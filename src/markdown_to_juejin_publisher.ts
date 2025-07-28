import fs from 'fs-extra';
import MarkdownIt from 'markdown-it';
import clipboardy from 'clipboardy';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import dotenv from 'dotenv';
import { pino } from 'pino';
import { MarkdownData, ImageData, ArticleMetadata, PublishOptions } from './types.js';

// 计算 __dirname (在 ESM 中使用)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// 向上找到项目根目录（假设您的代码在 src 目录下）
const rootDir = path.resolve(__dirname, '..');
// 明确指定 .env 文件路径
dotenv.config({ path: path.join(rootDir, '.env') });
// 加载环境变量
dotenv.config();
console.log('环境变量 JUEJIN_USERNAME:', process.env.JUEJIN_USERNAME);

// 检测是否为 Windows 系统
const isWindows = process.platform === 'win32';

// 设置控制台编码（Windows 特定）
if (isWindows) {
  // 尝试设置控制台编码为 UTF-8
  try {
    process.env.LANG = 'zh_CN.UTF-8';
    process.env.LC_ALL = 'zh_CN.UTF-8';
  } catch (error) {
    // 忽略设置失败的错误
  }
}

// 创建自定义的 Windows 日志记录器
function createWindowsLogger() {
  const levels = ['debug', 'info', 'warn', 'error'];
  const currentLevel = levels.indexOf(process.env.LOG_LEVEL || 'info');
  
  const logger = {
    debug: (msg: string, ...args: any[]) => {
      if (currentLevel <= 0) console.log(`[DEBUG] ${msg}`, ...args);
    },
    info: (msg: string, ...args: any[]) => {
      if (currentLevel <= 1) console.log(`[INFO] ${msg}`, ...args);
    },
    warn: (msg: string, ...args: any[]) => {
      if (currentLevel <= 2) console.log(`[WARN] ${msg}`, ...args);
    },
    error: (msg: string, ...args: any[]) => {
      if (currentLevel <= 3) console.log(`[ERROR] ${msg}`, ...args);
    }
  };
  
  return logger;
}

// 初始化日志记录器
const logger = isWindows ? createWindowsLogger() : pino({
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

// 初始化 markdown-it
const md = new MarkdownIt();

/**
 * 解析 Markdown 文件，提取文字和图片
 * @param filePath Markdown 文件路径
 * @returns 包含文字内容和图片数据的对象
 */
async function parseMarkdown(filePath: string): Promise<MarkdownData> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    const images: ImageData[] = [];
    let match: RegExpExecArray | null;

    // 获取 Markdown 文件的目录
    const mdDir = path.dirname(filePath);

    while ((match = imageRegex.exec(content)) !== null) {
      const [, alt, imagePath] = match;

      // 处理相对路径
      const absolutePath = path.isAbsolute(imagePath)
          ? imagePath
          : path.join(mdDir, imagePath);

      if (await fs.pathExists(absolutePath)) {
        const buffer = await fs.readFile(absolutePath);
        const extension = path.extname(absolutePath).toLowerCase();
        let mimeType = 'image/jpeg'; // 默认

        if (extension === '.png') mimeType = 'image/png';
        else if (extension === '.gif') mimeType = 'image/gif';
        else if (extension === '.webp') mimeType = 'image/webp';
        else if (extension === '.svg') mimeType = 'image/svg+xml';

        images.push({ alt, path: absolutePath, buffer, mimeType });
      } else {
        logger.warn(`图片文件不存在: ${absolutePath}`);
      }
    }

    return { content, images };
  } catch (error) {
    logger.error('解析 Markdown 文件失败:', error);
    throw new Error(`解析 Markdown 文件失败: ${(error as Error).message}`);
  }
}

/**
 * 从 Markdown 内容中提取文章元数据
 */
function extractMetadata(content: string): { metadata: ArticleMetadata, cleanContent: string } {
  const metadataRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(metadataRegex);

  const defaultMetadata: ArticleMetadata = {
    title: '未命名文章',
    category: '前端',
    tags: ['JavaScript'],
  };

  let cleanContent = content;

  if (match) {
    const metadataText = match[1];
    const lines = metadataText.split('\n');

    const metadata = { ...defaultMetadata };

    for (const line of lines) {
      const parts = line.split(':', 2);
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();

        if (key && value) {
          if (key === 'tags') {
            metadata.tags = value.split(',').map(tag => tag.trim());
          } else if (key in defaultMetadata || key === 'cover' || key === 'description') {
            (metadata as any)[key] = value;
          }
        }
      }
    }

    // 移除元数据部分
    cleanContent = content.replace(metadataRegex, '');

    return { metadata, cleanContent };
  }

  return { metadata: defaultMetadata, cleanContent };
}

