import { useMemo } from 'react';

/**
 * 视频后期处理参数接口
 */
export interface VideoEffectsParams {
  brightness?: number;      // -100 to 100
  contrast?: number;        // -100 to 100
  saturation?: number;      // -100 to 100
  temperature?: string;     // '原始' | '暖色调' | '冷色调' | '中性'
  detail?: string;          // '柔和' | '标准' | '锐利'
  denoiseLevel?: string;    // '关闭' | '轻度' | '中度' | '重度'
  filter?: string;          // '原片' | '复古胶片' | '冷调科技' | '暖色纪实' | '黑白' | '高饱和'
}

/**
 * 视频效果处理 Hook
 * 将 UI 参数转换为 CSS filter 样式
 */
export const useVideoEffects = (params: VideoEffectsParams = {}) => {
  return useMemo(() => {
    const {
      brightness = 0,
      contrast = 0,
      saturation = 0,
      temperature = '原始',
      detail = '标准',
      denoiseLevel = '关闭',
      filter = '原片'
    } = params;

    let filterString = '';

    // 1. 基础调色映射 (UI的 -100~100 映射到 CSS 的倍数)
    // 亮度: 0 -> 100% (1), -100 -> 0% (0), 100 -> 200% (2)
    const b = Math.max(0, 1 + brightness / 100);
    const c = Math.max(0, 1 + contrast / 100);
    const s = Math.max(0, 1 + saturation / 100);

    filterString += `brightness(${b}) contrast(${c}) saturate(${s}) `;

    // 2. 色温处理 (Temperature / Color Tone)
    if (temperature === '暖色调') {
      // 暖色：加一点深褐色 (sepia) 并微调色相
      filterString += `sepia(0.2) hue-rotate(-5deg) `;
      // 也可以直接引用 SVG 滤镜: url(#filter-warm-tone)
    } else if (temperature === '冷色调') {
      // 冷色：增加蓝色通道
      filterString += `url(#filter-cool-tone) `;
    } else if (temperature === '中性') {
      // 中性：轻微降低饱和度
      filterString += `saturate(0.95) `;
    }

    // 3. 风格滤镜预设 (Presets)
    if (filter === '复古胶片') {
      filterString += `sepia(0.5) contrast(1.15) url(#filter-vintage) `;
    } else if (filter === '冷调科技') {
      filterString += `url(#filter-cyberpunk) contrast(1.2) `;
    } else if (filter === '暖色纪实') {
      filterString += `sepia(0.3) saturate(1.1) brightness(1.05) `;
    } else if (filter === '黑白') {
      filterString += `grayscale(1) contrast(1.15) `;
    } else if (filter === '高饱和') {
      filterString += `saturate(1.6) contrast(1.1) `;
    }

    // 4. 细节处理 (Detail - Sharpness/Blur)
    // 注意：SVG 滤镜通过 url() 引用
    if (detail === '锐利') {
      filterString += `url(#filter-sharp) `;
    } else if (detail === '柔和') {
      // 柔和其实就是轻微模糊
      filterString += `blur(0.8px) `;
    }

    // 5. 降噪模拟 (Denoise)
    // 前端模拟降噪通常就是利用模糊来掩盖噪点
    if (denoiseLevel === '轻度') {
      filterString += `blur(0.5px) `;
    } else if (denoiseLevel === '中度') {
      filterString += `blur(1px) `;
    } else if (denoiseLevel === '重度') {
      filterString += `blur(1.5px) `;
    }

    // 返回样式对象
    return {
      filter: filterString.trim(),
      // 添加过渡效果，让调整更平滑
      transition: 'filter 0.15s ease-out'
    };
  }, [params]);
};

/**
 * 生成 FFmpeg 命令字符串（用于后端导出）
 * 将前端参数转换为 FFmpeg 滤镜链
 */
export const generateFFmpegFilterString = (params: VideoEffectsParams): string => {
  const {
    brightness = 0,
    contrast = 0,
    saturation = 0,
    temperature = '原始',
    detail = '标准',
    denoiseLevel = '关闭',
    filter = '原片'
  } = params;

  const vf: string[] = []; // 滤镜链数组

  // 1. 基础调色 (eq filter)
  // FFmpeg eq: brightness (-1.0 to 1.0), contrast (0.0 to 2.0), saturation (0.0 to 3.0)
  const b = brightness / 100;
  const c = Math.max(0, 1 + contrast / 100);
  const s = Math.max(0, 1 + saturation / 100);
  
  if (b !== 0 || c !== 1 || s !== 1) {
    vf.push(`eq=brightness=${b.toFixed(2)}:contrast=${c.toFixed(2)}:saturation=${s.toFixed(2)}`);
  }

  // 2. 色温 (colorbalance / curves)
  if (temperature === '暖色调') {
    // 增加红色和黄色通道
    vf.push(`colorbalance=rs=0.15:gs=0.05:bs=-0.1`);
  } else if (temperature === '冷色调') {
    // 增加蓝色通道
    vf.push(`colorbalance=rs=-0.1:gs=0:bs=0.15`);
  }

  // 3. 细节处理 (unsharp mask for sharpening)
  if (detail === '锐利') {
    // luma_msize_x:luma_msize_y:luma_amount:chroma_msize_x:chroma_msize_y:chroma_amount
    vf.push(`unsharp=5:5:1.0:5:5:0.0`);
  } else if (detail === '柔和' || denoiseLevel !== '关闭') {
    // 简单的模糊模拟降噪/柔和
    let blurAmount = 0;
    if (detail === '柔和') blurAmount = 1;
    if (denoiseLevel === '轻度') blurAmount = Math.max(blurAmount, 0.5);
    if (denoiseLevel === '中度') blurAmount = Math.max(blurAmount, 1);
    if (denoiseLevel === '重度') blurAmount = Math.max(blurAmount, 1.5);
    
    if (blurAmount > 0) {
      vf.push(`boxblur=${blurAmount}:1`);
    }
  }

  // 4. 风格滤镜预设
  if (filter === '复古胶片') {
    vf.push(`colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`);
  } else if (filter === '黑白') {
    vf.push(`hue=s=0`);
  } else if (filter === '高饱和') {
    vf.push(`eq=saturation=1.6`);
  }

  // 生成最终字符串
  // 结果示例: "eq=brightness=0.1:contrast=1.1,unsharp=5:5:1.0"
  return vf.length > 0 ? vf.join(',') : 'null';
};





















