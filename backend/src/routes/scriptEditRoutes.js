/**
 * 脚本编辑相关路由 (debug: 4acee7-v3)
 * 支持脚本编辑页面的AI交互功能
 */

import express from 'express';
import fs from 'fs';
import ScriptEditController from '../controllers/scriptEditController.js';

const router = express.Router();

// #region agent debug log endpoint
router.post('/debug-log', (req, res) => {
  const entry = JSON.stringify({ ...req.body, _ts: new Date().toISOString() }) + '\n';
  fs.appendFileSync('debug-4acee7.log', entry);
  console.log('[AI-Director-DEBUG-FRONT]', req.body?.message, req.body?.data);
  res.json({ ok: true });
});
// #endregion

// AI对话优化脚本
router.post('/chat', ScriptEditController.chatWithAI);

// 批量优化场景
router.post('/optimize-scenes', ScriptEditController.optimizeScenes);

// 插入新场景
router.post('/insert-scene', ScriptEditController.insertScene);

// 调整节奏
router.post('/adjust-pacing', ScriptEditController.adjustPacing);

// AI润色单条自定义场景
router.post('/enhance-scene', ScriptEditController.enhanceScene);

export default router;
