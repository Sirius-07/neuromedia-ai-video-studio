import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * VideoMergeService - 视频合成服务
 * 
 * 使用 FFmpeg 将音效合成到视频中
 * 参考 test-direct-api.js 中的视频合成逻辑
 */
class VideoMergeService {
  /**
   * 检查 FFmpeg 是否可用
   * @returns {Promise<boolean>}
   */
  static async checkFFmpeg() {
    return new Promise((resolve) => {
      const checkProcess = spawn('ffmpeg', ['-version']);

      checkProcess.on('close', (code) => {
        resolve(code === 0);
      });

      checkProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * 将时间戳转换为秒数
   * @param {string} timestamp - 格式 HH:MM:SS.mmm
   * @returns {number} 秒数
   */
  static timestampToSeconds(timestamp) {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * 下载视频到本地（如果是URL）
   * @private
   * @param {string} videoInput - 视频URL或本地路径
   * @param {string} outputDir - 输出目录
   * @returns {Promise<string>} 本地视频路径
   */
  static async _downloadVideo(videoInput, outputDir) {
    // 如果已经是本地文件，直接返回
    if (fs.existsSync(videoInput)) {
      console.log(`✓ 使用本地视频文件: ${videoInput}`);
      return videoInput;
    }

    // 如果是URL，下载到本地
    if (videoInput.startsWith('http://') || videoInput.startsWith('https://')) {
      console.log('[下载视频] 从URL下载...');
      const videoPath = path.join(outputDir, 'original_video.mp4');

      // 使用 axios 下载视频
      const response = await axios({
        method: 'get',
        url: videoInput,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(videoPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`✓ 视频已下载: ${videoPath}`);
      return videoPath;
    }

    throw new Error(`无效的视频输入: ${videoInput}`);
  }

  /**
   * 合成音频到视频（包括BGM和音效）
   * @param {Object} options - 合成选项
   * @param {string} options.videoInput - 原视频URL或路径
   * @param {Object} options.bgmFile - BGM文件对象 { path, startTime, duration, volume }
   * @param {Array} options.audioFiles - 音效文件列表
   * @param {string} options.outputDir - 输出目录
   * @param {string} [options.outputFilename='video_with_audio.mp4'] - 输出文件名
   * @param {Function} [options.onProgress] - 进度回调函数
   * @returns {Promise<Object>} 合成结果 { videoPath, videoUrl }
   */
  static async mergeAudioToVideo(options) {
    const {
      videoInput,
      bgmFile = null,
      audioFiles,
      outputDir,
      outputFilename = 'video_with_audio.mp4',
      onProgress = null
    } = options;

    console.log('\n' + '='.repeat(100));
    console.log('🎬 开始合成音效到视频');
    console.log('='.repeat(100));

    return new Promise(async (resolve, reject) => {
      try {
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // 检查 FFmpeg
        console.log('[1/5] 检查 FFmpeg...');
        const hasFFmpeg = await this.checkFFmpeg();
        if (!hasFFmpeg) {
          throw new Error('未找到 FFmpeg，请先安装 FFmpeg');
        }
        console.log('✓ FFmpeg 可用\n');

        // 下载或使用本地视频
        console.log('[2/5] 准备视频文件...');
        const videoPath = await this._downloadVideo(videoInput, outputDir);
        const isDownloaded = !fs.existsSync(videoInput);

        // 准备 FFmpeg 命令
        console.log('[3/5] 准备 FFmpeg 合成命令...');

        const outputVideoPath = path.join(outputDir, outputFilename);

        // 构建复杂的 FFmpeg 过滤器
        const filterComplex = [];
        const audioInputs = ['-i', videoPath];
        let inputIndex = 1; // 从1开始，0是视频
        const audioStreamLabels = [];

        // 处理 BGM
        if (bgmFile) {
          audioInputs.push('-i', bgmFile.outputPath || bgmFile.path);
          
          // BGM 处理：延迟 + 截断/循环到指定时长 + 音量
          const bgmStartMs = Math.round((bgmFile.startTime || 0) * 1000);
          const bgmDuration = bgmFile.duration;
          
          // 如果BGM需要延迟，则添加adelay；然后截断到指定时长，最后调整音量
          const bgmFilter = bgmStartMs > 0 
            ? `[${inputIndex}:a]adelay=${bgmStartMs}|${bgmStartMs},atrim=0:${bgmDuration},asetpts=PTS-STARTPTS,volume=${bgmFile.volume || 1.0}[bgm]`
            : `[${inputIndex}:a]atrim=0:${bgmDuration},asetpts=PTS-STARTPTS,volume=${bgmFile.volume || 1.0}[bgm]`;
          
          filterComplex.push(bgmFilter);
          audioStreamLabels.push('[bgm]');
          inputIndex++;
          
          console.log(`✓ 添加 BGM (起始: ${bgmFile.startTime || 0}s, 时长: ${bgmDuration}s, 音量: ${Math.round((bgmFile.volume || 1.0) * 100)}%)`);
        }

        // 处理音效
        audioFiles.forEach((audioFile, index) => {
          audioInputs.push('-i', audioFile.outputPath || audioFile.path);

          // 计算延迟时间（毫秒）
          const delayMs = Math.round(this.timestampToSeconds(audioFile.timestamp) * 1000);

          // 为每个音效添加延迟和音量控制
          filterComplex.push(
            `[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=${audioFile.volume || 0.8}[sfx${index}]`
          );
          
          audioStreamLabels.push(`[sfx${index}]`);
          inputIndex++;
        });

        // 混合所有音频轨道（原视频音频 + BGM + 所有音效）
        const allAudioStreams = ['[0:a]', ...audioStreamLabels].join('');
        const totalInputs = 1 + audioStreamLabels.length; // 原视频音频 + BGM + 音效
        filterComplex.push(
          `${allAudioStreams}amix=inputs=${totalInputs}:duration=first:dropout_transition=2[aout]`
        );

        const audioCount = (bgmFile ? '1个BGM + ' : '') + `${audioFiles.length}个音效`;
        console.log(`✓ 将合成 ${audioCount} 到视频\n`);

        // 构建完整的 FFmpeg 命令
        const ffmpegArgs = [
          ...audioInputs,
          '-filter_complex', filterComplex.join(';'),
          '-map', '0:v',  // 使用原视频的视频流
          '-map', '[aout]',  // 使用混合后的音频流
          '-c:v', 'copy',  // 视频流不重新编码（快速）
          '-c:a', 'aac',  // 音频编码为 AAC
          '-b:a', '192k',  // 音频比特率
          '-y',  // 覆盖输出文件
          outputVideoPath
        ];

        console.log('[4/5] 执行 FFmpeg 合成...');
        console.log('   这可能需要一些时间，请耐心等待...\n');

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
          cwd: outputDir
        });

        let stderr = '';

        ffmpegProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          // 显示进度信息
          const progressMatch = stderr.match(/time=(\d+:\d+:\d+\.\d+)/);
          if (progressMatch && onProgress) {
            const timeStr = progressMatch[1];
            onProgress({ time: timeStr, stage: 'merging' });
          }
        });

        ffmpegProcess.on('close', (code) => {
          console.log('\n');

          if (code === 0) {
            console.log('[5/5] 合成完成！\n');
            console.log('='.repeat(100));
            console.log('✅ 视频合成成功');
            console.log('='.repeat(100));
            console.log(`📹 输出文件: ${path.basename(outputVideoPath)}`);
            console.log(`📂 完整路径: ${outputVideoPath}`);
            if (bgmFile) {
              console.log(`🎵 包含 BGM: 1 个`);
            }
            console.log(`🔊 包含音效: ${audioFiles.length} 个`);
            console.log('='.repeat(100));

            // 清理临时下载的视频文件
            if (isDownloaded && fs.existsSync(videoPath)) {
              fs.unlinkSync(videoPath);
              console.log('✓ 已清理临时视频文件');
            }

            // 生成可访问的 URL
            const relativePath = path.relative(path.join(__dirname, '../../uploads'), outputVideoPath);
            const videoUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;

            resolve({
              success: true,
              videoPath: outputVideoPath,
              videoUrl: videoUrl,
              filename: outputFilename
            });
          } else {
            console.error('❌ FFmpeg 合成失败');
            console.error('错误信息:', stderr);
            reject(new Error(`FFmpeg 退出码: ${code}`));
          }
        });

        ffmpegProcess.on('error', (error) => {
          console.error('❌ 无法启动 FFmpeg:', error.message);
          reject(error);
        });

        // 设置超时（30分钟）
        const timeout = setTimeout(() => {
          console.error('⏱️  视频合成超时（超过30分钟），终止进程...');
          ffmpegProcess.kill();
          reject(new Error('视频合成超时（超过30分钟）'));
        }, 30 * 60 * 1000);

        ffmpegProcess.on('close', () => {
          clearTimeout(timeout);
        });

      } catch (error) {
        console.error('❌ 合成过程出错:', error.message);
        reject(error);
      }
    });
  }
}

export default VideoMergeService;


