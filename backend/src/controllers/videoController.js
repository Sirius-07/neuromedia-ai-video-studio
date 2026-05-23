import { PrismaClient } from '@prisma/client';
import path from 'path';
import VideoProcessingService from '../services/VideoProcessingService.js';
import VideoOptimizationAIService from '../services/VideoOptimizationAIService.js';

const prisma = new PrismaClient();

/**
 * 上传视频文件控制器
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const uploadVideo = async (req, res) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的视频文件'
      });
    }

    const file = req.file;
    const videoId = `video_${Date.now()}`;
    const filePath = `/uploads/videos/${file.filename}`;

    console.log(`✅ 视频上传成功: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // 返回视频信息
    return res.status(200).json({
      success: true,
      data: {
        videoId: videoId,
        originalName: file.originalname,
        fileName: file.filename,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('视频上传失败:', error);
    return res.status(500).json({
      success: false,
      error: '视频上传失败',
      message: error.message
    });
  }
};

/**
 * 应用后期处理效果到视频
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const processVideo = async (req, res) => {
  try {
    const { video_url, ffmpeg_filter, output_format = 'mp4' } = req.body;

    // 参数验证
    if (!video_url) {
      return res.status(400).json({
        success: false,
        error: '请提供视频URL'
      });
    }

    if (!ffmpeg_filter || ffmpeg_filter === 'null') {
      // 如果没有滤镜效果，直接返回原视频
      return res.status(200).json({
        success: true,
        processed_video_url: video_url,
        message: '无需处理，返回原视频'
      });
    }

    console.log('🎬 [视频处理API] 收到处理请求');
    console.log('视频URL:', video_url);
    console.log('FFmpeg滤镜:', ffmpeg_filter);

    // 下载或获取本地视频路径
    const localVideoPath = await VideoProcessingService.downloadVideo(video_url);

    // 应用后期处理效果
    const processedVideoPath = await VideoProcessingService.processVideo(
      localVideoPath,
      ffmpeg_filter,
      output_format
    );

    console.log('✅ 视频处理完成:', processedVideoPath);

    return res.status(200).json({
      success: true,
      processed_video_url: processedVideoPath,
      message: '视频处理成功'
    });

  } catch (error) {
    console.error('❌ 视频处理失败:', error);
    return res.status(500).json({
      success: false,
      error: '视频处理失败',
      message: error.message
    });
  }
};

/**
 * 获取视频信息
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const getVideoInfo = async (req, res) => {
  try {
    const { video_url } = req.query;

    if (!video_url) {
      return res.status(400).json({
        success: false,
        error: '请提供视频URL'
      });
    }

    const localVideoPath = await VideoProcessingService.downloadVideo(video_url);
    const info = await VideoProcessingService.getVideoInfo(localVideoPath);    return res.status(200).json({
      success: true,
      data: info
    });

  } catch (error) {
    console.error('获取视频信息失败:', error);
    return res.status(500).json({
      success: false,
      error: '获取视频信息失败',
      message: error.message
    });
  }
};

/**
 * AI一键优化视频后期处理参数
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const optimizeVideoWithAI = async (req, res) => {
  try {
    const { video_url, project_theme, scene_script } = req.body;

    // 参数验证
    if (!video_url) {
      return res.status(400).json({
        success: false,
        error: '请提供视频URL'
      });
    }

    console.log('🎨 [AI优化API] 收到优化请求');
    console.log('视频URL:', video_url);
    console.log('项目主题:', project_theme);
    console.log('场景脚本:', scene_script);

    // 将视频URL转换为本地文件路径
    let videoPath = video_url;
    
    // 处理本地服务器的URL（localhost:4300）
    if (video_url.includes('localhost:4300/uploads/') || video_url.includes('127.0.0.1:4300/uploads/')) {
      // 提取路径部分：http://localhost:4300/uploads/assets/xxx.mp4 -> /uploads/assets/xxx.mp4
      const urlObj = new URL(video_url);
      videoPath = path.join(process.cwd(), urlObj.pathname.replace(/^\//, ''));
      console.log('🔄 检测到本地URL，转换为本地路径:', videoPath);
    } 
    // 处理相对路径
    else if (video_url.startsWith('/uploads/')) {
      videoPath = path.join(process.cwd(), video_url.replace(/^\//, ''));
      console.log('🔄 检测到相对路径，转换为本地路径:', videoPath);
    }
    // 其他情况（公网URL或已经是本地路径）保持不变
    else {
      console.log('📍 使用原始路径:', videoPath);
    }

    // 调用AI优化服务
    const optimizationResult = await VideoOptimizationAIService.optimizeVideo(
      videoPath,
      project_theme,
      scene_script
    );

    console.log('✅ AI优化完成');

    return res.status(200).json({
      success: true,
      data: optimizationResult,
      message: 'AI优化完成'
    });

  } catch (error) {
    console.error('❌ AI优化失败:', error);
    return res.status(500).json({
      success: false,
      error: 'AI优化失败',
      message: error.message
    });
  }
};
