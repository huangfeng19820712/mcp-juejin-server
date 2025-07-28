import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import { pino } from 'pino';
import { MarkdownParser } from './MarkdownParser.js';
import { MarkdownData, ArticleMetadata, PublishOptions } from './types.js';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
dotenv.config({ path: join(rootDir, '.env') });
dotenv.config();

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
      const element = await this.page.$(selector);
      if (element) return true;
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
    await this.page.goto('https://juejin.cn/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.manualLogin();
    const finalCheck = await this.checkLoginStatus();
    if (!finalCheck) throw new Error('登录流程完成，但最终检查登录状态失败');
  }

  async manualLogin() {
    if (!this.page || !this.context) throw new Error('Not initialized');
    this.logger.info('🔐 请在打开的浏览器中手动登录掘金...');
    if (!this.page.url().includes('/login')) {
      await this.page.goto('https://juejin.cn/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
    const username = process.env.JUEJIN_USERNAME;
    if (username) {
      this.logger.info(`📧 检测到配置的账号: ${username}`);
      try {
        await Promise.any([
          this.page.waitForSelector('.login-form', { timeout: 5000 }),
          this.page.waitForSelector('input[type="text"]', { timeout: 5000 }),
          this.page.waitForSelector('input[name="mobile"]', { timeout: 5000 }),
          this.page.waitForSelector('.number-input', { timeout: 5000 })
        ]);
        await this.prefillLoginForm(username);
      } catch {}
    }
    const maxWaitTime = 300000;
    const checkInterval = 3000;
    const startTime = Date.now();
    this.logger.info('⏰ 等待用户登录，最多等待5分钟...');
    try {
      await this.page.waitForURL(url => url.href.includes('juejin.cn') && !url.href.includes('/login'), { timeout: maxWaitTime });
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        this.logger.info('✅ 手动登录成功');
        await this.saveLoginState();
        return;
      }
    } catch {}
    while (Date.now() - startTime < maxWaitTime) {
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        this.logger.info('✅ 手动登录成功');
        await this.saveLoginState();
        return;
      }
      if (this.page.isClosed()) throw new Error('浏览器页面已关闭');
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    throw new Error('登录超时，请在5分钟内完成登录');
  }

  async prefillLoginForm(username: string) {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.waitForTimeout(3000);
    const selectors = ['input[name="mobile"]'];
    for (const selector of selectors) {
      const input = await this.page.$(selector);
      if (input) {
        await this.page.fill(selector, '');
        await this.page.fill(selector, username);
        this.logger.info(`✅ 账号信息预填充成功 (使用选择器: ${selector})`);
        break;
      }
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
    await this.page.goto('https://juejin.cn/editor/drafts/new', { waitUntil: 'networkidle' });
    await this.page.waitForSelector('.markdown-editor-wrapper', { timeout: 10000 });
    await this.page.fill('.title-input', this.metadata?.title || '');
    await this.page.evaluate((text: string) => {
      const editor = document.querySelector('.markdown-editor');
      if (editor && (editor as any).__vue__) {
        (editor as any).__vue__.setContent(text);
      } else {
        const textarea = document.querySelector('.markdown-editor textarea');
        if (textarea) {
          (textarea as HTMLTextAreaElement).value = text;
          textarea.dispatchEvent(new Event('input'));
        }
      }
    }, this.content);
    this.logger.info('已填充文章内容');
    // 图片上传略（可参考原实现）
    // 发布/保存草稿逻辑略（可参考原实现）
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
} 