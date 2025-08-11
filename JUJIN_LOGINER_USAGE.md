# JuejinLoginer 使用指南

## 概述

`JuejinLoginer` 是一个专门用于掘金网站自动登录的类，集成了滑块验证码识别和处理功能。它将原本分散的登录逻辑抽象成了一个易于使用的面向对象接口。

## 功能特性

- ✅ **自动登录**: 支持用户名密码登录
- ✅ **滑块验证码识别**: 自动识别和处理滑块验证码
- ✅ **重试机制**: 内置重试逻辑，提高成功率
- ✅ **多浏览器支持**: 支持 Chromium、Firefox、WebKit
- ✅ **错误处理**: 完善的错误处理和日志记录
- ✅ **登录状态检查**: 检查是否已登录

## 安装和依赖

确保已安装以下依赖：

```bash
npm install playwright opencv4nodejs sharp
```

## 基本使用

### 1. 创建登录器实例

```typescript
import { JuejinLoginer } from './src/JuejinLoginer.js';

const loginer = new JuejinLoginer({
  phone: '1111111111111',
  password: 'your_password'
}, {
  maxRetries: 3,
  timeout: 60000,
  mainUrl: 'https://juejin.cn/'
});
```

### 2. 执行登录

```typescript
import { test, expect } from '@playwright/test';

test('掘金自动登录测试', async ({ page }) => {
  const loginer = new JuejinLoginer({
    phone: '1111111111111',
    password: 'your_password'
  });

  // 执行登录流程
  const loginSuccess = await loginer.loginWithRetry(page);
  
  // 验证登录成功
  expect(loginSuccess).toBe(true);
  
  // 验证页面跳转
  await expect(page).toHaveURL('https://juejin.cn/');
});
```

## API 参考

### 构造函数

```typescript
constructor(credentials: LoginCredentials, options?: LoginOptions)
```

#### LoginCredentials 接口

```typescript
interface LoginCredentials {
  phone: string;    // 手机号
  password: string; // 密码
}
```

#### LoginOptions 接口

```typescript
interface LoginOptions {
  maxRetries?: number;  // 最大重试次数，默认 3
  timeout?: number;     // 超时时间（毫秒），默认 60000
  mainUrl?: string;     // 主页面URL，默认 'https://juejin.cn/'
}
```

### 主要方法

#### 1. `login(page: Page): Promise<boolean>`

执行基本的登录流程，包括：
- 打开登录页面
- 输入用户名密码
- 处理滑块验证码
- 返回登录是否成功

```typescript
const success = await loginer.login(page);
```

#### 2. `loginWithRetry(page: Page): Promise<boolean>`

带重试机制的登录流程，包括：
- 自动重试失败的登录
- 等待页面跳转
- 返回最终登录结果

```typescript
const success = await loginer.loginWithRetry(page);
```

#### 3. `handleSliderCaptcha(page: Page): Promise<boolean>`

专门处理滑块验证码，包括：
- 获取验证码图片URL
- 识别滑块位置
- 生成人类轨迹
- 执行拖动操作

```typescript
const captchaSuccess = await loginer.handleSliderCaptcha(page);
```

#### 4. `isLoggedIn(page: Page): Promise<boolean>`

检查是否已登录

```typescript
const isLoggedIn = await loginer.isLoggedIn(page);
```

## 测试示例

### Playwright 测试

```typescript
import { test, expect } from '@playwright/test';
import { JuejinLoginer } from '../src/JuejinLoginer.js';

test('掘金滑块验证码自动识别与拖动', async ({ page }) => {
  // 创建登录器实例
  const loginer = new JuejinLoginer({
    phone: '1111111111111',
    password: 'XXXXXXX'
  }, {
    maxRetries: 3,
    timeout: 60000,
    mainUrl: 'https://juejin.cn/'
  });

  // 执行登录流程
  const loginSuccess = await loginer.loginWithRetry(page);
  
  // 验证登录成功
  expect(loginSuccess).toBe(true);
  
  // 验证页面跳转到主页面
  await expect(page).toHaveURL('https://juejin.cn/');
});
```

### 运行测试

```bash
# 运行所有浏览器测试
npx playwright test tests/captcha-slider.spec.ts

# 运行指定浏览器测试
npx playwright test tests/captcha-slider.spec.ts --project=chromium

# 带界面运行测试
npx playwright test tests/captcha-slider.spec.ts --headed
```

## 配置选项

### 默认配置

```typescript
const defaultOptions = {
  maxRetries: 3,           // 最大重试次数
  timeout: 60000,          // 超时时间（毫秒）
  mainUrl: 'https://juejin.cn/'  // 主页面URL
};
```

### 自定义配置

```typescript
const loginer = new JuejinLoginer(credentials, {
  maxRetries: 5,           // 增加重试次数
  timeout: 120000,         // 增加超时时间
  mainUrl: 'https://juejin.cn/user'  // 自定义主页面
});
```

## 错误处理

### 常见错误

1. **登录失败**: 用户名或密码错误
2. **验证码识别失败**: 图片加载或识别问题
3. **网络超时**: 网络连接问题
4. **页面元素未找到**: 页面结构变化

### 错误处理示例

```typescript
try {
  const success = await loginer.loginWithRetry(page);
  if (!success) {
    console.error('登录失败');
  }
} catch (error) {
  console.error('登录异常:', error);
}
```

## 性能优化

### 1. 减少重试次数

对于稳定的网络环境，可以减少重试次数：

```typescript
const loginer = new JuejinLoginer(credentials, {
  maxRetries: 1  // 减少重试次数
});
```

### 2. 调整超时时间

根据网络状况调整超时时间：

```typescript
const loginer = new JuejinLoginer(credentials, {
  timeout: 30000  // 减少超时时间
});
```

## 注意事项

1. **账号安全**: 不要在代码中硬编码真实的用户名和密码
2. **频率限制**: 避免频繁登录，可能触发风控
3. **验证码变化**: 网站可能更新验证码机制，需要及时适配
4. **网络环境**: 确保网络连接稳定

## 更新日志

- ✅ 创建 `JuejinLoginer` 类
- ✅ 抽象登录和验证码处理逻辑
- ✅ 添加重试机制
- ✅ 完善错误处理
- ✅ 支持多浏览器测试
- ✅ 保持原有测试兼容性

## 相关文件

- `src/JuejinLoginer.ts` - 主要类文件
- `tests/captcha-slider.spec.ts` - 测试文件
- `src/captcha_solver.ts` - 验证码处理工具
- `src/crop_background.ts` - 图片处理工具
