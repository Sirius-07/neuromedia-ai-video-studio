import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

/**
 * 视频后期处理服务
 * 使用 FFmpeg 应用颜色校正、滤镜等效果
 */
class VideoProcessingService {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'processed');
    this.ensureOutputDir();
  }

  /**
   * 确保输出目录存在
   */
  async ensureOutputDir() {
    try {
      await access(this.outputDir);
    } catch {
      await mkdir(this.outputDir, { recursive: true });
      console.log('📁 创建处理视频输出目录:', this.outputDir);
    }
  }

  /**
   * 应用后期处理效果到视频
   * @param {string} inputVideoPath - 输入视频路径
   * @param {string} ffmpegFilter - FFmpeg 滤镜字符串
   * @param {string} outputFormat - 输出格式 (mp4/webm)
   * @returns {Promise<string>} 处理后的视频路径
   */
  async processVideo(inputVideoPath, ffmpegFilter, outputFormat = 'mp4') {
    const timestamp = Date.now();
    const outputFilename = `processed_${timestamp}.${outputFormat}`;
    const outputPath = path.join(this.outputDir, outputFilename);

    console.log('🎬 [视频处理] 开始处理视频...');
    console.log('📥 输入:', inputVideoPath);
    console.log('🎨 滤镜:', ffmpegFilter);
    console.log('📤 输出:', outputPath);

    return new Promise((resolve, reject) => {
      // 构建 FFmpeg 命令
      const args = [
        '-i', inputVideoPath,
        '-vf', ffmpegFilter,
        '-c:v', 'libx264',        // 视频编码器
        '-preset', 'medium',      // 编码速度/质量平衡
        '-crf', '23',             // 质量参数 (18-28, 越小质量越好)
        '-c:a', 'aac',            // 音频编码器
        '-b:a', '192k',           // 音频比特率
        '-movflags', '+faststart', // Web 优化
        '-y',                     // 覆盖已存在的文件
        outputPath
      ];

      console.log('🔧 FFmpeg 命令:', 'ffmpeg', args.join(' '));

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        // 提取进度信息
        const timeMatch = data.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
        if (timeMatch) {
          console.log('⏱️ 处理进度:', timeMatch[1]);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ 视频处理完成:', outputFilename);
          resolve(`/uploads/processed/${outputFilename}`);
        } else {
          console.error('❌ FFmpeg 处理失败，退出码:', code);
          console.error('错误信息:', stderr);
          reject(new Error(`FFmpeg 处理失败 (退出码: ${code})`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg 启动失败:', error);
        reject(new Error(`FFmpeg 启动失败: ${error.message}`));
      });
    });
  }

  /**
   * 从 URL 下载视频到本地（用于处理远程视频）
   * @param {string} videoUrl - 视频 URL
   * @returns {Promise<string>} 本地文件路径
   */
  async downloadVideo(videoUrl) {
    // 如果是本地路径，直接返回
    if (videoUrl.startsWith('/uploads/') || videoUrl.startsWith('./uploads/')) {
      return path.join(process.cwd(), videoUrl.replace(/^\//, ''));
    }

    // TODO: 实现远程视频下载逻辑
    // 这里简化处理，假设都是本地文件
    throw new Error('暂不支持远程视频处理');
  }

  /**
   * 获取视频信息
   * @param {string} videoPath - 视频路径
   * @returns {Promise<Object>} 视频信息
   */
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-show_format',
        '-show_streams',
        '-of', 'json'
      ];

      const ffprobe = spawn('ffprobe', args);
      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            resolve(info);
          } catch (error) {
            reject(new Error('解析视频信息失败'));
          }
        } else {
          reject(new Error(`FFprobe 失败 (退出码: ${code})`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`FFprobe 启动失败: ${error.message}`));
      });
    });
  }
}

export default new VideoProcessingService();





















