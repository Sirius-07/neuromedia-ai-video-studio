/**
 * 图片生成路由 - 火山方舟 Seedream API
 * 处理文生图和图生图请求
 */

import express from 'express';
import { generateImage } from '../controllers/imageGenController.js';

const router = express.Router();

/**
 * @route POST /api/v1/image-gen/generate
 * @desc 生成图片（文生图或图生图）- 使用火山方舟 Seedream API
 * @body {
 *   model?: string,         // 模型ID (默认: doubao-seedream-4.0)
 *                           // 可选: doubao-seedream-4.5, doubao-seedream-4.0,
 *                           //       doubao-seedream-3.0-t2i, doubao-seededit-3.0-i2i
 *   prompt: string,         // 提示词（必填）
 *   image?: string | string[], // 参考图片（图生图时使用，支持URL或Base64）
 *                           // doubao-seedream-4.5/4.0: 最多14张
 *                           // doubao-seededit-3.0-i2i: 仅支持单张
 *   size?: string,          // 图片尺寸
 *                           // doubao-seedream-4.5/4.0: '2K', '4K' 或 '2048x2048'
 *                           // doubao-seedream-3.0-t2i: '1024x1024'
 *                           // doubao-seededit-3.0-i2i: 'adaptive'
 *   seed?: number,          // 随机种子 [-1, 2147483647] (仅3.0模型支持)
 *   sequential_image_generation?: 'auto' | 'disabled', // 组图功能 (仅4.5/4.0支持)
 *   sequential_image_generation_options?: {
 *     max_images?: number  // 最大生成图片数量 [1, 15]
 *   },
 *   response_format?: 'url' | 'b64_json', // 响应格式
 *   watermark?: boolean     // 是否添加水印 (默认: true)
 * }
 */
router.post('/generate', generateImage);

export default router;

