import express from 'express';
import { generateTransition } from '../controllers/comfyuiController.js';

const router = express.Router();

/**
 * POST /api/v1/comfyui/transition
 * 使用ComfyUI的wan2.2工作流生成首尾帧转场视频
 */
router.post('/transition', generateTransition);

export default router;