/**
 * 检查是否已登录掘金
 * @param page Playwright Page 对象
 * @returns 是否已登录
 */
async function checkLoginStatus(page: Page): Promise<boolean> {
  try {
    // 检查当前页面URL
    const currentUrl = page.url();

    // 如果当前不在掘金网站，先导航到掘金
    if (!currentUrl.includes('juejin.cn')) {
      await page.goto('https://juejin.cn', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
    }

    // 等待页面基本元素加载
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

    // 检查是否存在用户头像或用户菜单（多种选择器，提高成功率）
    const selectors = [
      '.avatar-wrapper'
    ];

    // 正确使用选择器检查
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        // 找到登录标识元素
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.warn('检查登录状态时出错:', error);
    return false;
  }
}

/**
 * 登录掘金
 * @param page Playwright Page 对象
 * @param context BrowserContext 对象，用于保存登录状态
 */
async function loginToJuejin(page: Page, context: BrowserContext): Promise<void> {
  try {
    logger.info('正在检查登录状态...');

    // 首先检查是否已经登录
    const isAlreadyLoggedIn = await checkLoginStatus(page);

    if (isAlreadyLoggedIn) {
      logger.info('✅ 已经登录掘金，无需重新登录');
      return;
    }

    logger.info('未登录，开始手动登录流程...');

    // 直接访问登录页面，并等待页面基本加载
    await page.goto('https://juejin.cn/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 仅支持手动登录
    await manualLogin(page, context);

    // 最终验证登录状态
    const finalCheck = await checkLoginStatus(page);
    if (!finalCheck) {
      throw new Error('登录流程完成，但最终检查登录状态失败');
    }
  } catch (error) {
    logger.error('登录掘金失败:', error);
    throw new Error(`登录掘金失败: ${(error as Error).message}`);
  }
}

/**
 * 预填充登录表单
 * @param page Playwright Page 对象
 * @param username 用户名
 */
async function prefillLoginForm(page: Page, username: string): Promise<void> {
  try {
    // 等待页面加载完成
    await page.waitForTimeout(3000);
    
    // 尝试多种可能的登录表单选择器（更新为最新的选择器）
    const selectors = [
      'input[name="mobile"]'
    ];
    
    let filled = false;
    for (const selector of selectors) {
      try {
        const input = await page.$(selector);
        if (input) {
          // 先清空输入框
          await page.fill(selector, '');
          // 然后填入用户名
          await page.fill(selector, username);
          logger.info(`✅ 账号信息预填充成功 (使用选择器: ${selector})`);
          filled = true;
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
        continue;
      }
    }
    
    if (!filled) {
      logger.warn('未找到账号输入框，请手动输入');
    }
  } catch (error) {
    logger.warn('预填充账号信息时出错:', error);
  }
}

/**
 * 手动登录流程
 * @param page Playwright Page 对象
 * @param context BrowserContext 对象
 */
async function manualLogin(page: Page, context: BrowserContext): Promise<void> {
  logger.info('🔐 请在打开的浏览器中手动登录掘金...');
  logger.info('💡 提示：登录成功后，程序会自动保存登录状态，下次启动无需重新登录');

  // 确保在登录页面
  if (!page.url().includes('/login')) {
    await page.goto('https://juejin.cn/login', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
  }

  // 检查是否配置了账号信息，如果配置了则预填充
  const username = process.env.JUEJIN_USERNAME;
  if (username) {
    logger.info(`📧 检测到配置的账号: ${username}`);
    logger.info('💡 程序会自动预填充账号信息，您只需输入密码即可');

    try {
      // 等待登录表单加载完成（使用更通用的选择器，缩短超时时间）
      const formSelector = await Promise.any([
        page.waitForSelector('.login-form', { timeout: 5000 }),
        page.waitForSelector('input[type="text"]', { timeout: 5000 }),
        page.waitForSelector('input[name="mobile"]', { timeout: 5000 }),
        page.waitForSelector('.number-input', { timeout: 5000 })
      ]);

      if (formSelector) {
        // 尝试预填充账号信息
        await prefillLoginForm(page, username);
      }
    } catch (error) {
      logger.warn('预填充账号信息失败，请手动输入:', error);
    }
  } else {
    logger.info('💡 未配置账号信息，请手动输入账号和密码');
  }

  // 等待用户手动登录
  const maxWaitTime = 300000; // 5分钟
  const checkInterval = 3000; // 每3秒检查一次
  const startTime = Date.now();

  logger.info('⏰ 等待用户登录，最多等待5分钟...');

  // 使用URL变化来检测登录状态
  const urlChangedPromise = page.waitForURL(url => {
    // 如果URL变成首页或不包含login，可能已登录成功
    return url.href.includes('juejin.cn') && !url.href.includes('/login');
  }, { timeout: maxWaitTime });

  try {
    // 等待URL变化或超时
    await urlChangedPromise;

    // 额外验证登录状态
    const isLoggedIn = await checkLoginStatus(page);
    if (isLoggedIn) {
      logger.info('✅ 手动登录成功');
      // 保存登录状态
      await saveLoginState(context);
      return;
    }
  } catch (error) {
    // URL变化等待超时，继续使用循环检测
  }

  // 备用检测逻辑：定期检查登录状态
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // 检查是否已登录
      const isLoggedIn = await checkLoginStatus(page);

      if (isLoggedIn) {
        logger.info('✅ 手动登录成功');
        // 保存登录状态
        await saveLoginState(context);
        return;
      }

      // 检查页面是否关闭
      if (page.isClosed()) {
        throw new Error('浏览器页面已关闭');
      }

      // 等待一段时间后再次检查
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      logger.warn('检查登录状态时出错:', error);

      // 如果页面已关闭，抛出错误
      if (String(error).includes('closed')) {
        throw new Error('浏览器页面已关闭，无法继续登录流程');
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  throw new Error('登录超时，请在5分钟内完成登录');
}

/**
 * 保存掘金登录状态
 */
async function saveLoginState(context: BrowserContext): Promise<void> {
  try {
    const storageState = await context.storageState();
    const statePath = join(__dirname, '../juejin-storage-state.json');
    await fs.writeJSON(statePath, storageState);
    logger.info('💾 登录状态已保存，下次启动将自动登录');
  } catch (error) {
    logger.warn('保存登录状态失败:', error);
  }
}

/**
 * 加载掘金登录状态
 */
async function loadLoginState(): Promise<any> {
  try {
    const statePath = join(__dirname, '../juejin-storage-state.json');
    if (await fs.pathExists(statePath)) {
      const state = await fs.readJSON(statePath);
      logger.info('📂 找到已保存的登录状态');
      return state;
    }
    return null;
  } catch (error) {
    logger.warn('加载登录状态失败:', error);
    return null;
  }
}

/**
 * 验证存储的登录状态是否有效
 * @param page Playwright Page 对象
 * @returns 登录状态是否有效
 */
async function validateStoredLogin(page: Page): Promise<boolean> {
  try {
    const isLoggedIn = await checkLoginStatus(page);
    if (isLoggedIn) {
      logger.info('✅ 存储的登录状态有效');
      return true;
    } else {
      logger.info('❌ 存储的登录状态已失效，需要重新登录');
      return false;
    }
  } catch (error) {
    logger.warn('验证登录状态时出错:', error);
    return false;
  }
}

/**
 * 使用 Playwright 将 Markdown 文章发布到掘金
 */
async function publishToJuejin(
    filePath: string,
    options: PublishOptions = {}
): Promise<void> {
  const { publish = false, openBrowser = true, useStoredLogin = true } = options;

  // 解析 Markdown
  const { content, images } = await parseMarkdown(filePath);
  const { metadata, cleanContent } = extractMetadata(content);

  // 启动浏览器
  const browser: Browser = await chromium.launch({
    headless: !openBrowser,
    slowMo: 50, // 减慢操作速度，便于观察
    args: [
      '--start-maximized', // 启动时最大化
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  let context: BrowserContext;

  // 尝试使用存储的登录状态
  const storedState = useStoredLogin ? await loadLoginState() : null;

  if (storedState) {
    context = await browser.newContext({ 
      storageState: storedState,
      viewport: null // 设置为 null 以使用全屏
    });
  } else {
    context = await browser.newContext({
      viewport: null // 设置为 null 以使用全屏
    });
  }

  const page: Page = await context.newPage();

  try {
    // 处理登录逻辑
    if (options.forceLogin) {
      // 强制重新登录
      logger.info('🔄 强制重新登录模式...');
      // 删除现有的登录状态文件
      const statePath = join(__dirname, '../juejin-storage-state.json');
      if (await fs.pathExists(statePath)) {
        await fs.remove(statePath);
        logger.info('🗑️ 已删除旧的登录状态');
      }
      await loginToJuejin(page, context);
    } else if (storedState) {
      // 使用存储的登录状态
      logger.info('🔑 使用已保存的登录状态...');
      
      // 验证存储的登录状态是否有效
      const isValidLogin = await validateStoredLogin(page);
      
      if (!isValidLogin) {
        logger.info('🔄 存储的登录状态已失效，重新登录...');
        // 删除失效的登录状态文件
        const statePath = join(__dirname, '../juejin-storage-state.json');
        if (await fs.pathExists(statePath)) {
          await fs.remove(statePath);
        }
        // 重新登录
        await loginToJuejin(page, context);
      }
    } else {
      // 没有存储的登录状态，进行登录
      logger.info('🔑 没有找到已保存的登录状态，开始登录...');
      await loginToJuejin(page, context);
    }

    logger.info('📝 正在打开掘金编辑器...');
    // 打开编辑器
    await page.goto('https://juejin.cn/editor/drafts/new', { waitUntil: 'networkidle' });

    // 等待编辑器加载完成
    await page.waitForSelector('.markdown-editor-wrapper', { timeout: 10000 });

    // 输入标题
    await page.fill('.title-input', metadata.title);

    // 使用编辑器的 API 设置内容或直接操作文本区域
    await page.evaluate((text: string) => {
      // 尝试使用编辑器 API
      const editor = document.querySelector('.markdown-editor');
      if (editor && (editor as any).__vue__) {
        (editor as any).__vue__.setContent(text);
      } else {
        // 备用方案：直接在编辑区域输入
        const textarea = document.querySelector('.markdown-editor textarea');
        if (textarea) {
          (textarea as HTMLTextAreaElement).value = text;
          // 触发 input 事件使编辑器识别内容变化
          textarea.dispatchEvent(new Event('input'));
        }
      }
    }, cleanContent);

    logger.info('已填充文章内容');

    // 上传图片
    for (const [index, image] of images.entries()) {
      logger.info(`处理图片 ${index + 1}/${images.length}: ${image.alt || '无描述'}`);

      if (!image.buffer) {
        console.warn('图片缺少 buffer 数据，跳过');
        continue;
      }

      // 创建临时文件
      const tempFilePath = join(__dirname, `../temp_${Date.now()}.${image.mimeType.split('/')[1]}`);
      await fs.writeFile(tempFilePath, image.buffer);

      try {
        // 点击插入图片按钮
        await page.click('.bytemd-toolbar-icon[bytemd-tippy-content="插入图片"]');

        // 点击"本地上传"
        await page.click('text=本地上传');

        // 等待文件选择器出现并选择文件
        const fileChooser = await page.waitForEvent('filechooser');
        await fileChooser.setFiles(tempFilePath);

        // 等待图片上传完成
        await page.waitForTimeout(3000); // 基础等待时间
      } catch (error) {
        logger.error(`上传图片失败: ${(error as Error).message}`);
      } finally {
        // 删除临时文件
        await fs.remove(tempFilePath);
      }
    }

    // 保存草稿或发布
    if (publish) {
      // 点击发布按钮
      await page.click('.publish-popup button:has-text("发布文章")');

      // 等待发布弹窗
      await page.waitForSelector('.publish-popup', { state: 'visible' });

      // 选择分类
      await page.click('.category-selector');
      await page.click(`.category-list-item:has-text("${metadata.category}")`);

      // 添加标签（最多3个）
      const tagsToAdd = metadata.tags.slice(0, 3);
      for (const tag of tagsToAdd) {
        await page.click('.tag-input-container');
        await page.fill('.tag-input', tag);

        // 选择匹配的标签（如果存在）或创建新标签
        try {
          await page.click(`.tag-item:has-text("${tag}")`, { timeout: 2000 });
        } catch {
          // 如果没有匹配的标签，按回车创建新标签
          await page.press('.tag-input', 'Enter');
        }

        await page.waitForTimeout(500);
      }

      // 如果有封面图片
      if (metadata.cover) {
        await page.click('.cover-uploader');
        // 处理封面上传...（类似于图片上传）
      }

      // 如果有文章摘要
      if (metadata.description) {
        await page.fill('.article-description textarea', metadata.description);
      }

      // 最终发布
      await page.click('.publish-popup .confirm-btn:has-text("确定发布")');

      // 等待发布成功
      await page.waitForSelector('.success-message', { timeout: 30000 });
      logger.info('文章发布成功！');
    } else {
      // 保存草稿
      await page.click('.draft-control button:has-text("保存草稿")');
      await page.waitForSelector('.success-message', { timeout: 10000 });
      logger.info('文章已保存为草稿');
    }

    // 如果需要在发布后不关闭浏览器
    if (openBrowser) {
      logger.info('浏览器已打开，请手动关闭窗口以结束程序');
      // 不关闭浏览器，等待用户手动关闭
      await new Promise(resolve => {
        process.on('SIGINT', resolve);
      });
    }
  } catch (error) {
    logger.error('发布到掘金失败:', error);

    // 保存错误截图
    const screenshotPath = join(__dirname, `../error-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`错误截图已保存至: ${screenshotPath}`);

    throw new Error(`发布到掘金失败: ${(error as Error).message}`);
  } finally {
    if (!openBrowser) {
      await browser.close();
    }
  }
}

/**
 * 显示使用帮助
 */
function showHelp(): void {
  logger.info(`
🚀 掘金文章发布工具

使用方法:
  node markdown_to_juejin_publisher.js [文件路径] [选项]

参数:
  文件路径    要发布的 Markdown 文件路径 (可选，默认为 src/test.md)

选项:
  --publish    直接发布文章 (默认只保存草稿)
  --headless   无头模式运行 (不显示浏览器窗口)
  --force-login 强制重新登录 (忽略已保存的登录状态)
  --help       显示此帮助信息

示例:
  node markdown_to_juejin_publisher.js my-article.md --publish
  node markdown_to_juejin_publisher.js --headless
  node markdown_to_juejin_publisher.js --force-login

环境变量:
  JUEJIN_USERNAME  掘金账号 (邮箱或手机号，用于预填充登录表单)

注意:
  - 程序仅支持手动登录，确保账号安全
  - 如果配置了 JUEJIN_USERNAME，程序会自动预填充账号信息
  - 首次使用需要登录，登录状态会自动保存
  - 下次启动时会自动使用已保存的登录状态
  - 如果登录状态失效，程序会自动重新登录
`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    
    // 显示帮助信息
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }
    
    const filePath = args.find(arg => !arg.startsWith('--')) || join(__dirname, '../src/test.md');
    const shouldPublish = args.includes('--publish');
    const openBrowser = !args.includes('--headless');
    const forceLogin = args.includes('--force-login');

    if (!await fs.pathExists(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    logger.info('🎯 掘金文章发布工具启动');
    logger.info(`📄 文件: ${filePath}`);
    logger.info(`📤 模式: ${shouldPublish ? '发布文章' : '保存草稿'}`);
    logger.info(`🌐 浏览器: ${openBrowser ? '显示窗口' : '无头模式'}`);
    logger.info(`🔑 登录: ${forceLogin ? '强制重新登录' : '使用已保存状态'}`);
    logger.info('─'.repeat(50));

    await publishToJuejin(filePath, {
      publish: shouldPublish,
      openBrowser,
      useStoredLogin: !forceLogin,
      forceLogin
    });

    logger.info('─'.repeat(50));
    logger.info('✅ 操作完成');
  } catch (error) {
    logger.error('❌ 程序执行失败:', (error as Error).message);
    process.exit(1);
  }
}

// 导出函数供其他模块使用
export {
  parseMarkdown,
  publishToJuejin,
  extractMetadata
};

logger.debug('import.meta.url:', import.meta.url,`file://${process.argv[1]}`);

const importMetaUrl = new URL(import.meta.url);
const argvUrl = new URL(`file://${process.argv[1]}`);
const isEqual = importMetaUrl.pathname === argvUrl.pathname;

// 如果直接运行此文件则执行主函数
if (isEqual) {
  main();
}