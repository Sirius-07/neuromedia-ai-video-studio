import express from 'express';
import {
  createAudioGenerationTask,
  getAudioTaskStatus,
  getAllAudioTasks,
  deleteAudioTask,
  quickGenerateAudio
} from '../controllers/audioController.js';

const router = express.Router();

/**
 * @route POST /api/v1/audio/generate
 * @desc 创建音频生成任务（完整参数）
 * @access Public
 */
router.post('/generate', createAudioGenerationTask);

/**
 * @route POST /api/v1/audio/quick-generate
 * @desc 快速生成音频（简化接口，使用默认参数）
 * @access Public
 */
router.post('/quick-generate', quickGenerateAudio);

/**
 * @route GET /api/v1/audio/task/:taskId
 * @desc 获取指定任务的状态和结果
 * @access Public
 */
router.get('/task/:taskId', getAudioTaskStatus);

/**
 * @route GET /api/v1/audio/tasks
 * @desc 获取所有任务列表
 * @access Public
 */
router.get('/tasks', getAllAudioTasks);

/**
 * @route DELETE /api/v1/audio/task/:taskId
 * @desc 删除指定任务及其关联文件
 * @access Public
 */
router.delete('/task/:taskId', deleteAudioTask);

export default router;















