# 掘金文章发布工具

一个自动化工具，可以将 Markdown 文件发布到掘金平台，支持图片上传、草稿保存和自动登录。

## 功能特性

- ✅ **手动登录管理** - 仅支持手动登录，确保账号安全，首次登录后自动保存状态
- ✅ **账号预填充** - 支持配置账号信息，自动预填充登录表单
- ✅ **Markdown 解析** - 支持完整的 Markdown 语法和图片引用
- ✅ **图片自动上传** - 自动处理文章中的本地图片并上传到掘金
- ✅ **元数据支持** - 支持文章标题、分类、标签等元数据
- ✅ **草稿/发布模式** - 可选择保存草稿或直接发布
- ✅ **无头模式** - 支持后台运行，无需显示浏览器窗口
- ✅ **全屏浏览器** - 浏览器自动启动为全屏模式，提供更好的操作体验
- ✅ **结构化日志** - 使用 Pino 日志框架，提供彩色、结构化的日志输出
- ✅ **错误处理** - 完善的错误处理和截图保存

## 安装

1. 克隆项目
```bash
git clone <repository-url>
cd mcp-juejin-server
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量（可选）
复制配置文件：
```bash
cp config.example .env
```

然后编辑 `.env` 文件，填入您的账号信息：
```env
# 掘金账号（用于预填充登录表单）
JUEJIN_USERNAME=your_email@example.com

# 日志级别（可选）
LOG_LEVEL=info
```

**注意：** 程序仅支持手动登录，不会自动填写密码，确保账号安全。

## 使用方法

### 基本用法

```bash
# 保存草稿（默认）
node src/index.js my-article.md

# 直接发布文章
node src/index.js my-article.md --publish

# 无头模式运行
node src/index.js my-article.md --headless

# 强制重新登录
node src/index.js my-article.md --force-login
```

### 命令行选项

- `--publish` - 直接发布文章（默认只保存草稿）
- `--headless` - 无头模式运行（不显示浏览器窗口）
- `--force-login` - 强制重新登录（忽略已保存的登录状态）
- `--help` - 显示帮助信息

### Markdown 文件格式

支持标准的 Markdown 语法，可以在文件开头添加元数据：

```markdown
---
title: 文章标题
category: 前端
tags: [JavaScript, Vue, React]
cover: 封面图片路径
description: 文章摘要
---

# 文章内容

这里是文章正文...

![图片描述](./images/example.png)
```

## 登录说明

### 首次使用
1. 运行程序后会自动打开浏览器
2. 如果配置了 `JUEJIN_USERNAME`，程序会自动预填充账号信息
3. 在浏览器中手动输入密码并登录掘金
4. 登录成功后程序会自动保存登录状态

### 后续使用
- 程序会自动使用已保存的登录状态
- 如果登录状态失效，会自动重新登录
- 使用 `--force-login` 选项可以强制重新登录

### 账号配置
为了简化登录流程，您可以配置账号信息：
```bash
# Linux/macOS
export JUEJIN_USERNAME="your_email@example.com"

# Windows PowerShell
$env:JUEJIN_USERNAME="your_email@example.com"

# Windows CMD
set JUEJIN_USERNAME=your_email@example.com
```

**安全提示：** 程序仅支持手动登录，不会自动填写密码，确保您的账号安全。

## 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `JUEJIN_USERNAME` | 掘金账号（邮箱或手机号，用于预填充登录表单） | 否 |
| `LOG_LEVEL` | 日志级别（debug, info, warn, error） | 否 |

**注意：** 程序仅支持手动登录以确保账号安全。如果配置了 `JUEJIN_USERNAME`，程序会自动预填充账号信息，您只需输入密码即可。

### 日志配置

程序使用 Pino 日志框架，支持以下日志级别：
- `debug` - 调试信息（最详细）
- `info` - 一般信息（默认）
- `warn` - 警告信息
- `error` - 错误信息（最简洁）

**Windows 兼容性：** 程序已针对 Windows 系统进行了优化，自动处理字符编码问题，确保日志输出正常显示。在 Windows 系统上，程序会使用简化的日志格式以避免编码问题。

可以通过环境变量 `LOG_LEVEL` 设置日志级别：

**Linux/macOS:**
```bash
LOG_LEVEL=debug npm run dev -- src/example.md
```

**Windows PowerShell:**
```powershell
$env:LOG_LEVEL="debug"; npm run dev -- src/example.md
```

**Windows CMD:**
```cmd
set LOG_LEVEL=debug && npm run dev -- src/example.md
```

## 注意事项

1. **手动登录**：程序仅支持手动登录，确保账号安全
2. **账号预填充**：如果配置了 `JUEJIN_USERNAME`，程序会自动预填充账号信息
3. **登录状态**：登录状态保存在 `juejin-storage-state.json` 文件中
4. **图片路径**：确保 Markdown 文件中的图片路径正确
5. **网络环境**：确保网络连接稳定，避免登录或上传失败
6. **浏览器兼容**：使用 Chromium 浏览器，确保系统支持
7. **浏览器全屏**：程序会自动启动浏览器为全屏模式，提供更好的操作体验
8. **日志输出**：程序使用彩色日志输出，便于查看操作进度和错误信息
9. **Windows 兼容性**：程序已针对 Windows 系统进行了优化，自动处理字符编码问题，使用简化的日志格式确保中文和 emoji 正常显示

## 图片处理功能

### 背景图片裁剪

`crop_background.ts` 模块提供了强大的图片处理功能，包括背景图片裁剪和滑块模板匹配。

#### 基本裁剪功能

```bash
# 裁剪背景图片
node src/crop_background.ts <bgPath> <top> <cropHeight> [outputPath] [browserWidth] [browserHeight]

