/**
 * 图像生成路由
 * 处理即梦API相关的路由配置
 */

import express from 'express';
import {
  checkConfig,
  submitGenerationTask,
  getTaskStatus,
  generateAndWait,
  textToImage,
  imageToImage,
  submitVideoTask,
  getVideoTaskStatus,
  imageToVideo,
  textToVideo
} from '../controllers/imageController.js';

const router = express.Router();

/**
 * @route GET /api/v1/image/config
 * @desc 检查服务配置状态
 */
router.get('/config', checkConfig);

/**
 * @route POST /api/v1/image/generate
 * @desc 提交图像生成任务（异步）
 * @body {
 *   prompt: string,           // 必填，提示词
 *   imageUrls?: string[],     // 可选，参考图片URL（图生图时使用）
 *   width?: number,           // 可选，图片宽度
 *   height?: number,          // 可选，图片高度
 *   scale?: number,           // 可选，文本影响程度 (0-1)
 *   forceSingle?: boolean,    // 可选，是否强制单图
 *   mode?: 'text_to_image' | 'image_to_image'  // 可选，生成模式
 * }
 */
router.post('/generate', submitGenerationTask);

/**
 * @route GET /api/v1/image/task/:taskId
 * @desc 查询任务状态和结果
 */
router.get('/task/:taskId', getTaskStatus);

/**
 * @route POST /api/v1/image/generate-sync
 * @desc 同步生成图像（提交并等待结果）
 * @body 同 /generate
 */
router.post('/generate-sync', generateAndWait);

/**
 * @route POST /api/v1/image/text-to-image
 * @desc 文生图快捷接口
 * @body {
 *   prompt: string,
 *   width?: number,
 *   height?: number,
 *   scale?: number,
 *   forceSingle?: boolean
 * }
 */
router.post('/text-to-image', textToImage);

/**
 * @route POST /api/v1/image/image-to-image
 * @desc 图生图快捷接口
 * @body {
 *   prompt: string,
 *   imageUrls: string[],
 *   width?: number,
 *   height?: number,
 *   scale?: number,
 *   forceSingle?: boolean
 * }
 */
router.post('/image-to-image', imageToImage);

// ==================== 视频生成路由 ====================

/**
 * @route POST /api/v1/image/video/generate
 * @desc 提交视频生成任务（异步）
 * @body {
 *   imageUrl?: string,      // 首帧图片URL（图生视频）
 *   prompt?: string,        // 提示词（文生视频必填）
 *   frames?: number,        // 帧数：121(5秒) 或 241(10秒)
 *   aspectRatio?: string,   // 宽高比：16:9, 4:3, 1:1, 3:4, 9:16, 21:9
 *   seed?: number           // 随机种子
 * }
 */
router.post('/video/generate', submitVideoTask);

/**
 * @route GET /api/v1/image/video/task/:taskId
 * @desc 查询视频任务状态
 */
router.get('/video/task/:taskId', getVideoTaskStatus);

/**
 * @route POST /api/v1/image/image-to-video
 * @desc 图生视频（同步等待结果）
 * @body {
 *   imageUrl: string,       // 首帧图片URL（必填）
 *   prompt?: string,        // 动态描述提示词
 *   frames?: number,        // 帧数：121(5秒) 或 241(10秒)
 *   aspectRatio?: string,   // 宽高比
 *   seed?: number           // 随机种子
 * }
 */
router.post('/image-to-video', imageToVideo);

/**
 * @route POST /api/v1/image/text-to-video
 * @desc 文生视频（同步等待结果）
 * @body {
 *   prompt: string,         // 视频描述提示词（必填）
 *   frames?: number,        // 帧数：121(5秒) 或 241(10秒)
 *   aspectRatio?: string,   // 宽高比
 *   seed?: number           // 随机种子
 * }
 */
router.post('/text-to-video', textToVideo);

export default router;


