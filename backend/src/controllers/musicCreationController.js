import VideoConcatService from '../services/VideoConcatService.js';
import TOSService from '../services/TOSService.js';
import MultimodalAIService from '../services/MultimodalAIService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 内存任务存储 (TaskId -> TaskInfo)
// 在生产环境中应使用 Redis 或数据库
const taskStore = new Map();

/**
 * 获取任务状态
 * GET /api/v1/music-creation/status/:taskId
 */
export const getTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const task = taskStore.get(taskId);
  
  if (!task) {
    return res.status(404).json({
      success: false,
      error: '任务不存在或已过期'
    });
  }
  
  return res.status(200).json({
    success: true,
    data: task
  });
};

/**
 * 音频创作控制器
 * 
 * 处理从分镜页面到音频创作的完整流程：
 * 1. 拼接视频
 * 2. 上传到TOS对象存储
 * 3. 调用AI分析生成音频指令蓝图
 */

/**
 * 创建音频创作任务（完整流程）- 异步模式
 * POST /api/v1/music-creation/create
 */
export const createMusicCreationTask = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('🎵 [音频创作] 收到新任务请求');
  console.log('='.repeat(80));
  
  try {
    const { scenes } = req.body;
    
    // 验证输入
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: scenes（至少需要一个分镜）'
      });
    }
    
    console.log(`📹 收到 ${scenes.length} 个分镜`);
    
    // 生成任务ID
    const taskId = uuidv4();
    
    // 初始化任务状态
    const initialTaskState = {
      id: taskId,
      status: 'processing',
      step: 'preparing', // preparing, concatenating, uploading, analyzing, completed, error
      progress: 0,
      details: '正在初始化任务...',
      subProgress: {
        current: 0,
        total: scenes.length,
        item: ''
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    taskStore.set(taskId, initialTaskState);
    
    // 立即返回任务ID
    res.status(202).json({
      success: true,
      data: { taskId },
      message: '任务已接受，请轮询状态接口获取进度'
    });
    
    // ============================================================
    // 异步后台处理
    // ============================================================
    (async () => {
      const updateTask = (updates) => {
        const current = taskStore.get(taskId);
        if (current) {
          taskStore.set(taskId, {
            ...current,
            ...updates,
            updatedAt: Date.now()
          });
        }
      };
      
      try {
        // ============================================================
        // 阶段1：拼接视频 (包含素材准备)
        // ============================================================
        console.log(`[${taskId}] [阶段 1/3] 拼接视频...`);
        updateTask({ 
          step: 'preparing', 
          details: '准备分镜素材...',
          progress: 10 
        });
        
        const outputDir = path.join(__dirname, '../../uploads/video/music-creation');
        const timestamp = Date.now();
        const outputFilename = `music_creation_${timestamp}.mp4`;
        
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const concatResult = await VideoConcatService.concatVideos({
          scenes: scenes,
          outputDir: outputDir,
          outputFilename: outputFilename,
          onProgress: (progress) => {
            console.log(`[${taskId}] 进度: ${progress.stage} - ${progress.message || ''}`);
            
            // 将 VideoConcatService 的进度映射到任务状态
            if (progress.stage === 'downloading') {
              updateTask({
                step: 'preparing',
                details: `准备分镜素材 (${progress.current}/${progress.total})`,
                subProgress: {
                  current: progress.current,
                  total: progress.total,
                  item: `正在处理分镜 ${progress.current}...`
                },
                // 进度 10-30%
                progress: 10 + Math.floor((progress.current / progress.total) * 20)
              });
            } else if (progress.stage === 'concatenating') {
              updateTask({
                step: 'concatenating',
                details: '视频智能拼接中...',
                subProgress: {
                  current: 0,
                  total: 0,
                  item: progress.message || '正在编码...'
                },
                // 进度 30-60%
                progress: 30 + (progress.percent ? Math.floor(progress.percent * 0.3) : 0)
              });
            }
          }
        });
        
        if (!concatResult.success) {
          throw new Error('视频拼接失败');
        }
        
        console.log(`[${taskId}] ✅ 视频拼接完成: ${concatResult.videoPath}`);
        const localVideoPath = concatResult.videoPath;
        
        // ============================================================
        // 阶段2：上传到TOS对象存储
        // ============================================================
        console.log(`[${taskId}] [阶段 2/3] 上传到TOS对象存储...`);
        updateTask({
          step: 'uploading',
          details: '正在上传到云端存储...',
          progress: 60,
          subProgress: { item: '上传中...' }
        });
        
        let tosUrl;
        let uploadResult;
        
        try {
          // TODO: TOSService 目前没有进度回调，如果需要可以添加
          uploadResult = await TOSService.uploadVideo(localVideoPath, {
            folder: 'videos/music-creation/'
          });
          
          tosUrl = uploadResult.url;
          console.log(`[${taskId}] ✅ 上传成功: ${tosUrl}`);
          
          updateTask({ progress: 80 });
          
        } catch (uploadError) {
          console.error(`[${taskId}] ⚠️ TOS上传失败，将使用本地文件路径:`, uploadError.message);
          
          // 如果TOS上传失败，尝试使用本地URL（仅用于开发环境）
          const publicUrl = process.env.PUBLIC_URL || 'http://localhost:4300';
          tosUrl = `${publicUrl}${concatResult.videoUrl}`;
          
          console.log(`[${taskId}] ⚠️ 使用本地URL: ${tosUrl}`);
        }
        
        // ============================================================
        // 阶段3：AI分析生成音频指令蓝图
        // ============================================================
        console.log(`[${taskId}] [阶段 3/3] AI分析视频内容...`);
        updateTask({
          step: 'analyzing',
          details: 'AI 正在进行视觉分析...',
          progress: 85,
          subProgress: { item: '多模态模型推理中...' }
        });
        
        let instructionBlueprint;
        
        try {
          instructionBlueprint = await MultimodalAIService.analyzeVideo(tosUrl);
          console.log(`[${taskId}] ✅ AI分析完成`);
          
        } catch (aiError) {
          console.error(`[${taskId}] ❌ AI分析失败:`, aiError.message);
          
          // AI分析失败，标记为部分成功
          updateTask({
            status: 'completed',
            step: 'completed',
            progress: 100,
            details: '处理完成（AI分析失败）',
            result: {
              partial: true,
              data: {
                videoUrl: tosUrl,
                localVideoPath: localVideoPath,
                uploadResult: uploadResult,
                error: `AI分析失败: ${aiError.message}`
              }
            }
          });
          return;
        }
        
        // ============================================================
        // 完成
        // ============================================================
        console.log(`[${taskId}] ✅ 任务全部完成`);
        
        // 可选：清理本地临时文件
        if (uploadResult && process.env.AUTO_CLEANUP_LOCAL_FILES === 'true') {
          try {
            fs.unlinkSync(localVideoPath);
          } catch (e) {}
        }
        
        updateTask({
          status: 'completed',
          step: 'completed',
          progress: 100,
          details: '全部完成',
          result: {
            success: true,
            data: {
              videoUrl: tosUrl,
              localVideoPath: localVideoPath,
              videoFilename: outputFilename,
              uploadResult: uploadResult ? {
                bucket: uploadResult.bucket,
                objectKey: uploadResult.objectKey,
                region: uploadResult.region,
                fileSizeInMB: uploadResult.fileSizeInMB,
                uploadDuration: uploadResult.uploadDuration
              } : null,
              instructionBlueprint: instructionBlueprint,
              stats: {
                scenesCount: scenes.length,
                videoCount: concatResult.videoCount
              }
            }
          }
        });
        
        // 10分钟后清理内存中的任务状态
        setTimeout(() => {
          if (taskStore.has(taskId)) {
            taskStore.delete(taskId);
          }
        }, 10 * 60 * 1000);
        
      } catch (error) {
        console.error(`[${taskId}] ❌ 任务执行失败:`, error);
        updateTask({
          status: 'error',
          step: 'error',
          error: error.message,
          details: '任务执行失败'
        });
      }
    })();
    
  } catch (error) {
    console.error('\n❌ [音频创作] 任务创建失败:', error);
    return res.status(500).json({
      success: false,
      error: '创建音频创作任务失败',
      message: error.message
    });
  }
};

