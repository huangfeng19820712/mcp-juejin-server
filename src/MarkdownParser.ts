import fs from 'fs-extra';
import path from 'path';
import { MarkdownData, ImageData, ArticleMetadata } from './types.js';

export class MarkdownParser {
  /**
   * 解析 Markdown 文件，提取文字和图片
   */
  static async parseMarkdown(filePath: string): Promise<MarkdownData> {
    const content = await fs.readFile(filePath, 'utf-8');
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    const images: ImageData[] = [];
    let match: RegExpExecArray | null;
    const mdDir = path.dirname(filePath);
    while ((match = imageRegex.exec(content)) !== null) {
      const [, alt, imagePath] = match;
      const absolutePath = path.isAbsolute(imagePath)
        ? imagePath
        : path.join(mdDir, imagePath);
      if (await fs.pathExists(absolutePath)) {
        const buffer = await fs.readFile(absolutePath);
        const extension = path.extname(absolutePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (extension === '.png') mimeType = 'image/png';
        else if (extension === '.gif') mimeType = 'image/gif';
        else if (extension === '.webp') mimeType = 'image/webp';
        else if (extension === '.svg') mimeType = 'image/svg+xml';
        images.push({ alt, path: absolutePath, buffer, mimeType });
      }
    }
    return { content, images };
  }

  /**
   * 从 Markdown 内容中提取文章元数据
   */
  static extractMetadata(content: string): { metadata: ArticleMetadata, cleanContent: string } {
    const metadataRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(metadataRegex);
    const defaultMetadata: ArticleMetadata = {
      title: '未命名文章',
      category: '前端',
      tags: ['JavaScript'],
    };
    let cleanContent = content;
    if (match) {
      const metadataText = match[1];
      const lines = metadataText.split('\n');
      const metadata = { ...defaultMetadata };
      for (const line of lines) {
        const parts = line.split(':', 2);
        if (parts.length === 2) {
          const key = parts[0].trim();
          const value = parts[1].trim();
          if (key && value) {
            if (key === 'tags') {
              metadata.tags = value.split(',').map(tag => tag.trim());
            } else if (key in defaultMetadata || key === 'cover' || key === 'description') {
              (metadata as any)[key] = value;
            }
          }
        }
      }
      cleanContent = content.replace(metadataRegex, '');
      return { metadata, cleanContent };
    }
    return { metadata: defaultMetadata, cleanContent };
  }
} 