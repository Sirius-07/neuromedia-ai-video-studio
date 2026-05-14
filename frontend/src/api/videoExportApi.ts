/**
 * 视频导出 API 模块
 * 
 * 用于导出和拼接视频
 */

import { Scene } from '../components/storyboard/types';
import { apiUrl } from '../config/api';

// API 基础地址
const API_BASE_URL = apiUrl('');
const VIDEO_FILE_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];

function isLikelyVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const pathname = url.split('?')[0]?.toLowerCase() || '';
  return VIDEO_FILE_EXTENSIONS.some(extension => pathname.endsWith(extension));
}

export function getExportableVideoScenes(scenes: Scene[]): Scene[] {
  return scenes.filter(scene => Boolean(scene.videoUrl) || isLikelyVideoUrl(scene.assetUrl));
}

/**
 * 导出结果
 */
export interface ExportResult {
  success: boolean;
  videoPath: string;
  videoUrl: string;
  filename: string;
  videoCount: number;
}

/**
 * 进度信息
 */
export interface ExportProgress {
  stage: 'downloading' | 'concatenating' | 'completed' | 'error';
  current?: number;
  total?: number;
  time?: string;
  message?: string;
  result?: ExportResult;
  error?: string;
}

/**
 * 导出粗剪视频（简化版）
 * @param scenes - 分镜场景数组
 * @returns 导出结果
 */
export async function exportRoughCut(scenes: Scene[]): Promise<ExportResult> {
  try {
    console.log('📤 开始导出粗剪，共', scenes.length, '个分镜');
    
    const response = await fetch(`${API_BASE_URL}/api/v1/video-export/rough-cut-simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || '导出失败');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || data.message || '导出失败');
    }

    console.log('✅ 粗剪导出成功:', data.data);
    return data.data;

  } catch (error) {
    console.error('❌ 导出粗剪失败:', error);
    throw error;
  }
}

/**
 * 导出粗剪视频（带进度回调）
 * @param scenes - 分镜场景数组
 * @param onProgress - 进度回调函数
 * @returns 导出结果
 */
export async function exportRoughCutWithProgress(
  scenes: Scene[],
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    try {
      console.log('📤 开始导出粗剪（带进度），共', scenes.length, '个分镜');

      // EventSource only supports GET; this export endpoint is POST + SSE.
      // Use fetch streams directly so the browser never makes a stray GET request.
      fetch(`${API_BASE_URL}/api/v1/video-export/rough-cut`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenes }),
      }).then(response => {
        if (!response.ok) {
          throw new Error('导出请求失败');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('无法读取响应');
        }

        const readStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              return;
            }

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                try {
                  const progress: ExportProgress = JSON.parse(data);
                  
                  if (onProgress) {
                    onProgress(progress);
                  }

                  if (progress.stage === 'completed' && progress.result) {
                    resolve(progress.result);
                    return;
                  } else if (progress.stage === 'error') {
                    reject(new Error(progress.error || '导出失败'));
                    return;
                  }
                } catch (e) {
                  console.error('解析进度数据失败:', e);
                }
              }
            }

            readStream();
          }).catch(error => {
            reject(error);
          });
        };

        readStream();

      }).catch(error => {
        reject(error);
      });

    } catch (error) {
      console.error('❌ 导出粗剪失败:', error);
      reject(error);
    }
  });
}

/**
 * 触发浏览器下载文件
 * @param url - 文件URL
 * @param filename - 文件名
 */
export function downloadFile(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}




























