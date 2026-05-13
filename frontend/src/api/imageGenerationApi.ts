/**
 * 图片生成 API 模块
 * 使用豆包 Seedream 模型进行图片生成
 * 通过后端代理调用，API Key配置在后端
 */

// API 配置 - 通过后端代理
const API_BASE_URL = 'http://localhost:4300/api/v1/image-gen';

// ============================================================
// 类型定义
// ============================================================

/** 图片尺寸类型 */
export type ImageSize = '1K' | '2K' | '4K' | string;

/** 响应格式 */
export type ResponseFormat = 'url' | 'b64_json';

/** 图片生成请求参数 */
export interface ImageGenerationParams {
  /** 模型ID */
  model: string;
  /** 提示词 */
  prompt: string;
  /** 图片URL或Base64（图生图时使用） */
  image?: string | string[];
  /** 图片尺寸 */
  size?: string;
  /** 随机种子 */
  seed?: number;
  /** 是否添加水印 */
  watermark?: boolean;
  /** 响应格式 */
  response_format?: ResponseFormat;
  /** 组图功能控制 */
  sequential_image_generation?: 'auto' | 'disabled';
  /** 其他可选参数 */
  [key: string]: any;
}

/** 图片数据 */
export interface ImageData {
  /** 图片URL（response_format为url时） */
  url?: string;
  /** Base64编码（response_format为b64_json时） */
  b64_json?: string;
  /** 图片尺寸 */
  size?: string;
  /** 错误信息（生成失败时） */
  error?: {
    code: string;
    message: string;
  };
}

/** 用量信息 */
export interface UsageInfo {
  /** 成功生成的图片数量 */
  generated_images: number;
  /** 输出token数 */
  output_tokens: number;
  /** 总token数 */
  total_tokens: number;
}

/** 图片生成响应 */
export interface ImageGenerationResponse {
  /** 模型ID */
  model: string;
  /** 创建时间戳 */
  created: number;
  /** 生成的图片数据 */
  data: ImageData[];
  /** 用量信息 */
  usage: UsageInfo;
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// API 函数
// ============================================================

/**
 * 文生图 - 使用 Seedream 4.0 模型
 * @param prompt 提示词
 * @param options 可选参数
 * @returns 生成的图片信息
 */
export async function generateImageFromText(
  prompt: string,
  options?: {
    size?: ImageSize;
    seed?: number;
    watermark?: boolean;
    response_format?: ResponseFormat;
    sequential_image_generation?: 'auto' | 'disabled';
    sequential_image_generation_options?: {
      max_images?: number;
    };
  }
): Promise<ImageGenerationResponse> {
  const params: ImageGenerationParams = {
    model: 'doubao-seedream-4-5-251128', // 使用4.5模型的推理接入点ID
    prompt,
    size: options?.size || '2K',
    seed: options?.seed ?? -1,
    watermark: options?.watermark ?? true,
    response_format: options?.response_format || 'url',
    sequential_image_generation: options?.sequential_image_generation || 'disabled',
  };

  // 如果启用了组图功能，添加组图选项
  if (options?.sequential_image_generation === 'auto' && options?.sequential_image_generation_options) {
    params.sequential_image_generation_options = options.sequential_image_generation_options;
    console.log('✅ [前端] 组图功能已启用，max_images:', options.sequential_image_generation_options.max_images);
  } else {
    console.log('⚠️ [前端] 组图功能未启用:', {
      sequential_image_generation: options?.sequential_image_generation,
      has_options: !!options?.sequential_image_generation_options
    });
  }

  console.log('📤 [前端] 调用图片生成API，完整参数:', JSON.stringify(params, null, 2));
  
  return callImageGenerationAPI(params);
}

/**
 * 图生图 - 使用 Seedream 4.0 模型
 * @param prompt 提示词
 * @param imageUrl 参考图片URL或Base64编码
 * @param options 可选参数
 * @returns 生成的图片信息
 */
export async function generateImageFromImage(
  prompt: string,
  imageUrl: string,
  options?: {
    size?: 'adaptive' | ImageSize;
    watermark?: boolean;
    response_format?: ResponseFormat;
  }
): Promise<ImageGenerationResponse> {
  const params: ImageGenerationParams = {
    model: 'doubao-seedream-4-5-251128', // 使用Seedream 4.5模型
    prompt,
    image: imageUrl,
    // 如果size是'adaptive'或未指定，则不传递size参数（让API自适应）
    // 否则使用指定的尺寸
    ...(options?.size && options.size !== 'adaptive' ? { size: options.size } : {}),
    watermark: options?.watermark ?? true,
    response_format: options?.response_format || 'url',
    sequential_image_generation: 'disabled', // 生成单图
  };

  return callImageGenerationAPI(params);
}

/**
 * 多图融合生成 - 使用 Seedream 4.0 模型
 * @param prompt 提示词
 * @param imageUrls 参考图片URL数组（2-14张）
 * @param options 可选参数
 * @returns 生成的图片信息
 */
export async function generateImageFromMultipleImages(
  prompt: string,
  imageUrls: string[],
  options?: {
    size?: ImageSize;
    watermark?: boolean;
    response_format?: ResponseFormat;
  }
): Promise<ImageGenerationResponse> {
  if (imageUrls.length < 2 || imageUrls.length > 14) {
    throw new Error('多图融合需要2-14张参考图片');
  }

  const params: ImageGenerationParams = {
    model: 'doubao-seedream-4-5-251128', // 多图融合使用4.5模型的推理接入点ID
    prompt,
    image: imageUrls,
    size: options?.size || '2K',
    watermark: options?.watermark ?? true,
    response_format: options?.response_format || 'url',
    sequential_image_generation: 'disabled', // 生成单图
  };

  return callImageGenerationAPI(params);
}

/**
 * 调用图片生成API（通过后端代理）
 * @param params 请求参数
 * @returns API响应
 */
async function callImageGenerationAPI(
  params: ImageGenerationParams
): Promise<ImageGenerationResponse> {
  try {
    console.log('[ImageGenerationAPI] 发起请求:', {
      model: params.model,
      prompt: params.prompt?.substring(0, 50),
      hasImage: !!params.image,
      size: params.size,
    });

    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[ImageGenerationAPI] 请求失败:', response.status, errorData);
      throw new Error(
        errorData.error || `API请求失败: ${response.status}`
      );
    }

    const apiResponse = await response.json();
    
    if (!apiResponse.success) {
      throw new Error(apiResponse.error || '图片生成失败');
    }

    const result: ImageGenerationResponse = apiResponse.data;
    
    console.log('[ImageGenerationAPI] 请求成功:', {
      model: result.model,
      imageCount: result.data.length,
      usage: result.usage,
    });

    // 检查是否有生成失败的图片
    const failedImages = result.data.filter(img => img.error);
    if (failedImages.length > 0) {
      console.warn('[ImageGenerationAPI] 部分图片生成失败:', failedImages);
    }

    return result;
  } catch (error) {
    console.error('[ImageGenerationAPI] 调用失败:', error);
    throw error;
  }
}

