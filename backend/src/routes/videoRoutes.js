import express from 'express';
import { uploadVideo, processVideo, getVideoInfo, optimizeVideoWithAI } from '../controllers/videoController.js';
import { upload } from '../config/multerConfig.js';

const router = express.Router();

/**
 * POST /api/v1/video/upload
 * 上传视频文件
 */
router.post('/upload', upload.single('video'), uploadVideo);

/**
 * POST /api/v1/video/process
 * 应用后期处理效果到视频
 */
router.post('/process', processVideo);

/**
 * GET /api/v1/video/info
 * 获取视频信息
 */
router.get('/info', getVideoInfo);

/**
 * POST /api/v1/video/optimize
 * AI一键优化视频后期处理参数
 */
router.post('/optimize', optimizeVideoWithAI);

export default router;





