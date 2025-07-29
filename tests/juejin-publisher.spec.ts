import { test, expect } from '@playwright/test';
import { JuejinPublisher } from '../src/JuejinPublisher';
import fs from 'fs-extra';
import path from 'path';

// 测试用的 Markdown 文件路径
const testFilePath = path.join(__dirname, 'fixtures/test-article.md');

test.describe('JuejinPublisher Tests', () => {
  let publisher: JuejinPublisher;

  test.beforeAll(async () => {
    // 确保测试文件存在
    if (!await fs.pathExists(testFilePath)) {
      await fs.writeFile(testFilePath, `---
title: 测试文章
category: 前端
tags: [JavaScript, TypeScript, 测试]
description: 这是一个用于测试掘金发布功能的文章
---

# 测试文章

这是一个用于测试掘金发布功能的文章。

## 功能特性

- 支持 Markdown 解析
- 自动上传图片
- 提取元数据
- 发布到掘金

## 代码示例

\`\`\`javascript
console.log('Hello, Juejin!');
\`\`\`

## 图片测试

![测试图片](https://via.placeholder.com/300x200/0066cc/ffffff?text=Test+Image)

## 总结

这是一个完整的测试用例，用于验证 JuejinPublisher 的各项功能。
`);
    }
  });

  test.beforeEach(async () => {
    // 每个测试前创建新的 publisher 实例
    publisher = new JuejinPublisher(testFilePath, {
      openBrowser: false, // 使用 Playwright 的浏览器，不需要额外打开
      useStoredLogin: false,
      forceLogin: true
    });
  });

  test.afterEach(async () => {
    // 每个测试后清理
    if (publisher) {
      await publisher.close();
    }
  });

  test('should initialize browser and context', async () => {
    await publisher.init();
    
    expect(publisher.browser).toBeDefined();
    expect(publisher.context).toBeDefined();
    expect(publisher.page).toBeDefined();
  });

  test('should parse markdown file', async () => {
    await publisher.init();
    await publisher.parseMarkdown();
    
    expect(publisher.content).toBeDefined();
    expect(publisher.metadata).toBeDefined();
    expect(publisher.metadata?.title).toBe('测试文章');
    expect(Array.isArray(publisher.images)).toBe(true);
  });

  test('should check login status', async () => {
    await publisher.init();
    
    const isLoggedIn = await publisher.checkLoginStatus();
    
    // 首次运行应该返回 false（未登录）
    expect(typeof isLoggedIn).toBe('boolean');
  });

  test('should handle login flow', async ({ page }) => {
    // 使用 Playwright 的 page 对象
    await publisher.init();
    
    // 这里会打开浏览器，需要手动登录
    console.log('🔐 请在打开的浏览器中手动登录掘金...');
    
    // 等待用户手动登录
    await publisher.login();
    
    // 登录后再次检查状态
    const isLoggedIn = await publisher.checkLoginStatus();
    expect(isLoggedIn).toBe(true);
  });

  test('should complete full publish flow', async () => {
    await publisher.init();
    
    // 执行完整的发布流程
    await publisher.publish();
    
    // 验证发布结果
    expect(publisher.content).toBeDefined();
    expect(publisher.metadata).toBeDefined();
  });

  test('should test specific method for debugging', async () => {
    await publisher.init();
    
    // 测试登录状态检查
    const loginStatus = await publisher.checkLoginStatus();
    console.log('登录状态:', loginStatus);
    
    // 测试元数据解析
    await publisher.parseMarkdown();
    console.log('解析的元数据:', publisher.metadata);
    console.log('解析的内容长度:', publisher.content.length);
    
    expect(publisher.metadata).toBeDefined();
    expect(publisher.content).toBeDefined();
  });
});

// 单独的测试用例，用于调试特定功能
test.describe('JuejinPublisher Debug Tests', () => {
  test('should debug login process step by step', async ({ page }) => {
    const publisher = new JuejinPublisher(testFilePath, {
      openBrowser: false,
      useStoredLogin: false,
      forceLogin: true
    });

    try {
      await publisher.init();
      
      // 步骤1：检查初始登录状态
      const initialStatus = await publisher.checkLoginStatus();
      console.log('初始登录状态:', initialStatus);
      
      // 步骤2：尝试登录
      console.log('开始登录流程...');
      await publisher.login();
      
      // 步骤3：验证登录结果
      const finalStatus = await publisher.checkLoginStatus();
      console.log('最终登录状态:', finalStatus);
      
      expect(finalStatus).toBe(true);
    } finally {
      await publisher.close();
    }
  });

  test('should debug markdown parsing', async () => {
    const publisher = new JuejinPublisher(testFilePath, {
      openBrowser: false,
      useStoredLogin: false,
      forceLogin: true
    });

    try {
      await publisher.init();
      
      // 解析 Markdown
      await publisher.parseMarkdown();
      
      // 输出详细信息
      console.log('解析结果:');
      console.log('- 标题:', publisher.metadata?.title);
      console.log('- 分类:', publisher.metadata?.category);
      console.log('- 标签:', publisher.metadata?.tags);
      console.log('- 内容长度:', publisher.content.length);
      console.log('- 图片数量:', publisher.images.length);
      
      expect(publisher.metadata?.title).toBe('测试文章');
      expect(publisher.content).toContain('测试文章');
    } finally {
      await publisher.close();
    }
  });
}); 