/**
 * 图片代理工具
 * 用于处理即梦图片的跨域问题
 */

/**
 * 判断是否是即梦的图片URL
 */
export function isJimengImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // 即梦图片域名
    return urlObj.hostname.includes('jimengai.com') || 
           urlObj.hostname.includes('volccdn.com') ||
           urlObj.hostname.includes('volces.com');
  } catch {
    return false;
  }
}

/**
 * 将即梦图片URL转换为代理URL
 */
export function getProxiedImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  
  // 如果已经是代理URL，直接返回
  if (originalUrl.includes('/api/v1/proxy/image')) {
    return originalUrl;
  }
  
  // 如果是本地URL（localhost或相对路径），直接返回
  if (originalUrl.startsWith('/') || originalUrl.includes('localhost')) {
    return originalUrl;
  }
  
  // 如果是即梦URL，使用代理
  if (isJimengImageUrl(originalUrl)) {
    return `http://localhost:4300/api/v1/proxy/image?url=${encodeURIComponent(originalUrl)}`;
  }
  
  // 其他外部URL也使用代理（防止跨域）
  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    return `http://localhost:4300/api/v1/proxy/image?url=${encodeURIComponent(originalUrl)}`;
  }
  
  return originalUrl;
}

/**
 * 批量转换图片URL为代理URL
 */
export function getProxiedImageUrls(urls: string[]): string[] {
  return urls.map(url => getProxiedImageUrl(url));
}

/**
 * 从代理URL中提取原始URL
 * @param proxyUrl 代理URL，格式：http://localhost:4300/api/v1/proxy/image?url=原始URL
 * @returns 原始URL，如果不是代理URL则返回原URL
 */
export function extractOriginalUrl(proxyUrl: string): string {
  if (!proxyUrl) return proxyUrl;
  
  try {
    // 检查是否是代理URL
    if (proxyUrl.includes('/api/v1/proxy/image?url=')) {
      const url = new URL(proxyUrl);
      const originalUrl = url.searchParams.get('url');
      return originalUrl || proxyUrl;
    }
    
    // 不是代理URL，直接返回
    return proxyUrl;
  } catch (error) {
    console.error('提取原始URL失败:', error);
    return proxyUrl;
  }
}








