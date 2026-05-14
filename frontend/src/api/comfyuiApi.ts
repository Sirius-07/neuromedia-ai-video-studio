import { apiUrl } from '../config/api';

/**
 * ComfyUI API 模块
 * 用于调用ComfyUI的工作流，特别是wan2.2首尾帧生成视频
 */

const API_BASE_URL = apiUrl('');

export interface ComfyUITransitionParams {
  firstFrameUrl: string; // 首帧图片URL（base64或URL）
  lastFrameUrl: string; // 尾帧图片URL（base64或URL）
  prompt: string; // 提示词
  negativePrompt?: string; // 负面提示词
  duration?: number; // 视频时长（秒）
  width?: number; // 视频宽度
  height?: number; // 视频高度
}

export interface ComfyUITransitionResponse {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

/**
 * 使用wan2.2工作流生成首尾帧转场视频
 * @param params 转场参数
 * @returns 生成的视频URL
 */
export async function generateTransitionVideo(
  params: ComfyUITransitionParams
): Promise<ComfyUITransitionResponse> {
  try {
    console.log('[ComfyUI API] 开始生成转场视频:', params);

    const response = await fetch(`${API_BASE_URL}/api/v1/comfyui/transition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_frame_url: params.firstFrameUrl,
        last_frame_url: params.lastFrameUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走',
        duration: params.duration || 2,
        width: params.width || 640,
        height: params.height || 640,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[ComfyUI API] 转场视频生成成功:', result);

    return {
      success: true,
      videoUrl: result.video_url,
    };
  } catch (error) {
    console.error('[ComfyUI API] 转场视频生成失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成失败',
    };
  }
}

/**
 * 将图片URL转换为Base64（如果需要）
 * @param imageUrl 图片URL
 * @returns Base64编码的图片
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }

  try {
    const proxyUrl = `${API_BASE_URL}/api/v1/proxy/image?url=${encodeURIComponent(imageUrl)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[imageUrlToBase64] 转换失败:', error);
    throw error;
  }
}

