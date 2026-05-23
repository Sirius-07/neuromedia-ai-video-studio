import { apiUrl } from '../config/api';

/**
 * 分镜项目持久化 API 客户端
 * 
 * 解决 localStorage 不可靠的问题，使用后端数据库存储
 */

const API_BASE_URL = apiUrl('/api/v1/storyboard');

export interface Scene {
  id: number;
  type: string;
  duration: string;
  script: string;
  visualPrompt: string;
  motionPrompt?: string;
  generationStatus: string;
  assetUrl?: string;
  videoUrl?: string;
  // ... 其他字段
}

export interface StoryboardProject {
  projectId: string;
  title: string;
  userPrompt?: string;
  scenes: Scene[];
  totalScenes: number;
  completedScenes: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastModified: string;
}

export interface ProjectListItem {
  id: string;
  title: string;
  status: string;
  totalScenes: number;
  completedScenes: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 保存或更新分镜项目
 */
export async function saveStoryboardProject(projectData: {
  projectId?: string;
  title: string;
  userPrompt?: string;
  scenes: Scene[];
}): Promise<{ success: boolean; data?: StoryboardProject; error?: string }> {
  try {
    console.log('💾 [API] 保存分镜项目到数据库:', projectData.title);
    
    const response = await fetch(`${API_BASE_URL}/project/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '保存项目失败');
    }
    
    console.log('✅ [API] 项目保存成功:', result.data.projectId);
    return result;
  } catch (error: any) {
    console.error('❌ [API] 保存项目失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取项目详情
 */
export async function getStoryboardProject(projectId: string): Promise<{ success: boolean; data?: StoryboardProject; error?: string }> {
  try {
    console.log('📖 [API] 从数据库读取项目:', projectId);
    
    const response = await fetch(`${API_BASE_URL}/project/${projectId}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '读取项目失败');
    }
    
    console.log('✅ [API] 项目读取成功:', result.data.title);
    return result;
  } catch (error: any) {
    console.error('❌ [API] 读取项目失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取最近的项目列表
 */
export async function getRecentProjects(limit = 10): Promise<{ success: boolean; data?: ProjectListItem[]; error?: string }> {
  try {
    console.log('📚 [API] 获取最近的项目列表');
    
    const response = await fetch(`${API_BASE_URL}/projects/recent?limit=${limit}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '获取项目列表失败');
    }
    
    console.log(`✅ [API] 找到 ${result.data.length} 个项目`);
    return result;
  } catch (error: any) {
    console.error('❌ [API] 获取项目列表失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 删除项目
 */
export async function deleteStoryboardProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🗑️ [API] 删除项目:', projectId);
    
    const response = await fetch(`${API_BASE_URL}/project/${projectId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '删除项目失败');
    }
    
    console.log('✅ [API] 项目删除成功');
    return result;
  } catch (error: any) {
    console.error('❌ [API] 删除项目失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

