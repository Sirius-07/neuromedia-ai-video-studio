import { apiUrl } from '../config/api';

/**
 * 即梦图像生成 API 客户端
 * 用于前端调用图像生成服务
 */

const API_BASE_URL = apiUrl('/api/v1/image');

// ==================== 类型定义 ====================

export interface ImageGenerationParams {
  prompt: string;
  imageUrls?: string[];
  width?: number;
  height?: number;
  scale?: number;
  forceSingle?: boolean;
  imageCount?: number; // 期望生成的图片数量（1-4）
  mode?: 'text_to_image' | 'image_to_image';
}

export interface ImageTask {
  taskId: string;
  status: 'submitted' | 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
  imageUrls?: string[];
  base64Images?: string[];
  requestId?: string;
  message?: string;
}

export interface ImageGenerationResult {
  taskId: string;
  imageUrls: string[];
  base64Images?: string[];
  requestId: string;
}

export interface ConfigStatus {
  configured: boolean;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  host: string;
  region: string;
  service: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  retry?: boolean;
}

// ==================== 视频生成类型 ====================

export type VideoModel = 'jimeng-pro' | 'jimeng-first' | 'jimeng-first-tail' | 'wan2.2' | 'comfyui';

export interface VideoGenerationParams {
  // 通用参数
  imageUrl?: string;        // 首帧图片URL（图生视频 - Pro模式）
  firstImageUrl?: string;   // 首帧图片URL（首尾帧模式）
  lastImageUrl?: string;    // 尾帧图片URL（首尾帧模式）
  prompt?: string;          // 提示词
  frames?: number;          // 帧数：即梦支持 121/241，wan2.2 默认 81
  aspectRatio?: '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
  seed?: number;
  model?: VideoModel;       // 模型选择
  // ComfyUI wan2.2 特有参数
  negativePrompt?: string;  // 负向提示词
  width?: number;           // 视频宽度
  height?: number;          // 视频高度
  fps?: number;             // 帧率
}

export interface VideoTask {
  taskId: string;
  status: 'submitted' | 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
  videoUrl?: string;
  requestId?: string;
  message?: string;
  model?: VideoModel;
}

export interface VideoGenerationResult {
  taskId: string;
  videoUrl: string;
  requestId?: string;
  model?: VideoModel;
  aigcMetaTagged?: boolean;  // 首尾帧模式返回的隐式标识状态
}

// ==================== API 方法 ====================

/**
 * 检查服务配置状态
 */
export async function checkConfig(): Promise<ConfigStatus> {
  const response = await fetch(`${API_BASE_URL}/config`);
  const result: ApiResponse<ConfigStatus> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '获取配置状态失败');
  }

  return result.data;
}

/**
 * 提交图像生成任务（异步）
 */
export async function submitTask(params: ImageGenerationParams): Promise<ImageTask> {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const result: ApiResponse<ImageTask> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '提交任务失败');
  }

  return result.data;
}

/**
 * 查询任务状态
 */
export async function getTaskStatus(taskId: string): Promise<ImageTask> {
  const response = await fetch(`${API_BASE_URL}/task/${taskId}`);
  const result: ApiResponse<ImageTask> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '查询任务失败');
  }

  return result.data;
}

/**
 * 同步生成图像（提交并等待结果）
 */
export async function generateSync(params: ImageGenerationParams): Promise<ImageGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/generate-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const result: ApiResponse<ImageGenerationResult> = await response.json();

  if (!result.success || !result.data) {
    const error = new Error(result.error || '生成图像失败') as Error & { code?: string; retry?: boolean };
    error.code = result.code;
    error.retry = result.retry;
    throw error;
  }

  return result.data;
}

/**
 * 文生图
 */
export async function textToImage(
  prompt: string,
  options: Omit<ImageGenerationParams, 'prompt' | 'imageUrls' | 'mode'> = {}
): Promise<ImageGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/text-to-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, ...options }),
  });

  const result: ApiResponse<ImageGenerationResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '文生图失败');
  }

  return result.data;
}

/**
 * 图生图
 */
export async function imageToImage(
  prompt: string,
  imageUrls: string[],
  options: Omit<ImageGenerationParams, 'prompt' | 'imageUrls' | 'mode'> = {}
): Promise<ImageGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/image-to-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, imageUrls, ...options }),
  });

  const result: ApiResponse<ImageGenerationResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '图生图失败');
  }

  return result.data;
}

// ==================== 轮询工具 ====================

/**
 * 等待任务完成（轮询）
 * @param taskId 任务ID
 * @param onProgress 进度回调函数
 * @param pollInterval 轮询间隔（毫秒），默认 2000
 * @param timeout 超时时间（毫秒），默认 5 分钟
 */
