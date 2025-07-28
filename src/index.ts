import fs from 'fs-extra';
import MarkdownIt from 'markdown-it';
import clipboardy from 'clipboardy';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MarkdownData, ImageData } from './types.js';

// 计算 __dirname (在 ESM 中使用)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 初始化 markdown-it
const md = new MarkdownIt();

/**
 * 解析 Markdown 文件，提取文字和图片
 * @param filePath Markdown 文件路径
 * @returns 包含文字内容和图片数据的对象
 */
async function parseMarkdown(filePath: string): Promise<MarkdownData> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    const images: ImageData[] = [];
    let match: RegExpExecArray | null;

    // 获取 Markdown 文件的目录
    const mdDir = path.dirname(filePath);

    while ((match = imageRegex.exec(content)) !== null) {
      const [, alt, imagePath] = match;

      // 处理相对路径
      const absolutePath = path.isAbsolute(imagePath)
          ? imagePath
          : path.join(mdDir, imagePath);

      if (await fs.pathExists(absolutePath)) {
        const buffer = await fs.readFile(absolutePath);
        const extension = path.extname(absolutePath).toLowerCase();
        let mimeType = 'image/jpeg'; // 默认

        if (extension === '.png') mimeType = 'image/png';
        else if (extension === '.gif') mimeType = 'image/gif';
        else if (extension === '.webp') mimeType = 'image/webp';
        else if (extension === '.svg') mimeType = 'image/svg+xml';

        images.push({ alt, path: absolutePath, buffer, mimeType });
      } else {
        console.warn(`图片文件不存在: ${absolutePath}`);
      }
    }

    return { content, images };
  } catch (error) {
    console.error('解析 Markdown 文件失败:', error);
    throw new Error(`解析 Markdown 文件失败: ${(error as Error).message}`);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const filePath = args[0] || join(__dirname, '../test.md');

    if (!await fs.pathExists(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    console.log(`解析文件: ${filePath}`);
    const markdownData = await parseMarkdown(filePath);
    console.log(`找到 ${markdownData.images.length} 张图片`);

    // 将 Markdown 内容复制到剪贴板
    try {
      await clipboardy.write(markdownData.content);
      console.log('Markdown 内容已复制到剪贴板');

      // 输出图片信息
      markdownData.images.forEach(({ alt, mimeType, path }: ImageData, index: number) => {
        console.log(`图片 ${index + 1}:`);
        console.log(`  描述: ${alt || '无'}`);
        console.log(`  类型: ${mimeType}`);
        console.log(`  路径: ${path}`);
        console.log('---');
      });
    } catch (error) {
      console.error('复制到剪贴板失败:', (error as Error).message);
    }
  } catch (error) {
    console.error('程序错误:', (error as Error).message);
    process.exit(1);
  }
}

// 执行主函数
main();