/**
 * 服务器配置
 * 用于管理服务器URL、端口等配置
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * 获取公网可访问的服务器URL
 * 
 * 优先级：
 * 1. 环境变量 PUBLIC_URL (用于生产环境或ngrok)
 * 2. 默认 localhost:3000 (用于本地开发)
 * 
 * 使用示例：
 * - 本地开发: http://localhost:3000
 * - ngrok: https://xxxx.ngrok.io
 * - 生产服务器: https://your-domain.com
 */
export const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';

/**
 * 服务器端口
 */
export const PORT = process.env.PORT || 3000;

/**
 * 将相对路径转换为完整的公网URL
 * @param {string} path - 相对路径（如 /uploads/video/xxx.mp4）
 * @returns {string} 完整的公网URL
 */
export function toPublicUrl(path) {
  if (!path) return '';
  
  // 如果已经是完整URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // 确保path以/开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${PUBLIC_URL}${normalizedPath}`;
}

console.log('🌐 服务器配置已加载:');
console.log('   - 公网URL:', PUBLIC_URL);
console.log('   - 端口:', PORT);
console.log('   - 提示: 如需AI服务访问视频，请配置环境变量 PUBLIC_URL');








