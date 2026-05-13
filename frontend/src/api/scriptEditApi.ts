/**
 * 脚本编辑 API
 * 支持脚本编辑页面的AI交互功能
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4300';

export interface SceneItem {
  id: string;
  sceneNumber: number;
  description: string;
  narration?: string;
  visualStyle?: string;
  bgmStyle?: string;
  assetType?: 'real_footage' | 'ai_generated' | 'image';
  assetId?: string;
  duration?: number;
  cameraMovement?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatWithAIParams {
  userInput: string;
  currentScenes: SceneItem[];
  conversationHistory: ChatMessage[];
  proposal?: any;
  userPrompt?: string;
}

export interface AiChange {
  type: 'edit' | 'add' | 'delete';
  sceneIndex?: number;
  afterIndex?: number;
  fields?: Partial<SceneItem>;
  scene?: Partial<SceneItem>;
}

export interface ChatWithAIResponse {
  success: boolean;
  data?: {
    message: string;
    action: string;
    changes: AiChange[];
  };
  error?: string;
}

export interface OptimizeScenesParams {
  scenes: SceneItem[];
  optimizationType?: 'general' | 'pacing' | 'visual' | 'emotion' | 'conflict' | 'regenerate';
  userDirection?: string;
}

export interface OptimizeScenesResponse {
  success: boolean;
  data?: {
    optimizedScenes: SceneItem[];
    explanation: string;
  };
  error?: string;
}

export interface InsertSceneParams {
  scenes: SceneItem[];
  insertPosition: number;
  sceneDescription: string;
}

export interface InsertSceneResponse {
  success: boolean;
  data?: {
    scenes: SceneItem[];
    insertedScene: SceneItem;
  };
  error?: string;
}

export interface AdjustPacingParams {
  scenes: SceneItem[];
  pacingType: 'faster' | 'slower' | 'balanced';
}

export interface AdjustPacingResponse {
  success: boolean;
  data?: {
    scenes: SceneItem[];
    message: string;
  };
  error?: string;
}

/**
 * AI对话 - 与AI交互优化脚本
 * @param signal 可选的 AbortSignal，用于取消请求
 */
export async function chatWithAI(params: ChatWithAIParams, signal?: AbortSignal): Promise<ChatWithAIResponse> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/script-edit/chat`, params, { signal });
    return response.data;
  } catch (error: any) {
    // 用户主动取消，不算错误
    if (axios.isCancel(error) || error.name === 'AbortError' || error.name === 'CanceledError') {
      return { success: false, error: 'cancelled' };
    }
    console.error('AI对话失败:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'AI对话失败'
    };
  }
}

/**
 * 批量优化场景（支持整体重新生成）
 */
export async function optimizeScenes(params: OptimizeScenesParams): Promise<OptimizeScenesResponse> {
  try {
    const { scenes, optimizationType, userDirection } = params;
    const response = await axios.post(`${API_BASE_URL}/api/script-edit/optimize-scenes`, {
      scenes,
      optimizationType,
      userDirection
    });
    return response.data;
  } catch (error: any) {
    console.error('场景优化失败:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || '场景优化失败'
    };
  }
}

/**
 * 插入新场景
 */
export async function insertScene(params: InsertSceneParams): Promise<InsertSceneResponse> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/script-edit/insert-scene`, params);
    return response.data;
  } catch (error: any) {
    console.error('插入场景失败:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || '插入场景失败'
    };
  }
}

export interface EnhanceSceneParams {
  scene: SceneItem;
  surroundingScenes?: { prev?: SceneItem; next?: SceneItem };
  allScenes?: SceneItem[];
  proposal?: any;
  userPrompt?: string;
}

export interface EnhanceSceneResponse {
  success: boolean;
  data?: { scene: SceneItem };
  error?: string;
}

/**
 * AI润色单条自定义场景
 */
export async function enhanceScene(params: EnhanceSceneParams): Promise<EnhanceSceneResponse> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/script-edit/enhance-scene`, params);
    return response.data;
  } catch (error: any) {
    console.error('场景润色失败:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || '场景润色失败'
    };
  }
}

/**
 * 调整节奏
 */
export async function adjustPacing(params: AdjustPacingParams): Promise<AdjustPacingResponse> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/script-edit/adjust-pacing`, params);
    return response.data;
  } catch (error: any) {
    console.error('节奏调整失败:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || '节奏调整失败'
    };
  }
}