/**
 * 将图片URL转换为Base64编码
 * @param imageUrl 图片URL
 * @returns Base64编码字符串
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    // 如果已经是Base64，直接返回
    if (imageUrl.startsWith('data:image/')) {
      return imageUrl;
    }

    // 通过后端代理获取图片，避免跨域问题
    const proxyUrl = `http://localhost:4300/api/v1/proxy/image?url=${encodeURIComponent(imageUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[imageUrlToBase64] 转换失败:', error);
    throw error;
  }
}

/**
 * 获取推荐的图片尺寸
 * @param aspectRatio 宽高比字符串，如 "16:9"
 * @param resolution 分辨率等级
 * @returns 宽高像素值
 */
export function getRecommendedSize(
  aspectRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | '21:9',
  resolution: '1K' | '2K' | '4K' = '2K'
): string {
  const sizeMap = {
    '2K': {
      '1:1': '2048x2048',
      '4:3': '2304x1728',
      '3:4': '1728x2304',
      '16:9': '2560x1440',
      '9:16': '1440x2560',
      '3:2': '2496x1664',
      '2:3': '1664x2496',
      '21:9': '3024x1296',
    },
    '1K': {
      '1:1': '1024x1024',
      '4:3': '1152x864',
      '3:4': '864x1152',
      '16:9': '1280x720',
      '9:16': '720x1280',
      '3:2': '1248x832',
      '2:3': '832x1248',
      '21:9': '1512x648',
    },
    '4K': {
      '1:1': '4096x4096',
      '4:3': '4608x3456',
      '3:4': '3456x4608',
      '16:9': '5120x2880',
      '9:16': '2880x5120',
      '3:2': '4992x3328',
      '2:3': '3328x4992',
      '21:9': '6048x2592',
    },
  };

  return sizeMap[resolution][aspectRatio];
}

// ============================================================
// 简化的API接口（兼容旧的调用方式）
// ============================================================

/**
 * 简化的文生图接口
 * @param prompt 提示词
 * @param options 可选参数
 * @returns 生成结果（包含图片URL数组）
 */
export async function textToImage(
  prompt: string,
  options?: {
    width?: number;
    height?: number;
    size?: ImageSize;
    seed?: number;
    watermark?: boolean;
    response_format?: ResponseFormat;
    sequential_image_generation?: 'auto' | 'disabled';
    sequential_image_generation_options?: {
      max_images?: number;
    };
  }
): Promise<{ imageUrls: string[] }> {
  // 如果提供了width和height，转换为size格式
  let size: ImageSize | string = options?.size || '2K';
  if (options?.width && options?.height) {
    size = `${options.width}x${options.height}`;
  }

  const response = await generateImageFromText(prompt, {
    size: size as ImageSize,
    seed: options?.seed,
    watermark: options?.watermark,
    response_format: options?.response_format,
    sequential_image_generation: options?.sequential_image_generation,
    sequential_image_generation_options: options?.sequential_image_generation_options,
  });

  // 提取URL数组
  const imageUrls = response.data
    .filter(img => !img.error && img.url)
    .map(img => img.url!);

  return { imageUrls };
}

/**
 * 简化的图生图接口
 * @param prompt 提示词
 * @param imageUrls 参考图片URL数组（单图或多图）
 * @param options 可选参数
 * @returns 生成结果（包含图片URL数组）
 */
export async function imageToImage(
  prompt: string,
  imageUrls: string[],
  options?: {
    width?: number;
    height?: number;
    size?: ImageSize | 'adaptive';
    watermark?: boolean;
    response_format?: ResponseFormat;
  }
): Promise<{ imageUrls: string[] }> {
  let response: ImageGenerationResponse;

  // 多图融合
  if (imageUrls.length > 1) {
    response = await generateImageFromMultipleImages(prompt, imageUrls, {
      size: (options?.size as ImageSize) || '2K',
      watermark: options?.watermark,
      response_format: options?.response_format,
    });
  }
  // 单图生图
  else if (imageUrls.length === 1) {
    response = await generateImageFromImage(prompt, imageUrls[0], {
      size: options?.size === 'adaptive' ? undefined : (options?.size as ImageSize),
      watermark: options?.watermark,
      response_format: options?.response_format,
    });
  } else {
    throw new Error('至少需要一张参考图片');
  }

  // 提取URL数组
  const resultUrls = response.data
    .filter(img => !img.error && img.url)
    .map(img => img.url!);

  return { imageUrls: resultUrls };
}

