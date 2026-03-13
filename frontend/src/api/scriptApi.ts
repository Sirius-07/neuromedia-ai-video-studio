/**
 * 脚本生成 API 模块
 * 
 * 调用 Node.js 后端的脚本生成服务
 */

// API 基础地址（Node.js 后端）
const API_BASE_URL = 'http://localhost:3000';

// ============================================================
// 类型定义
// ============================================================

/** 素材文件类型 */
export type FileType = 'image' | 'video';

/** 素材信息 */
export interface AssetInfo {
  file_path: string;
  url?: string; // 素材URL（用于直接访问）
  file_type: FileType;
  description: string | null;
  duration?: number; // 视频时长（秒），仅视频素材有效
  selected?: boolean; // 用户是否选中该素材（仅 AI+实拍模式）
}

/** 分镜类型 */
export type SceneType = 'ai_generated' | 'mixed_media';

/** 分镜模型 */
export interface Scene {
  scene_id: number;
  type: SceneType;
  script_content: string;
  narration?: string; // 字幕/旁白文案
  visual_description: string;
  estimated_duration: number;
  reference_asset_path: string | null;
  clip_start?: number; // 视频剪辑起始时间（秒）
  clip_end?: number; // 视频剪辑结束时间（秒）
}

/** 脚本响应 */
export interface ScriptResponse {
  project_id: string;
  title: string;
  scenes: Scene[];
  total_duration: number;
}

/** 生成模式类型 */
export type GenerationMode = 'ai_generated' | 'ai_plus_real' | 'pure_real';

/** 脚本生成请求参数 */
export interface GenerateScriptParams {
  user_prompt: string;
  uploaded_assets: AssetInfo[];
  project_title?: string;
  generation_mode?: GenerationMode;
  art_style?: string;    // 艺术风格 ID（children/animation/japanese/realistic/pencil/retro/custom）
  aspect_ratio?: string; // 画幅比例（16:9/9:16/1:1/4:3）
}

// ============================================================
// API 函数
// ============================================================

/**
 * 上传单个文件
 * @param file 要上传的文件
 * @returns 上传后的素材信息
 */
export async function uploadFile(file: File): Promise<AssetInfo> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/v1/script/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '上传失败' }));
    throw new Error(error.error || '文件上传失败');
  }

  return response.json();
}

/**
 * 批量上传文件
 * @param files 文件列表
 * @returns 上传后的素材信息列表
 */
export async function uploadFiles(files: File[]): Promise<AssetInfo[]> {
  const results: AssetInfo[] = [];
  
  for (const file of files) {
    try {
      const asset = await uploadFile(file);
      results.push(asset);
    } catch (error) {
      console.error(`上传文件失败: ${file.name}`, error);
    }
  }
  
  return results;
}

/**
 * 生成视频脚本
 * @param params 生成参数
 * @param useAI 是否使用真实 AI（默认 true）
 * @returns 生成的脚本响应
 */
export async function generateScript(
  params: GenerateScriptParams,
  useAI: boolean = true
): Promise<ScriptResponse> {
  // 根据 useAI 选择不同的端点
  const endpoint = useAI ? '/api/v1/script/generate' : '/api/v1/script/generate-mock';
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '生成失败' }));
    throw new Error(error.error || '脚本生成失败');
  }

  return response.json();
}

/**
 * 检查后端服务是否可用
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================
// 异步生成相关
// ============================================================

export interface ScriptTaskStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  step: 'initializing' | 'analyzing_assets' | 'generating' | 'parsing' | 'completed' | 'error';
  progress: number;
  details: string;
  result?: ScriptResponse;
  error?: string;
}

/**
 * 异步生成视频脚本（支持实时进度）
 * @param params 生成参数
 * @param onProgress 进度回调
 * @returns 生成的脚本响应
 */
export async function generateScriptAsync(
  params: GenerateScriptParams,
  onProgress?: (status: ScriptTaskStatus) => void
): Promise<ScriptResponse> {
  // 1. 启动任务
  const response = await fetch(`${API_BASE_URL}/api/v1/script/generate-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '启动生成失败' }));
    throw new Error(error.error || '脚本生成启动失败');
  }
  
  const { data: { taskId } } = await response.json();
  console.log('[ScriptApi] 异步任务已启动:', taskId);
  
  // 2. 轮询状态
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const statusRes = await fetch(`${API_BASE_URL}/api/v1/script/task/${taskId}`);
        
        if (!statusRes.ok) {
           if (statusRes.status === 404) {
             console.warn('⚠️ 任务未找到，稍后重试');
             setTimeout(poll, 1000);
             return;
           }
           throw new Error('获取任务状态失败');
        }
        
        const { data: task }: { data: ScriptTaskStatus } = await statusRes.json();
        
        if (onProgress) {
          onProgress(task);
        }
        
        if (task.status === 'completed') {
          if (task.result) {
            resolve(task.result);
          } else {
            reject(new Error('生成完成但无结果'));
          }
        } else if (task.status === 'error') {
          reject(new Error(task.error || '生成失败'));
        } else {
          // 继续轮询
          setTimeout(poll, 1000);
        }
      } catch (err) {
        console.error('轮询出错:', err);
        // 出错暂不终止，继续尝试（除非是致命错误）
        setTimeout(poll, 2000);
      }
    };
    poll();
  });
}