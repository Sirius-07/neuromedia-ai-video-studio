/**
 * 标签精炼 API 客户端
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * 视频提示词标签结构
 */
export interface VideoPromptTags {
  subjects: string[];     // 主体
  environment: string[];  // 环境
  style: string[];        // 风格
  action: string[];       // 动态/运镜
}

/**
 * 标签精炼请求参数
 */
export interface RefineTagsRequest {
  scriptContent: string;              // 当前分镜的原始剧本内容（必填）
  currentTags?: VideoPromptTags;      // 当前已有的标签数据（可选）
  userInstruction?: string;           // 用户的修改指令（可选）
}

/**
 * 标签精炼响应
 */
export interface RefineTagsResponse {
  code: number;
  data: {
    tags: VideoPromptTags;
    message: string;  // AI 对本次修改的说明
  };
  message?: string;
}

/**
 * 智能标签生成与修订
 * - 如果 currentTags 为空或 userInstruction 为空 → 初始化模式（冷启动）
 * - 如果都存在 → 修订模式（热更新）
 */
export async function refineTags(params: RefineTagsRequest): Promise<RefineTagsResponse> {
  try {
    const response = await axios.post<RefineTagsResponse>(
      `${API_BASE_URL}/api/ai/refine-tags`,
      params,
      {
        timeout: 60000  // 60秒超时
      }
    );
    
    return response.data;
  } catch (error: any) {
    console.error('标签精炼失败:', error);
    
    // 提取错误信息
    if (error.response?.data) {
      throw new Error(error.response.data.message || '标签精炼失败');
    } else if (error.request) {
      throw new Error('网络请求失败，请检查网络连接');
    } else {
      throw new Error(error.message || '未知错误');
    }
  }
}

/**
 * 标签转文本提示词（用于高级预览）
 * 按照：主体 + 环境 + 风格 + 动态 的顺序拼接
 */
export function tagsToPromptText(tags: VideoPromptTags): string {
  const parts: string[] = [];
  
  if (tags.subjects.length > 0) {
    parts.push(tags.subjects.join(', '));
  }
  if (tags.environment.length > 0) {
    parts.push(tags.environment.join(', '));
  }
  if (tags.style.length > 0) {
    parts.push(tags.style.join(', '));
  }
  if (tags.action.length > 0) {
    parts.push(tags.action.join(', '));
  }
  
  return parts.join('; ');
}

/**
 * 创建空标签对象
 */
export function createEmptyTags(): VideoPromptTags {
  return {
    subjects: [],
    environment: [],
    style: [],
    action: []
  };
}

