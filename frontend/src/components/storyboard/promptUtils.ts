import { StructuredPrompt, PromptTag, CameraControl, Scene } from './types';

// ============================================================
// 中英文摄影术语映射表
// ============================================================

const SHOT_SIZE_MAP: Record<string, string> = {
  '大远景': 'extreme long shot',
  '远景': 'long shot',
  '全景': 'full shot',
  '中景': 'medium shot',
  '近景': 'medium close-up',
  '特写': 'close-up',
  '大特写': 'extreme close-up',
  'Extreme Long Shot': 'extreme long shot',
  'Long Shot': 'long shot',
  'Medium Shot': 'medium shot',
  'Close-up': 'close-up',
};

const PERSPECTIVE_MAP: Record<string, string> = {
  '平视': 'eye-level angle',
  '俯视': 'high angle',
  '仰视': 'low angle',
  '斜侧': 'dutch angle',
  '鸟瞰': "bird's eye view",
  '荷兰角': 'dutch angle',
};

const EQUIPMENT_MAP: Record<string, string> = {
  '稳定器': 'gimbal stabilizer shot',
  '三脚架': 'tripod shot',
  '手持': 'handheld camera',
  '摇臂': 'crane shot',
  '无人机': 'aerial drone shot',
  '航拍无人机': 'aerial drone photography',
  '轨道': 'dolly track shot',
  '肩扛': 'shoulder-mounted camera',
};

const CAMERA_MOVEMENT_MAP: Record<string, string> = {
  '静止': 'static shot',
  '固定': 'static shot',
  '推镜头': 'dolly push-in',
  '推进': 'dolly push-in',
  '拉镜头': 'dolly pull-out',
  '拉远': 'dolly pull-out',
  '左摇': 'pan left',
  '右摇': 'pan right',
  '摇镜头': 'camera pan',
  '上摇': 'tilt up',
  '下摇': 'tilt down',
  '跟镜头': 'tracking shot',
  '跟拍': 'tracking shot',
  '升镜头': 'crane up',
  '升降': 'crane shot',
  '降镜头': 'crane down',
  '环绕': 'orbiting shot',
};

function mapTerm(map: Record<string, string>, value: string): string {
  return map[value] || value;
}

/**
 * 将场景的摄影参数构建为图片生成用的英文描述后缀
 * 例如: "medium shot, eye-level angle, 50mm lens, tripod shot, static shot"
 */
export function buildCinematicSuffix(scene: Partial<Scene>): string {
  const parts: string[] = [];

  if (scene.size?.trim()) {
    parts.push(mapTerm(SHOT_SIZE_MAP, scene.size.trim()));
  }
  if (scene.perspective?.trim()) {
    parts.push(mapTerm(PERSPECTIVE_MAP, scene.perspective.trim()));
  }
  if (scene.focalLength?.trim()) {
    // focalLength 如 "50mm" 直接拼接 " lens"
    const fl = scene.focalLength.trim();
    parts.push(/mm$/i.test(fl) ? `${fl} lens` : fl);
  }
  if (scene.equipment?.trim()) {
    parts.push(mapTerm(EQUIPMENT_MAP, scene.equipment.trim()));
  }
  if (scene.motionPrompt?.trim()) {
    const movement = mapTerm(CAMERA_MOVEMENT_MAP, scene.motionPrompt.trim());
    if (movement && movement !== 'static shot') {
      parts.push(movement);
    }
  }

  return parts.join(', ');
}

/**
 * 将视觉提示词与摄影参数合并，返回用于图片生成的完整提示词
 */
export function buildCinematicPrompt(scene: Partial<Scene>, basePrompt: string): string {
  const suffix = buildCinematicSuffix(scene);
  if (!suffix) return basePrompt;
  return `${basePrompt}, ${suffix}`;
}

/**
 * 将结构化提示词转换为文本提示词
 */
export function structuredPromptToText(structured: StructuredPrompt): string {
  const parts: string[] = [];
  
  // 主体
  if (structured.subjects.length > 0) {
    const subjectTexts = structured.subjects.map(tag => formatTagWithWeight(tag));
    parts.push(subjectTexts.join(', '));
  }
  
  // 环境与风格
  if (structured.environment.length > 0) {
    const envTexts = structured.environment.map(tag => formatTagWithWeight(tag));
    parts.push(envTexts.join(', '));
  }
  
  // 动态描述
  if (structured.motion.length > 0) {
    const motionTexts = structured.motion.map(tag => tag.text);
    parts.push(motionTexts.join(', '));
  }
  
  return parts.join(', ');
}

/**
 * 格式化标签权重（如果有）
 */
function formatTagWithWeight(tag: PromptTag): string {
  if (tag.weight && tag.weight !== 1.0) {
    return `(${tag.text}:${tag.weight.toFixed(1)})`;
  }
  return tag.text;
}

