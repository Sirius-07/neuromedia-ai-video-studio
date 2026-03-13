import express from 'express';
import {
  saveProject,
  getProject,
  getRecentProjects,
  deleteProject
} from '../controllers/storyboardProjectController.js';

const router = express.Router();

/**
 * 分镜项目持久化 API 路由
 */

// 保存或更新项目
router.post('/project/save', saveProject);

// 获取项目详情
router.get('/project/:projectId', getProject);

// 获取最近的项目列表
router.get('/projects/recent', getRecentProjects);

// 删除项目
router.delete('/project/:projectId', deleteProject);

export default router;

