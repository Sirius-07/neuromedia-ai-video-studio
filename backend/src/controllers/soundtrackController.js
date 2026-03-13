import SoundtrackService from '../services/SoundtrackService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 创建配乐任务控制器
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const createSoundtrackTask = async (req, res) => {
  try {
    const { videoId } = req.body;

    // 验证必填字段
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: videoId'
      });
    }

    // 调用服务层创建任务
    const task = await SoundtrackService.createTask(videoId);

    // 返回任务信息
    return res.status(201).json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        videoId: task.videoId,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    console.error('创建配乐任务失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * 获取配乐任务状态控制器
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const getSoundtrackTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    // 验证必填字段
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: taskId'
      });
    }

    // 从数据库查询任务
    const task = await prisma.soundtrackTask.findUnique({
      where: { id: taskId }
    });

    // 任务不存在
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
        taskId: taskId
      });
    }

    // 解析 finalAssetMap（如果存在）
    let finalAssetMap = null;
    if (task.finalAssetMap) {
      try {
        finalAssetMap = JSON.parse(task.finalAssetMap);
      } catch (e) {
        console.error('解析 finalAssetMap 失败:', e);
      }
    }

    // 返回任务状态
    return res.status(200).json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        videoId: task.videoId,
        finalAssetMap: finalAssetMap,
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
 * 更新音效配置控制器
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const updateSoundEffects = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: taskId'
      });
    }

    // 调用服务层更新配置
    const updatedTask = await SoundtrackService.updateSoundEffects(taskId, updates);

    return res.status(200).json({
      success: true,
      data: {
        taskId: updatedTask.id,
        finalAssetMap: updatedTask.finalAssetMap
      }
    });

  } catch (error) {
    console.error('更新音效配置失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * 合成视频控制器
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const mergeVideo = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: taskId'
      });
    }

    // 调用服务层合成视频
    const result = await SoundtrackService.mergeVideo(taskId);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('合成视频失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

