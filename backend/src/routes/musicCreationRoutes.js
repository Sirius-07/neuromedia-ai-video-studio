import express from 'express';
import { 
  createMusicCreationTask, 
  getTaskStatus,
  uploadVideoOnly,
  checkTOSConfiguration 
} from '../controllers/musicCreationController.js';

const router = express.Router();

/**
 * 音频创作路由
 * 
 * 基础路径: /api/v1/music-creation
 */

/**
 * POST /api/v1/music-creation/create
 * 创建音频创作任务（完整流程：拼接 → 上传TOS → AI分析）
 */
router.post('/create', createMusicCreationTask);

/**
 * GET /api/v1/music-creation/status/:taskId
 * 获取任务状态
 */
router.get('/status/:taskId', getTaskStatus);

/**
 * POST /api/v1/music-creation/upload-only
 * 仅拼接并上传视频到TOS（不进行AI分析）
 * 
 * Request Body: 同上
 */
router.post('/upload-only', uploadVideoOnly);

/**
 * GET /api/v1/music-creation/check-tos
 * 检查TOS配置状态
 */
router.get('/check-tos', checkTOSConfiguration);

export default router;

