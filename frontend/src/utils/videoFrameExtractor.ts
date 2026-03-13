/**
 * 视频帧提取工具
 * 用于从视频中提取指定时间点的帧作为图片
 */

interface ExtractFrameOptions {
  /** 视频 URL */
  videoUrl: string;
  /** 提取时间点（秒），默认为视频结尾 */
  time?: number;
  /** 输出图片质量 (0-1) */
  quality?: number;
  /** 输出格式 */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * 从视频中提取指定时间点的帧
 * @param options 提取选项
 * @returns Promise<string> 返回 base64 格式的图片数据
 */
export async function extractVideoFrame(options: ExtractFrameOptions): Promise<string> {
  const { videoUrl, time, quality = 0.92, format = 'image/jpeg' } = options;

  console.log('📹 extractVideoFrame 开始:', { videoUrl: videoUrl.substring(0, 100) + '...', time, quality, format });

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('无法创建 Canvas 上下文'));
      return;
    }

    // 视频加载完成后的处理
    video.onloadedmetadata = () => {
      // 如果没有指定时间，默认取视频最后一帧（-0.1秒确保能获取到）
      const targetTime = time !== undefined ? time : Math.max(0, video.duration - 0.1);
      
      console.log('✅ 视频元数据加载完成:', { duration: video.duration, targetTime, videoWidth: video.videoWidth, videoHeight: video.videoHeight });
      
      video.currentTime = targetTime;
    };

    // 定位到指定时间后的处理
    video.onseeked = () => {
      try {
        console.log('✅ 视频定位完成，开始提取帧:', { currentTime: video.currentTime });
        
        // 设置 canvas 尺寸为视频尺寸
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 绘制当前帧到 canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 转换为 base64
        const dataUrl = canvas.toDataURL(format, quality);

        console.log('✅ 帧提取完成:', { size: `${canvas.width}x${canvas.height}`, dataUrlLength: dataUrl.length });

        // 清理资源
        video.src = '';
        video.load();

        resolve(dataUrl);
      } catch (error) {
        console.error('❌ 提取帧时出错:', error);
        reject(error);
      }
    };

    // 错误处理
    video.onerror = (e) => {
      console.error('视频加载错误事件:', e);
      reject(new Error(`视频加载失败: ${videoUrl}`));
    };

    // 设置视频源并加载
    // 必须设置 crossOrigin，即使是代理 URL，否则 canvas 会被"污染"
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.load();
  });
}

/**
 * 从视频中提取最后一帧
 * @param videoUrl 视频 URL
 * @returns Promise<string> 返回 base64 格式的图片数据
 */
export async function extractLastFrame(videoUrl: string): Promise<string> {
  return extractVideoFrame({ videoUrl });
}

/**
 * 从视频中提取第一帧
 * @param videoUrl 视频 URL
 * @returns Promise<string> 返回 base64 格式的图片数据
 */
export async function extractFirstFrame(videoUrl: string): Promise<string> {
  return extractVideoFrame({ videoUrl, time: 0.1 });
}

/**
 * 批量提取多个视频的最后一帧
 * @param videoUrls 视频 URL 数组
 * @returns Promise<string[]> 返回 base64 图片数据数组
 */
export async function extractLastFrames(videoUrls: string[]): Promise<string[]> {
  return Promise.all(videoUrls.map(url => extractLastFrame(url)));
}

