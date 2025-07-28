import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STORAGE_STATE = path.resolve(__dirname, '../../juejin-storage-state.json');
const USERNAME = process.env.JUEJIN_USERNAME || '';
const PASSWORD = process.env.JUEJIN_PASSWORD || '';

setup('登录并保存状态', async ({ page }) => {
  // 如果存储状态文件已存在，则跳过登录
  if (fs.existsSync(STORAGE_STATE)) {
    console.log('登录状态已存在，跳过登录流程');
    return;
  }

  // 导航到登录页面
  await page.goto('https://juejin.cn/auth/login');
  await expect(page).toHaveURL(/login/);

  // 选择密码登录选项
  await page.click('text=密码登录');

  // 输入用户名和密码
  await page.fill('input[name="loginPhoneOrEmail"]', USERNAME);
  await page.fill('input[name="loginPassword"]', PASSWORD);

  // 点击登录按钮
  await Promise.all([
    page.waitForNavigation(),
    page.click('button:has-text("登录")')
  ]);

  // 验证登录成功
  await expect(page.locator('nav')).toContainText('写文章');

  // 创建存储状态目录（如果不存在）
  const storageDir = path.dirname(STORAGE_STATE);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // 保存存储状态
  await page.context().storageState({ path: STORAGE_STATE });
  console.log('登录状态已保存到:', STORAGE_STATE);
});