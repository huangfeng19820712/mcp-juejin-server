import * as sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import cv from 'opencv4nodejs';
import { setTimeout } from 'timers/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

/**
 * 重试机制
 */
async function withRetry<T>(fn: () => Promise<T>, retries: number = 3, delayMs: number = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`操作失败，重试 ${i + 1}/${retries}:`, error);
      await setTimeout(delayMs);
    }
  }
  throw new Error('重试次数耗尽');
}

/**
 * 下载图片到本地临时文件
 * @param url 图片URL或本地文件路径
 * @param filename 文件名（可选）
 * @returns 本地文件路径
 */
async function downloadImage(url: string, filename?: string): Promise<string> {
  try {
    // 检查是否是本地文件路径
    if (url.startsWith('file://')) {
      // 处理file://协议
      const filePath = url.replace('file://', '');
      if (fs.existsSync(filePath)) {
        // 生成临时文件名
        if (!filename) {
          const urlParts = filePath.split('/');
          filename = urlParts[urlParts.length - 1] || `temp_${Date.now()}.jpg`;
        }

        // 确保tmp目录存在
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }

        const destPath = path.join(tmpDir, filename);
        
        // 复制文件
        fs.copyFileSync(filePath, destPath);
        console.log(`图片已复制到: ${destPath}`);
        return destPath;
      } else {
        throw new Error(`本地文件不存在: ${filePath}`);
      }
    } else if (fs.existsSync(url)) {
      // 直接是本地文件路径
      // 生成临时文件名
      if (!filename) {
        const urlParts = url.split('/');
        filename = urlParts[urlParts.length - 1] || `temp_${Date.now()}.jpg`;
      }

      // 确保tmp目录存在
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const destPath = path.join(tmpDir, filename);
      
      // 复制文件
      fs.copyFileSync(url, destPath);
      console.log(`图片已复制到: ${destPath}`);
      return destPath;
    } else {
      // 网络URL，使用fetch下载
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      // 生成临时文件名
      if (!filename) {
        const urlParts = url.split('/');
        filename = urlParts[urlParts.length - 1] || `temp_${Date.now()}.jpg`;
      }

      // 确保tmp目录存在
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const filePath = path.join(tmpDir, filename);
      
      // 将响应流写入文件
      const fileStream = createWriteStream(filePath);
      await pipeline(response.body as any, fileStream);
      
      console.log(`图片已下载到: ${filePath}`);
      return filePath;
    }
  } catch (error) {
    console.error('下载图片失败:', error);
    throw error;
  }
}

/**
 * 通过URL获取滑块在浏览器中的x轴偏移位置
 * @param bgUrl 背景图片URL
 * @param slideUrl 滑块图片URL
 * @param top 裁剪起始高度（像素，基于浏览器显示尺寸）
 * @param cropHeight 裁剪高度（像素，基于浏览器显示尺寸）
 * @param browserWidth 浏览器显示宽度（默认340）
 * @param browserHeight 浏览器显示高度（默认212）
 * @returns 浏览器中的x轴偏移位置（像素）
 */
