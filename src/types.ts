// 定义图片数据接口
export interface ImageData {
  alt: string;
  path: string;
  buffer?: Buffer;
  mimeType: string;
}

// 定义解析后的 Markdown 数据接口
export interface MarkdownData {
  content: string;
  images: ImageData[];
}

// 掘金文章元数据接口
export interface ArticleMetadata {
  title: string;
  category: string;
  tags: string[];
  cover?: string;
  description?: string;
}

// 发布选项接口
export interface PublishOptions {
  publish?: boolean;
  openBrowser?: boolean;
  useStoredLogin?: boolean;
  forceLogin?: boolean; // 强制重新登录
  loginTimeout?: number; // 登录超时时间（毫秒）
}