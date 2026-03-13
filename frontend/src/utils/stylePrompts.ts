/**
 * 艺术风格到中文提示词的映射
 * 用于在图片和视频生成时添加风格描述
 */

export const STYLE_PROMPTS: Record<string, string> = {
  children: '儿童画风格，色彩鲜艳，线条简单，充满童趣',
  animation: '动画风格，明亮色彩，流畅线条，卡通感',
  japanese: '日本水墨画风格，黑白灰色调，笔触飘逸，意境深远',
  realistic: '真实摄影风格，细节丰富，光影自然，写实画面',
  pencil: '铅笔画风格，黑白素描，线条细腻，明暗层次分明',
  retro: '黑白复古风格，怀旧氛围，经典质感，高对比度',
  custom: '自定义艺术风格'
};

/**
 * 获取风格的中文提示词
 * @param styleId 风格ID
 * @returns 风格提示词，如果没有则返回空字符串
 */
export function getStylePrompt(styleId?: string): string {
  if (!styleId) return '';
  return STYLE_PROMPTS[styleId] || '';
}

/**
 * 将风格提示词添加到原有提示词中
 * @param originalPrompt 原始提示词
 * @param styleId 风格ID
 * @returns 合并后的提示词
 */
export function addStyleToPrompt(originalPrompt: string, styleId?: string): string {
  const stylePrompt = getStylePrompt(styleId);
  if (!stylePrompt) return originalPrompt;
  
  // 如果原始提示词为空，直接返回风格提示词
  if (!originalPrompt || !originalPrompt.trim()) {
    return stylePrompt;
  }
  
  // 将风格提示词添加到开头
  return `${stylePrompt}，${originalPrompt}`;
}
