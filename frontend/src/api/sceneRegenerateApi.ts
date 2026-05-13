/**
 * 单个分镜重新生成 API
 * 通过Node.js代理访问Python后端，统一使用3000端口
 */

const API_BASE_URL = 'http://localhost:4300/api/v1/proxy/python';

export interface SceneContext {
  scene_id: number;
  script_content: string;
  visual_description: string;
  duration: number;
}

export interface RegenerateSceneRequest {
  project_title: string;
  user_prompt: string;
  all_scenes: SceneContext[];
  target_scene_index: number;
  user_feedback?: string;
}

export interface RegenerateSceneResponse {
  scene_id: number;
  script_content: string;
  visual_description: string;
  duration: number;
  motion_prompt?: string;
  regenerate_reason: string;
  improvements: string[];
}

/**
 * 重新生成单个分镜
 */
export async function regenerateScene(
  request: RegenerateSceneRequest,
  useAi: boolean = true
): Promise<RegenerateSceneResponse> {
  try {
    console.log('🔄 [API] 重新生成分镜:', request.target_scene_index + 1);
    
    const response = await fetch(`${API_BASE_URL}/regenerate-scene?use_ai=${useAi}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || '重新生成失败');
    }

    const result = await response.json();
    console.log('✅ [API] 重新生成成功');
    
    return result;
  } catch (error: any) {
    console.error('❌ [API] 重新生成失败:', error);
    throw error;
  }
}

