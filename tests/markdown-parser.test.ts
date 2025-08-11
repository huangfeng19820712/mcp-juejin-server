import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MarkdownParser } from '../src/MarkdownParser.js';
import { MarkdownData, ImageData, ArticleMetadata } from '../src/types.js';
import * as path from 'path';
import * as fs from 'fs-extra';

describe('MarkdownParser Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const tempDir = path.join(__dirname, 'temp');
  
  // 测试用的临时文件路径
  const tempMarkdownPath = path.join(tempDir, 'test-temp.md');
  const tempImagePath = path.join(tempDir, 'test-image.png');

  beforeEach(async () => {
    // 创建临时目录
    await fs.ensureDir(tempDir);
    
    // 创建测试用的临时图片文件
    const testImageBuffer = Buffer.from('fake-png-data');
    await fs.writeFile(tempImagePath, testImageBuffer);
  });

  afterEach(async () => {
    // 清理临时文件
    try {
      await fs.remove(tempDir);
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('parseMarkdown', () => {
    test('should parse markdown file without images', async () => {
      const markdownContent = `# 测试文章
这是一个测试文章，没有图片。

## 功能特性
- 支持 Markdown 解析
- 自动上传图片
- 提取元数据

## 代码示例
\`\`\`javascript
console.log('Hello, World!');
\`\`\``;

      await fs.writeFile(tempMarkdownPath, markdownContent);
      
      const result = await MarkdownParser.parseMarkdown(tempMarkdownPath);
      
      expect(result).toBeDefined();
      expect(result.content).toBe(markdownContent);
      expect(result.images).toEqual([]);
    });

    test('should parse markdown file with local images', async () => {
      const markdownContent = `# 测试文章
这是一个包含本地图片的测试文章。

## 图片测试
![测试图片1](${path.basename(tempImagePath)})
![测试图片2](./${path.basename(tempImagePath)})
![测试图片3](${tempImagePath})

## 总结
测试完成。`;

      await fs.writeFile(tempMarkdownPath, markdownContent);
      
      const result = await MarkdownParser.parseMarkdown(tempMarkdownPath);
      
      expect(result).toBeDefined();
      expect(result.content).toBe(markdownContent);
      expect(result.images).toHaveLength(3);
      
      // 验证图片数据
      result.images.forEach((image: ImageData) => {
        expect(image.alt).toMatch(/测试图片\d+/);
        expect(image.path).toBe(tempImagePath);
        expect(image.buffer).toBeDefined();
        expect(image.mimeType).toBe('image/png');
      });
    });

    test('should parse markdown file with remote images', async () => {
      const markdownContent = `# 测试文章
这是一个包含远程图片的测试文章。

## 远程图片测试
![远程图片1](https://via.placeholder.com/300x200/0066cc/ffffff?text=Test+Image)
![远程图片2](https://example.com/image.jpg)

## 总结
测试完成。`;

      await fs.writeFile(tempMarkdownPath, markdownContent);
      
      const result = await MarkdownParser.parseMarkdown(tempMarkdownPath);
      
      expect(result).toBeDefined();
      expect(result.content).toBe(markdownContent);
      expect(result.images).toHaveLength(0); // 远程图片不会被处理
    });

    test('should handle absolute and relative image paths correctly', async () => {
      const markdownContent = `# 测试文章
测试绝对路径和相对路径。

![相对路径图片](./${path.basename(tempImagePath)})
![绝对路径图片](${tempImagePath})`;

      await fs.writeFile(tempMarkdownPath, markdownContent);
      
      const result = await MarkdownParser.parseMarkdown(tempMarkdownPath);
      
      expect(result.images).toHaveLength(2);
      
      // 两个图片都应该指向同一个文件
      result.images.forEach((image: ImageData) => {
        expect(image.path).toBe(tempImagePath);
      });
    });

    test('should handle non-existent image files gracefully', async () => {
      const markdownContent = `# 测试文章
测试不存在的图片文件。

![不存在的图片](./non-existent-image.png)
![存在的图片](${path.basename(tempImagePath)})`;

      await fs.writeFile(tempMarkdownPath, markdownContent);
      
      const result = await MarkdownParser.parseMarkdown(tempMarkdownPath);
      
      // 只应该处理存在的图片文件
      expect(result.images).toHaveLength(1);
      expect(result.images[0].path).toBe(tempImagePath);
    });
  });

  describe('extractMetadata', () => {
    test('should extract metadata from markdown with frontmatter', () => {
      const markdownContent = `---
title: 测试文章标题
category: 技术
tags: [JavaScript, TypeScript, 测试]
description: 这是一个测试描述
cover: https://example.com/cover.jpg
---

# 文章内容
这是文章的实际内容。

## 章节1
内容描述...`;

      const result = MarkdownParser.extractMetadata(markdownContent);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBe('测试文章标题');
      expect(result.metadata.category).toBe('技术');
      expect(result.metadata.tags).toEqual(['JavaScript', 'TypeScript', '测试']);
      expect(result.metadata.description).toBe('这是一个测试描述');
      expect(result.metadata.cover).toBe('https://example.com/cover.jpg');
      
      expect(result.cleanContent).not.toContain('---');
      expect(result.cleanContent).toContain('# 文章内容');
    });

    test('should use default metadata when no frontmatter', () => {
      const markdownContent = `# 文章标题
这是没有 frontmatter 的文章内容。

## 章节1
内容描述...`;

      const result = MarkdownParser.extractMetadata(markdownContent);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBe('未命名文章');
      expect(result.metadata.category).toBe('前端');
      expect(result.metadata.tags).toEqual(['JavaScript']);
      
      expect(result.cleanContent).toBe(markdownContent);
    });

    test('should handle partial metadata in frontmatter', () => {
      const markdownContent = `---
title: 部分元数据文章
tags: [React, Vue]
---

# 文章内容
这是文章内容。`;

      const result = MarkdownParser.extractMetadata(markdownContent);
      
      expect(result.metadata.title).toBe('部分元数据文章');
      expect(result.metadata.category).toBe('前端'); // 使用默认值
      expect(result.metadata.tags).toEqual(['React', 'Vue']);
      expect(result.metadata.cover).toBeUndefined();
      expect(result.metadata.description).toBeUndefined();
    });

    test('should handle tags with spaces and special characters', () => {
      const markdownContent = `---
title: 测试文章
tags: [JavaScript, TypeScript, React Hooks, Vue.js, Node.js]
---

# 文章内容
这是文章内容。`;

      const result = MarkdownParser.extractMetadata(markdownContent);
      
      expect(result.metadata.tags).toEqual([
        'JavaScript',
        'TypeScript', 
        'React Hooks',
        'Vue.js',
        'Node.js'
      ]);
    });
  });

  describe('integration tests', () => {
    test('should parse real markdown file from fixtures', async () => {
      const fixturePath = path.join(fixturesDir, 'test-article.md');
      
      if (await fs.pathExists(fixturePath)) {
        const result = await MarkdownParser.parseMarkdown(fixturePath);
        
        expect(result).toBeDefined();
        expect(result.content).toContain('# 测试文章');
        expect(result.content).toContain('这是一个用于测试掘金发布功能的文章');
        
        // 这个文件包含一个远程图片，应该不会被处理
        expect(result.images).toHaveLength(0);
      } else {
        console.log('跳过真实文件测试：fixture 文件不存在');
      }
    });

    test('should extract metadata from real markdown file', async () => {
      const fixturePath = path.join(fixturesDir, 'test-article.md');
      
      if (await fs.pathExists(fixturePath)) {
        const content = await fs.readFile(fixturePath, 'utf-8');
        const result = MarkdownParser.extractMetadata(content);
        
        expect(result.metadata.title).toBe('测试文章');
        expect(result.metadata.category).toBe('前端');
        expect(result.metadata.tags).toEqual(['JavaScript', 'TypeScript', '测试']);
        expect(result.metadata.description).toBe('这是一个用于测试掘金发布功能的文章');
        
        expect(result.cleanContent).not.toContain('---');
        expect(result.cleanContent).toContain('# 测试文章');
      } else {
        console.log('跳过真实文件测试：fixture 文件不存在');
      }
    });
    test('should extract metadata from real markdown file with images', async () => {
      const fixturePath = path.join(fixturesDir, 'test-article-with-images.md');

      if (await fs.pathExists(fixturePath)) {
        const content = await fs.readFile(fixturePath, 'utf-8');
        const result = MarkdownParser.extractMetadata(content);

        expect(result.metadata.title).toBe('测试文章 - 包含本地图片');
        expect(result.metadata.category).toBe('前端');
        expect(result.metadata.tags).toEqual(['JavaScript', 'TypeScript', '测试','图片上传']);
        expect(result.metadata.description).toBe('这是一个用于测试掘金发布功能和图片上传的文章');

        expect(result.cleanContent).not.toContain('---');
        expect(result.cleanContent).toContain('# 测试文章');


        const result1 = await MarkdownParser.parseMarkdown(fixturePath);
        expect(result1).toBeDefined();
        expect(result1.images).toHaveLength(3);
        // 验证图片数据
        result1.images.forEach((image: ImageData) => {
          expect(image.alt).toMatch(/测试图片\d+/);
          // expect(image.path).toBe(tempImagePath);
          expect(image.buffer).toBeDefined();
          expect(image.mimeType).toBe('image/png');
        });
      } else {
        console.log('跳过真实文件测试：fixture 文件不存在');
      }
    });
  });

  describe('error handling', () => {
    test('should handle non-existent markdown file', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.md');
      
      await expect(MarkdownParser.parseMarkdown(nonExistentPath))
        .rejects.toThrow();
    });

    test('should handle invalid file path', async () => {
      const invalidPath = '';
      
      await expect(MarkdownParser.parseMarkdown(invalidPath))
        .rejects.toThrow();
    });
  });

});