/**
 * 仅拼接并上传视频（不进行AI分析）
 * POST /api/v1/music-creation/upload-only
 * 
 * 用于快速导出视频到TOS，供其他用途使用
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const uploadVideoOnly = async (req, res) => {
  try {
    const { scenes } = req.body;
    
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: scenes'
      });
    }
    
    console.log(`🎬 [仅上传] 拼接并上传 ${scenes.length} 个分镜`);
    
    // 拼接视频
    const outputDir = path.join(__dirname, '../../uploads/video/music-creation');
    const timestamp = Date.now();
    const outputFilename = `upload_only_${timestamp}.mp4`;
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const concatResult = await VideoConcatService.concatVideos({
      scenes: scenes,
      outputDir: outputDir,
      outputFilename: outputFilename
    });
    
    if (!concatResult.success) {
      throw new Error('视频拼接失败');
    }
    
    // 上传到TOS
    const uploadResult = await TOSService.uploadVideo(concatResult.videoPath, {
      folder: 'videos/music-creation/'
    });
    
    console.log(`✅ [仅上传] 完成: ${uploadResult.url}`);
    
    return res.status(200).json({
      success: true,
      data: {
        videoUrl: uploadResult.url,
        localVideoPath: concatResult.videoPath,
        uploadResult: {
          bucket: uploadResult.bucket,
          objectKey: uploadResult.objectKey,
          region: uploadResult.region,
          fileSizeInMB: uploadResult.fileSizeInMB
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [仅上传] 失败:', error);
    return res.status(500).json({
      success: false,
      error: '上传视频失败',
      message: error.message
    });
  }
};

/**
 * 检查TOS配置状态
 * GET /api/v1/music-creation/check-tos
 * 
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const checkTOSConfiguration = async (req, res) => {
  try {
    const isValid = await TOSService.checkConfiguration();
    
    return res.status(200).json({
      success: true,
      data: {
        configured: isValid,
        region: process.env.TOS_REGION || 'cn-guangzhou',
        bucket: process.env.TOS_BUCKET || null,
        message: isValid 
          ? 'TOS配置有效，可以正常使用音频创作功能' 
          : 'TOS配置无效，请检查环境变量配置'
      }
    });
    
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: {
        configured: false,
        error: error.message,
        message: 'TOS未配置或配置错误，音频创作功能将使用本地URL（仅开发环境）'
      }
    });
  }
};
