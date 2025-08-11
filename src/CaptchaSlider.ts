import * as sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import cv from 'opencv4nodejs';
import { setTimeout as delay } from 'timers/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export interface MatchResult {
  location: cv.Point2;
  confidence: number;
  distance: number;
  distanceRatio: number;
}

export interface CaptchaSliderOptions {
  tmpDir?: string;
  defaultBrowserWidth?: number;
  defaultBrowserHeight?: number;
  retry?: { attempts?: number; delayMs?: number };
}

export class CaptchaSlider {
  private readonly tmpDir: string;
  private readonly defaultBrowserWidth: number;
  private readonly defaultBrowserHeight: number;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;

  constructor(options: CaptchaSliderOptions = {}) {
    this.tmpDir = options.tmpDir ?? path.join(process.cwd(), 'tmp');
    this.defaultBrowserWidth = options.defaultBrowserWidth ?? 340;
    this.defaultBrowserHeight = options.defaultBrowserHeight ?? 212;
    this.retryAttempts = options.retry?.attempts ?? 3;
    this.retryDelayMs = options.retry?.delayMs ?? 1000;
    this.ensureTmpDir();
  }

  // 公共API：裁剪背景图
  async cropBackgroundImage(
    bgPath: string,
    top: number,
    cropHeight: number,
    outputPath?: string,
    browserWidth: number = this.defaultBrowserWidth,
    browserHeight: number = this.defaultBrowserHeight
  ): Promise<string> {
    if (!fs.existsSync(bgPath)) {
      throw new Error(`背景图片不存在: ${bgPath}`);
    }

    const sharpModule = (sharp as any).default || sharp;
    const image = sharpModule(bgPath);
    if (!image) throw new Error('Sharp 实例创建失败');

    const metadata = await image.metadata();
    const actualWidth = metadata.width || 0;
    const actualHeight = metadata.height || 0;
    if (actualWidth === 0 || actualHeight === 0) {
      throw new Error(`无法获取图片尺寸: ${actualWidth}x${actualHeight}`);
    }

    const scaleY = actualHeight / browserHeight;
    const actualTop = Math.round(top * scaleY);
    const actualCropHeight = Math.round(cropHeight * scaleY);

    if (actualTop < 0 || actualTop + actualCropHeight > actualHeight) {
      throw new Error(`裁剪区域超出图片范围: top=${actualTop}, height=${actualCropHeight}, 图片高度=${actualHeight}`);
    }

    const outPath = this.resolveOutputPath(
      outputPath,
      this.generateCroppedFilename(bgPath, top, cropHeight)
    );

    await image
      .extract({ left: 0, top: actualTop, width: actualWidth, height: actualCropHeight })
      .toFile(outPath);

    return outPath;
  }

