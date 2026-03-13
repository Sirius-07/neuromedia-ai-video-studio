import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import fs from 'fs';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * VideoConcatService - 视频拼接服务
 * 
 * 使用 FFmpeg 将多个视频按顺序拼接成一个完整视频
 */
class VideoConcatService {
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
   * 下载远程视频到本地
   * @param {string} videoUrl - 视频URL
   * @param {string} outputPath - 输出路径
   * @param {number} retries - 重试次数
   * @returns {Promise<string>} 本地文件路径
   */
  static async downloadVideo(videoUrl, outputPath, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`📥 下载视频 (尝试 ${attempt}/${retries}): ${videoUrl.substring(0, 100)}...`);
        
        const response = await axios({
          url: videoUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 120000, // 120秒超时
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'video/*,*/*',
            // 跳过ngrok的浏览器警告页面
            'ngrok-skip-browser-warning': 'true'
          }
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            // 验证下载的文件是否有效（检查文件大小和魔数）
            const stats = fs.statSync(outputPath);
            const fileSize = stats.size;
            
            // 检查文件大小（太小可能是错误页面）
            if (fileSize < 1024) { // 小于1KB
              console.error(`❌ 下载的文件太小 (${fileSize} bytes)，可能不是视频文件`);
              if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
              }
              reject(new Error('下载的文件太小，可能是HTML错误页面'));
              return;
            }
            
            // 检查文件头（MP4魔数）
            const buffer = Buffer.alloc(12);
            const fd = fs.openSync(outputPath, 'r');
            fs.readSync(fd, buffer, 0, 12, 0);
            fs.closeSync(fd);
            
            // MP4文件通常以 "ftyp" 开头（从第4字节开始）
            const ftypSignature = buffer.toString('ascii', 4, 8);
            if (!ftypSignature.includes('ftyp') && !ftypSignature.includes('mdat')) {
              console.error(`❌ 文件格式验证失败，不是有效的视频文件`);
              console.error(`   文件头: ${buffer.toString('hex')}`);
              if (fs.existsSync(outputPath)) {
                // 读取前100字节查看内容
                const previewBuffer = Buffer.alloc(100);
                const previewFd = fs.openSync(outputPath, 'r');
                fs.readSync(previewFd, previewBuffer, 0, 100, 0);
                fs.closeSync(previewFd);
                console.error(`   文件内容预览: ${previewBuffer.toString('utf8', 0, 100)}`);
                fs.unlinkSync(outputPath);
              }
              reject(new Error('下载的不是视频文件，可能是ngrok警告页面或HTML'));
              return;
            }
            
            console.log(`✅ 下载完成并验证: ${outputPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
            resolve(outputPath);
          });
          writer.on('error', (error) => {
            // 清理失败的文件
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
            reject(error);
          });
        });
      } catch (error) {
        console.error(`❌ 下载失败 (尝试 ${attempt}/${retries}):`, error.message);
        
        // 清理失败的文件
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        
        // 如果还有重试次数，等待后重试
        if (attempt < retries) {
          const waitTime = attempt * 2000; // 递增等待时间
          console.log(`⏳ 等待 ${waitTime/1000} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * 将后期处理参数转换为FFmpeg滤镜字符串
   * @param {Object} postProcessing - 后期处理参数
   * @returns {string} FFmpeg滤镜字符串
   */
  static buildFFmpegFilters(postProcessing) {
    if (!postProcessing) {
      return null;
    }

    const filters = [];

    // 1. 基础调色 (eq filter)
    const brightness = (postProcessing.brightness || 0) / 100; // -1.0 to 1.0
    const contrast = 1 + (postProcessing.contrast || 0) / 100; // 0.0 to 2.0
    const saturation = 1 + (postProcessing.saturation || 0) / 100; // 0.0 to 3.0
    
    if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
      filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
    }

    // 2. 细节处理 (unsharp/blur)
    const sharpness = postProcessing.sharpness || '标准';
    if (sharpness === '锐利') {
      filters.push('unsharp=5:5:1.0:5:5:0.0');
    } else if (sharpness === '柔和') {
      filters.push('boxblur=1:1');
    }

    // 3. 降噪处理
    const denoiseLevel = postProcessing.denoiseLevel || '关闭';
    if (denoiseLevel !== '关闭') {
      const denoiseMap = {
        '轻度': 'boxblur=0.5:1',
        '中度': 'boxblur=1:1',
        '重度': 'boxblur=1.5:1'
      };
      if (denoiseMap[denoiseLevel]) {
        filters.push(denoiseMap[denoiseLevel]);
      }
    }

    // 4. 色温处理
    const colorTone = postProcessing.colorTone || '原始';
    if (colorTone === '暖色调') {
      filters.push('colorbalance=rs=0.1:bs=-0.1');
    } else if (colorTone === '冷色调') {
      filters.push('colorbalance=bs=0.1:rs=-0.1');
    }

    // 5. 速度调整
    const speed = postProcessing.speed || 1;
    if (speed !== 1) {
      // setpts 用于调整时间戳
      const ptsMultiplier = 1 / speed;
      filters.push(`setpts=${ptsMultiplier}*PTS`);
    }

    return filters.length > 0 ? filters.join(',') : null;
  }

