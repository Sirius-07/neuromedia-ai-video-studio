/**
 * 灵感激发模式路由
 */

import express from 'express';
import * as inspirationController from '../controllers/inspirationController.js';

const router = express.Router();

// 分析内容情绪
router.post('/analyze', inspirationController.analyzeContent);

// 生成创意方案
router.post('/generate', inspirationController.generateProposals);

// 转换方案为分镜脚本（简单转换，已废弃）
router.post('/convert', inspirationController.convertToScenes);

// 扩展为详细脚本（新接口）
router.post('/expand', inspirationController.expandProposalToScript);

export default router;
