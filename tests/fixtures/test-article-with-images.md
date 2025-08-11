---
title: 测试文章 - 包含本地图片
category: 前端
tags: [JavaScript, TypeScript, 测试, 图片上传]
description: 这是一个用于测试掘金发布功能和图片上传的文章
---

# 测试文章 - 包含本地图片

这是一个用于测试掘金发布功能和图片上传的文章。

## 功能特性

- 支持 Markdown 解析
- 自动上传本地图片到掘金
- 提取元数据
- 发布到掘金
- 图片地址自动替换

## 代码示例

```javascript
console.log('Hello, Juejin!');

// 图片上传示例
const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    // 上传逻辑
};
```

## 本地图片测试

### 测试图片1
![测试图片1](test-article-with-images.assets/image-20250809234416142.png)

### 测试图片2  
![测试图片2](test-article-with-images.assets/image-20250809234501439.png)

### 测试图片3

![测试图片3](test-article-with-images.assets/image-20250809234623868.png)

## 图片上传流程

1. 解析 Markdown 文件中的本地图片路径
2. 逐个上传图片到掘金
3. 获取掘金返回的图片URL
4. 替换原内容中的本地路径为掘金URL
5. 清空编辑器并粘贴更新后的内容
6. 保存草稿

## 总结

这是一个完整的测试用例，用于验证 JuejinPublisher 的图片上传和内容替换功能。通过这个测试，我们可以确保：

- 本地图片能够正确上传到掘金
- 图片地址能够正确替换
- 文章内容能够正确保存
- 整个发布流程的完整性