# 示例：裁剪背景图片，从第50像素开始，裁剪100像素高度
node src/crop_background.ts bg.jpg 50 100 output.jpg 340 212
```

**参数说明：**
- `bgPath` - 背景图片路径
- `top` - 裁剪起始高度（像素，基于浏览器显示尺寸）
- `cropHeight` - 裁剪高度（像素，基于浏览器显示尺寸）
- `outputPath` - 输出图片路径（可选，不传则自动生成）
- `browserWidth` - 浏览器显示宽度（默认340）
- `browserHeight` - 浏览器显示高度（默认212）

#### 滑块模板匹配

新增的模板匹配功能可以自动识别滑块在背景图中的位置，使用 OpenCV4Node.js 进行精确匹配。

```bash
# 模板匹配模式
node src/crop_background.ts match <bgPath> <slidePath> [outputPath]

# 示例：匹配滑块位置
node src/crop_background.ts match bg_cropped.jpg slide.png result.jpg
```

**参数说明：**
- `bgPath` - 背景图片路径（裁剪后的）
- `slidePath` - 滑块图片路径
- `outputPath` - 结果图片输出路径（可选）

#### 获取距离比例

```bash
# 获取距离比例模式
node src/crop_background.ts distance <bgPath> <slidePath>

# 示例：获取滑块距离比例
node src/crop_background.ts distance bg_cropped.jpg slide.png
```

**返回值：** 位置比例（位置/图片宽度），范围 0-1

#### 编程接口

```typescript
import { cropBackgroundImage, matchSliderWithBackground, getSlideDistance } from './src/crop_background';

// 裁剪背景图片
const croppedPath = await cropBackgroundImage(
  'bg.jpg', 
  50, 
  100, 
  'output.jpg', 
  340, 
  212
);

// 模板匹配
const matchResult = await matchSliderWithBackground(
  'bg_cropped.jpg', 
  'slide.png', 
  'result.jpg'
);
console.log(`位置: (${matchResult.location.x}, ${matchResult.location.y})`);
console.log(`置信度: ${matchResult.confidence}`);
console.log(`距离比例: ${matchResult.distanceRatio}`);

// 获取距离比例
const distanceRatio = await getSlideDistance('bg_cropped.jpg', 'slide.png');
console.log(`距离比例: ${distanceRatio}`);
```

#### 匹配算法说明

模板匹配使用以下步骤：

1. **图像预处理**：
   - 转换为灰度图
   - 高斯模糊处理（5x5核）
   - Canny边缘检测（阈值30-100）

2. **模板匹配**：
   - 使用 `TM_CCORR_NORMED` 方法进行归一化相关系数匹配
   - 自动计算最佳匹配位置和置信度

3. **结果输出**：
   - 返回匹配位置坐标
   - 返回匹配置信度（0-1）
   - 返回距离比例（位置/图片宽度）
   - 自动生成结果图片（包含匹配框和文本信息）

#### 使用场景

- **验证码识别**：自动识别滑块验证码中的缺口位置
- **图像处理**：批量处理背景图片裁剪
- **自动化测试**：图像对比和位置检测
- **计算机视觉**：模板匹配和对象检测

## 错误处理

- 程序会自动保存错误截图到项目根目录
- 登录失败时会自动重试
- 图片上传失败会跳过该图片并继续处理

## 开发

### 项目结构

```
src/
├── index.ts  # 主要发布逻辑
├── types.ts                         # 类型定义
└── index.ts                         # 入口文件
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

## 许可证

MIT License
