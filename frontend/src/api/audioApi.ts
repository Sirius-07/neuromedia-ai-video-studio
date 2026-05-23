import { apiUrl, assetUrl } from '../config/api';

/**
 * Stable Audio API 客户端
 * 用于前端调用音频生成服务
 */

const API_BASE_URL = apiUrl('/api/v1/audio');

export interface AudioGenerationParams {
  prompt: string;
  duration: number;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  sampler_type?: string;
  sigma_min?: number;
  sigma_max?: number;
}

export interface AudioTask {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  duration: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  outputFileUrl?: string;
  outputFilePath?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 创建音频生成任务（完整参数）
 */
export async function createAudioTask(params: AudioGenerationParams): Promise<AudioTask> {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const result: ApiResponse<AudioTask> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '创建任务失败');
  }

  return result.data;
}

/**
 * 快速创建音频生成任务（简化参数）
 */
export async function quickGenerateAudio(prompt: string, duration: number): Promise<AudioTask> {
  const response = await fetch(`${API_BASE_URL}/quick-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, duration }),
  });

  const result: ApiResponse<AudioTask> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '创建任务失败');
  }

  return result.data;
}

/**
 * 查询任务状态
 */
export async function getTaskStatus(taskId: string): Promise<AudioTask> {
  const response = await fetch(`${API_BASE_URL}/task/${taskId}`);
  
  const result: ApiResponse<AudioTask> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '查询任务失败');
  }

  return result.data;
}

/**
 * 获取所有任务列表
 */
export async function getAllTasks(options?: {
  limit?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}): Promise<AudioTask[]> {
  const params = new URLSearchParams();
  
  if (options?.limit) {
    params.append('limit', options.limit.toString());
  }
  
  if (options?.status) {
    params.append('status', options.status);
  }

  const url = `${API_BASE_URL}/tasks${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  
  const result: ApiResponse<{ tasks: AudioTask[]; count: number }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || '获取任务列表失败');
  }

  return result.data.tasks;
}

/**
 * 删除任务
 */
export async function deleteTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/task/${taskId}`, {
    method: 'DELETE',
  });

  const result: ApiResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error || '删除任务失败');
  }
}

/**
 * 等待任务完成（轮询）
 * @param taskId 任务ID
 * @param onProgress 进度回调函数
 * @param pollInterval 轮询间隔（毫秒），默认 5000
 * @param timeout 超时时间（毫秒），默认 10 分钟
 */
export async function waitForCompletion(
  taskId: string,
  onProgress?: (task: AudioTask) => void,
  pollInterval: number = 5000,
  timeout: number = 10 * 60 * 1000
): Promise<AudioTask> {
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
    if (task.status === 'completed') {
      return task;
    }

    // 任务失败
    if (task.status === 'failed') {
      throw new Error(task.errorMessage || '任务失败');
    }

    // 等待后继续轮询
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * 一键生成音频并等待完成
 * @param prompt 提示词
 * @param duration 音频时长（秒）
 * @param onProgress 进度回调函数
 */
export async function generateAndWait(
  prompt: string,
  duration: number,
  onProgress?: (task: AudioTask) => void
): Promise<string> {
  // 1. 创建任务
  const task = await quickGenerateAudio(prompt, duration);
  
  // 2. 等待完成
  const completedTask = await waitForCompletion(task.taskId, onProgress);
  
  // 3. 返回音频 URL
  if (!completedTask.outputFileUrl) {
    throw new Error('音频文件 URL 不存在');
  }
  
  return assetUrl(completedTask.outputFileUrl);
}

/**
 * 获取音频文件的完整 URL
 */
export function getAudioUrl(fileUrl: string): string {
  if (fileUrl.startsWith('http')) {
    return fileUrl;
  }
  return assetUrl(fileUrl);
}

/**
 * 下载音频文件
 */
export async function downloadAudio(fileUrl: string, filename?: string): Promise<void> {
  const url = getAudioUrl(fileUrl);
  
  const response = await fetch(url);
  const blob = await response.blob();
  
  // 创建下载链接
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename || 'audio.wav';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 清理
  window.URL.revokeObjectURL(downloadUrl);
}















