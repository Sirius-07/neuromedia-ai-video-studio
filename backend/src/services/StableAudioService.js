import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StableAudioService {
  /**
   * 创建音频生成任务
   * @param {Object} params - 生成参数
   * @param {string} params.prompt - 提示词
   * @param {number} params.duration - 音频时长（秒）
   * @param {number} [params.steps=100] - 推理步数
   * @param {number} [params.cfg_scale=7] - CFG引导强度
   * @param {number} [params.seed=-1] - 随机种子
   * @returns {Promise<Object>} 创建的任务对象
   */
  static async createGenerationTask(params) {
    const {
      prompt,
      duration,
      steps = 100,
      cfg_scale = 7,
      seed = -1,
      sampler_type = 'dpmpp-3m-sde',
      sigma_min = 0.3,
      sigma_max = 500
    } = params;

    // 验证必填参数
    if (!prompt || !duration) {
      throw new Error('缺少必填参数: prompt 和 duration 是必需的');
    }

    // 验证参数范围
    if (duration <= 0 || duration > 512) {
      throw new Error('duration 必须在 0-512 秒之间');
    }

    if (steps < 1 || steps > 500) {
      throw new Error('steps 必须在 1-500 之间');
    }

    if (cfg_scale < 0 || cfg_scale > 20) {
      throw new Error('cfg_scale 必须在 0-20 之间');
    }

    try {
      // 在数据库中创建新任务记录
      const task = await prisma.audioGenerationTask.create({
        data: {
          prompt,
          duration,
          steps,
          cfgScale: cfg_scale,
          seed,
          samplerType: sampler_type,
          sigmaMin: sigma_min,
          sigmaMax: sigma_max,
          status: 'pending',
          outputFilePath: null,
          errorMessage: null
        }
      });

      console.log(`✅ 音频生成任务已创建: ${task.id}`);
      console.log(`📋 参数: prompt="${prompt}", duration=${duration}s, steps=${steps}`);

      // 🔥 Fire-and-forget: 触发后台异步生成流程
      // ⚠️  临时禁用 - 测试用
      // this._startGeneration(task.id).catch(error => {
      //   console.error(`❌ 任务 ${task.id} 生成失败:`, error);
      // });
      
      // 临时：模拟生成过程
      setTimeout(() => {
        this._mockGeneration(task.id).catch(console.error);
      }, 100);

      return task;

    } catch (error) {
      console.error('创建音频生成任务失败:', error);
      throw new Error(`无法创建音频生成任务: ${error.message}`);
    }
  }

  /**
   * 获取任务状态
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务对象
   */
  static async getTaskStatus(taskId) {
    try {
      const task = await prisma.audioGenerationTask.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new Error('任务不存在');
      }

      return task;

    } catch (error) {
      console.error('获取任务状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有任务列表
   * @param {Object} options - 查询选项
   * @param {number} [options.limit=50] - 返回数量限制
   * @param {string} [options.status] - 按状态筛选
   * @returns {Promise<Array>} 任务列表
   */
  static async getAllTasks(options = {}) {
    const { limit = 50, status } = options;

    try {
      const where = status ? { status } : {};
      
      const tasks = await prisma.audioGenerationTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return tasks;

    } catch (error) {
      console.error('获取任务列表失败:', error);
      throw error;
    }
  }

  /**
   * 私有方法：启动音频生成流程（异步）
   * @private
   * @param {string} taskId - 任务ID
   */
  static async _startGeneration(taskId) {
    console.log(`🎵 开始生成音频: 任务 ${taskId}`);

    try {
      // 更新状态为 processing
      await prisma.audioGenerationTask.update({
        where: { id: taskId },
        data: { status: 'processing' }
      });

      // 获取任务参数
      const task = await prisma.audioGenerationTask.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new Error('任务不存在');
      }

      // 生成输出文件路径
      const timestamp = Date.now();
      const outputFilename = `audio_${taskId}_${timestamp}.wav`;
      const outputPath = path.join(__dirname, '../../uploads/audio', outputFilename);

      // 确保输出目录存在
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 调用 Python 脚本生成音频
      const audioFilePath = await this._callStableAudio({
        prompt: task.prompt,
        duration: task.duration,
        steps: task.steps,
        cfg_scale: task.cfgScale,
        seed: task.seed,
        sampler_type: task.samplerType,
        sigma_min: task.sigmaMin,
        sigma_max: task.sigmaMax,
        output_path: outputPath
      });

      console.log(`✅ 任务 ${taskId} 音频生成完成: ${audioFilePath}`);

      // 生成可访问的 URL
      const fileUrl = `/uploads/audio/${outputFilename}`;

      // 更新任务状态为 completed
      await prisma.audioGenerationTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          outputFilePath: audioFilePath,
          outputFileUrl: fileUrl
        }
      });

      console.log(`🎉 任务 ${taskId} 已完成！`);

    } catch (error) {
      console.error(`❌ 任务 ${taskId} 生成失败:`, error);

      // 更新任务状态为 failed
      await prisma.audioGenerationTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorMessage: error.message
        }
      });

      throw error;
    }
  }

  /**
   * 调用 Stable Audio Python 脚本生成音频
   * @private
   * @param {Object} params - 生成参数
   * @returns {Promise<string>} 生成的音频文件路径
   */
  static async _callStableAudio(params) {
    const {
      prompt,
      duration,
      steps,
      cfg_scale,
      seed,
      sampler_type,
      sigma_min,
      sigma_max,
      output_path
    } = params;

    return new Promise((resolve, reject) => {
      // Python 脚本路径
      const pythonScript = path.join(__dirname, '../../../stable-audio/generate_audio_api.py');
      const stableAudioDir = path.join(__dirname, '../../../stable-audio');

      // 检查脚本是否存在
      if (!fs.existsSync(pythonScript)) {
        return reject(new Error(`Python 脚本不存在: ${pythonScript}`));
      }

      // 准备参数
      const args = [
        pythonScript,
        '--prompt', prompt,
        '--duration', duration.toString(),
        '--steps', steps.toString(),
        '--cfg-scale', cfg_scale.toString(),
        '--seed', seed.toString(),
        '--sampler-type', sampler_type,
        '--sigma-min', sigma_min.toString(),
        '--sigma-max', sigma_max.toString(),
        '--output', output_path
      ];

      console.log(`🐍 调用 Python: python ${args.join(' ')}`);

      // 启动 Python 进程
      const pythonProcess = spawn('python', args, {
        cwd: stableAudioDir,
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[Python stdout]: ${output.trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(`[Python stderr]: ${output.trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          // 检查输出文件是否存在
          if (fs.existsSync(output_path)) {
            console.log(`✅ Python 脚本执行成功，文件已生成: ${output_path}`);
            resolve(output_path);
          } else {
            reject(new Error(`音频生成失败: 输出文件不存在 ${output_path}`));
          }
        } else {
          reject(new Error(`Python 脚本执行失败 (退出码: ${code})\n${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`无法启动 Python 进程: ${error.message}`));
      });

      // 设置超时（10分钟）
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('音频生成超时（超过10分钟）'));
      }, 10 * 60 * 1000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * 模拟音频生成（测试用）
   * @private
   */
  static async _mockGeneration(taskId) {
    console.log(`🎭 [模拟] 开始生成音频: 任务 ${taskId}`);
    
    await prisma.audioGenerationTask.update({
      where: { id: taskId },
      data: { status: 'processing' }
    });
    
    // 模拟生成延迟
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await prisma.audioGenerationTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        outputFilePath: '/mock/audio.wav',
        outputFileUrl: '/uploads/audio/mock_audio.wav'
      }
    });
    
    console.log(`✅ [模拟] 任务完成: ${taskId}`);
  }

  /**
   * 删除任务及其关联文件
   * @param {string} taskId - 任务ID
   * @returns {Promise<void>}
   */
  static async deleteTask(taskId) {
    try {
      const task = await prisma.audioGenerationTask.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new Error('任务不存在');
      }

      // 如果有输出文件，删除它
      if (task.outputFilePath && fs.existsSync(task.outputFilePath)) {
        fs.unlinkSync(task.outputFilePath);
        console.log(`🗑️ 已删除文件: ${task.outputFilePath}`);
      }

      // 从数据库删除任务
      await prisma.audioGenerationTask.delete({
        where: { id: taskId }
      });

      console.log(`✅ 任务 ${taskId} 已删除`);

    } catch (error) {
      console.error('删除任务失败:', error);
      throw error;
    }
  }
}

export default StableAudioService;