export async function waitForCompletion(
  taskId: string,
  onProgress?: (task: ImageTask) => void,
  pollInterval: number = 2000,
  timeout: number = 5 * 60 * 1000
): Promise<ImageTask> {
  const startTime = Date.now();

  while (true) {
    // 检查超时
    if (Date.now() - startTime > timeout) {
      throw new Error('任务超时');
    }

    const task = await getTaskStatus(taskId);

    // 调用进度回调
    if (onProgress) {
      onProgress(task);
    }

    // 任务完成
    if (task.status === 'done') {
      return task;
    }

    // 任务失败
    if (task.status === 'not_found') {
      throw new Error('任务未找到，可能已过期');
    }

    if (task.status === 'expired') {
      throw new Error('任务已过期，请重新提交');
    }

    // 等待后继续轮询
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * 提交任务并等待完成
 */
export async function generateAndWait(
  params: ImageGenerationParams,
  onProgress?: (task: ImageTask) => void
): Promise<ImageGenerationResult> {
  // 1. 提交任务
  const task = await submitTask(params);

  // 2. 等待完成
  const completedTask = await waitForCompletion(task.taskId, onProgress);

  // 3. 返回结果
  return {
    taskId: completedTask.taskId,
    imageUrls: completedTask.imageUrls || [],
    base64Images: completedTask.base64Images,
    requestId: completedTask.requestId || ''
  };
}

// ==================== 便捷方法 ====================

/**
 * 文生图并等待结果（带进度回调）
 */
export async function textToImageWithProgress(
  prompt: string,
  onProgress?: (task: ImageTask) => void,
  options: Omit<ImageGenerationParams, 'prompt' | 'imageUrls' | 'mode'> = {}
): Promise<ImageGenerationResult> {
  return generateAndWait(
    { prompt, ...options, mode: 'text_to_image' },
    onProgress
  );
}

/**
 * 图生图并等待结果（带进度回调）
 */
export async function imageToImageWithProgress(
  prompt: string,
  imageUrls: string[],
  onProgress?: (task: ImageTask) => void,
  options: Omit<ImageGenerationParams, 'prompt' | 'imageUrls' | 'mode'> = {}
): Promise<ImageGenerationResult> {
  return generateAndWait(
    { prompt, imageUrls, ...options, mode: 'image_to_image' },
    onProgress
  );
}

// ==================== 视频生成 API ====================

/**
 * 提交视频生成任务（异步）
 */
export async function submitVideoTask(params: VideoGenerationParams): Promise<VideoTask> {
  const response = await fetch(`${API_BASE_URL}/video/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const result: ApiResponse<VideoTask> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '提交视频任务失败');
  }

  return result.data;
}

/**
 * 查询视频任务状态
 */
export async function getVideoTaskStatus(taskId: string): Promise<VideoTask> {
  const response = await fetch(`${API_BASE_URL}/video/task/${taskId}`);
  const result: ApiResponse<VideoTask> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '查询视频任务失败');
  }

  return result.data;
}

/**
 * 图生视频（同步等待）
 */
export async function imageToVideo(
  imageUrl: string,
  prompt?: string,
  options: Omit<VideoGenerationParams, 'imageUrl' | 'prompt'> = {}
): Promise<VideoGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/image-to-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageUrl, prompt, ...options }),
  });

  const result: ApiResponse<VideoGenerationResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '图生视频失败');
  }

  return result.data;
}

/**
 * 文生视频（同步等待）
 */
export async function textToVideo(
  prompt: string,
  options: Omit<VideoGenerationParams, 'imageUrl' | 'prompt'> = {}
): Promise<VideoGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/text-to-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, ...options }),
  });

  const result: ApiResponse<VideoGenerationResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '文生视频失败');
  }

  return result.data;
}

/**
 * 等待视频任务完成（轮询）
 */
export async function waitForVideoCompletion(
  taskId: string,
  onProgress?: (task: VideoTask) => void,
  pollInterval: number = 3000,
  timeout: number = 15 * 60 * 1000
): Promise<VideoTask> {
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeout) {
      throw new Error('视频任务超时');
    }

    const task = await getVideoTaskStatus(taskId);

    if (onProgress) {
      onProgress(task);
    }

    if (task.status === 'done') {
      return task;
    }

    if (task.status === 'not_found') {
      throw new Error('视频任务未找到，可能已过期');
    }

    if (task.status === 'expired') {
      throw new Error('视频任务已过期，请重新提交');
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

// ==================== 默认导出 ====================

export default {
  checkConfig,
  submitTask,
  getTaskStatus,
  generateSync,
  textToImage,
  imageToImage,
  waitForCompletion,
  generateAndWait,
  textToImageWithProgress,
  imageToImageWithProgress,
  // 视频生成
  submitVideoTask,
  getVideoTaskStatus,
  imageToVideo,
  textToVideo,
  waitForVideoCompletion
};