  // 公共API：模板匹配
  async matchSliderWithBackground(
    bgPath: string,
    slidePath: string,
    outputPath?: string
  ): Promise<MatchResult> {
    if (!fs.existsSync(bgPath)) {
      throw new Error(`背景图片不存在: ${bgPath}`);
    }
    if (!fs.existsSync(slidePath)) {
      throw new Error(`滑块图片不存在: ${slidePath}`);
    }

    const matObjects: cv.Mat[] = [];
    try {
      const bgMat = await this.withRetry(() => cv.imreadAsync(bgPath));
      const slideMat = await this.withRetry(() => cv.imreadAsync(slidePath));
      matObjects.push(bgMat, slideMat);

      if ((bgMat as any).empty || (slideMat as any).empty) {
        throw new Error('图片加载失败，请检查文件格式和完整性');
      }

      const bgGray = (bgMat as any).cvtColor(cv.COLOR_BGR2GRAY);
      const slideGray = (slideMat as any).cvtColor(cv.COLOR_BGR2GRAY);
      matObjects.push(bgGray, slideGray);

      const bgBlurred = (bgGray as any).gaussianBlur(new cv.Size(5, 5), 0);
      const slideBlurred = (slideGray as any).gaussianBlur(new cv.Size(5, 5), 0);
      matObjects.push(bgBlurred, slideBlurred);

      const bgEdges = (bgBlurred as any).canny(30, 100);
      const slideEdges = (slideBlurred as any).canny(30, 100);
      matObjects.push(bgEdges, slideEdges);

      const bgEdgesRGB = (bgEdges as any).cvtColor(cv.COLOR_GRAY2RGB);
      const slideEdgesRGB = (slideEdges as any).cvtColor(cv.COLOR_GRAY2RGB);
      matObjects.push(bgEdgesRGB, slideEdgesRGB);

      const result = (bgEdgesRGB as any).matchTemplate(slideEdgesRGB, cv.TM_CCORR_NORMED);
      matObjects.push(result);

      const minMax = (result as any).minMaxLoc();
      const maxLoc = minMax.maxLoc as cv.Point2;
      const maxVal = minMax.maxVal as number;

      const distanceRatio = (maxLoc.x as number) / (bgGray as any).cols;

      const resultMat = (bgMat as any).copy();
      matObjects.push(resultMat);

      const rect = new (cv as any).Rect(maxLoc.x, maxLoc.y, (slideMat as any).cols, (slideMat as any).rows);
      (resultMat as any).drawRectangle(rect, new (cv as any).Vec3(0, 255, 0), 2);
      (resultMat as any).putText(
        `Confidence: ${maxVal.toFixed(4)}`,
        new (cv as any).Point2(10, 30),
        (cv as any).FONT_HERSHEY_SIMPLEX,
        0.8,
        new (cv as any).Vec3(0, 255, 0),
        2
      );
      (resultMat as any).putText(
        `Position: (${maxLoc.x}, ${maxLoc.y})`,
        new (cv as any).Point2(10, 60),
        (cv as any).FONT_HERSHEY_SIMPLEX,
        0.8,
        new (cv as any).Vec3(0, 255, 0),
        2
      );
      (resultMat as any).putText(
        `Distance Ratio: ${distanceRatio.toFixed(4)}`,
        new (cv as any).Point2(10, 90),
        (cv as any).FONT_HERSHEY_SIMPLEX,
        0.8,
        new (cv as any).Vec3(0, 255, 0),
        2
      );

      const outPath = this.resolveOutputPath(
        outputPath,
        this.generateMatchFilename(bgPath)
      );
      await this.withRetry(() => (cv as any).imwriteAsync(outPath, resultMat));

      return { location: maxLoc, confidence: maxVal, distance: maxLoc.x as number, distanceRatio };
    } finally {
      matObjects.forEach((mat) => {
        try {
          if (mat && !(mat as any).empty && typeof (mat as any).release === 'function') {
            (mat as any).release();
          }
        } catch {
          // ignore release errors in cleanup
        }
      });
    }
  }

  // 公共API：仅返回距离比例
  async getSlideDistance(bgPath: string, slidePath: string): Promise<number> {
    const result = await this.matchSliderWithBackground(bgPath, slidePath);
    return result.distanceRatio;
  }

  // 公共API：通过URL获取浏览器中的x轴偏移
  async getSliderOffsetFromUrls(
    bgUrl: string,
    slideUrl: string,
    top: number,
    cropHeight: number,
    browserWidth: number = this.defaultBrowserWidth,
    browserHeight: number = this.defaultBrowserHeight
  ): Promise<number> {
    let bgPath: string | undefined;
    let slidePath: string | undefined;
    try {
      const ts = Date.now();
      bgPath = await this.downloadImage(bgUrl, `bg_${ts}.jpg`);
      slidePath = await this.downloadImage(slideUrl, `slide_${ts}.png`);

      const croppedPath = await this.cropBackgroundImage(bgPath, top, cropHeight, undefined, browserWidth, browserHeight);
      const matchResult = await this.matchSliderWithBackground(croppedPath, slidePath);

      const sharpModule = (sharp as any).default || sharp;
      const croppedImage = sharpModule(croppedPath);
      const metadata = await croppedImage.metadata();
      const croppedWidth = metadata.width || 0;

      const browserOffsetX = Math.round(((matchResult.location.x as number) / croppedWidth) * browserWidth);
      return browserOffsetX;
    } finally {
      // 可选：保留文件用于调试
      void bgPath;
      void slidePath;
    }
  }

