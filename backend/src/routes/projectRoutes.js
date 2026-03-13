import express from 'express';
import {
  createProject,
  updateProject,
  saveStoryboard,
  linkSoundtrackTask,
  saveExportedVideo,
  getProject,
  getRecentProjects,
  deleteProject
} from '../controllers/projectController.js';

const router = express.Router();

/**
 * 完整项目管理 API 路由
 */

// 创建新项目
router.post('/create', createProject);

// 获取最近的项目列表（注意：这个路由要放在 /:projectId 之前）
router.get('/list/recent', getRecentProjects);

// 获取项目详情
router.get('/:projectId', getProject);

// 更新项目
router.put('/:projectId', updateProject);

// 保存分镜数据
router.post('/:projectId/storyboard', saveStoryboard);

// 关联配乐任务
router.post('/:projectId/soundtrack', linkSoundtrackTask);

// 保存导出视频
router.post('/:projectId/export', saveExportedVideo);

// 删除项目
router.delete('/:projectId', deleteProject);

export default router;

