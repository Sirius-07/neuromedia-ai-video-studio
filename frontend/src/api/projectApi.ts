/**
 * 完整项目管理 API 客户端
 * 
 * 管理项目的完整生命周期：脚本 → 分镜 → 配乐 → 导出
 */

import { createLogger } from '../utils/logger';

const log = createLogger('projectApi');
const API_BASE_URL = 'http://localhost:3000/api/v1/project';

export interface Project {
  id: string;
  title: string;
  description?: string;
  userPrompt?: string;
  uploadedAssets?: any[]; // 上传的素材列表
  generationMode?: string; // 生成模式（ai_generated, ai_plus_real, pure_real）
  thumbnail?: string;
  status: 'draft' | 'storyboard' | 'soundtrack' | 'completed';
  
  // 分镜数据
  storyboardData?: any[];
  totalScenes: number;
  completedScenes: number;
  
  // 配乐数据
  soundtrackTaskId?: string;
  soundtrackTask?: {
    id: string;
    status: string;
    finalAssetMap: any;
  };
  
  // 导出数据
  roughCutVideoUrl?: string;
  finalVideoUrl?: string;
  
  // 设置
  settings?: any;
  
  // 时间
  createdAt: string;
  updatedAt: string;
  lastModified: string;
}

export interface ProjectListItem {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  status: string;
  totalScenes: number;
  completedScenes: number;
  createdAt: string;
  updatedAt: string;
  settings?: any; // 项目设置（包含currentPage等信息）
}

/**
 * 创建新项目
 */
export async function createProject(data: {
  title: string;
  description?: string;
  userPrompt?: string;
  settings?: any;
}): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    log.debug('📁 创建新项目:', data.title);
    
    const response = await fetch(`${API_BASE_URL}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '创建项目失败');
    }
    
    log.debug('✅ 项目创建成功:', result.data.id);
    return result;
  } catch (error: any) {
    log.error('❌ 创建项目失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 更新项目
 */
export async function updateProject(projectId: string, data: Partial<Project>): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    log.verbose('📝 更新项目:', projectId);
    
    const response = await fetch(`${API_BASE_URL}/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '更新项目失败');
    }
    
    log.verbose('✅ 项目更新成功');
    return result;
  } catch (error: any) {
    log.error('❌ 更新项目失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 保存分镜数据
 */
export async function saveStoryboard(projectId: string, storyboardData: {
  scenes: any[];
  title?: string;
  userPrompt?: string;
  uploadedAssets?: any[];
  generationMode?: string;
}): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    log.verbose('🎬 保存分镜数据:', projectId);
    
    const response = await fetch(`${API_BASE_URL}/${projectId}/storyboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(storyboardData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '保存分镜数据失败');
    }
    
    log.verbose('✅ 分镜数据保存成功');
    return result;
  } catch (error: any) {
    log.error('❌ 保存分镜数据失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 关联配乐任务
 */
export async function linkSoundtrackTask(projectId: string, soundtrackTaskId: string): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    log.debug('🎵 关联配乐任务:', projectId, '->', soundtrackTaskId);
    
    const response = await fetch(`${API_BASE_URL}/${projectId}/soundtrack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ soundtrackTaskId })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '关联配乐任务失败');
    }
    
    log.debug('✅ 配乐任务关联成功');
    return result;
  } catch (error: any) {
    log.error('❌ 关联配乐任务失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 保存导出视频
 */
export async function saveExportedVideo(projectId: string, videoData: {
  roughCutVideoUrl?: string;
  finalVideoUrl?: string;
}): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    log.debug('📹 保存导出视频:', projectId);
    
    const response = await fetch(`${API_BASE_URL}/${projectId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(videoData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '保存导出视频失败');
    }
    
    log.debug('✅ 导出视频保存成功');
    return result;
  } catch (error: any) {
    log.error('❌ 保存导出视频失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取项目详情
 */
export async function getProject(projectId: string): Promise<{ success: boolean; data?: Project; error?: string }> {
  try {
    log.verbose('📖 获取项目详情:', projectId);
    
    const response = await fetch(`${API_BASE_URL}/${projectId}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '获取项目详情失败');
    }
    
    log.verbose('✅ 项目详情获取成功');
    return result;
  } catch (error: any) {
    log.error('❌ 获取项目详情失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取最近的项目列表
 */
export async function getRecentProjects(limit = 20): Promise<{ success: boolean; data?: ProjectListItem[]; error?: string }> {
  try {
    log.verbose('📚 获取最近的项目列表');
    
    const response = await fetch(`${API_BASE_URL}/list/recent?limit=${limit}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '获取项目列表失败');
    }
    
    log.verbose(`✅ 找到 ${result.data.length} 个项目`);
    return result;
  } catch (error: any) {
    log.error('❌ 获取项目列表失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 删除项目
 */
export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    log.debug('🗑️ 删除项目:', projectId);
    
    const response = await fetch(`${API_BASE_URL}/${projectId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '删除项目失败');
    }
    
    log.debug('✅ 项目删除成功');
    return result;
  } catch (error: any) {
    log.error('❌ 删除项目失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

