import { Page } from 'playwright-core';
import { CaptchaSlider } from './CaptchaSlider.js';

export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface LoginOptions {
  maxRetries?: number;
  timeout?: number;
  mainUrl?: string;
}

export class JuejinLoginer {
  private readonly credentials: LoginCredentials;
  private readonly options: Required<LoginOptions>;
  private readonly captchaSlider: CaptchaSlider;
  page: Page;

  constructor(page:Page,credentials: LoginCredentials, options: LoginOptions = {}) {
    this.credentials = credentials;
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      timeout: options.timeout ?? 60000,
      mainUrl: options.mainUrl ?? 'https://juejin.cn/'
    };
    this.captchaSlider = new CaptchaSlider();
    this.page = page;
  }

  /**
   * 处理滑块验证码
   * @param page Playwright页面对象
   * @returns 是否处理成功
   */
  async handleSliderCaptcha(page: Page): Promise<boolean> {
    try {
      // 等待验证码图片出现
      await this.page.locator('iframe').contentFrame().locator('img#captcha_verify_image').waitFor({ timeout: this.options.timeout });
      await this.page.locator('iframe').contentFrame().locator('img#captcha-verify_img_slide').waitFor({ timeout: this.options.timeout });

      // 获取图片 URL
      const captchaVerifyImage = await this.page.locator('iframe').contentFrame().locator('img#captcha_verify_image');

      // 等待图片加载的网络请求
      let bgUrl: string | null = null;
      const maxAttempts = 30; // 最大尝试次数（约30秒）
      for (let i = 0; i < maxAttempts; i++) {
        bgUrl = await captchaVerifyImage.getAttribute('src');
        if (bgUrl && bgUrl !== '') {
          break;
        }
        await this.page.waitForTimeout(1000); // 等待 1 秒
      }

      if (!bgUrl) {
        throw new Error('Img src 属性未能在规定时间内获取到值');
      }

      const puzzleUrl = await this.page.locator('iframe').contentFrame().locator('img#captcha-verify_img_slide').getAttribute('src');

      console.log('背景图片 URL:', bgUrl);
      console.log('滑块图片 URL:', puzzleUrl);
      
      await this.page.locator('iframe').contentFrame().locator('div.dragger-box').first().waitFor({
        timeout: this.options.timeout,
        state: 'attached'
      });
      const draggerBox = await this.page.locator('iframe').contentFrame().locator('div.dragger-box').first();

      // 获取滑块的top值
      const topValue = await draggerBox?.evaluate((element) => element.style.top);
      await this.page.locator('iframe').contentFrame().locator('#vc_captcha_box').waitFor({ timeout: 6000 });
      const vcCaptchaBoxWrapper = await this.page.locator('iframe').contentFrame().locator('#vc_captcha_box');
      const fontSizeValue = await vcCaptchaBoxWrapper?.evaluate((element) => element.style.fontSize);
      console.log('fontSizeValue 数值2:', fontSizeValue);

      const numericTop = parseFloat(topValue!); // 提取数值，如 1.1579710144927535
      const fontSize = parseFloat(fontSizeValue!); // 提取数值，如 1.1579710144927535
      console.log('Top 数值:', numericTop);
      console.log('Font Size 数值:', fontSize);
      const top = numericTop * fontSize;
      console.log('Top 数值:', top);

      // 识别缺口
      const offset = await this.captchaSlider.getSliderOffsetFromUrls(bgUrl!, puzzleUrl!, top, 68, 340, 212);
      console.log('识别到的缺口位置:', offset);

      // 生成轨迹
      const track = this.captchaSlider.generateHumanTrack(offset);

      // 拖动滑块
      await this.captchaSlider.dragSliderWithTrack(page, '#captcha-verify_img_slide', offset, track);

      return true;
    } catch (error) {
      console.error('处理滑块验证码失败:', error);
      return false;
    }
  }

  /**
   * 执行登录流程
   * @param page Playwright页面对象
   * @returns 是否登录成功
   */
  async login(page: Page): Promise<boolean> {
    try {
      // 打开掘金登录页
      await this.page.goto('https://juejin.cn/login');
      
      // 点击密码登录
      await this.page.getByText('密码登录').click();
      
      // 输入手机号
      await this.page.getByRole('textbox', { name: '请输入邮箱/手机号（国际号码加区号）' }).fill(this.credentials.phone);
      
      // 输入密码
      await this.page.getByRole('textbox', { name: '请输入密码' }).fill(this.credentials.password);
      
      // 点击登录
      await this.page.click('button:has-text("登录")');
      
      // 处理滑块验证码
      const captchaSuccess = await this.handleSliderCaptcha(page);
      if (!captchaSuccess) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  }

  /**
   * 带重试的登录流程
   * @param page Playwright页面对象
   * @returns 是否登录成功
   */
  async loginWithRetry(page: Page): Promise<boolean> {
    let attempt = 0;
    while (attempt < this.options.maxRetries) {
      try {
        console.log(`尝试登录，第 ${attempt + 1} 次`);
        
        const loginSuccess = await this.login(page);
        if (!loginSuccess) {
          throw new Error('登录流程失败');
        }

        // 等待跳转到主页面
        await this.page.waitForURL(this.options.mainUrl, { timeout: 10000 });
        console.log('成功跳转到:', this.options.mainUrl);
        return true;
      } catch (error) {
        console.log('登录失败:', (error as Error).message);
        attempt++;
        if (attempt === this.options.maxRetries) {
          throw new Error('达到最大重试次数，登录失败');
        }
        // 等待一段时间后重试
        await this.page.waitForTimeout(2000);
      }
    }
    return false;
  }

  /**
   * 检查是否已登录
   * @param page Playwright页面对象
   * @returns 是否已登录
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.goto(this.options.mainUrl);
      // 检查是否存在登录相关的元素
      const loginButton = await page.locator('text=登录').count();
      return loginButton === 0;
    } catch (error) {
      console.error('检查登录状态失败:', error);
      return false;
    }
  }
}
