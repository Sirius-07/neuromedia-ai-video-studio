/**
 * 脚本同步 API
 * 用于将脚本文本转换为视觉提示词
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4300';

export interface ScriptToPromptRequest {
  scriptText: string;
  lockedTags?: string[];
  previousPrompt?: string;
  sceneType?: 'ai' | 'real' | 'empty';
}

export interface ScriptToPromptResponse {
  success: boolean;
  data?: {
    visualPrompt: string;
    motionPrompt?: string;
    extractedKeywords: {
      subjects: string[];
      environment: string[];
      actions: string[];
    };
    confidence: number; // 0-1
  };
  error?: string;
}

/**
 * 调用 LLM 将脚本转换为提示词
 */
export async function convertScriptToPrompt(
  request: ScriptToPromptRequest
): Promise<ScriptToPromptResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/script/to-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || '转换失败');
    }

    return await response.json();
  } catch (error) {
    console.error('脚本转换失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 简单的客户端版本（Fallback，不调用API）
 */
export function convertScriptToPromptLocal(scriptText: string, lockedTags: string[] = []): string {
  // 简单的关键词提取逻辑
  const keywords: string[] = [];
  
  // 常见关键词库
  const subjectKeywords = ['人物', '建筑', '风景', '动物', '车辆', '老人', '少年', '女孩', '男孩', '广州塔', '舞狮'];
  const envKeywords = ['晨光', '夕阳', '夜晚', '雨天', '晴天', '室内', '室外', '街道', '公园', '赛博朋克', '古风'];
  const actionKeywords = ['奔跑', '行走', '跳舞', '飞行', '站立', '坐下', '欢呼', '挥手', '打太极', '微笑'];

  [...subjectKeywords, ...envKeywords, ...actionKeywords].forEach(keyword => {
    if (scriptText.includes(keyword) && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  // 组合锁定标签和提取的关键词
  const lockedPart = lockedTags.length > 0 ? lockedTags.join(', ') + ', ' : '';
  const extractedPart = keywords.join(', ');

  return lockedPart + extractedPart;
}








