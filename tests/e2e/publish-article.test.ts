import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// 读取存储的登录状态
const STORAGE_STATE = path.resolve(__dirname, '../../juejin-storage-state.json');

// 测试文章内容
const TEST_ARTICLE = {
  title: 'Playwright测试文章',
  content: '# 测试文章内容\n这是一篇用于自动化测试的文章\n![测试图片](src/assets/image-20250724165010759.png)',
  tags: ['自动化测试', 'Playwright']
};

test.describe('掘金文章发布流程', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // 复用登录状态
    const context = await browser.newContext({
      storageState: STORAGE_STATE
    });
    page = await context.newPage();
  });

  test.afterAll(async ({ browser }) => {
    await browser.close();
  });

  test('1. 登录状态验证', async () => {
    await page.goto('https://juejin.cn/');
    await expect(page.locator('nav')).toContainText('写文章');
    console.log('登录状态验证成功');
  });

  test('2. 导航到写文章页面', async () => {
    await page.click('text=写文章');
    await expect(page).toHaveURL(/editor/);
    await expect(page.locator('h1')).toContainText('编辑器');
    console.log('已进入文章编辑器页面');
  });

  test('3. 填写文章标题', async () => {
    const titleInput = page.locator('input[placeholder="请输入文章标题"]');
    await titleInput.fill(TEST_ARTICLE.title);
    await expect(titleInput).toHaveValue(TEST_ARTICLE.title);
    console.log('文章标题填写完成');
  });

  test('4. 填写文章内容', async () => {
    // 假设使用的是Markdown编辑器
    const contentEditor = page.locator('textarea.markdown-editor');
    await contentEditor.fill(TEST_ARTICLE.content);
    await expect(contentEditor).toContainText(TEST_ARTICLE.content);
    console.log('文章内容填写完成');
  });

  test('5. 上传文章图片', async () => {
    const fileChooserPromise = page.waitForFileChooser();
    await page.click('button:has-text("上传图片")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(__dirname, '../../src/assets/image-20250724165010759.png'));
    await expect(page.locator('img')).toHaveCount(1);
    console.log('图片上传完成');
  });

  test('6. 添加文章标签', async () => {
    for (const tag of TEST_ARTICLE.tags) {
      await page.click('button:has-text("添加标签")');
      const tagInput = page.locator('input[placeholder="输入标签"]');
      await tagInput.fill(tag);
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('.tag-item')).toHaveCount(TEST_ARTICLE.tags.length);
    console.log('文章标签添加完成');
  });

  test('7. 发布文章', async () => {
    const publishButton = page.locator('button:has-text("发布文章")');
    await publishButton.click();
    // 处理确认对话框
    await page.locator('button:has-text("确认发布")').click();
    // 验证发布成功
    await expect(page.locator('.success-message')).toContainText('发布成功');
    console.log('文章发布成功');
  });
});