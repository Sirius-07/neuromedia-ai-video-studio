import axios from 'axios';
import { generateFFmpegFilterString, VideoEffectsParams } from '../hooks/useVideoEffects';

const API_BASE_URL = 'http://localhost:3000/api/v1';

/**
 * 应用后期处理效果到视频
 */
export interface ProcessVideoRequest {
  videoUrl: string;
  effects: VideoEffectsParams;
  outputFormat?: 'mp4' | 'webm';
}

export interface ProcessVideoResponse {
  success: boolean;
  processedVideoUrl: string;
  message?: string;
}

/**
 * 应用视频后期处理效果（后端FFmpeg处理）
 */
export const applyVideoEffects = async (request: ProcessVideoRequest): Promise<ProcessVideoResponse> => {
  try {
    // 将前端参数转换为 FFmpeg 滤镜字符串
    const ffmpegFilter = generateFFmpegFilterString(request.effects);
    
    console.log('📤 发送视频处理请求:', {
      videoUrl: request.videoUrl,
      ffmpegFilter,
      effects: request.effects
    });

    const response = await axios.post(`${API_BASE_URL}/video/process`, {
      video_url: request.videoUrl,
      ffmpeg_filter: ffmpegFilter,
      output_format: request.outputFormat || 'mp4'
    }, {
      timeout: 300000 // 5分钟超时
    });

    return {
      success: true,
      processedVideoUrl: response.data.processed_video_url,
      message: response.data.message
    };
  } catch (error) {
    console.error('❌ 视频处理失败:', error);
    throw new Error(error instanceof Error ? error.message : '视频处理失败');
  }
};

/**
 * 获取视频处理进度
 */
export interface ProcessingProgress {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
}

export const getProcessingProgress = async (taskId: string): Promise<ProcessingProgress> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/video/process/${taskId}/progress`);
    return response.data;
  } catch (error) {
    console.error('获取处理进度失败:', error);
    throw error;
  }
};

/**
 * 导出带有后期处理的视频
 * 这个函数会在前端预览基础上，生成真实的处理后视频
 */
export const exportProcessedVideo = async (
  videoUrl: string,
  effects: VideoEffectsParams,
  filename?: string
): Promise<void> => {
  try {
    const result = await applyVideoEffects({
      videoUrl,
      effects
    });

    // 触发下载
    const link = document.createElement('a');
    link.href = result.processedVideoUrl;
    link.download = filename || `processed_video_${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ 视频导出成功');
  } catch (error) {
    console.error('视频导出失败:', error);
    throw error;
  }
};





















