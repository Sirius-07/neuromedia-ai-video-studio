import { PrismaClient } from '@prisma/client';
import MultimodalAIService from './MultimodalAIService.js';
import BatchAudioService from './BatchAudioService.js';
import VideoMergeService from './VideoMergeService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SoundtrackService {
  /**
   * 解析视频输入，返回实际的文件路径或URL
   * @private
   * @param {string} videoInput - 可能是URL、相对路径或videoId
   * @returns {string} 实际的文件路径或URL
   */
  static _resolveVideoPath(videoInput) {
    // 如果是公网URL，直接返回
    if (videoInput.startsWith('http://') || videoInput.startsWith('https://')) {
      console.log(`🌐 检测到公网URL: ${videoInput}`);
      return videoInput;
    }
    
    // 如果是相对路径（如 /uploads/videos/xxx.mp4）
    if (videoInput.startsWith('/uploads/')) {
      const absolutePath = path.join(__dirname, '../../', videoInput);
      console.log(`📁 相对路径转换为绝对路径: ${absolutePath}`);
      return absolutePath;
    }
    
    // 如果是完整的本地文件路径
    if (fs.existsSync(videoInput)) {
      console.log(`📁 检测到本地文件: ${videoInput}`);
      return videoInput;
    }
    
    // 默认：假设是存储在 uploads/videos 目录下的文件名或 videoId
    // 尝试在 uploads/videos 目录中查找匹配的文件
    const uploadsDir = path.join(__dirname, '../../uploads/videos');
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      // 查找包含 videoInput 的文件
      const matchedFile = files.find(file => file.includes(videoInput) || videoInput.includes(file));
      
      if (matchedFile) {
        const absolutePath = path.join(uploadsDir, matchedFile);
        console.log(`📁 在上传目录中找到匹配文件: ${absolutePath}`);
        return absolutePath;
      }
    }
    
    // 如果都不匹配，返回原始输入（让后续处理报错）
    console.warn(`⚠️ 无法解析视频路径: ${videoInput}，将使用原始输入`);
    return videoInput;
  }

  /**
   * 创建新的配乐任务
   * @param {string} videoId - 视频ID、URL或文件路径
   * @returns {Promise<Object>} 创建的任务对象
   */
  static async createTask(videoId) {
    try {
      // 在数据库中创建新任务记录
      const task = await prisma.soundtrackTask.create({
        data: {
          videoId: videoId,
          status: 'processing',
          instructionBlueprint: null,
          finalAssetMap: null,
          errorMessage: null
        }
      });

      console.log(`✅ 任务已创建: ${task.id}, 视频ID: ${videoId}`);

      // 🔥 Fire-and-forget: 触发后台异步分析流程，不等待完成
      // 使用 .catch() 避免未捕获的 Promise rejection
      this._startAnalysis(task.id, videoId).catch(error => {
        console.error(`❌ 任务 ${task.id} 分析流程失败:`, error);
      });

      // 立即返回任务，不等待分析完成
      return task;

    } catch (error) {
      console.error('创建任务失败:', error);
      throw new Error('无法创建配乐任务');
    }
  }

  /**
   * 私有方法：启动AI分析流程（异步，不阻塞）
   * @private
   * @param {string} taskId - 任务ID
   * @param {string} videoId - 视频ID、URL或文件路径
   */
  static async _startAnalysis(taskId, videoId) {
    console.log(`🎬 开始分析任务: ${taskId}, 视频输入: ${videoId}`);
    
    try {
      // 🔍 解析视频路径（URL 或本地文件）
      const resolvedPath = this._resolveVideoPath(videoId);
      console.log(`✅ 解析后的路径: ${resolvedPath}`);
      
      // 🤖 阶段二：调用多模态AI分析视频
      const instructionBlueprint = await MultimodalAIService.analyzeVideo(resolvedPath);
      
      console.log(`📋 任务 ${taskId} 获取到指令蓝图:`, JSON.stringify(instructionBlueprint, null, 2));
      
      // 💾 将指令蓝图保存到数据库
      await prisma.soundtrackTask.update({
        where: { id: taskId },
        data: {
          instructionBlueprint: JSON.stringify(instructionBlueprint)
        }
      });
      
      console.log(`✅ 任务 ${taskId} 的指令蓝图已保存到数据库`);
      
      // 🎵 阶段三：触发音频资产生成流程
      await this._startGeneration(taskId, instructionBlueprint);
      
    } catch (error) {
      console.error(`❌ 任务 ${taskId} 分析失败:`, error);
      
      // 更新任务状态为失败
      await prisma.soundtrackTask.update({
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
   * 私有方法：启动音频资产生成流程（异步）
   * @private
   * @param {string} taskId - 任务ID
   * @param {Object} blueprint - 指令蓝图对象
   */
  static async _startGeneration(taskId, blueprint) {
    console.log(`🎵 开始生成音频资产: 任务 ${taskId}`);
    
    try {
      // 📋 解析蓝图，提取背景音乐和音效任务
      const { background_music, sound_effects } = blueprint;
      
      console.log(`📊 任务 ${taskId} - 发现 1 个BGM任务 和 ${sound_effects.length} 个SFX任务`);
      
      // 🎼 准备所有音频生成任务（使用批量生成服务）
      const audioTasks = [];
      
      // 添加 BGM 任务
      if (background_music) {
        audioTasks.push({
          type: 'bgm',
          prompt: background_music.prompt,
          duration: background_music.duration,
          description: background_music.mood || 'Background Music'
        });
      }
      
      // 添加所有 SFX 任务
      sound_effects.forEach((sfx, index) => {
        audioTasks.push({
          type: 'sfx',
          prompt: sfx.prompt,
          duration: sfx.duration,
          timestamp: sfx.timestamp,
          category: sfx.category,
          description: sfx.description
        });
      });
      
      console.log(`⚡ 任务 ${taskId} - 开始批量生成 ${audioTasks.length} 个音频文件...`);
      
      // 🚀 使用批量音频生成服务（只加载一次模型，更高效）
      const batchResult = await BatchAudioService.batchGenerate(audioTasks, {
        steps: 50,
        cfg_scale: 7,
        batchName: `task_${taskId}`
      });
      
      console.log(`✅ 任务 ${taskId} - 批量音频生成完成！`);
      console.log(`   成功: ${batchResult.results.length} 个，失败: ${batchResult.errors.length} 个`);
      
      // 📦 创建最终资产地图（Final Asset Map）
      // 深拷贝原始蓝图
      const finalAssetMap = JSON.parse(JSON.stringify(blueprint));
      
      // 注入生成的音频文件 URL
      let resultIndex = 0;
      
      // 注入 BGM 的 file_url
      if (finalAssetMap.background_music && batchResult.results[resultIndex]) {
        finalAssetMap.background_music.file_url = batchResult.results[resultIndex].fileUrl;
        finalAssetMap.background_music.file_path = batchResult.results[resultIndex].outputPath;
        console.log(`🎵 BGM URL: ${batchResult.results[resultIndex].fileUrl}`);
        resultIndex++;
      }
      
      // 注入所有 SFX 的 file_url
      finalAssetMap.sound_effects.forEach((sfx, index) => {
        if (batchResult.results[resultIndex]) {
          sfx.file_url = batchResult.results[resultIndex].fileUrl;
          sfx.file_path = batchResult.results[resultIndex].outputPath;
          console.log(`🔊 SFX ${index + 1} URL: ${batchResult.results[resultIndex].fileUrl}`);
          resultIndex++;
        }
      });
      
      // 添加生成完成的时间戳和批次信息
      finalAssetMap.generatedAt = new Date().toISOString();
      finalAssetMap.batchFolder = batchResult.folderName;
      finalAssetMap.outputDirectory = batchResult.outputDir;
      
      console.log(`📋 任务 ${taskId} - 最终资产地图已创建`);
      
      // 💾 保存最终资产地图到数据库，并更新状态为 completed
      await prisma.soundtrackTask.update({
        where: { id: taskId },
        data: {
          finalAssetMap: JSON.stringify(finalAssetMap),
          status: 'completed'
        }
      });
      
      console.log(`🎉 任务 ${taskId} - 已完成！状态已更新为 'completed'`);
      
    } catch (error) {
      console.error(`❌ 任务 ${taskId} 音频生成失败:`, error);
      
      // 更新任务状态为失败
      await prisma.soundtrackTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorMessage: `音频生成失败: ${error.message}`
        }
      });
      
      throw error;
    }
  }

  /**
   * 获取任务状态
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务对象
   */
  static async getTaskStatus(taskId) {
    try {
      const task = await prisma.soundtrackTask.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new Error('任务不存在');
      }

      // 解析 JSON 字段
      const result = {
        ...task,
        instructionBlueprint: task.instructionBlueprint ? JSON.parse(task.instructionBlueprint) : null,
        finalAssetMap: task.finalAssetMap ? JSON.parse(task.finalAssetMap) : null
      };

      return result;
    } catch (error) {
      console.error('获取任务状态失败:', error);
      throw error;
    }
  }

  /**
   * 更新音效配置（调整音量、时间戳等）
   * @param {string} taskId - 任务ID
   * @param {Object} updates - 更新的配置
   * @returns {Promise<Object>} 更新后的任务对象
   */
  static async updateSoundEffects(taskId, updates) {
    try {
      const task = await this.getTaskStatus(taskId);

      if (!task.finalAssetMap) {
        throw new Error('任务还未完成音频生成');
      }

      const finalAssetMap = task.finalAssetMap;

      // 更新音效配置
      if (updates.sound_effects) {
        updates.sound_effects.forEach((update, index) => {
          if (finalAssetMap.sound_effects[index]) {
            Object.assign(finalAssetMap.sound_effects[index], update);
          }
        });
      }

      // 更新 BGM 配置
      if (updates.background_music) {
        Object.assign(finalAssetMap.background_music, updates.background_music);
      }

      // 保存更新
      await prisma.soundtrackTask.update({
        where: { id: taskId },
        data: {
          finalAssetMap: JSON.stringify(finalAssetMap)
        }
      });

      console.log(`✅ 任务 ${taskId} 音效配置已更新`);

      return await this.getTaskStatus(taskId);
    } catch (error) {
      console.error('更新音效配置失败:', error);
      throw error;
    }
  }

  /**
   * 合成视频（将音效合成到视频中）
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 合成结果
   */
  static async mergeVideo(taskId) {
    try {
      const task = await this.getTaskStatus(taskId);

      if (!task.finalAssetMap) {
        throw new Error('任务还未完成音频生成');
      }

      const finalAssetMap = task.finalAssetMap;

      // 准备音频文件列表（包括BGM和音效）
      const audioFiles = [];
      let bgmFile = null;

      // 添加 BGM
      if (finalAssetMap.background_music && finalAssetMap.background_music.file_path) {
        if (fs.existsSync(finalAssetMap.background_music.file_path)) {
          bgmFile = {
            outputPath: finalAssetMap.background_music.file_path,
            path: finalAssetMap.background_music.file_path,
            startTime: finalAssetMap.background_music.startTime || 0,
            duration: finalAssetMap.background_music.duration,
            volume: finalAssetMap.background_music.volume || 1.0,
            type: 'bgm'
          };
          console.log(`🎵 添加 BGM: ${bgmFile.path}`);
        }
      }

      // 添加所有音效
      finalAssetMap.sound_effects.forEach((sfx) => {
        if (sfx.file_path && fs.existsSync(sfx.file_path)) {
          audioFiles.push({
            outputPath: sfx.file_path,
            path: sfx.file_path,
            timestamp: sfx.timestamp,
            volume: sfx.volume || 0.8,
            type: 'sfx'
          });
        }
      });

      console.log(`🎬 任务 ${taskId} - 准备合成 ${bgmFile ? '1个BGM + ' : ''}${audioFiles.length} 个音效到视频`);

      // 解析视频路径
      const videoInput = this._resolveVideoPath(task.videoId);

      // 输出目录 - 如果没有outputDirectory则创建带时间戳的文件夹
      let outputDir = finalAssetMap.outputDirectory;
      if (!outputDir) {
        const now = new Date();
        const dateStr = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
        const folderName = `merged_${dateStr}`;
        outputDir = path.join(__dirname, '../../uploads/audio', folderName);
      }

      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 生成带时间戳的输出文件名
      const now = new Date();
      const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
      const outputFilename = `video_with_audio_${timestamp}.mp4`;

      // 执行视频合成
      const mergeResult = await VideoMergeService.mergeAudioToVideo({
        videoInput: videoInput,
        bgmFile: bgmFile,
        audioFiles: audioFiles,
        outputDir: outputDir,
        outputFilename: outputFilename
      });

      // 更新任务，添加合成视频信息
      finalAssetMap.mergedVideo = {
        videoPath: mergeResult.videoPath,
        videoUrl: mergeResult.videoUrl,
        filename: mergeResult.filename,
        mergedAt: new Date().toISOString()
      };

      await prisma.soundtrackTask.update({
        where: { id: taskId },
        data: {
          finalAssetMap: JSON.stringify(finalAssetMap)
        }
      });

      console.log(`🎉 任务 ${taskId} - 视频合成完成！`);

      return {
        success: true,
        taskId: taskId,
        mergedVideo: finalAssetMap.mergedVideo
      };

    } catch (error) {
      console.error(`❌ 任务 ${taskId} 视频合成失败:`, error);
      throw error;
    }
  }
}

export default SoundtrackService;