export async function getSliderOffsetFromUrls(
  bgUrl: string,
  slideUrl: string,
  top: number,
  cropHeight: number,
  browserWidth: number = 340,
  browserHeight: number = 212
): Promise<number> {
  console.log('=== 通过URL获取滑块偏移位置 ===');
  console.log(`背景图片URL: ${bgUrl}`);
  console.log(`滑块图片URL: ${slideUrl}`);
  console.log(`裁剪参数: top=${top}, cropHeight=${cropHeight}, browserWidth=${browserWidth}, browserHeight=${browserHeight}`);

  let bgPath: string | undefined;
  let slidePath: string | undefined;

  try {
    // 1. 下载图片到./tmp目录
    console.log('\n1. 下载图片到./tmp目录...');
    const timestamp = Date.now();
    const bgFilename = `bg_${timestamp}.jpg`;
    const slideFilename = `slide_${timestamp}.png`;
    
    bgPath = await downloadImage(bgUrl, bgFilename);
    slidePath = await downloadImage(slideUrl, slideFilename);
    
    console.log(`背景图片已下载: ${bgPath}`);
    console.log(`滑块图片已下载: ${slidePath}`);

    // 2. 裁剪背景图片
    console.log('\n2. 裁剪背景图片...');
    const croppedPath = await cropBackgroundImage(
      bgPath,
      top,
      cropHeight,
      undefined,
      browserWidth,
      browserHeight
    );
    console.log(`裁剪完成: ${croppedPath}`);

    // 3. 进行模板匹配
    console.log('\n3. 进行模板匹配...');
    const matchResult = await matchSliderWithBackground(croppedPath, slidePath);
    console.log(`匹配结果: 位置=(${matchResult.location.x}, ${matchResult.location.y}), 置信度=${matchResult.confidence.toFixed(4)}`);

    // 4. 计算浏览器中的x轴偏移位置
    console.log('\n4. 计算浏览器偏移位置...');
    
    // 获取裁剪后图片的实际尺寸
    const sharpModule = sharp.default || sharp;
    const croppedImage = sharpModule(croppedPath);
    const metadata = await croppedImage.metadata();
    const croppedWidth = metadata.width || 0;
    const croppedHeight = metadata.height || 0;
    
    console.log(`裁剪后图片尺寸: ${croppedWidth}x${croppedHeight}`);
    console.log(`匹配位置: x=${matchResult.location.x}, y=${matchResult.location.y}`);
    
    // 计算浏览器中的偏移位置
    // 匹配位置是相对于裁剪后图片的，需要转换为浏览器坐标
    const browserOffsetX = Math.round((matchResult.location.x / croppedWidth) * browserWidth);
    
    console.log(`浏览器偏移位置: ${browserOffsetX}px`);
    console.log('=== 计算完成 ===');
    
    return browserOffsetX;

  } catch (error) {
    console.error('获取滑块偏移位置失败:', error);
    throw error;
  } finally {
    // 清理临时文件（可选，根据需要决定是否删除）
    try {
      if (bgPath && fs.existsSync(bgPath)) {
        // 可以选择保留文件用于调试，或者删除
        // fs.unlinkSync(bgPath);
        console.log(`临时文件保留: ${bgPath}`);
      }
      if (slidePath && fs.existsSync(slidePath)) {
        // fs.unlinkSync(slidePath);
        console.log(`临时文件保留: ${slidePath}`);
      }
    } catch (cleanupError) {
      console.warn('清理临时文件失败:', cleanupError);
    }
  }
}

/**
 * 裁剪背景图片
 * @param bgPath 背景图片路径
 * @param top 裁剪起始高度（像素，基于浏览器显示尺寸）
 * @param cropHeight 裁剪高度（像素，基于浏览器显示尺寸）
 * @param outputPath 输出图片路径（可选，不传则自动生成）
 * @param browserWidth 浏览器显示宽度（默认340）
 * @param browserHeight 浏览器显示高度（默认212）
 * @returns 输出图片路径
 */
