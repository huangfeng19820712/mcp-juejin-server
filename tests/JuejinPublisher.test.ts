import { describe, test, expect } from '@jest/globals';
import {JuejinPublisher} from '../src/JuejinPublisher';
import path from 'path';
// 测试用的 Markdown 文件路径
const testFilePath = path.join(__dirname, '/fixtures/test-article-with-images.md');

describe('Captcha Solver Tests', () => {
  test('掘金登录并发布文章', async () => {
    let publisher: JuejinPublisher;

    publisher = new JuejinPublisher(testFilePath, {
      openBrowser: true, // 使用 Playwright 的浏览器，不需要额外打开
      useStoredLogin: true,
      forceLogin: false
    });

    await publisher.init();
    try {
      await publisher.publish();
    } catch (e) {
      console.error('异常:', e);
    }

  }, 30000);
});