import VideoConcatService from '../services/VideoConcatService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { toPublicUrl } from '../config/serverConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIDEO_FILE_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];

function isLikelyVideoUrl(url = '') {
  const pathname = String(url).split('?')[0].toLowerCase();
  return VIDEO_FILE_EXTENSIONS.some(extension => pathname.endsWith(extension));
}

function getExportVideoSource(scene = {}) {
  if (scene.videoUrl) return scene.videoUrl;
  if (isLikelyVideoUrl(scene.assetUrl)) return scene.assetUrl;
  return null;
}

/**
 * 导出粗剪视频控制器
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const exportRoughCut = async (req, res) => {
  try {
    const { scenes } = req.body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: scenes（分镜数组）'
      });
    }

    console.log(`\n📹 收到导出粗剪请求（带进度），共 ${scenes.length} 个分镜`);

    // 过滤并准备场景数据（包含后期处理参数）
    const validScenes = scenes
      .filter(scene => {
        // 保留有视频的分镜：AI生成(videoUrl) 或 实拍素材(assetUrl)
        return Boolean(getExportVideoSource(scene));
      })
      .map((scene, index) => {
        // 优先使用 videoUrl (AI生成)，如果没有则使用 assetUrl (实拍素材)
        const url = getExportVideoSource(scene);
        
        console.log(`  分镜 ${index + 1}: ${scene.type === 'ai' ? 'AI生成' : '实拍素材'} - ${url}`);
        if (scene.postProcessing) {
          console.log(`    后期处理: 亮度=${scene.postProcessing.brightness || 0}, 对比度=${scene.postProcessing.contrast || 0}`);
        }
        if (scene.clipStartTime !== undefined && scene.clipEndTime !== undefined) {
          console.log(`    裁剪时间: ${scene.clipStartTime}s - ${scene.clipEndTime}s`);
        }
        
        // 如果是相对路径，转换为完整URL（使用配置的公网URL）
        const processedUrl = toPublicUrl(url);

        return {
          videoUrl: processedUrl,
          assetUrl: scene.assetUrl,
          postProcessing: scene.postProcessing || {},
          clipStartTime: scene.clipStartTime,
          clipEndTime: scene.clipEndTime
        };
      });

    if (validScenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有可导出的视频，请先生成视频'
      });
    }

    console.log(`✅ 找到 ${validScenes.length} 个已生成的视频`);

    // 创建输出目录
    const now = new Date();
    const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
    const folderName = `rough_cut_${timestamp}`;
    const outputDir = path.join(__dirname, '../../uploads/video', folderName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFilename = `rough_cut_${timestamp}.mp4`;

    // 设置SSE头（用于实时进度推送）
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 进度回调函数
    const onProgress = (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    try {
      // 执行视频拼接（传递完整场景数据以应用后期处理）
      const result = await VideoConcatService.concatVideos({
        scenes: validScenes,
        outputDir: outputDir,
        outputFilename: outputFilename,
        onProgress: onProgress
      });

      // 将相对路径转换为公网URL
      const resultWithPublicUrl = {
        ...result,
        videoUrl: toPublicUrl(result.videoUrl)
      };
      
      // 发送最终结果
      res.write(`data: ${JSON.stringify({
        stage: 'completed',
        result: resultWithPublicUrl
      })}\n\n`);
      
      res.end();

      console.log('✅ 粗剪导出成功，视频URL:', resultWithPublicUrl.videoUrl);

    } catch (error) {
      console.error('❌ 视频拼接失败:', error);
      
      res.write(`data: ${JSON.stringify({
        stage: 'error',
        error: error.message
      })}\n\n`);
      
      res.end();
    }

  } catch (error) {
    console.error('❌ 导出粗剪失败:', error);
    
    // 如果还没有开始发送SSE，返回JSON错误
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: error.message
      });
    } else {
      res.end();
    }
  }
};

/**
 * 导出粗剪视频控制器（简化版，直接返回结果）
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const exportRoughCutSimple = async (req, res) => {
  try {
    const { scenes } = req.body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: scenes（分镜数组）'
      });
    }

    console.log(`\n📹 收到导出粗剪请求，共 ${scenes.length} 个分镜`);

    // 过滤并准备场景数据（包含后期处理参数）
    const validScenes = scenes
      .filter(scene => {
        // 保留有视频的分镜：AI生成(videoUrl) 或 实拍素材(assetUrl)
        return Boolean(getExportVideoSource(scene));
      })
      .map((scene, index) => {
        // 优先使用 videoUrl (AI生成)，如果没有则使用 assetUrl (实拍素材)
        const url = getExportVideoSource(scene);
        
        console.log(`  分镜 ${index + 1}: ${scene.type === 'ai' ? 'AI生成' : '实拍素材'} - ${url}`);
        if (scene.postProcessing) {
          console.log(`    后期处理: 亮度=${scene.postProcessing.brightness || 0}, 对比度=${scene.postProcessing.contrast || 0}, 饱和度=${scene.postProcessing.saturation || 0}`);
        }
        if (scene.clipStartTime !== undefined && scene.clipEndTime !== undefined) {
          console.log(`    裁剪时间: ${scene.clipStartTime}s - ${scene.clipEndTime}s`);
        }
        
        // 如果是相对路径，转换为完整URL（使用配置的公网URL）
        const processedUrl = toPublicUrl(url);

        return {
          videoUrl: processedUrl,
          assetUrl: scene.assetUrl,
          postProcessing: scene.postProcessing || {},
          clipStartTime: scene.clipStartTime,
          clipEndTime: scene.clipEndTime
        };
      });

    if (validScenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有可导出的视频，请先生成视频'
      });
    }

    console.log(`✅ 找到 ${validScenes.length} 个已生成的视频`);

    // 创建输出目录
    const now = new Date();
    const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
    const folderName = `rough_cut_${timestamp}`;
    const outputDir = path.join(__dirname, '../../uploads/video', folderName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFilename = `rough_cut_${timestamp}.mp4`;

    // 执行视频拼接（传递完整场景数据以应用后期处理）
    const result = await VideoConcatService.concatVideos({
      scenes: validScenes,
      outputDir: outputDir,
      outputFilename: outputFilename
    });

    // 将相对路径转换为公网URL
    const resultWithPublicUrl = {
      ...result,
      videoUrl: toPublicUrl(result.videoUrl)
    };
    
    console.log('✅ 粗剪导出成功，视频URL:', resultWithPublicUrl.videoUrl);

    return res.status(200).json({
      success: true,
      data: resultWithPublicUrl
    });

  } catch (error) {
    console.error('❌ 导出粗剪失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};






