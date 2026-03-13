/**
 * 音频创作API
 * 
 * 处理从分镜页面到音频创作的完整流程
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';

export interface Scene {
  videoUrl: string;
  postProcessing?: any;
  clipStartTime?: number;
  clipEndTime?: number;
  assetUrl?: string;
}

export interface MusicCreationResult {
  success: boolean;
  partial?: boolean;
  data: {
    videoUrl: string;
    localVideoPath: string;
    videoFilename: string;
    uploadResult?: {
      bucket: string;
      objectKey: string;
      region: string;
      fileSizeInMB: number;
      uploadDuration: number;
    };
    instructionBlueprint?: {
      background_music: {
        prompt: string;
        mood: string;
        genre: string;
        duration: number;
        startTime: string;
        volume: number;
      };
      sound_effects: Array<{
        prompt: string;
        timestamp: string;
        description: string;
        category: string;
        duration: number;
        volume: number;
      }>;
    };
    stats: {
      scenesCount: number;
      videoCount: number;
    };
    error?: string;
    message?: string;
  };
  message?: string;
}

export interface TOSConfigStatus {
  success: boolean;
  data: {
    configured: boolean;
    region?: string;
    bucket?: string | null;
    message: string;
    error?: string;
  };
}

export interface TaskStatus {
  id: string;
  status: 'processing' | 'completed' | 'error';
  step: 'preparing' | 'concatenating' | 'uploading' | 'analyzing' | 'completed' | 'error';
  progress: number;
  details: string;
  subProgress?: {
    current: number;
    total: number;
    item: string;
  };
  result?: MusicCreationResult;
  error?: string;
}

/**
 * 创建音频创作任务（完整流程）
 * 
 * 流程：
 * 1. 提交任务获取 TaskID
 * 2. 轮询获取任务状态
 * 
 * @param scenes - 分镜数组
 * @param onProgress - 进度回调函数
 * @returns 音频创作任务结果
 */
export async function createMusicCreationTask(
  scenes: Scene[],
  onProgress?: (status: TaskStatus) => void
): Promise<MusicCreationResult> {
  console.log('🎵 [API] 创建音频创作任务，分镜数量:', scenes.length);
  
  try {
    // 1. 提交任务
    const response = await fetch(`${API_BASE_URL}/music-creation/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '创建音频创作任务失败');
    }

    const { data: { taskId } } = await response.json();
    console.log('✅ [API] 任务提交成功, taskId:', taskId);

    // 2. 轮询状态
    return new Promise((resolve, reject) => {
      const pollInterval = 1000;
      
      const poll = async () => {
        try {
          const statusRes = await fetch(`${API_BASE_URL}/music-creation/status/${taskId}`);
          
          if (!statusRes.ok) {
            // 如果是404，可能是任务还没写入，重试几次？或者直接报错
            if (statusRes.status === 404) {
               console.warn('⚠️ 任务未找到，可能是初始化延迟');
            } else {
               throw new Error(`获取状态失败: ${statusRes.statusText}`);
            }
          } else {
             const { data: task }: { data: TaskStatus } = await statusRes.json();
             
             if (onProgress) {
               onProgress(task);
             }
             
             if (task.status === 'completed') {
               if (task.result) {
                 resolve(task.result);
                 return;
               } else {
                 reject(new Error('任务完成但无结果返回'));
                 return;
               }
             } else if (task.status === 'error') {
               reject(new Error(task.error || '任务执行失败'));
               return;
             }
          }
          
          // 继续轮询
          setTimeout(poll, pollInterval);
          
        } catch (error) {
           console.error('轮询出错:', error);
           // 暂时不因轮询错误而终止，除非连续错误？这里简单处理为继续重试或者抛出
           // 如果是严重错误则 reject
           reject(error);
        }
      };
      
      // 启动轮询
      poll();
    });
    
  } catch (error) {
    console.error('❌ [API] 创建音频创作任务失败:', error);
    throw error;
  }
}

/**
 * 仅上传视频（不进行AI分析）
 * 
 * 用于快速导出视频到TOS
 * 
 * @param scenes - 分镜数组
 * @returns 上传结果
 */
export async function uploadVideoOnly(scenes: Scene[]): Promise<MusicCreationResult> {
  console.log('📤 [API] 仅上传视频，分镜数量:', scenes.length);
  
  try {
    const response = await fetch(`${API_BASE_URL}/music-creation/upload-only`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '上传视频失败');
    }

    const result: MusicCreationResult = await response.json();
    console.log('✅ [API] 视频上传成功');
    
    return result;
    
  } catch (error) {
    console.error('❌ [API] 上传视频失败:', error);
    throw error;
  }
}

/**
 * 检查TOS配置状态
 * 
 * @returns TOS配置状态
 */
export async function checkTOSConfiguration(): Promise<TOSConfigStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/music-creation/check-tos`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('检查TOS配置失败');
    }

    const result: TOSConfigStatus = await response.json();
    
    if (result.data.configured) {
      console.log('✅ [API] TOS配置有效');
    } else {
      console.warn('⚠️ [API] TOS未配置或配置无效');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ [API] 检查TOS配置失败:', error);
    throw error;
  }
}
