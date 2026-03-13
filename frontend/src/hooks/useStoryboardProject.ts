import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveStoryboardProject,
  getStoryboardProject,
  Scene,
  StoryboardProject
} from '../api/storyboardProjectApi';

/**
 * 分镜项目持久化 Hook
 * 
 * 双重保险策略：
 * 1. 优先使用数据库存储（可靠、跨设备）
 * 2. localStorage 作为备份（离线时使用）
 */

const STORAGE_KEY = 'current_storyboard_project_backup';
const AUTO_SAVE_DELAY = 2000; // 2秒防抖

interface UseStoryboardProjectOptions {
  projectId?: string;
  autoSave?: boolean;
}

export function useStoryboardProject(options: UseStoryboardProjectOptions = {}) {
  const { projectId: initialProjectId, autoSave = true } = options;
  
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * 保存项目到数据库（带防抖）
   */
  const saveProject = useCallback(async (projectData: {
    title: string;
    userPrompt?: string;
    scenes: Scene[];
  }) => {
    try {
      setIsSaving(true);
      setError(null);
      
      // 调用API保存到数据库
      const result = await saveStoryboardProject({
        projectId: projectId || undefined,
        ...projectData
      });
      
      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }
      
      // 保存成功后更新项目ID
      if (result.data) {
        setProjectId(result.data.projectId);
        setLastSaved(new Date());
        
        // 禁用localStorage备份，仅使用数据库
        // localStorage.setItem(STORAGE_KEY, JSON.stringify({
        //   projectId: result.data.projectId,
        //   ...projectData,
        //   lastModified: new Date().toISOString()
        // }));
        
        console.log('✅ 项目已保存到数据库');
      }
      
      return result;
    } catch (err: any) {
      console.error('❌ 保存项目失败:', err);
      setError(err.message);
      
      // 禁用localStorage备份，数据库保存失败时不再备份到localStorage
      // try {
      //   localStorage.setItem(STORAGE_KEY, JSON.stringify({
      //     projectId: projectId || 'local_project',
      //     ...projectData,
      //     lastModified: new Date().toISOString()
      //   }));
      //   console.log('⚠️ 已备份到localStorage（数据库保存失败）');
      // } catch (storageErr) {
      //   console.error('❌ localStorage 备份也失败:', storageErr);
      // }
      
      return { success: false, error: err.message };
    } finally {
      setIsSaving(false);
    }
  }, [projectId]);
  
  /**
   * 自动保存（防抖）
   */
  const scheduleAutoSave = useCallback((projectData: {
    title: string;
    userPrompt?: string;
    scenes: Scene[];
  }) => {
    if (!autoSave) return;
    
    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // 设置新的定时器
    autoSaveTimerRef.current = setTimeout(() => {
      console.log('⏰ 触发自动保存...');
      saveProject(projectData);
    }, AUTO_SAVE_DELAY);
  }, [autoSave, saveProject]);
  
  /**
   * 加载项目
   */
  const loadProject = useCallback(async (projectIdToLoad: string) => {
    try {
      console.log('📖 加载项目:', projectIdToLoad);
      
      // 先尝试从数据库加载
      const result = await getStoryboardProject(projectIdToLoad);
      
      if (result.success && result.data) {
        setProjectId(result.data.projectId);
        console.log('✅ 从数据库加载成功');
        return result.data;
      }
      
      // 禁用localStorage降级加载，仅从数据库加载
      // console.log('⚠️ 数据库加载失败，尝试从localStorage加载');
      // const backup = localStorage.getItem(STORAGE_KEY);
      // if (backup) {
      //   const parsed = JSON.parse(backup);
      //   if (parsed.projectId === projectIdToLoad) {
      //     console.log('✅ 从localStorage备份加载成功');
      //     return parsed;
      //   }
      // }
      
      throw new Error('项目不存在');
    } catch (err: any) {
      console.error('❌ 加载项目失败:', err);
      setError(err.message);
      return null;
    }
  }, []);
  
  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);
  
  return {
    projectId,
    isSaving,
    lastSaved,
    error,
    saveProject,
    scheduleAutoSave,
    loadProject
  };
}

