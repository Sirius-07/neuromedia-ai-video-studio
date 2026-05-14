/**
 * 图像生成控制器
 * 处理即梦API相关的HTTP请求
 */

import JimengService from '../services/JimengService.js';
import ComfyUIService from '../services/ComfyUIService.js';
import { imageTaskQueue, videoTaskQueue } from '../services/TaskQueueManager.js';
import { ENABLE_COMFYUI } from '../config/serverConfig.js';

/**
 * 检查服务配置状态
 */
export const checkConfig = async (req, res) => {
  try {
    const status = JimengService.getConfigStatus();
    
    res.json({
      success: true,
      data: status,
      message: status.configured ? '服务已配置' : '服务未配置，请设置环境变量'
    });
  } catch (error) {
    console.error('检查配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 提交图像生成任务
 * POST /api/v1/image/generate
 */
export const submitGenerationTask = async (req, res) => {
  try {
    const {
      prompt,
      imageUrls,
      width,
      height,
      scale,
      forceSingle,
      imageCount = 4,
      mode = 'text_to_image' // 'text_to_image' | 'image_to_image'
    } = req.body;

    // 验证必填参数
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt'
      });
    }

    // 图生图模式验证
    if (mode === 'image_to_image' && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({
        success: false,
        error: '图生图模式需要提供参考图片URL'
      });
    }

    console.log(`📸 收到图像生成请求: mode=${mode}, imageCount=${imageCount}, prompt="${prompt.substring(0, 50)}..."`);

    const result = await JimengService.submitTask({
      prompt,
      imageUrls: mode === 'image_to_image' ? imageUrls : [],
      width,
      height,
      scale,
      forceSingle,
      imageCount
    });

    res.json({
      success: true,
      data: {
        taskId: result.taskId,
        requestId: result.requestId,
        status: 'submitted',
        message: '任务已提交，请使用 taskId 查询结果'
      }
    });

  } catch (error) {
    console.error('提交任务失败:', error);
    
    // 处理特定错误
    if (error.message.includes('未配置')) {
      return res.status(503).json({
        success: false,
        error: error.message,
        code: 'SERVICE_NOT_CONFIGURED'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 查询任务状态
 * GET /api/v1/image/task/:taskId
 */
export const getTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少任务ID'
      });
    }

    const result = await JimengService.queryTask(taskId, {
      returnUrl: true
    });

    res.json({
      success: true,
      data: {
        taskId,
        status: result.status,
        imageUrls: result.imageUrls,
        base64Images: result.base64Images,
        requestId: result.requestId
      }
    });

  } catch (error) {
    console.error('查询任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 一键生成并等待结果（同步方式）
 * POST /api/v1/image/generate-sync
 * 注意：此接口可能需要较长时间才能返回
 * 使用队列管理器避免并发限制问题
 */
export const generateAndWait = async (req, res) => {
  try {
    const {
      prompt,
      imageUrls,
      width,
      height,
      scale,
      forceSingle = false,
      imageCount = 4,
      mode = 'text_to_image'
    } = req.body;

    // 验证必填参数
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt'
      });
    }

    console.log(`📸 收到同步图像生成请求: mode=${mode}, 队列状态:`, imageTaskQueue.getStatus());

    // 将任务加入队列
    const result = await imageTaskQueue.addTask(async () => {
      if (mode === 'image_to_image') {
        if (!imageUrls || imageUrls.length === 0) {
          throw new Error('图生图模式需要提供参考图片URL');
        }
        return await JimengService.imageToImage(prompt, imageUrls, {
          width,
          height,
          scale,
          forceSingle,
          imageCount
        });
      } else {
        return await JimengService.textToImage(prompt, {
          width,
          height,
          scale,
          forceSingle,
          imageCount
        });
      }
    });

    res.json({
      success: true,
      data: {
        taskId: result.taskId,
        imageUrls: result.imageUrls,
        base64Images: result.base64Images,
        requestId: result.requestId
      }
    });

  } catch (error) {
    console.error('生成图像失败:', error);

    // 处理特定错误码
    const errorResponse = {
      success: false,
      error: error.message
    };

    // 审核相关错误
    if (error.message.includes('Risk Not Pass')) {
      errorResponse.code = 'CONTENT_RISK';
      errorResponse.retry = false;
    }
    // 超限错误
    else if (error.message.includes('Limit')) {
      errorResponse.code = 'RATE_LIMIT';
      errorResponse.retry = true;
    }
    // 超时错误
    else if (error.message.includes('超时')) {
      errorResponse.code = 'TIMEOUT';
      errorResponse.retry = true;
    }

    res.status(500).json(errorResponse);
  }
};

