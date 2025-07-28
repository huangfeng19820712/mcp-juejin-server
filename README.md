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
node src/markdown_to_juejin_publisher.js my-article.md

# 直接发布文章
node src/markdown_to_juejin_publisher.js my-article.md --publish

# 无头模式运行
node src/markdown_to_juejin_publisher.js my-article.md --headless

# 强制重新登录
node src/markdown_to_juejin_publisher.js my-article.md --force-login
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

## 错误处理

- 程序会自动保存错误截图到项目根目录
- 登录失败时会自动重试
- 图片上传失败会跳过该图片并继续处理

## 开发

### 项目结构

```
src/
├── markdown_to_juejin_publisher.ts  # 主要发布逻辑
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
