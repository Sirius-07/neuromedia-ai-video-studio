/**
 * Storyboard Assistant 路由
 * 挂载于 /api/storyboard-assistant
 */

import express from 'express';
import { chat } from '../controllers/storyboardAssistantController.js';

const router = express.Router();

// POST /api/storyboard-assistant/chat
router.post('/chat', chat);

export default router;
