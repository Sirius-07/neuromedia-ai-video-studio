import axios from 'axios';
import { apiUrl } from '../config/api';

const API_BASE_URL = apiUrl('/api/v1');

/**
 * AI优化请求参数
 */
export interface VideoOptimizationRequest {
  video_url: string;
  project_theme?: string;
  scene_script?: string;
}

/**
 * AI优化响应数据
 */
export interface VideoOptimizationResult {
  analysis: string;
  recommendations: string[];
  parameters: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: string;
    detail: string;
    denoiseLevel: string;
    filter: string;
  };
  videoInput: string;
  optimizedAt: string;
  aiModel: string;
}

export interface VideoOptimizationResponse {
  success: boolean;
  data?: VideoOptimizationResult;
  message?: string;
  error?: string;
}

/**
 * 调用AI一键优化视频后期处理参数
 * @param request 优化请求参数
 * @returns 优化结果
 */
export const optimizeVideoWithAI = async (
  request: VideoOptimizationRequest
): Promise<VideoOptimizationResult> => {
  try {
    console.log('🎨 [前端] 发送AI优化请求:', request);

    const response = await axios.post<VideoOptimizationResponse>(
      `${API_BASE_URL}/video/optimize`,
      request,
      {
        timeout: 180000 // 3分钟超时（视频分析需要更长时间）
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || response.data.message || 'AI优化失败');
    }

    console.log('✅ [前端] AI优化成功:', response.data.data);

    return response.data.data;
  } catch (error) {
    console.error('❌ [前端] AI优化失败:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(error.response.data?.message || error.response.data?.error || 'AI优化失败');
      } else if (error.request) {
        throw new Error('网络请求失败，请检查网络连接');
      }
    }
    
    throw new Error(error instanceof Error ? error.message : 'AI优化失败');
  }
};