export async function cropBackgroundImage(
  bgPath: string,
  top: number,
  cropHeight: number,
  outputPath?: string,
  browserWidth: number = 340,
  browserHeight: number = 212
): Promise<string> {
  if (!fs.existsSync(bgPath)) {
    throw new Error(`背景图片不存在: ${bgPath}`);
  }

  console.log('Sharp 模块:', typeof sharp);
  console.log('Sharp 默认导出:', sharp.default);
  console.log('正在处理图片:', bgPath);

  try {
    // 尝试不同的导入方式
    const sharpModule = sharp.default || sharp;
    console.log('使用的 Sharp 模块:', typeof sharpModule);
    
    const image = sharpModule(bgPath);
    console.log('Sharp 实例:', typeof image);
    
    if (!image) {
      throw new Error('Sharp 实例创建失败');
    }

    const metadata = await image.metadata();
    console.log('图片元数据:', metadata);
    
    const actualWidth = metadata.width || 0;
    const actualHeight = metadata.height || 0;

    if (actualWidth === 0 || actualHeight === 0) {
      throw new Error(`无法获取图片尺寸: ${actualWidth}x${actualHeight}`);
    }

    // 计算缩放比例
    const scaleX = actualWidth / browserWidth;
    const scaleY = actualHeight / browserHeight;

    // 将浏览器坐标转换为实际图片坐标
    const actualTop = Math.round(top * scaleY);
    const actualCropHeight = Math.round(cropHeight * scaleY);

    console.log(`浏览器尺寸: ${browserWidth}x${browserHeight}`);
    console.log(`实际图片尺寸: ${actualWidth}x${actualHeight}`);
    console.log(`缩放比例: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);
    console.log(`浏览器坐标: top=${top}, height=${cropHeight}`);
    console.log(`实际坐标: top=${actualTop}, height=${actualCropHeight}`);

    // 验证裁剪区域是否在图片范围内
    if (actualTop < 0 || actualTop + actualCropHeight > actualHeight) {
      throw new Error(`裁剪区域超出图片范围: top=${actualTop}, height=${actualCropHeight}, 图片高度=${actualHeight}`);
    }

    if (!outputPath) {
      // 确保tmp目录存在
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const ext = path.extname(bgPath);
      const base = path.basename(bgPath, ext);
      const timestamp = Date.now();
      outputPath = path.join(
        tmpDir,
        `${base}_cropped_${top}_${cropHeight}_${timestamp}${ext}`
      );
    } else {
      // 如果指定了输出路径，但路径不是绝对路径，则也保存到tmp目录
      if (!path.isAbsolute(outputPath)) {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        outputPath = path.join(tmpDir, outputPath);
      }
    }

    console.log('开始裁剪，输出路径:', outputPath);
    
    await image.extract({ 
      left: 0, 
      top: actualTop, 
      width: actualWidth, 
      height: actualCropHeight 
    }).toFile(outputPath);

    console.log('裁剪完成');
    return outputPath;
    
  } catch (error) {
    console.error('Sharp 处理错误:', error);
    throw error;
  }
}

/**
 * 模板匹配结果接口
 */
interface MatchResult {
  location: cv.Point2;
  confidence: number;
  distance: number;
  distanceRatio: number;
}

/**
 * 使用OpenCV进行模板匹配，查找滑块在背景图中的位置
 * @param bgPath 背景图片路径（裁剪后的）
 * @param slidePath 滑块图片路径
 * @param outputPath 结果图片输出路径（可选）
 * @returns 匹配结果，包含位置、置信度、距离和距离比例
 */
export async function matchSliderWithBackground(
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

  console.log('开始模板匹配...');
  console.log('背景图片:', bgPath);
  console.log('滑块图片:', slidePath);

  const matObjects: cv.Mat[] = [];
  
  try {
    // 读取图片
    const bgMat = await withRetry(() => cv.imreadAsync(bgPath));
    const slideMat = await withRetry(() => cv.imreadAsync(slidePath));
    matObjects.push(bgMat, slideMat);

    if (bgMat.empty || slideMat.empty) {
      throw new Error('图片加载失败，请检查文件格式和完整性');
    }

    console.log(`背景图片尺寸: ${bgMat.cols}x${bgMat.rows}`);
    console.log(`滑块图片尺寸: ${slideMat.cols}x${slideMat.rows}`);

    // 转换为灰度图
    const bgGray = bgMat.cvtColor(cv.COLOR_BGR2GRAY);
    const slideGray = slideMat.cvtColor(cv.COLOR_BGR2GRAY);
    matObjects.push(bgGray, slideGray);

    // 高斯模糊处理
    const bgBlurred = bgGray.gaussianBlur(new cv.Size(5, 5), 0);
    const slideBlurred = slideGray.gaussianBlur(new cv.Size(5, 5), 0);
    matObjects.push(bgBlurred, slideBlurred);

    // Canny边缘检测
    const bgEdges = bgBlurred.canny(30, 100);
    const slideEdges = slideBlurred.canny(30, 100);
    matObjects.push(bgEdges, slideEdges);

    // 转换为RGB格式用于模板匹配
    const bgEdgesRGB = bgEdges.cvtColor(cv.COLOR_GRAY2RGB);
    const slideEdgesRGB = slideEdges.cvtColor(cv.COLOR_GRAY2RGB);
    matObjects.push(bgEdgesRGB, slideEdgesRGB);

    // 模板匹配
    const result = bgEdgesRGB.matchTemplate(slideEdgesRGB, cv.TM_CCORR_NORMED);
    matObjects.push(result);

    // 获取最佳匹配位置
    const minMax = result.minMaxLoc();
    const maxLoc = minMax.maxLoc;
    const maxVal = minMax.maxVal;

    console.log(`匹配结果: 置信度=${maxVal.toFixed(4)}, 位置=(${maxLoc.x}, ${maxLoc.y})`);

    // 计算距离比例（位置/图片宽度）
    const distanceRatio = maxLoc.x / bgGray.cols;

    // 绘制匹配结果
    const resultMat = bgMat.copy();
    matObjects.push(resultMat);
    
    // 绘制矩形框
    const rect = new cv.Rect(maxLoc.x, maxLoc.y, slideMat.cols, slideMat.rows);
    resultMat.drawRectangle(rect, new cv.Vec3(0, 255, 0), 2);
    
    // 添加文本信息
    resultMat.putText(
      `Confidence: ${maxVal.toFixed(4)}`, 
      new cv.Point2(10, 30), 
      cv.FONT_HERSHEY_SIMPLEX, 
      0.8, 
      new cv.Vec3(0, 255, 0), 
      2
    );
    resultMat.putText(
      `Position: (${maxLoc.x}, ${maxLoc.y})`, 
      new cv.Point2(10, 60), 
      cv.FONT_HERSHEY_SIMPLEX, 
      0.8, 
      new cv.Vec3(0, 255, 0), 
      2
    );
    resultMat.putText(
      `Distance Ratio: ${distanceRatio.toFixed(4)}`, 
      new cv.Point2(10, 90), 
      cv.FONT_HERSHEY_SIMPLEX, 
      0.8, 
      new cv.Vec3(0, 255, 0), 
      2
    );

    // 保存结果图片
    if (outputPath) {
      // 如果指定了输出路径，但路径不是绝对路径，则也保存到tmp目录
      if (!path.isAbsolute(outputPath)) {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const finalOutputPath = path.join(tmpDir, outputPath);
        await withRetry(() => cv.imwriteAsync(finalOutputPath, resultMat));
        console.log(`匹配结果已保存至: ${finalOutputPath}`);
      } else {
        await withRetry(() => cv.imwriteAsync(outputPath, resultMat));
        console.log(`匹配结果已保存至: ${outputPath}`);
      }
    } else {
      // 自动生成输出路径到tmp目录
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const ext = path.extname(bgPath);
      const base = path.basename(bgPath, ext);
      const timestamp = Date.now();
      const autoOutputPath = path.join(
        tmpDir,
        `match_result_${base}_${timestamp}${ext}`
      );
      await withRetry(() => cv.imwriteAsync(autoOutputPath, resultMat));
      console.log(`匹配结果已保存至: ${autoOutputPath}`);
    }

    return {
      location: maxLoc,
      confidence: maxVal,
      distance: maxLoc.x,
      distanceRatio: distanceRatio
    };

  } catch (error) {
    console.error('模板匹配失败:', error);
    throw error;
  } finally {
    // 释放所有Mat对象
    matObjects.forEach((mat, index) => {
      try {
        if (mat && !mat.empty) mat.release();
      } catch (e) {
        console.warn(`释放Mat对象${index}失败:`, e);
      }
    });
  }
}

/**
 * 获取滑块距离（位置比例）
 * @param bgPath 背景图片路径
 * @param slidePath 滑块图片路径
 * @returns 位置比例（位置/图片宽度）
 */
export async function getSlideDistance(bgPath: string, slidePath: string): Promise<number> {
  const result = await matchSliderWithBackground(bgPath, slidePath);
  return result.distanceRatio;
}

// CLI usage example: node src/crop_background.ts <bgPath> <top> <cropHeight> [outputPath] [browserWidth] [browserHeight]
// 检查是否直接运行（通过检查参数数量）
const isDirectRun = process.argv.length > 2 && (
  process.argv[1].includes('crop_background.ts') || 
  process.argv[1].includes('crop_background.js') ||
  process.argv[1].endsWith('node')
);
if (isDirectRun) {
  const [,, firstArg, ...restArgs] = process.argv;
  
  // 检查第一个参数是否是命令
  if (firstArg === 'match' || firstArg === 'm') {
    // 模板匹配模式: node src/crop_background.ts match <bgPath> <slidePath> [outputPath]
    const [bgPath, slidePath, outputPath] = restArgs;
    if (!bgPath || !slidePath) {
      console.log('模板匹配用法: node src/crop_background.ts match <bgPath> <slidePath> [outputPath]');
      console.log('示例: node src/crop_background.ts match bg_cropped.jpg slide.png result.jpg');
      process.exit(1);
    }
    
    matchSliderWithBackground(bgPath, slidePath, outputPath)
      .then(result => {
        console.log('模板匹配完成:');
        console.log(`  位置: (${result.location.x}, ${result.location.y})`);
        console.log(`  置信度: ${result.confidence.toFixed(4)}`);
        console.log(`  距离: ${result.distance}px`);
        console.log(`  距离比例: ${result.distanceRatio.toFixed(4)}`);
      })
      .catch(err => {
        console.error('模板匹配失败:', err);
        process.exit(1);
      });
  } else if (firstArg === 'distance' || firstArg === 'd') {
    // 获取距离比例模式: node src/crop_background.ts distance <bgPath> <slidePath>
    const [bgPath, slidePath] = restArgs;
    if (!bgPath || !slidePath) {
      console.log('获取距离比例用法: node src/crop_background.ts distance <bgPath> <slidePath>');
      console.log('示例: node src/crop_background.ts distance bg_cropped.jpg slide.png');
      process.exit(1);
    }
    
    getSlideDistance(bgPath, slidePath)
      .then(distanceRatio => {
        console.log(`距离比例: ${distanceRatio.toFixed(4)}`);
      })
      .catch(err => {
        console.error('获取距离比例失败:', err);
        process.exit(1);
      });
  } else if (firstArg === 'offset' || firstArg === 'o') {
    // 通过URL获取偏移位置模式: node src/crop_background.ts offset <bgUrl> <slideUrl> <top> <cropHeight> [browserWidth] [browserHeight]
    const [bgUrl, slideUrl, topStr, cropHeightStr, browserWidthStr, browserHeightStr] = restArgs;
    if (!bgUrl || !slideUrl || !topStr || !cropHeightStr) {
      console.log('获取偏移位置用法: node src/crop_background.ts offset <bgUrl> <slideUrl> <top> <cropHeight> [browserWidth] [browserHeight]');
      console.log('示例: node src/crop_background.ts offset https://example.com/bg.jpg https://example.com/slide.png 104 68 340 212');
      process.exit(1);
    }
    
    const browserWidth = browserWidthStr ? parseInt(browserWidthStr, 10) : 340;
    const browserHeight = browserHeightStr ? parseInt(browserHeightStr, 10) : 212;
    
    getSliderOffsetFromUrls(bgUrl, slideUrl, parseInt(topStr, 10), parseInt(cropHeightStr, 10), browserWidth, browserHeight)
      .then(offsetX => {
        console.log(`浏览器x轴偏移位置: ${offsetX}px`);
      })
      .catch(err => {
        console.error('获取偏移位置失败:', err);
        process.exit(1);
      });
  } else {
    // 裁剪模式: node src/crop_background.ts <bgPath> <top> <cropHeight> [outputPath] [browserWidth] [browserHeight]
    const [bgPath, topStr, cropHeightStr, outputPath, browserWidthStr, browserHeightStr] = [firstArg, ...restArgs];
    if (!bgPath || !topStr || !cropHeightStr) {
      console.log('用法:');
      console.log('  裁剪模式: node src/crop_background.ts <bgPath> <top> <cropHeight> [outputPath] [browserWidth] [browserHeight]');
      console.log('  模板匹配: node src/crop_background.ts match <bgPath> <slidePath> [outputPath]');
      console.log('  获取距离: node src/crop_background.ts distance <bgPath> <slidePath>');
      console.log('  获取偏移: node src/crop_background.ts offset <bgUrl> <slideUrl> <top> <cropHeight> [browserWidth] [browserHeight]');
      console.log('');
      console.log('示例:');
      console.log('  node src/crop_background.ts bg.jpg 50 100 output.jpg 340 212');
      console.log('  node src/crop_background.ts match bg_cropped.jpg slide.png result.jpg');
      console.log('  node src/crop_background.ts distance bg_cropped.jpg slide.png');
      console.log('  node src/crop_background.ts offset https://example.com/bg.jpg https://example.com/slide.png 104 68 340 212');
      process.exit(1);
    }
    
    const browserWidth = browserWidthStr ? parseInt(browserWidthStr, 10) : 340;
    const browserHeight = browserHeightStr ? parseInt(browserHeightStr, 10) : 212;
    
    cropBackgroundImage(
      bgPath, 
      parseInt(topStr, 10), 
      parseInt(cropHeightStr, 10), 
      outputPath,
      browserWidth,
      browserHeight
    )
      .then(out => {
        console.log('裁剪完成，输出文件:', out);
      })
      .catch(err => {
        console.error('裁剪失败:', err);
        process.exit(1);
      });
  }
}