  /**
   * 检测视频是否有音频轨道
   * @param {string} videoPath - 视频文件路径
   * @returns {Promise<boolean>} 是否有音频
   */
  static async hasAudioTrack(videoPath) {
    return new Promise((resolve) => {
      const ffprobeArgs = [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_type',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ];

      const ffprobeProcess = spawn('ffprobe', ffprobeArgs);
      let output = '';

      ffprobeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobeProcess.on('close', () => {
        resolve(output.trim() === 'audio');
      });

      ffprobeProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * 统一视频编码格式（确保所有视频参数一致，如果没有音频则添加静音轨道）
   * @param {string} inputPath - 输入视频路径
   * @param {string} outputPath - 输出视频路径
   * @returns {Promise<string>} 处理后的视频路径
   */
  static async normalizeVideo(inputPath, outputPath) {
    return new Promise(async (resolve, reject) => {
      // 检测是否有音频轨道
      const hasAudio = await this.hasAudioTrack(inputPath);
      
      const ffmpegArgs = ['-i', inputPath];
      
      // 如果没有音频，添加静音音频轨道
      if (!hasAudio) {
        console.log('  检测到无音频，添加静音轨道');
        ffmpegArgs.push(
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'
        );
      }
      
      ffmpegArgs.push(
        '-c:v', 'libx264',  // 统一使用H.264编码
        '-preset', 'fast',  // 快速编码
        '-crf', '23',       // 质量控制
        '-pix_fmt', 'yuv420p', // 像素格式统一
        '-vsync', 'cfr',    // 恒定帧率
        '-c:a', 'aac',      // 音频统一为AAC
        '-b:a', '192k',     // 音频比特率
        '-ar', '44100',     // 音频采样率
        '-ac', '2',         // 立体声
        '-shortest',        // 以最短的流为准
        '-y',
        outputPath
      );

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('  ✅ 编码统一完成');
          resolve(outputPath);
        } else {
          console.error('  ❌ 编码统一失败:', stderr);
          reject(new Error(`FFmpeg 编码统一失败，退出码: ${code}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error('  ❌ FFmpeg 进程错误:', error);
        reject(error);
      });
    });
  }

  /**
   * 应用后期处理和裁剪到视频
   * @param {string} inputPath - 输入视频路径
   * @param {string} outputPath - 输出视频路径
   * @param {Object} postProcessing - 后期处理参数
   * @param {number} clipStartTime - 裁剪开始时间（秒）
   * @param {number} clipEndTime - 裁剪结束时间（秒）
   * @returns {Promise<string>} 处理后的视频路径
   */
  static async applyPostProcessing(inputPath, outputPath, postProcessing, clipStartTime, clipEndTime) {
    return new Promise(async (resolve, reject) => {
      const filters = this.buildFFmpegFilters(postProcessing);
      const needsTrim = clipStartTime !== undefined && clipEndTime !== undefined && 
                        clipStartTime >= 0 && clipEndTime > clipStartTime;

      if (!filters && !needsTrim) {
        // 没有滤镜也不需要裁剪，直接复制文件
        console.log('  无后期处理和裁剪，直接使用原视频');
        resolve(inputPath);
        return;
      }

      // 检测是否有音频轨道
      const hasAudio = await this.hasAudioTrack(inputPath);

      const ffmpegArgs = ['-i', inputPath];
      
      // 如果没有音频，添加静音音频轨道
      if (!hasAudio) {
        console.log('  检测到无音频，添加静音轨道');
        ffmpegArgs.push(
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'
        );
      }

      // 如果需要裁剪，添加裁剪参数
      if (needsTrim) {
        const duration = clipEndTime - clipStartTime;
        console.log(`  裁剪视频: ${clipStartTime.toFixed(2)}s - ${clipEndTime.toFixed(2)}s (时长: ${duration.toFixed(2)}s)`);
        ffmpegArgs.push('-ss', clipStartTime.toString());
        ffmpegArgs.push('-t', duration.toString());
      }

      // 如果有滤镜，添加滤镜参数
      if (filters) {
        console.log(`  应用后期处理: ${filters}`);
        ffmpegArgs.push('-vf', filters);
      }

      // 添加编码参数
      ffmpegArgs.push(
        '-c:v', 'libx264',  // 使用H.264编码
        '-preset', 'fast',  // 快速编码
        '-crf', '23',       // 质量控制
        '-pix_fmt', 'yuv420p', // 像素格式统一
        '-vsync', 'cfr',    // 恒定帧率，避免时间戳问题
        '-c:a', 'aac',      // 音频重新编码为AAC
        '-b:a', '192k',     // 音频比特率
        '-ar', '44100',     // 音频采样率
        '-ac', '2',         // 立体声
        '-shortest',        // 以最短的流为准
        '-y',
        outputPath
      );

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('  ✅ 视频处理完成');
          resolve(outputPath);
        } else {
          console.error('  ❌ 视频处理失败:', stderr);
          reject(new Error(`FFmpeg 视频处理失败，退出码: ${code}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error('  ❌ FFmpeg 进程错误:', error);
        reject(error);
      });
    });
  }

  /**
   * 拼接多个视频（支持后期处理）
   * @param {Object} options - 拼接选项
   * @param {Array<Object>} options.scenes - 场景数组（包含videoUrl和postProcessing）
   * @param {Array<string>} options.videoUrls - 视频URL或路径数组（如果没有scenes则使用）
   * @param {string} options.outputDir - 输出目录
   * @param {string} options.outputFilename - 输出文件名
   * @param {Function} options.onProgress - 进度回调
   * @returns {Promise<Object>} 拼接结果
   */
  static async concatVideos(options) {
    const {
      scenes,
      videoUrls,
      outputDir,
      outputFilename = 'merged_video.mp4',
      onProgress
    } = options;

    // 处理输入：优先使用scenes，否则使用videoUrls
    const inputList = scenes || (videoUrls ? videoUrls.map(url => ({ videoUrl: url })) : []);

    console.log('\n' + '='.repeat(80));
    console.log('🎬 开始视频拼接（带后期处理）');
    console.log('='.repeat(80));
    console.log(`📹 视频数量: ${inputList.length}`);
    console.log(`📁 输出目录: ${outputDir}`);
    console.log(`📄 输出文件: ${outputFilename}\n`);

    return new Promise(async (resolve, reject) => {
      try {
        // 检查 FFmpeg
        const hasFFmpeg = await this.checkFFmpeg();
        if (!hasFFmpeg) {
          throw new Error('FFmpeg 未安装或不可用');
        }

        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // 临时目录用于下载文件和后期处理
        const tempDir = path.join(outputDir, 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log('[1/4] 准备视频文件并应用后期处理...\n');
        
        // 下载和准备视频文件
        const localVideoPaths = [];
        for (let i = 0; i < inputList.length; i++) {
          const scene = inputList[i];
          const videoUrl = scene.videoUrl || scene.assetUrl;
          
          if (!videoUrl) {
            console.warn(`⚠️ 分镜 ${i + 1} 没有视频，跳过`);
            continue;
          }

          console.log(`处理分镜 ${i + 1}/${inputList.length}:`);
          console.log(`  视频URL: ${videoUrl}`);
          
          if (onProgress) {
            onProgress({
              stage: 'downloading',
              current: i + 1,
              total: inputList.length,
              message: `处理视频 ${i + 1}/${inputList.length}`
            });
          }

          let localPath = null;

          // 处理localhost URL
          if (videoUrl.startsWith('http://localhost:') || videoUrl.startsWith('http://127.0.0.1:')) {
            // 检查是否是代理API URL
            if (videoUrl.includes('/api/v1/proxy/video')) {
              // 代理URL，提取原始URL并下载
              console.log('  检测到代理URL，提取原始视频地址...');
              try {
                // 从代理URL中提取原始URL
                const urlParams = new URL(videoUrl).searchParams;
                const originalUrl = urlParams.get('url');
                
                if (originalUrl) {
                  console.log('  原始视频URL:', originalUrl);
                  const tempFileName = `temp_video_${i}_${Date.now()}.mp4`;
                  const tempFilePath = path.join(tempDir, tempFileName);
                  localPath = await this.downloadVideo(originalUrl, tempFilePath);
                } else {
                  console.warn('⚠️ 无法从代理URL中提取原始地址');
                  continue;
                }
              } catch (error) {
                console.error('⚠️ 处理代理URL失败:', error.message);
                continue;
              }
            } else {
              // 真实的本地文件路径
              console.log('  检测到localhost URL，转换为本地路径');
              const relativePath = videoUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1):\d+\//, '');
              localPath = path.join(__dirname, '../../', relativePath);
              
              if (!fs.existsSync(localPath)) {
                console.warn(`⚠️ 本地文件不存在: ${localPath}`);
                continue;
              }
              console.log(`  ✅ 本地路径: ${localPath}`);
            }
          } else if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
            // 远程URL，需要下载
            console.log('  下载远程视频...');
            const tempFileName = `temp_video_${i}_${Date.now()}.mp4`;
            const tempFilePath = path.join(tempDir, tempFileName);
            localPath = await this.downloadVideo(videoUrl, tempFilePath);
          } else {
            // 本地文件路径
            localPath = videoUrl.startsWith('/') 
              ? path.join(__dirname, '../../', videoUrl)
              : videoUrl;
            
            if (!fs.existsSync(localPath)) {
              console.warn(`⚠️ 视频文件不存在: ${localPath}`);
              continue;
            }
          }

          // 应用后期处理和裁剪（如果有）
          const hasPostProcessing = scene.postProcessing && Object.keys(scene.postProcessing).length > 0;
          const needsTrim = scene.clipStartTime !== undefined && scene.clipEndTime !== undefined;
          
          if (hasPostProcessing || needsTrim) {
            const actionDesc = [
              hasPostProcessing ? '后期处理' : null,
              needsTrim ? '裁剪' : null
            ].filter(Boolean).join('和');
            
            console.log(`  应用${actionDesc}...`);
            const processedFileName = `processed_video_${i}_${Date.now()}.mp4`;
            const processedFilePath = path.join(tempDir, processedFileName);
            
            try {
              const processedPath = await this.applyPostProcessing(
                localPath,
                processedFilePath,
                scene.postProcessing,
                scene.clipStartTime,
                scene.clipEndTime
              );
              localVideoPaths.push(processedPath);
            } catch (error) {
              console.error(`  ⚠️ 视频处理失败，使用原视频: ${error.message}`);
              localVideoPaths.push(localPath);
            }
          } else {
            // 即使没有后期处理和裁剪，也统一编码格式以避免拼接问题
            console.log('  统一视频编码格式...');
            const normalizedFileName = `normalized_video_${i}_${Date.now()}.mp4`;
            const normalizedFilePath = path.join(tempDir, normalizedFileName);
            
            try {
              await this.normalizeVideo(localPath, normalizedFilePath);
              localVideoPaths.push(normalizedFilePath);
            } catch (error) {
              console.error(`  ⚠️ 统一编码失败，使用原视频: ${error.message}`);
              localVideoPaths.push(localPath);
            }
          }
        }

        if (localVideoPaths.length === 0) {
          throw new Error('没有有效的视频文件');
        }

        console.log(`\n✅ 准备了 ${localVideoPaths.length} 个视频文件\n`);

        // 创建 concat 列表文件
        console.log('[2/4] 创建拼接列表...');
        const concatListPath = path.join(tempDir, 'concat_list.txt');
        const concatListContent = localVideoPaths
          .map(p => `file '${p.replace(/\\/g, '/')}'`)
          .join('\n');
        
        fs.writeFileSync(concatListPath, concatListContent, 'utf8');
        console.log(`✅ 拼接列表已创建: ${concatListPath}\n`);

        // 输出文件路径
        const outputVideoPath = path.join(outputDir, outputFilename);

        // 构建 FFmpeg 命令
        console.log('[3/4] 执行视频拼接...');
        console.log('   正在统一编码并拼接视频...\n');

        // 使用重新编码模式，确保所有视频参数一致
        // 优化参数以减小文件大小，适合通过ngrok传输给AI服务
        const ffmpegArgs = [
          '-f', 'concat',          // 使用 concat 协议
          '-safe', '0',            // 允许绝对路径
          '-i', concatListPath,    // 输入列表文件
          '-c:v', 'libx264',       // 视频编码器：H.264
          '-preset', 'fast',       // 编码速度：快速（减少编码时间）
          '-crf', '28',            // 质量控制：28（较高压缩，适合AI分析）
          '-pix_fmt', 'yuv420p',   // 像素格式：确保兼容性
          '-vf', 'scale=iw*min(1\\,min(1280/iw\\,720/ih)):-2', // 限制最大分辨率为1280x720
          '-c:a', 'aac',           // 音频编码器：AAC
          '-b:a', '128k',          // 音频比特率：128kbps（降低50%）
          '-ar', '44100',          // 音频采样率：44.1kHz
          '-ac', '2',              // 音频声道：立体声
          '-movflags', '+faststart', // 优化网络播放
          '-vsync', 'cfr',         // 恒定帧率模式，避免时间戳问题
          '-y',                    // 覆盖输出文件
          outputVideoPath
        ];

        if (onProgress) {
          onProgress({
            stage: 'concatenating',
            message: '正在拼接视频...'
          });
        }

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        let stderr = '';

        ffmpegProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          
          // 解析进度信息
          const progressMatch = stderr.match(/time=(\d+:\d+:\d+\.\d+)/);
          if (progressMatch && onProgress) {
            const timeStr = progressMatch[1];
            onProgress({
              stage: 'concatenating',
              time: timeStr,
              message: `拼接进度: ${timeStr}`
            });
          }
        });

        ffmpegProcess.on('close', (code) => {
          console.log('\n');
          
          // 清理临时文件
          try {
            localVideoPaths.forEach(p => {
              if (p.includes(tempDir) && fs.existsSync(p)) {
                fs.unlinkSync(p);
              }
            });
            if (fs.existsSync(concatListPath)) {
              fs.unlinkSync(concatListPath);
            }
            if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
              fs.rmdirSync(tempDir);
            }
          } catch (cleanupError) {
            console.warn('清理临时文件时出错:', cleanupError);
          }

          if (code === 0) {
            console.log('[4/4] 拼接完成！\n');
            console.log('✅ 输出文件:', outputVideoPath);
            console.log('='.repeat(80));
            
            // 生成可访问的URL
            const videoUrl = `/uploads/video/${path.basename(outputDir)}/${outputFilename}`;
            
            if (onProgress) {
              onProgress({
                stage: 'completed',
                message: '拼接完成'
              });
            }

            resolve({
              success: true,
              videoPath: outputVideoPath,
              videoUrl: videoUrl,
              filename: outputFilename,
              videoCount: localVideoPaths.length
            });
          } else {
            console.error('❌ FFmpeg 执行失败');
            console.error('错误输出:', stderr);
            reject(new Error(`FFmpeg 执行失败，退出码: ${code}`));
          }
        });

        ffmpegProcess.on('error', (error) => {
          console.error('❌ FFmpeg 进程错误:', error);
          reject(error);
        });

      } catch (error) {
        console.error('❌ 视频拼接失败:', error);
        reject(error);
      }
    });
  }
}

export default VideoConcatService;








