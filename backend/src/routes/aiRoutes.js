/**
 * AI 相关路由
 * 包含标签精炼、视频优化等 AI 功能
 */

import express from 'express';
import { refineTags } from '../controllers/tagRefinementController.js';

const router = express.Router();

/**
 * POST /api/ai/refine-tags
 * 智能标签生成与修订
 */
router.post('/refine-tags', refineTags);

export default router;