  // 工具：下载图片（支持http/https、本地路径、file://）
  private async downloadImage(url: string, filename?: string): Promise<string> {
    this.ensureTmpDir();

    // file:// 协议
    if (url.startsWith('file://')) {
      const localPath = url.replace('file://', '');
      return this.copyLocalFile(localPath, filename);
    }

    // 本地路径
    if (fs.existsSync(url)) {
      return this.copyLocalFile(url, filename);
    }

    // 网络URL
    const response = await fetch(url as any);
    if (!(response as any).ok) {
      throw new Error(`下载失败: ${(response as any).status} ${(response as any).statusText}`);
    }

    const finalName = filename ?? this.filenameFromUrl(url) ?? `temp_${Date.now()}.jpg`;
    const filePath = path.join(this.tmpDir, finalName);
    const fileStream = createWriteStream(filePath);
    await pipeline((response as any).body, fileStream as any);
    return filePath;
  }

  private copyLocalFile(localPath: string, filename?: string): Promise<string> {
    const finalName = filename ?? (path.basename(localPath) || `temp_${Date.now()}.jpg`);
    const destPath = path.join(this.tmpDir, finalName);
    fs.copyFileSync(localPath, destPath);
    return Promise.resolve(destPath);
  }

  private filenameFromUrl(url: string): string | undefined {
    try {
      const parts = url.split('/');
      return parts[parts.length - 1] || undefined;
    } catch {
      return undefined;
    }
  }

  private resolveOutputPath(outputPath: string | undefined, autoFileName: string): string {
    this.ensureTmpDir();
    if (!outputPath) return path.join(this.tmpDir, autoFileName);
    if (path.isAbsolute(outputPath)) return outputPath;
    return path.join(this.tmpDir, outputPath);
  }

  private generateCroppedFilename(bgPath: string, top: number, cropHeight: number): string {
    const ext = path.extname(bgPath);
    const base = path.basename(bgPath, ext);
    const ts = Date.now();
    return `${base}_cropped_${top}_${cropHeight}_${ts}${ext}`;
    }

  private generateMatchFilename(bgPath: string): string {
    const ext = path.extname(bgPath);
    const base = path.basename(bgPath, ext);
    const ts = Date.now();
    return `match_result_${base}_${ts}${ext}`;
  }

  private ensureTmpDir() {
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; i < this.retryAttempts; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === this.retryAttempts - 1) throw error;
        await delay(this.retryDelayMs);
      }
    }
    throw new Error('重试次数耗尽');
  }

  /**
   * 生成模拟人类的滑块拖动轨迹
   * @param distance 目标距离
   * @returns 拖动轨迹数组，每个元素为 {x, y, t}
   */
  generateHumanTrack(distance: number): Array<{x: number, y: number, t: number}> {
    const track = [];
    let current = 0;
    let t = 0;
    let v = 0;
    const dt = 16; // ms
    const mid = distance * 0.7;
    while (current < distance) {
      let a = current < mid ? 2 : -3;
      v += a * (dt / 1000);
      if (v < 1) v = 1 + Math.random();
      let move = v + Math.random() * 0.5;
      if (current + move > distance) move = distance - current;
      current += move;
      t += dt;
      track.push({ x: Math.round(current), y: Math.round(Math.random() * 2 - 1), t });
    }
    // 补充微调和抖动
    for (let i = 0; i < 3; i++) {
      t += dt;
      track.push({ x: distance + Math.random() * 2 - 1, y: Math.random() * 2 - 1, t });
    }
    return track;
  }

  /**
   * Playwright 集成拖动滑块验证码
   * @param page Playwright Page
   * @param sliderSelector 滑块按钮选择器
   * @param distance 拖动距离
   * @param track 拖动轨迹
   */
  async dragSliderWithTrack(page: any, sliderSelector: string, distance: number, track: Array<{x: number, y: number, t: number}>) {
    if (!Array.isArray(track)) {
      throw new Error('track 必须是有效的轨迹数组');
    }
    const slider = await page.locator('iframe').contentFrame().locator(sliderSelector);
    const box = await slider.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (const point of track) {
      await page.mouse.move(startX + point.x, startY + point.y, { steps: 2 });
      await page.waitForTimeout(10 + Math.random() * 10);
    }
    await page.mouse.up();
  }
}


