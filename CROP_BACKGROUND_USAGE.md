# Crop Background 功能使用指南

## 功能概述

`crop_background.ts` 提供了完整的图片处理功能，包括裁剪、模板匹配、距离计算和URL下载等功能。所有生成的文件都会自动保存到 `./tmp` 目录下。

## 主要功能

### 1. 图片裁剪 (`cropBackgroundImage`)

将背景图片按照浏览器坐标进行裁剪。

**CLI用法:**
```bash
node build/crop_background.js <bgPath> <top> <cropHeight> [outputPath] [browserWidth] [browserHeight]
```

**示例:**
```bash
# 基本裁剪
node build/crop_background.js ./tmp/bg_188rlo5p4y-2.jpg 104 68

# 指定输出路径
node build/crop_background.js ./tmp/bg_188rlo5p4y-2.jpg 104 68 test_crop.jpg

# 自定义浏览器尺寸
node build/crop_background.js ./tmp/bg_188rlo5p4y-2.jpg 104 68 test_crop.jpg 340 212
```

**编程接口:**
```typescript
import { cropBackgroundImage } from './build/crop_background.js';

const result = await cropBackgroundImage(
  './tmp/bg_188rlo5p4y-2.jpg',  // 背景图片路径
  104,                          // 裁剪起始高度（浏览器坐标）
  68,                           // 裁剪高度（浏览器坐标）
  undefined,                    // 输出路径（可选，自动生成）
  340,                          // 浏览器宽度（默认340）
  212                           // 浏览器高度（默认212）
);
```

### 2. 模板匹配 (`matchSliderWithBackground`)

使用OpenCV进行滑块与背景图片的模板匹配。

**CLI用法:**
```bash
node build/crop_background.js match <bgPath> <slidePath> [outputPath]
```

**示例:**
```bash
# 基本匹配
node build/crop_background.js match ./tmp/test_crop.jpg ./tmp/puzzle_188rlo5p4y-2.png

# 指定输出路径
node build/crop_background.js match ./tmp/test_crop.jpg ./tmp/puzzle_188rlo5p4y-2.png test_match.jpg
```

**编程接口:**
```typescript
import { matchSliderWithBackground } from './build/crop_background.js';

const result = await matchSliderWithBackground(
  './tmp/test_crop.jpg',        // 背景图片路径
  './tmp/puzzle_188rlo5p4y-2.png', // 滑块图片路径
  undefined                     // 输出路径（可选，自动生成）
);

console.log(`位置: (${result.location.x}, ${result.location.y})`);
console.log(`置信度: ${result.confidence}`);
console.log(`距离比例: ${result.distanceRatio}`);
```

### 3. 距离计算 (`getSlideDistance`)

获取滑块在背景图片中的距离比例。

**CLI用法:**
```bash
node build/crop_background.js distance <bgPath> <slidePath>
```

**示例:**
```bash
node build/crop_background.js distance ./tmp/test_crop.jpg ./tmp/puzzle_188rlo5p4y-2.png
```

**编程接口:**
```typescript
import { getSlideDistance } from './build/crop_background.js';

const distanceRatio = await getSlideDistance(
  './tmp/test_crop.jpg',
  './tmp/puzzle_188rlo5p4y-2.png'
);
console.log(`距离比例: ${distanceRatio}`);
```

### 4. URL下载和偏移计算 (`getSliderOffsetFromUrls`)

从URL下载图片并计算滑块在浏览器中的x轴偏移位置。

**CLI用法:**
```bash
node build/crop_background.js offset <bgUrl> <slideUrl> <top> <cropHeight> [browserWidth] [browserHeight]
```

**示例:**
```bash
# 使用网络URL
node build/crop_background.js offset https://example.com/bg.jpg https://example.com/slide.png 104 68 340 212

# 使用本地文件（file://协议）
node build/crop_background.js offset file://./tmp/bg_188rlo5p4y-2.jpg file://./tmp/puzzle_188rlo5p4y-2.png 104 68 340 212
```

**编程接口:**
```typescript
import { getSliderOffsetFromUrls } from './build/crop_background.js';

const offsetX = await getSliderOffsetFromUrls(
  'file://./tmp/bg_188rlo5p4y-2.jpg',  // 背景图片URL
  'file://./tmp/puzzle_188rlo5p4y-2.png', // 滑块图片URL
  104,                                 // 裁剪起始高度
  68,                                  // 裁剪高度
  340,                                 // 浏览器宽度
  212                                  // 浏览器高度
);
console.log(`浏览器x轴偏移位置: ${offsetX}px`);
```

## 支持的文件格式

### 输入格式
- **背景图片**: JPG, PNG, WebP, TIFF等
- **滑块图片**: PNG, JPG, WebP等

### 输出格式
- 所有输出图片都保存为JPG格式
- 自动保存到 `./tmp` 目录
- 文件名包含时间戳以避免冲突

## URL支持

### 网络URL
- 支持HTTP/HTTPS协议
- 自动下载到本地临时文件

### 本地文件
- 支持 `file://` 协议
- 支持直接文件路径
- 自动复制到临时目录

## 算法说明

### 模板匹配算法
1. **图像预处理**:
   - 转换为灰度图
   - 高斯模糊去噪
   - Canny边缘检测

2. **匹配方法**:
   - 使用 `cv.TM_CCORR_NORMED` 方法
   - 返回最佳匹配位置和置信度

3. **结果验证**:
   - 置信度阈值验证
   - 位置合理性检查

### 坐标转换
- 浏览器坐标 → 实际图片坐标
- 匹配位置 → 浏览器偏移位置
- 自动处理不同分辨率的缩放

## 错误处理

### 常见错误
- 文件不存在
- 图片格式不支持
- 网络下载失败
- 内存不足

### 重试机制
- 文件操作自动重试
- 网络请求重试
- 详细的错误日志

## 性能优化

### 内存管理
- 自动释放OpenCV Mat对象
- 及时清理临时文件
- 流式处理大文件

### 并发处理
- 支持异步操作
- 非阻塞I/O
- 可配置的重试策略

## 测试验证

所有功能都经过完整测试：

```bash
# 运行单元测试
npm test -- tests/crop-background.test.ts

# 运行端到端测试
node build/crop_background.js ./tmp/bg_188rlo5p4y-2.jpg 104 68
node build/crop_background.js match ./tmp/test_crop.jpg ./tmp/puzzle_188rlo5p4y-2.png
node build/crop_background.js distance ./tmp/test_crop.jpg ./tmp/puzzle_188rlo5p4y-2.png
node build/crop_background.js offset file://./tmp/bg_188rlo5p4y-2.jpg file://./tmp/puzzle_188rlo5p4y-2.png 104 68 340 212
```

## 注意事项

1. **文件路径**: 所有相对路径都基于项目根目录
2. **临时文件**: 下载的图片会保留在 `./tmp` 目录中
3. **内存使用**: 大图片处理时注意内存使用情况
4. **网络连接**: URL下载功能需要网络连接
5. **依赖库**: 需要安装 `sharp` 和 `opencv4nodejs` 库

## 更新日志

- ✅ 添加模板匹配功能
- ✅ 添加距离计算功能
- ✅ 添加URL下载功能
- ✅ 所有文件保存到 `./tmp` 目录
- ✅ 完整的CLI接口
- ✅ 全面的错误处理
- ✅ 单元测试覆盖
