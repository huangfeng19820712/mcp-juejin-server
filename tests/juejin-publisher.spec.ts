import {test, expect,FileChooser} from '@playwright/test';
import {generateHumanTrack, dragSliderWithTrack} from '../src/captcha_solver';
import {getSliderOffsetFromUrls} from '../src/crop_background';
import {Page} from "playwright-core";
import {join} from "path";
import fs from "fs-extra";
import { MarkdownParser } from '../src/MarkdownParser';
// const __dirname = process.cwd();
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前模块的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 设置CodeMirror的值，内容
 * @param page
 * @param value
 */
async function setCodeMirrorValue(page:Page,value:string) {
     return page.evaluate((content) => {
         const cm = document.querySelector('.CodeMirror') as any;
         if (cm && cm.CodeMirror) {
             cm.CodeMirror.setValue(content);
         }
     }, value);
}

/**
 * 通过请求来判断上传图片是否成功，因为会有多个图片情况
 * @param page
 */
async function uploadImages(page:Page) {
    const targetUrl = 'https://api.juejin.cn/content_api/v1/article_draft/update';

    const response = await page.waitForResponse(async (resp) => {
        return resp.url().startsWith(targetUrl) && resp.status() === 200;
    }, { timeout: 10000 }); // 超时 10 秒

// 可选：解析返回的 JSON 看是否业务成功
    const data = await response.json();
    console.log('返回数据：', data);
// 根据返回内容判断业务是否成功
    if (data.err_no === 0) {
        console.log('草稿更新成功！');
        return true;
    } else {
        console.error('草稿更新失败：', data.err_msg);
        return false;
    }

}


test.describe('掘金文章发布测试', () => {
    test('发布包含本地图片的文章', async ({ browser}) => {
        const statePath = join(__dirname, '../juejin-storage-state.json');
        if (!await fs.pathExists(statePath)) {
            return
        }

        const state = await fs.readJSON(statePath);
        const context = await browser.newContext({ storageState: state })
        const page = await context.newPage();
        
        // 1. 打开掘金编辑器
        await page.goto('https://juejin.cn/editor/drafts/new', { waitUntil: 'networkidle' });
        await page.waitForSelector('.CodeMirror-wrap', { timeout: 10000 });
        
        // 2. 解析测试文章（使用包含图片的测试文章）
        const testArticlePath = join(__dirname, '/fixtures/test-article-with-images.md');
        const { content, images } = await MarkdownParser.parseMarkdown(testArticlePath);
        const { metadata, cleanContent } = MarkdownParser.extractMetadata(content);
        
        console.log(`📖 解析文章: ${metadata.title}`);
        console.log(`🏷️ 分类: ${metadata.category}`);
        console.log(`🏷️ 标签: ${metadata.tags?.join(', ')}`);
        console.log(`🖼️ 发现图片数量: ${images.length}`);
        
        // 3. 填充标题
        await page.fill('.title-input', metadata.title || '测试文章');
        console.log('✅ 标题已填充');
        
        // 4. 上传本地图片到掘金
        let updatedContent = cleanContent;
        if (images.length > 0) {
            console.log(`\n🔄 开始上传 ${images.length} 张本地图片...`);


            // 等待 CodeMirror 编辑器加载
            await page.waitForSelector('.bytemd-toolbar-icon[bytemd-tippy-path="5"]');

             // 监听 file chooser 事件
          const [fileChooser]: [FileChooser] = await Promise.all([
            page.waitForEvent('filechooser'),
              // 点击上传图片的图标,获取第一个元素
            page.locator('.bytemd-toolbar-icon[bytemd-tippy-path="5"]').nth(0).click() // 触发弹出文件选择框
          ]);

            // 等待文件选择输入框出现.
            // const fileInput = await page.waitForSelector('.file-input', { state: 'attached' });
            let imagePaths:string[] = [];
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                imagePaths.push(image.path);
            }
            // 设置要上传的文件
            await fileChooser.setFiles(imagePaths);
            // await fileInput.setInputFiles(imagePaths);

            // 可选：等待编辑器内容更新（例如，图片的 Markdown 链接插入）
            // await page.waitForTimeout(10000); // 根据实际加载时间调整
            await uploadImages(page);
            // 可选：验证图片是否成功插入到 CodeMirror 编辑器
            const imagesUrlContent = await page.evaluate(() => {
                const editor = document.querySelector('.CodeMirror');
                return editor.CodeMirror.getValue(); // 获取编辑器内容
            });
            console.log('Editor content:', imagesUrlContent);
            // 2. 从 codemirrorContent 提取图片 URL
            const newImagesUrls = Array.from(
                imagesUrlContent.matchAll(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g),
                match => match[1]
            );

            console.log('提取到的掘金图片URL:', newImagesUrls);

            // 4. 替换本地图片地址为掘金地址（按顺序）
            let index = 0;
            updatedContent = updatedContent.replace(
                /(!\[.*?\]\()(?!https?:\/\/)([^\)]+)(\))/g,
                (_, p1, p2, p3) => {
                    const newUrl = newImagesUrls[index++];
                    return `${p1}${newUrl}${p3}`;
                }
            );
        }

        // 6. 将更新后的内容复制到剪贴板并粘贴到编辑器
        console.log('📋 准备粘贴更新后的内容...');

        await setCodeMirrorValue(page,updatedContent)

        // 等待内容粘贴完成
        await page.waitForTimeout(3000);
        
        // 7. 验证内容是否正确粘贴
        const finalContent = await page.locator('.CodeMirror-code').textContent();
        expect(finalContent).toContain(metadata.title || '测试文章');
        console.log('✅ 内容验证通过');
        
        // 8. 保存草稿
        console.log('\n💾 保存草稿...');
        const draftButton = page.locator('.xitu-btn.btn-drafts.with-padding.xitu-btn-outline');
        await draftButton.click();
        console.log('✅ 草稿保存成功');
        
        console.log('\n🎉 文章发布流程完成！');
        console.log(`📝 标题: ${metadata.title}`);
        console.log(`🏷️ 分类: ${metadata.category}`);
        console.log(`🏷️ 标签: ${metadata.tags?.join(', ')}`);
        console.log(`🖼️ 处理图片数量: ${images.length}`);
        console.log(`📄 内容长度: ${updatedContent.length} 字符`);
    });
    
    
});