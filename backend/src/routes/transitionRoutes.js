import express from 'express';
import { generateTransitionPrompt } from '../controllers/transitionController.js';

const router = express.Router();

/**
 * @route POST /api/v1/transition/generate-prompt
 * @desc 生成AI转场提示词
 * @body {
 *   prev_scene_script: string,
 *   next_scene_script: string,
 *   video_theme: string,
 *   first_frame_base64: string,
 *   last_frame_base64: string
 * }
 */
router.post('/generate-prompt', generateTransitionPrompt);

export default router;

