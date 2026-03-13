// 智能生成控制台相关类型
export interface PromptTag {
  id: string;
  text: string;
  weight?: number;
}

export interface StructuredPrompt {
  subjects: PromptTag[];
  environment: PromptTag[];
  motion: PromptTag[];
}

export interface CameraControl {
  movement: 'none' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'roll' | 'drone';
  strength: number;
}

export interface ReferenceControl {
  styleRef?: string;
  characterRef?: string;
}

export interface Scene {
  id: number;
  type: 'ai' | 'real' | 'empty';
  duration: string;
  script: string;
  narration?: string; // 字幕/旁白文案
  isAiGenerated: boolean;
  
  // AI 生成相关状态
  visualPrompt: string;
  motionPrompt: string;
  generationStatus: 'idle' | 'generating_image' | 'image_selected' | 'generating_video' | 'completed';
  selectedImageIndex?: number; // 0-3
  
  // AI 生成模式
  generationMode?: 'text_to_image' | 'image_to_image';
  imagePromptUrl?: string; // 图生图的参考图 URL
  
  // 图片分辨率设置
  imageResolution?: {
    preset?: '1k' | '2k' | '4k' | 'custom';
    aspectRatio?: '1:1' | '4:3' | '3:2' | '16:9' | '21:9' | '9:16' | '3:4';
    customWidth?: number;
    customHeight?: number;
  };
  
  // 智能生成控制台配置（新增）
  smartGeneration?: {
    structuredPrompt?: StructuredPrompt;
    cameraControl?: CameraControl;
    referenceControl?: ReferenceControl;
    matchNarrationDuration?: boolean;
  };
  
  // 意图驱动标签（新增）
  intentTags?: {
    subjects: string[];
    environment: string[];
    style: string[];
    action: string[];
  };

  // 实拍素材相关状态
  assetUrl?: string;
  videoUrl?: string; // AI 生成的视频 URL（当前选中版本）
  footageStatus: 'empty' | 'filled';
  matchReason?: string; // AI 匹配理由
  clipRange?: [number, number]; // 截取片段 [start, end] (0-100%)
  clipStartTime?: number; // 剪辑起始时间（秒）- AI 返回的原始值
  clipEndTime?: number; // 剪辑结束时间（秒）- AI 返回的原始值
  
  // 多版本管理（新增）
  versions?: VideoVersion[];
  selectedVersionId?: string; // 当前选中的版本ID
  
  // 脚本同步状态（新增）
  scriptSync?: {
    lastSyncedScript?: string;
    lockedTags?: string[];
    hasModification?: boolean;
  };

  // 后期处理参数 (实拍模式)
  postProcessing?: {
    filter?: string;
    colorGrade?: string;
    stabilization?: boolean;
    cameraMove?: string;
    cropMode?: 'fill' | 'fit' | 'blur_bg';
    speed?: number;
    // 降噪与画质
    denoiseLevel?: '关闭' | '轻度' | '中度' | '重度';
    colorTone?: '原始' | '暖色调' | '冷色调' | '中性';
    sharpness?: '柔和' | '标准' | '锐利';
    // 基础颜色调整
    brightness?: number; // -100 to 100
    contrast?: number; // -100 to 100
    saturation?: number; // -100 to 100
  };

  // 转场设置 (连接到下一个场景的转场)
  transitionType?: 'none' | 'dissolve' | 'fade_black' | 'match_cut' | 'wipe' | 'ai_transition';
  
  // AI 转场相关
  aiTransition?: {
    videoUrl?: string;
    prompt?: string;
    duration?: number;
    status?: 'idle' | 'generating' | 'completed' | 'error';
  };

  // AI 创意说明（新增）
  designReason?: string; // AI设计该分镜的创意理由
  creativeNotes?: string[]; // 创意要点列表

  // 新版分镜板字段（用于新 UI 设计）
  size?: string;        // 景别 (Extreme Long Shot / Long Shot / Medium / Close-up 等)
  perspective?: string; // 视角 (Eye-level / Low angle / High angle 等)
  equipment?: string;   // 设备 (Steady cam / Tripod / Handheld 等)
  focalLength?: string; // 焦距 (24mm / 35mm / 50mm 等)
  notes?: string;       // 备注
  dialogue?: string;    // 对白
}

export interface Asset {
  id: number;
  type: 'image' | 'video';
  url: string;
  thumbnail: string;
  tags?: string[];
  duration?: number; // Video duration in seconds
}

// 视频版本（用于生成结果对比）
export interface VideoVersion {
  id: string;
  version: number;
  videoUrl: string;
  thumbnailUrl?: string;
  timestamp: number;
  isSelected: boolean;
  metadata?: {
    prompt?: string;
    duration?: number;
    model?: string;
    seed?: number;
  };
}
