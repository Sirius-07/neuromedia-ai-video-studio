/**
 * TTS API - 语音合成
 * 
 * 对接后端 IndexTTS2 服务
 */

const API_BASE = 'http://localhost:4300/api/tts';

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  emotions: string[];
}

export interface GenerateVoiceoverRequest {
  text: string;
  voice?: string;          // 默认 'stable-male'
  speed?: number;          // 默认 1.0, 范围 0.5-2.0
  emotion?: string;        // 默认 'neutral'
}

export interface VoiceoverResult {
  success: boolean;
  audio_path?: string;
  audio_url?: string;
  duration?: number;
  text_length?: number;
  message?: string;
}

export interface BatchGenerateRequest {
  texts: string[];
  voice?: string;
  speed?: number;
  emotion?: string;
}

export interface BatchGenerateResult {
  success: boolean;
  results: Array<VoiceoverResult & { index: number; text: string }>;
  total: number;
  success_count: number;
  failed_count: number;
  message: string;
}

export interface Scene {
  narration?: string;
  script?: string;
  [key: string]: any;
}

export interface SceneWithVoiceover extends Scene {
  voiceover?: VoiceoverResult;
}

export interface GenerateSceneVoiceoversRequest {
  scenes: Scene[];
  voice?: string;
  speed?: number;
  emotion?: string;
}

export interface GenerateSceneVoiceoversResult {
  success: boolean;
  scenes: SceneWithVoiceover[];
  summary: {
    total: number;
    success_count: number;
    failed_count: number;
  };
  message: string;
}

/**
 * 生成单个配音
 */
export async function generateVoiceover(
  request: GenerateVoiceoverRequest
): Promise<VoiceoverResult> {
  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('生成配音失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 批量生成配音
 */
export async function batchGenerateVoiceovers(
  request: BatchGenerateRequest
): Promise<BatchGenerateResult> {
  try {
    const response = await fetch(`${API_BASE}/batch-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('批量生成配音失败:', error);
    return {
      success: false,
      results: [],
      total: 0,
      success_count: 0,
      failed_count: request.texts.length,
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 为分镜列表生成配音
 */
export async function generateSceneVoiceovers(
  request: GenerateSceneVoiceoversRequest
): Promise<GenerateSceneVoiceoversResult> {
  try {
    const response = await fetch(`${API_BASE}/scenes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('生成分镜配音失败:', error);
    return {
      success: false,
      scenes: request.scenes,
      summary: {
        total: request.scenes.length,
        success_count: 0,
        failed_count: request.scenes.length,
      },
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 获取可用的语音列表
 */
export async function getAvailableVoices(): Promise<{
  success: boolean;
  voices?: Record<string, VoiceOption>;
  message?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/voices`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取语音列表失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 健康检查 - 检查 IndexTTS2 服务是否可用
 */
export async function checkTTSHealth(): Promise<{
  success: boolean;
  status: string;
  message?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('TTS 健康检查失败:', error);
    return {
      success: false,
      status: 'unavailable',
      message: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 估算配音时长
 * 
 * 中文语速约 7字/秒
 */
export function estimateVoiceoverDuration(text: string, speed: number = 1.0): number {
  const charCount = text.length;
  const baseDuration = charCount / 7.0;
  return baseDuration / speed;
}

/**
 * 格式化配音时长
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}分${secs}秒`;
  }
  return `${secs}秒`;
}

