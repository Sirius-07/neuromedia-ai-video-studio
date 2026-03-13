import express from 'express';
import { exportRoughCut, exportRoughCutSimple } from '../controllers/videoExportController.js';

const router = express.Router();

/**
 * POST /api/v1/video-export/rough-cut
 * 导出粗剪视频（实时进度）
 * 
 * Request Body:
 * {
 *   scenes: [
 *     {
 *       id: 1,
 *       videoUrl: "http://...",
 *       ...
 *     }
 *   ]
 * }
 * 
 * Response: Server-Sent Events (SSE)
 */
router.post('/rough-cut', exportRoughCut);

/**
 * POST /api/v1/video-export/rough-cut-simple
 * 导出粗剪视频（简化版，直接返回结果）
 * 
 * Request Body:
 * {
 *   scenes: [
 *     {
 *       id: 1,
 *       videoUrl: "http://...",
 *       ...
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     videoPath: "...",
 *     videoUrl: "/uploads/video/...",
 *     filename: "rough_cut_xxx.mp4",
 *     videoCount: 5
 *   }
 * }
 */
router.post('/rough-cut-simple', exportRoughCutSimple);

export default router;




























