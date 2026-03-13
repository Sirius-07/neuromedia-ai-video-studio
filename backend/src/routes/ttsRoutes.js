/**
 * TTS API 路由
 * 
 * 提供语音合成相关的 API 端点
 */

import express from 'express';
import {
  generateVoiceover,
  batchGenerateVoiceovers,
  generateSceneVoiceovers,
  getVoices,
  healthCheck
} from '../controllers/ttsController.js';

const router = express.Router();

/**
 * POST /api/tts/generate
 * 生成单个配音
 * 
 * Body:
 * {
 *   "text": "要转换的文本",
 *   "voice": "stable-male",      // 可选
 *   "speed": 1.0,                 // 可选, 0.5-2.0
 *   "emotion": "neutral"          // 可选
 * }
 */
router.post('/generate', generateVoiceover);

/**
 * POST /api/tts/batch-generate
 * 批量生成配音
 * 
 * Body:
 * {
 *   "texts": ["文本1", "文本2", ...],
 *   "voice": "stable-male",      // 可选
 *   "speed": 1.0,                 // 可选
 *   "emotion": "neutral"          // 可选
 * }
 */
router.post('/batch-generate', batchGenerateVoiceovers);

/**
 * POST /api/tts/scenes
 * 为分镜列表生成配音
 * 
 * Body:
 * {
 *   "scenes": [
 *     { "narration": "分镜1的旁白文案", ... },
 *     { "narration": "分镜2的旁白文案", ... }
 *   ],
 *   "voice": "stable-male",      // 可选
 *   "speed": 1.0,                 // 可选
 *   "emotion": "neutral"          // 可选
 * }
 */
router.post('/scenes', generateSceneVoiceovers);

/**
 * GET /api/tts/voices
 * 获取可用的语音列表
 */
router.get('/voices', getVoices);

/**
 * GET /api/tts/health
 * 健康检查
 */
router.get('/health', healthCheck);

export default router;