/**
 * 文生图快捷接口
 * POST /api/v1/image/text-to-image
 * 使用队列管理器避免并发限制问题
 */
export const textToImage = async (req, res) => {
  try {
    const { prompt, width, height, scale, forceSingle = true } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt'
      });
    }

    console.log(`🎨 文生图请求: "${prompt.substring(0, 50)}...", 队列状态:`, imageTaskQueue.getStatus());

    // 将任务加入队列
    const result = await imageTaskQueue.addTask(async () => {
      return await JimengService.textToImage(prompt, {
        width,
        height,
        scale,
        forceSingle
      });
    });

    res.json({
      success: true,
      data: {
        taskId: result.taskId,
        imageUrls: result.imageUrls,
        requestId: result.requestId
      }
    });

  } catch (error) {
    console.error('文生图失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 图生图快捷接口
 * POST /api/v1/image/image-to-image
 * 使用队列管理器避免并发限制问题
 */
export const imageToImage = async (req, res) => {
  try {
    const { prompt, imageUrls, width, height, scale, forceSingle = true } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt'
      });
    }

    if (!imageUrls || imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: imageUrls'
      });
    }

    console.log(`🖼️ 图生图请求: "${prompt.substring(0, 50)}...", 参考图: ${imageUrls.length} 张, 队列状态:`, imageTaskQueue.getStatus());

    // 将任务加入队列
    const result = await imageTaskQueue.addTask(async () => {
      return await JimengService.imageToImage(prompt, imageUrls, {
        width,
        height,
        scale,
        forceSingle
      });
    });

    res.json({
      success: true,
      data: {
        taskId: result.taskId,
        imageUrls: result.imageUrls,
        requestId: result.requestId
      }
    });

  } catch (error) {
    console.error('图生图失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 提交视频生成任务
 * POST /api/v1/image/video/generate
 */
export const submitVideoTask = async (req, res) => {
  try {
    const {
      imageUrl,
      prompt,
      frames = 121,
      aspectRatio = '16:9',
      seed = -1
    } = req.body;

    // 验证参数
    if (!imageUrl && !prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: imageUrl 或 prompt 至少需要一个'
      });
    }

    console.log(`🎬 收到视频生成请求: imageUrl=${imageUrl ? '有' : '无'}, frames=${frames}`);

    const result = await JimengService.submitVideoTask({
      imageUrl,
      prompt,
      frames,
      aspectRatio,
      seed
    });

    res.json({
      success: true,
      data: {
        taskId: result.taskId,
        requestId: result.requestId,
        status: 'submitted',
        message: '视频任务已提交，请使用 taskId 查询结果'
      }
    });

  } catch (error) {
    console.error('提交视频任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 查询视频任务状态
 * GET /api/v1/image/video/task/:taskId
 */
export const getVideoTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少任务ID'
      });
    }

    const result = await JimengService.queryVideoTask(taskId);

    res.json({
      success: true,
      data: {
        taskId,
        status: result.status,
        videoUrl: result.videoUrl,
        requestId: result.requestId
      }
    });

  } catch (error) {
    console.error('查询视频任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 图生视频（同步等待）
 * POST /api/v1/image/image-to-video
 * 使用队列管理器避免并发限制问题
 */
export const imageToVideo = async (req, res) => {
  try {
    const {
      imageUrl,
      firstImageUrl,  // 首帧图片（首尾帧模式）
      lastImageUrl,   // 尾帧图片（首尾帧模式）
      prompt,
      frames = 121,
      aspectRatio = '16:9',
      seed = -1,
      model = 'jimeng-pro',  // 'jimeng-pro', 'jimeng-first', 'jimeng-first-tail', 'wan2.2'
      // ComfyUI 特有参数
      negativePrompt,
      width,
      height,
      fps
    } = req.body;

    console.log(`🎬 图生视频请求: model=${model}, frames=${frames}, 队列状态:`, videoTaskQueue.getStatus());

    // 将任务加入队列
    const result = await videoTaskQueue.addTask(async () => {
      let videoResult;

      // 根据模型选择不同的服务
      if (model === 'wan2.2' || model === 'comfyui') {
        if (!ENABLE_COMFYUI) {
          throw new Error('ComfyUI is disabled. Use a Jimeng video model or set ENABLE_COMFYUI=true.');
        }

        // 使用 ComfyUI wan2.2 模型
        if (!imageUrl) {
          throw new Error('缺少必填参数: imageUrl');
        }

        console.log('📌 使用 ComfyUI wan2.2 模型生成视频');
        
        videoResult = await ComfyUIService.imageToVideo(imageUrl, prompt, {
          negativePrompt,
          width: width || 640,
          height: height || 640,
          frames: frames || 81,  // ComfyUI 默认 81 帧
          fps: fps || 16,
          seed
        });

        return {
          taskId: videoResult.taskId,
          videoUrl: videoResult.videoUrl,
          model: 'wan2.2'
        };

      } else if (model === 'jimeng-first-tail') {
        // 使用即梦3.0 首尾帧模型
        if (!firstImageUrl || !lastImageUrl) {
          throw new Error('缺少必填参数: firstImageUrl 和 lastImageUrl');
        }

        if (!prompt) {
          throw new Error('首尾帧模式下 prompt 是必填的');
        }

        console.log('📌 使用即梦3.0 首尾帧模型生成视频');
        
        videoResult = await JimengService.firstTailImageToVideo(
          firstImageUrl,
          lastImageUrl,
          prompt,
          {
            frames,
            seed
          }
        );

        return {
          taskId: videoResult.taskId,
          videoUrl: videoResult.videoUrl,
          requestId: videoResult.requestId,
          model: 'jimeng-first-tail',
          aigcMetaTagged: videoResult.aigcMetaTagged
        };

      } else if (model === 'jimeng-first') {
        // 使用即梦3.0 首帧720P模型
        if (!imageUrl) {
          throw new Error('缺少必填参数: imageUrl');
        }

        if (!prompt) {
          throw new Error('首帧720P模式下 prompt 是必填的');
        }

        console.log('📌 使用即梦3.0 首帧720P模型生成视频');
        
        videoResult = await JimengService.firstFrameImageToVideo(
          imageUrl,
          prompt,
          {
            frames,
            seed
          }
        );

        return {
          taskId: videoResult.taskId,
          videoUrl: videoResult.videoUrl,
          requestId: videoResult.requestId,
          model: 'jimeng-first',
          aigcMetaTagged: videoResult.aigcMetaTagged
        };

      } else {
        // 默认使用即梦3.0 Pro
        if (!imageUrl) {
          throw new Error('缺少必填参数: imageUrl');
        }

        console.log('📌 使用即梦3.0 Pro 模型生成视频');
        
        videoResult = await JimengService.imageToVideo(imageUrl, prompt, {
          frames,
          aspectRatio,
          seed
        });

        return {
          taskId: videoResult.taskId,
          videoUrl: videoResult.videoUrl,
          requestId: videoResult.requestId,
          model: 'jimeng-pro'
        };
      }
    });

    // 返回结果
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('图生视频失败:', error);
    
    const errorResponse = {
      success: false,
      error: error.message
    };

    // 审核相关错误
    if (error.message.includes('Risk Not Pass')) {
      errorResponse.code = 'CONTENT_RISK';
      errorResponse.retry = false;
    }

    res.status(500).json(errorResponse);
  }
};

/**
 * 文生视频（同步等待）
 * POST /api/v1/image/text-to-video
 * 使用队列管理器避免并发限制问题
 */
export const textToVideo = async (req, res) => {
  try {
    const {
      prompt,
      frames = 121,
      aspectRatio = '16:9',
      seed = -1
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt'
      });
    }

    console.log(`🎬 文生视频请求: prompt="${prompt.substring(0, 50)}...", frames=${frames}, 队列状态:`, videoTaskQueue.getStatus());

    // 将任务加入队列
    const result = await videoTaskQueue.addTask(async () => {
      return await JimengService.textToVideo(prompt, {
        frames,
        aspectRatio,
        seed
      });
    });

    res.json({
      success: true,
      data: {
        taskId: result.taskId,
        videoUrl: result.videoUrl,
        requestId: result.requestId
      }
    });

  } catch (error) {
    console.error('文生视频失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export default {
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
};