/**
 * 从文本提示词解析为结构化提示词（简单的关键词提取）
 */
export function textToStructuredPrompt(text: string): StructuredPrompt {
  // 简化版本：将逗号分隔的词组转换为标签
  // 实际应用中可以调用AI来智能分类
  const parts = text.split(',').map(s => s.trim()).filter(Boolean);
  
  const subjects: PromptTag[] = [];
  const environment: PromptTag[] = [];
  const motion: PromptTag[] = [];
  
  // 简单的关键词分类逻辑
  const motionKeywords = ['moving', 'walking', 'running', 'flying', 'dancing', 'jumping', '移动', '行走', '奔跑', '飞行', '舞蹈', '跳跃', '摇晃', '飘扬', '旋转'];
  const envKeywords = ['light', 'dark', 'sunset', 'sunrise', 'night', 'day', 'cinematic', 'style', '光', '日落', '日出', '夜晚', '白天', '电影', '风格', '颗粒', '赛博朋克'];
  
  parts.forEach((part, index) => {
    // 检查是否有权重标记 (word:1.2)
    const weightMatch = part.match(/\((.+?):([\d.]+)\)/);
    let text = part;
    let weight = 1.0;
    
    if (weightMatch) {
      text = weightMatch[1];
      weight = parseFloat(weightMatch[2]);
    }
    
    const tag: PromptTag = {
      id: `tag-${Date.now()}-${index}`,
      text,
      weight
    };
    
    // 分类逻辑
    const lowerText = text.toLowerCase();
    if (motionKeywords.some(k => lowerText.includes(k))) {
      motion.push(tag);
    } else if (envKeywords.some(k => lowerText.includes(k))) {
      environment.push(tag);
    } else {
      subjects.push(tag);
    }
  });
  
  return { subjects, environment, motion };
}

/**
 * 将运镜控制转换为提示词文本
 */
export function cameraControlToPrompt(camera: CameraControl): string {
  if (camera.movement === 'none') return '';
  
  const strengthDesc = camera.strength <= 3 ? 'subtle' : 
                       camera.strength <= 6 ? 'smooth' : 
                       'dynamic';
  
  const movements: Record<CameraControl['movement'], string> = {
    'none': '',
    'pan_left': `${strengthDesc} camera panning left`,
    'pan_right': `${strengthDesc} camera panning right`,
    'tilt_up': `${strengthDesc} camera tilting up`,
    'tilt_down': `${strengthDesc} camera tilting down`,
    'zoom_in': `${strengthDesc} camera zooming in`,
    'zoom_out': `${strengthDesc} camera zooming out`,
    'roll': `${strengthDesc} camera rolling`,
    'drone': `${strengthDesc} aerial drone shot`
  };
  
  return movements[camera.movement] || '';
}

/**
 * 解析脚本文本，自动生成结构化提示词（AI 预填充）
 */
export function parseScriptToStructuredPrompt(scriptText: string): StructuredPrompt {
  // 这里是一个简化版本
  // 实际应用中应该调用后端 AI 服务来智能解析
  
  const subjects: PromptTag[] = [];
  const environment: PromptTag[] = [];
  const motion: PromptTag[] = [];
  
  // 简单的关键词匹配
  const commonSubjects = ['广州塔', '舞狮', '人物', '建筑', '老人', '少年', '女孩', '男孩', '动物', '汽车'];
  const commonEnv = ['晨光', '夕阳', '夜晚', '雨天', '晴天', '室内', '室外', '赛博朋克', '古风', '现代'];
  const commonMotion = ['奔跑', '行走', '跳舞', '飞行', '飘扬', '欢呼', '挥手'];
  
  let tagId = 0;
  
  // 提取主体
  commonSubjects.forEach(keyword => {
    if (scriptText.includes(keyword)) {
      subjects.push({
        id: `subject-${tagId++}`,
        text: keyword,
        weight: 1.0
      });
    }
  });
  
  // 提取环境
  commonEnv.forEach(keyword => {
    if (scriptText.includes(keyword)) {
      environment.push({
        id: `env-${tagId++}`,
        text: keyword,
        weight: 1.0
      });
    }
  });
  
  // 提取动作
  commonMotion.forEach(keyword => {
    if (scriptText.includes(keyword)) {
      motion.push({
        id: `motion-${tagId++}`,
        text: keyword
      });
    }
  });
  
  // 如果没有提取到任何内容，提供默认值
  if (subjects.length === 0 && environment.length === 0 && motion.length === 0) {
    return textToStructuredPrompt(scriptText);
  }
  
  return { subjects, environment, motion };
}

/**
 * 获取默认的智能生成配置
 */
export function getDefaultGenerationConfig() {
  return {
    structuredPrompt: {
      subjects: [],
      environment: [],
      motion: []
    },
    cameraControl: {
      movement: 'none' as const,
      strength: 3
    },
    referenceControl: {},
    matchNarrationDuration: false
  };
}








