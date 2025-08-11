import { chromium, Browser, Page, BrowserContext,FileChooser } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import { pino } from 'pino';
import { MarkdownParser } from './MarkdownParser.js';
import { ArticleMetadata, PublishOptions } from './types.js';
import { exec } from 'child_process';
import {JuejinLoginer} from './JuejinLoginer.js';

const rootDir = process.cwd();
dotenv.config({ path: join(rootDir, '.env') });
dotenv.config();
const USERNAME = process.env.JUEJIN_USERNAME || '';
const PASSWORD = process.env.JUEJIN_PASSWORD || '';

function createLogger() {
  if (process.platform === 'win32') {
    exec('chcp 65001'); // 设置Windows控制台为UTF-8编码
  }
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      }
    }
  });
}

export class JuejinPublisher {
  logger = createLogger();
  browser: Browser | null = null;
  context: BrowserContext | null = null;
  page: Page | null = null;
  filePath: string;
  options: PublishOptions;
  metadata: ArticleMetadata | null = null;
  images: any[] = [];
  content: string = '';

  constructor(filePath: string, options: PublishOptions = {}) {
    this.filePath = filePath;
    this.options = options;
  }

  async init() {
    this.browser = await chromium.launch({
      headless: !this.options.openBrowser,
      slowMo: 50,
      args: ['--start-maximized', '--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    const storedState = this.options.useStoredLogin ? await this.loadLoginState() : null;
    this.context = storedState
      ? await this.browser.newContext({ storageState: storedState, viewport: null })
      : await this.browser.newContext({ viewport: null });
    this.page = await this.context.newPage();
  }

  async parseMarkdown() {
    const { content, images } = await MarkdownParser.parseMarkdown(this.filePath);
    const { metadata, cleanContent } = MarkdownParser.extractMetadata(content);
    this.content = cleanContent;
    this.metadata = metadata;
    this.images = images;
  }

  async checkLoginStatus(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');
    const currentUrl = this.page.url();
    if (!currentUrl.includes('juejin.cn')) {
      await this.page.goto('https://juejin.cn', { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
    await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    const selectors = ['.avatar-wrapper'];
    for (const selector of selectors) {
      try {
        // 检查 .avatar-wrapper 元素是否存在，设置超时
        await this.page.locator(selector).waitFor({ state: 'visible', timeout: 6000 });
        console.log('检测到 .avatar-wrapper 元素，已登录。');
        return true;
      } catch (error) {
        console.log('未检测到 .avatar-wrapper 元素，未登录。');
        return false;
      }
    }
    return false;
  }

  async login() {
    if (!this.page || !this.context) throw new Error('Not initialized');
    this.logger.info('正在检查登录状态...');
    const isLoggedIn = await this.checkLoginStatus();
    if (isLoggedIn) {
      this.logger.info('✅ 已经登录掘金，无需重新登录');
      return;
    }
    this.logger.info('未登录，开始手动登录流程...');

    const loginer = new JuejinLoginer(this.page,{
      phone: USERNAME,
      password: PASSWORD
    }, {
      maxRetries: 3,
      timeout: 60000,
      mainUrl: 'https://juejin.cn/'
    });

    // 执行登录流程
    const loginSuccess = await loginer.loginWithRetry(this.page);

    const finalCheck = await this.checkLoginStatus();
    if (!finalCheck){
      throw new Error('登录流程完成，但最终检查登录状态失败');
    } else {
      this.saveLoginState();
      this.logger.info('✅ 登录成功');
    }
  }

  async saveLoginState() {
    if (!this.context) throw new Error('Context not initialized');
    const storageState = await this.context.storageState();
    const statePath = join(__dirname, '../juejin-storage-state.json');
    await fs.writeJSON(statePath, storageState);
    this.logger.info('💾 登录状态已保存，下次启动将自动登录');
  }

  async loadLoginState() {
    const statePath = join(__dirname, '../juejin-storage-state.json');
    if (await fs.pathExists(statePath)) {
      const state = await fs.readJSON(statePath);
      this.logger.info('📂 找到已保存的登录状态');
      return state;
    }
    return null;
  }

  async validateStoredLogin(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');
    const isLoggedIn = await this.checkLoginStatus();
    if (isLoggedIn) {
      this.logger.info('✅ 存储的登录状态有效');
      return true;
    } else {
      this.logger.info('❌ 存储的登录状态已失效，需要重新登录');
      return false;
    }
  }

  /**
   * 设置CodeMirror的值，内容
   * @param page
   * @param value
   */
  async setCodeMirrorValue(page:Page,value:string) {
    return page.evaluate((content) => {
      const cm = document.querySelector('.CodeMirror') as any;
      if (cm && cm.CodeMirror) {
        cm.CodeMirror.setValue(content);
      }
    }, value);
  }

  /**
   * 通过请求来判断上传图片是否成功，因为会有多个图片情况
   * @param page
   */
  async uploadImages(page:Page) {
    const targetUrl = 'https://api.juejin.cn/content_api/v1/article_draft/update';

    const response = await page.waitForResponse(async (resp) => {
      return resp.url().startsWith(targetUrl) && resp.status() === 200;
    }, { timeout: 10000 }); // 超时 10 秒

// 可选：解析返回的 JSON 看是否业务成功
    const data = await response.json();
    console.log('返回数据：', data);
// 根据返回内容判断业务是否成功
    if (data.err_no === 0) {
      console.log('草稿更新成功！');
      return true;
    } else {
      console.error('草稿更新失败：', data.err_msg);
      return false;
    }

  }
  async publish() {
    if (!this.page || !this.context) throw new Error('Not initialized');
    await this.parseMarkdown();
    // 登录逻辑
    if (this.options.forceLogin) {
      const statePath = join(__dirname, '../juejin-storage-state.json');
      if (await fs.pathExists(statePath)) {
        await fs.remove(statePath);
        this.logger.info('🗑️ 已删除旧的登录状态');
      }
      await this.login();
    } else {
      const storedState = await this.loadLoginState();
      if (storedState) {
        this.logger.info('🔑 使用已保存的登录状态...');
        const isValidLogin = await this.validateStoredLogin();
        if (!isValidLogin) {
          this.logger.info('🔄 存储的登录状态已失效，重新登录...');
          const statePath = join(__dirname, '../juejin-storage-state.json');
          if (await fs.pathExists(statePath)) {
            await fs.remove(statePath);
          }
          await this.login();
        }
      } else {
        this.logger.info('🔑 没有找到已保存的登录状态，开始登录...');
        await this.login();
      }
    }
    this.logger.info('📝 正在打开掘金编辑器...');

    // 1. 打开掘金编辑器
    await this.page.goto('https://juejin.cn/editor/drafts/new', { waitUntil: 'networkidle' });
    await this.page.waitForSelector('.CodeMirror-wrap', { timeout: 10000 });

    // 2. 解析测试文章（使用包含图片的测试文章）
    // const testArticlePath = join(__dirname, '../fixtures/test-article-with-images.md');
    const { content, images } = await MarkdownParser.parseMarkdown(this.filePath);
    const { metadata, cleanContent } = MarkdownParser.extractMetadata(content);

    console.log(`📖 解析文章: ${metadata.title}`);
    console.log(`🏷️ 分类: ${metadata.category}`);
    console.log(`🏷️ 标签: ${metadata.tags?.join(', ')}`);
    console.log(`🖼️ 发现图片数量: ${images.length}`);

    // 3. 填充标题
    await this.page.fill('.title-input', metadata.title || '测试文章');
    console.log('✅ 标题已填充');

    // 4. 上传本地图片到掘金
    let updatedContent = cleanContent;
    if (images.length > 0) {
      console.log(`\n🔄 开始上传 ${images.length} 张本地图片...`);


      // 等待 CodeMirror 编辑器加载
      await this.page.waitForSelector('.bytemd-toolbar-icon[bytemd-tippy-path="5"]');

      // 监听 file chooser 事件
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent('filechooser'),
        // 点击上传图片的图标,获取第一个元素
        this.page.locator('.bytemd-toolbar-icon[bytemd-tippy-path="5"]').nth(0).click() // 触发弹出文件选择框
      ]) as [FileChooser, void];

      // 等待文件选择输入框出现.
      // const fileInput = await page.waitForSelector('.file-input', { state: 'attached' });
      let imagePaths:string[] = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        imagePaths.push(image.path);
      }
      // 设置要上传的文件
      await fileChooser.setFiles(imagePaths);
      // await fileInput.setInputFiles(imagePaths);

      // 可选：等待编辑器内容更新（例如，图片的 Markdown 链接插入）
      // await page.waitForTimeout(10000); // 根据实际加载时间调整
      await this.uploadImages(this.page);
      // 可选：验证图片是否成功插入到 CodeMirror 编辑器
      const imagesUrlContent = await this.page.evaluate(() => {
        const editor = document.querySelector('.CodeMirror') as any;
        if (editor && editor.CodeMirror) {
          return editor.CodeMirror.getValue();
        }
        return '';
      });
      console.log('Editor content:', imagesUrlContent);
      // 2. 从 codemirrorContent 提取图片 URL
      const newImagesUrls = Array.from(
          imagesUrlContent.matchAll(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g),
          (match: RegExpMatchArray) => match[1]
      );

      console.log('提取到的掘金图片URL:', newImagesUrls);

      // 4. 替换本地图片地址为掘金地址（按顺序）
      let index = 0;
      updatedContent = updatedContent.replace(
          /(!\[.*?\]\()(?!https?:\/\/)([^\)]+)(\))/g,
          (_, p1, p2, p3) => {
            const newUrl = newImagesUrls[index++];
            return `${p1}${newUrl}${p3}`;
          }
      );
    }

    // 6. 将更新后的内容复制到剪贴板并粘贴到编辑器
    console.log('📋 准备粘贴更新后的内容...');

    await this.setCodeMirrorValue(this.page,updatedContent)

    // 等待内容粘贴完成
    await this.page.waitForTimeout(3000);

    // 7. 验证内容是否正确粘贴
    const finalContent = await this.page.locator('.CodeMirror-code').textContent();
    expect(finalContent).toContain(metadata.title || '测试文章');
    console.log('✅ 内容验证通过');

    // 8. 保存草稿
    console.log('\n💾 保存草稿...');
    const draftButton = this.page.locator('.xitu-btn.btn-drafts.with-padding.xitu-btn-outline');
    await draftButton.click();
    console.log('✅ 草稿保存成功');

    console.log('\n🎉 文章发布流程完成！');
    console.log(`📝 标题: ${metadata.title}`);
    console.log(`🏷️ 分类: ${metadata.category}`);
    console.log(`🏷️ 标签: ${metadata.tags?.join(', ')}`);
    console.log(`🖼️ 处理图片数量: ${images.length}`);
    console.log(`📄 内容长度: ${updatedContent.length} 字符`);
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
} 