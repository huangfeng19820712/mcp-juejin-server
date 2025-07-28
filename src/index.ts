import { JuejinPublisher } from './JuejinPublisher.js';
import { PublishOptions } from './types.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showHelp() {
  console.log(`\n🚀 掘金文章发布工具\n\n用法: node index.js [文件路径] [选项]\n\n参数:\n  文件路径    要发布的 Markdown 文件路径 (可选，默认为 src/test.md)\n\n选项:\n  --publish    直接发布文章 (默认只保存草稿)\n  --headless   无头模式运行 (不显示浏览器窗口)\n  --force-login 强制重新登录 (忽略已保存的登录状态)\n  --help       显示此帮助信息\n\n示例:\n  node index.js my-article.md --publish\n  node index.js --headless\n  node index.js --force-login\n\n环境变量:\n  JUEJIN_USERNAME  掘金账号 (邮箱或手机号，用于预填充登录表单)\n\n注意:\n  - 程序仅支持手动登录，确保账号安全\n  - 如果配置了 JUEJIN_USERNAME，程序会自动预填充账号信息\n  - 首次使用需要登录，登录状态会自动保存\n  - 下次启动时会自动使用已保存的登录状态\n  - 如果登录状态失效，程序会自动重新登录\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  const filePath = args.find(arg => !arg.startsWith('--')) || path.join(__dirname, '../src/test.md');
  const shouldPublish = args.includes('--publish');
  const openBrowser = !args.includes('--headless');
  const forceLogin = args.includes('--force-login');
  if (!await fs.pathExists(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const options: PublishOptions = {
    publish: shouldPublish,
    openBrowser,
    useStoredLogin: !forceLogin,
    forceLogin
  };
  const publisher = new JuejinPublisher(filePath, options);
  try {
    await publisher.init();
    await publisher.publish();
    if (openBrowser) {
      console.log('浏览器已打开，请手动关闭窗口以结束程序');
      await new Promise(resolve => {
        process.on('SIGINT', resolve);
      });
    }
  } catch (error) {
    console.error('❌ 程序执行失败:', (error as Error).message);
    process.exit(1);
  } finally {
    if (!openBrowser) {
      await publisher.close();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  main();
}