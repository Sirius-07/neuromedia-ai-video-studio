import StableAudioService from '../services/StableAudioService.js';

/**
 * 创建音频生成任务
 * POST /api/v1/audio/generate
 * 
 * Request Body:
 * {
 *   "prompt": "Thunder and rain sound effect",
 *   "duration": 3.5,
 *   "steps": 100,           // 可选，默认 100
 *   "cfg_scale": 7,         // 可选，默认 7
 *   "seed": 42,             // 可选，默认 -1 (随机)
 *   "sampler_type": "dpmpp-3m-sde",  // 可选
 *   "sigma_min": 0.3,       // 可选
 *   "sigma_max": 500        // 可选
 * }
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const createAudioGenerationTask = async (req, res) => {
  try {
    const {
      prompt,
      duration,
      steps,
      cfg_scale,
      seed,
      sampler_type,
      sigma_min,
      sigma_max
    } = req.body;

    // 验证必填字段
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt'
      });
    }

    if (!duration) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: duration'
      });
    }

    // 调用服务层创建任务
    const task = await StableAudioService.createGenerationTask({
      prompt,
      duration,
      steps,
      cfg_scale,
      seed,
      sampler_type,
      sigma_min,
      sigma_max
    });

    // 返回任务信息
    return res.status(201).json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        prompt: task.prompt,
        duration: task.duration,
        createdAt: task.createdAt
      },
      message: '音频生成任务已创建，正在处理中...'
    });

  } catch (error) {
    console.error('创建音频生成任务失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * 获取音频生成任务状态
 * GET /api/v1/audio/task/:taskId
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const getAudioTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: taskId'
      });
    }

    // 从数据库查询任务
    const task = await StableAudioService.getTaskStatus(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
        taskId: taskId
      });
    }

    // 返回任务状态
    return res.status(200).json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        prompt: task.prompt,
        duration: task.duration,
        steps: task.steps,
        cfgScale: task.cfgScale,
        seed: task.seed,
        outputFileUrl: task.outputFileUrl,
        outputFilePath: task.outputFilePath,
        errorMessage: task.errorMessage,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    });

  } catch (error) {
    console.error('获取任务状态失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * 获取所有音频生成任务列表
 * GET /api/v1/audio/tasks
 * 
 * Query Parameters:
 * - limit: 返回数量限制（默认 50）
 * - status: 按状态筛选（pending/processing/completed/failed）
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const getAllAudioTasks = async (req, res) => {
  try {
    const { limit, status } = req.query;

    const tasks = await StableAudioService.getAllTasks({
      limit: limit ? parseInt(limit) : undefined,
      status
    });

    return res.status(200).json({
      success: true,
      data: {
        tasks,
        count: tasks.length
      }
    });

  } catch (error) {
    console.error('获取任务列表失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * 删除音频生成任务
 * DELETE /api/v1/audio/task/:taskId
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const deleteAudioTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: taskId'
      });
    }

    await StableAudioService.deleteTask(taskId);

    return res.status(200).json({
      success: true,
      message: '任务已删除',
      taskId
    });

  } catch (error) {
    console.error('删除任务失败:', error);
    
    if (error.message === '任务不存在') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * 快速生成音频（简化接口）
 * POST /api/v1/audio/quick-generate
 * 
 * Request Body:
 * {
 *   "prompt": "Thunder sound effect",
 *   "duration": 3.5
 * }
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const quickGenerateAudio = async (req, res) => {
  try {
    const { prompt, duration } = req.body;

    if (!prompt || !duration) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt 和 duration'
      });
    }

    // 使用默认参数创建任务
    const task = await StableAudioService.createGenerationTask({
      prompt,
      duration,
      steps: 100,        // 默认快速生成
      cfg_scale: 7,      // 默认引导强度
      seed: -1           // 随机种子
    });

    return res.status(201).json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        prompt: task.prompt,
        duration: task.duration
      },
      message: '音频正在快速生成中...'
    });

  } catch (error) {
    console.error('快速生成音频失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};















