import express from 'express';
import { convertScriptToPrompt, convertScriptToPromptWithLLM } from '../controllers/scriptSyncController.js';

const router = express.Router();

/**
 * POST /api/v1/script/to-prompt
 * 将脚本转换为提示词（简单版）
 */
router.post('/to-prompt', convertScriptToPrompt);

/**
 * POST /api/v1/script/to-prompt-llm
 * 将脚本转换为提示词（LLM 版本）
 */
router.post('/to-prompt-llm', convertScriptToPromptWithLLM);

export default router;








