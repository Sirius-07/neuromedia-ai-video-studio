import express from 'express';
import { 
  createSoundtrackTask, 
  getSoundtrackTaskStatus,
  updateSoundEffects,
  mergeVideo
} from '../controllers/soundtrackController.js';

const router = express.Router();

/**
 * POST /api/v1/soundtrack/create
 * 创建新的配乐任务
 */
router.post('/create', createSoundtrackTask);

/**
 * GET /api/v1/soundtrack/status/:taskId
 * 获取配乐任务状态
 */
router.get('/status/:taskId', getSoundtrackTaskStatus);

/**
 * PUT /api/v1/soundtrack/:taskId/effects
 * 更新音效配置（调整音量、时间戳等）
 */
router.put('/:taskId/effects', updateSoundEffects);

/**
 * POST /api/v1/soundtrack/:taskId/merge
 * 合成视频（将音效合成到视频中）
 */
router.post('/:taskId/merge', mergeVideo);

export default router;

