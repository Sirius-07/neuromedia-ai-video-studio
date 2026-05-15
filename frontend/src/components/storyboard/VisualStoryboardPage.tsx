import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutTemplate, Download, Loader2, GripVertical, AlertTriangle, Sparkles, CheckCircle2, FileVideo, UploadCloud, BrainCircuit, Music, ImagePlus, Video, Plus, Copy, Trash2, Image as ImageIcon, Film, Clock, GripHorizontal, Undo2, Send, RefreshCw, Bot, ChevronLeft, ChevronRight, Lightbulb, Square, Play, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Inspector } from './Inspector';
import { SceneCard } from './SceneCard';
import { AiTransitionCard } from './AiTransitionCard';
import { Scene } from './types';
import { ScriptResponse, generateScriptAsync, ScriptTaskStatus } from '../../api/scriptApi';
import * as comfyuiApi from '../../api/comfyuiApi';
import * as videoExportApi from '../../api/videoExportApi';
import * as musicCreationApi from '../../api/musicCreationApi';
import * as imageGenApi from '../../api/imageGenerationApi';
import { getRecommendedSize } from '../../api/imageGenerationApi';
import * as imageApi from '../../api/imageApi';
import { motion } from 'framer-motion';
import { getProject, saveStoryboard } from '../../api/projectApi';
import { expandProposalToScript } from '../../api/inspirationApi';
import { addStyleToPrompt } from '../../utils/stylePrompts';
import { buildCinematicPrompt } from './promptUtils';
import { chatWithAI, type ChatMessage as AiChatMessage, type AiChange } from '../../api/scriptEditApi';
import StoryboardDirectorPanel from './assistant/StoryboardDirectorPanel';
import type { StoryboardAction } from './assistant/types';
import type {
  StoryboardAssistantActionPreview,
  StoryboardAssistantActionsEvent,
} from './assistant/useStoryboardAssistant';
import { shouldShowAdvancedSceneParameters } from './advancedSceneExpansion';
import {
  buildCreationSettings,
  createCreationIntent,
  DEFAULT_CREATION_ART_STYLE,
  DEFAULT_CREATION_ASPECT_RATIO,
  mergeCreationIntentFromProject,
  shouldSkipLegacyAutoScriptGeneration,
  type CreationAspectRatio,
  type CreationIntent,
} from '../../types/creationIntent';
import { apiUrl, assetUrl, proxyVideoUrl as buildProxyVideoUrl } from '../../config/api';

// ============================================================
// localStorage 持久化键名
// ============================================================
const STORAGE_KEY_SCENES = 'storyboard_scenes';
const STORAGE_KEY_PROJECT_TITLE = 'storyboard_project_title';
const STORAGE_KEY_SELECTED_SCENE = 'storyboard_selected_scene';
const STORAGE_KEY_USER_PROMPT = 'storyboard_user_prompt';
const STORAGE_KEY_UPLOADED_ASSETS = 'storyboard_uploaded_assets';
const STORAGE_KEY_GENERATION_MODE = 'storyboard_generation_mode';

/**
 * 从 localStorage 加载数据
 */
const loadFromStorage = (): { 
  scenes: Scene[]; 
  title: string; 
  selectedId: number | null;
  userPrompt?: string;
  uploadedAssets?: any[];
  generationMode?: string;
} | null => {
  try {
    const savedScenes = localStorage.getItem(STORAGE_KEY_SCENES);
    const savedTitle = localStorage.getItem(STORAGE_KEY_PROJECT_TITLE);
    const savedSelectedId = localStorage.getItem(STORAGE_KEY_SELECTED_SCENE);
    const savedUserPrompt = localStorage.getItem(STORAGE_KEY_USER_PROMPT);
    const savedUploadedAssets = localStorage.getItem(STORAGE_KEY_UPLOADED_ASSETS);
    const savedGenerationMode = localStorage.getItem(STORAGE_KEY_GENERATION_MODE);

    if (savedScenes && savedTitle) {
      const parsedScenes: Scene[] = JSON.parse(savedScenes);
      const parsedSelectedId = savedSelectedId ? parseInt(savedSelectedId, 10) : null;
      const parsedUploadedAssets = savedUploadedAssets ? JSON.parse(savedUploadedAssets) : undefined;
      
      console.log('[VisualStoryboardPage] ✅ 从localStorage恢复数据（包含生成参数）');
      return {
        scenes: parsedScenes,
        title: savedTitle,
        selectedId: parsedSelectedId,
        userPrompt: savedUserPrompt || undefined,
        uploadedAssets: parsedUploadedAssets,
        generationMode: savedGenerationMode || undefined,
      };
    }
  } catch (error) {
    console.error('[VisualStoryboardPage] ❌ 从localStorage加载失败:', error);
  }
  return null;
};

/**
 * 清除所有 localStorage 数据
 */
const clearAllStorage = () => {
  localStorage.removeItem(STORAGE_KEY_SCENES);
  localStorage.removeItem(STORAGE_KEY_PROJECT_TITLE);
  localStorage.removeItem(STORAGE_KEY_SELECTED_SCENE);
  localStorage.removeItem(STORAGE_KEY_USER_PROMPT);
  localStorage.removeItem(STORAGE_KEY_UPLOADED_ASSETS);
  localStorage.removeItem(STORAGE_KEY_GENERATION_MODE);
  // 清除生成的转场和图片缓存
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('scene-') && key.endsWith('-generated')) {
      localStorage.removeItem(key);
    }
  });
};

/**
 * 代理视频 URL（避免跨域/CDN 鉴权问题）
 * 本地 /uploads/ 路径直接访问后端静态文件；
 * 已经是代理 URL 的不重复包装；
 * 其他远程 URL 通过后端代理转发。
 */
const proxyVideoUrl = (url: string): string => {
  if (!url) return url;
  // 已经是代理 URL，不重复处理
  if (url.startsWith(apiUrl('/'))) return url;
  // 本地上传路径
  if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
    const path = url.startsWith('/') ? url : `/${url}`;
    return assetUrl(path);
  }
  // 远程 URL 通过代理
  return buildProxyVideoUrl(url);
};

const resolveLocalAssetUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
    const path = url.startsWith('/') ? url : `/${url}`;
    return assetUrl(path);
  }
  return url;
};

const cleanStoryboardText = (value?: string): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[，。；;,.、\s]+$/g, '')
    .trim();

const getStoryboardPreviewText = (scene: Scene): string => {
  const source = cleanStoryboardText(scene.script || scene.visualPrompt || scene.narration || '');
  if (!source) return '还没有填写这一镜的画面重点';

  const parts = source
    .split(/(?<=[。！？；;])/)
    .map(cleanStoryboardText)
    .filter(Boolean);
  const preview = (parts.length > 0 ? parts.slice(0, 2).join('。') : source).replace(/。+/g, '。');
  return preview.length > 92 ? `${preview.slice(0, 92)}...` : preview;
};

type AgentFeedbackTone = 'preview' | 'applied';
type AgentFeedbackField = 'visual' | 'narration' | 'duration' | 'asset' | 'motion' | 'generation';
type AgentFieldMap = Record<number, AgentFeedbackField[]>;

interface AgentCardFeedback {
  shotIds: number[];
  fieldMap: AgentFieldMap;
  summary?: string;
  label?: string;
  isBatch?: boolean;
}

const AGENT_APPLIED_VISIBLE_MS = 3200;

const AGENT_FIELD_LABELS: Record<AgentFeedbackField, string> = {
  visual: '画面',
  narration: '旁白',
  duration: '时长',
  asset: '素材',
  motion: '运动',
  generation: '生成',
};

const normalizeAgentField = (field: string): AgentFeedbackField => {
  if (['narration', 'dialogue', 'voiceoverText', 'subtitle'].includes(field)) return 'narration';
  if (['duration', 'clipStartTime', 'clipEndTime'].includes(field)) return 'duration';
  if (['assetUrl', 'footageStatus', 'type', 'referenceAssetPath', 'uploadedAssetId'].includes(field)) return 'asset';
  if (['motionPrompt', 'cameraMovement', 'cameraStrength'].includes(field)) return 'motion';
  if (['generationStatus', 'videoUrl', 'selectedImageIndex', 'generatedVideoUrl'].includes(field)) return 'generation';
  return 'visual';
};

const mergeAgentField = (fieldMap: AgentFieldMap, shotId: number, field: AgentFeedbackField) => {
  fieldMap[shotId] = Array.from(new Set([...(fieldMap[shotId] || []), field]));
};

const buildAgentFeedbackFromActions = (
  actions: StoryboardAction[] | undefined,
  scenes: Scene[]
): AgentCardFeedback | null => {
  if (!actions?.length) return null;

  const shotIds = new Set<number>();
  const fieldMap: AgentFieldMap = {};
  const addShot = (shotId: unknown, fields: AgentFeedbackField[] = ['visual']) => {
    if (typeof shotId !== 'number') return;
    shotIds.add(shotId);
    fields.forEach((field) => mergeAgentField(fieldMap, shotId, field));
  };

  actions.forEach((action) => {
    if (action.type === 'update_shot_field') {
      const fields = Object.keys(action.patch || {})
        .filter((field) => field !== 'mode')
        .map(normalizeAgentField);
      addShot(action.shotId, fields.length > 0 ? fields : ['visual']);
      return;
    }

    if (action.type === 'bulk_update_shots') {
      (action.items || []).forEach((item) => {
        const fields = Object.keys(item.patch || {})
          .filter((field) => field !== 'mode')
          .map(normalizeAgentField);
        addShot(item.shotId, fields.length > 0 ? fields : ['visual']);
      });
      return;
    }

    if (action.type === 'regenerate_shot') {
      addShot(action.shotId, ['generation']);
      return;
    }

    if (action.type === 'regenerate_storyboard') {
      scenes.forEach((scene) => addShot(scene.id, ['generation']));
    }
  });

  if (shotIds.size === 0) return null;

  return {
    shotIds: Array.from(shotIds),
    fieldMap,
    isBatch: shotIds.size > 1,
  };
};

const buildAgentFeedbackFromAssistantEvent = ({
  shotIds,
  fields,
  actions,
  scenes,
  summary,
  label,
}: {
  shotIds: number[];
  fields: string[];
  actions?: StoryboardAction[];
  scenes: Scene[];
  summary?: string;
  label?: string;
}): AgentCardFeedback | null => {
  const actionFeedback = buildAgentFeedbackFromActions(actions, scenes);
  const normalizedShotIds = shotIds.length > 0
    ? shotIds
    : actionFeedback?.shotIds ?? [];

  if (normalizedShotIds.length === 0) return null;

  const fieldMap: AgentFieldMap = {};
  Object.entries(actionFeedback?.fieldMap ?? {}).forEach(([shotId, actionFields]) => {
    fieldMap[Number(shotId)] = [...(actionFields as AgentFeedbackField[])];
  });

  const normalizedFields = Array.from(new Set(fields.map(normalizeAgentField)));
  if (Object.keys(fieldMap).length === 0 && normalizedFields.length > 0) {
    normalizedShotIds.forEach((shotId) => {
      normalizedFields.forEach((field) => mergeAgentField(fieldMap, shotId, field));
    });
  }

  if (Object.keys(fieldMap).length === 0) {
    normalizedShotIds.forEach((shotId) => mergeAgentField(fieldMap, shotId, 'visual'));
  }

  return {
    shotIds: normalizedShotIds,
    fieldMap,
    summary,
    label,
    isBatch: normalizedShotIds.length > 1,
  };
};

const hasAgentField = (fieldMap: AgentFieldMap | undefined, sceneId: number, field: AgentFeedbackField) =>
  !!fieldMap?.[sceneId]?.includes(field);

const AgentFieldMark = ({
  active,
  tone,
  label,
}: {
  active: boolean;
  tone: AgentFeedbackTone;
  label: string;
}) => {
  if (!active) return null;
  const classes = tone === 'preview'
    ? 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-200'
    : 'border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${classes}`}>
      <span className="h-1 w-1 rounded-full bg-current" />
      {label}
    </span>
  );
};

const getUploadedAssetName = (asset: any, index: number): string => {
  const rawName = asset?.name || asset?.file_name || asset?.filename || `素材 ${index + 1}`;
  const name = String(rawName).replace(/\.[^.]+$/, '');
  if (/^[a-f0-9]{18,}$/i.test(name) || /^\d{12,}/.test(name)) {
    return `图片 ${index + 1}`;
  }
  return name.length > 18 ? `${name.slice(0, 16)}...` : name;
};

const clampTextStyle = (lines: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

/**
 * 将前端场景格式转换为API/数据库标准格式
 * 前端格式：type: 'ai' | 'real' | 'empty'
 * 标准格式：type: 'ai_generated' | 'mixed_media' | 'empty'
 */
const normalizeSceneForSave = (scene: Scene): any => {
  const normalized = {
    ...scene,
    type: scene.type === 'real' ? 'mixed_media' : 
          scene.type === 'ai' ? 'ai_generated' : 
          scene.type
  };
  
  // 调试日志：检查AI场景的视频URL和配音URL是否被保存
  if (scene.type === 'ai' && scene.videoUrl) {
    console.log(`[normalizeSceneForSave] 场景${scene.id} 包含videoUrl:`, scene.videoUrl);
  }
  if ((scene as any).voiceoverUrl) {
    console.log(`[normalizeSceneForSave] 场景${scene.id} 包含voiceoverUrl:`, (scene as any).voiceoverUrl);
  }
  
  return normalized;
};

/**
 * 根据画幅比例获取图片分辨率配置
 * @param aspectRatio - 画幅比例 ('16:9' | '9:16' | '1:1' | '4:3')
 * @returns imageResolution配置对象
 */
const getImageResolutionByAspectRatio = (aspectRatio?: string): Scene['imageResolution'] => {
  const ratioMap: Record<string, Scene['imageResolution']> = {
    '16:9': { preset: '2k', aspectRatio: '16:9' },
    '9:16': { preset: '2k', aspectRatio: '9:16' },
    '1:1': { preset: '2k', aspectRatio: '1:1' },
    '4:3': { preset: '2k', aspectRatio: '4:3' }
  };
  
  return ratioMap[aspectRatio || '16:9'] || ratioMap['16:9'];
};

/**
 * 根据画幅比例调整提示词（添加画幅描述）
 * @param prompt - 原始提示词
 * @param aspectRatio - 画幅比例
 * @returns 增强后的提示词
 */
const enhancePromptWithAspectRatio = (prompt: string, aspectRatio?: string): string => {
  if (!aspectRatio || aspectRatio === '16:9') {
    return prompt; // 16:9是默认值，不需要特别说明
  }
  
  const ratioDescriptions: Record<string, string> = {
    '9:16': 'vertical composition, portrait format, 9:16 aspect ratio',
    '1:1': 'square composition, 1:1 aspect ratio, centered frame',
    '4:3': 'classic 4:3 aspect ratio, traditional frame composition'
  };
  
  const ratioDesc = ratioDescriptions[aspectRatio];
  return ratioDesc ? `${prompt}, ${ratioDesc}` : prompt;
};

/**
 * 将API返回的场景转换为前端使用的场景格式
 * 支持两种格式：
 * 1. 脚本生成API返回的格式 (narration, duration, camera_movement)
 * 2. 数据库存储的格式 (scene_id, script_content, estimated_duration)
 */
const convertApiSceneToScene = (apiScene: any, index: number, aspectRatio?: string): Scene => {
  console.log(`[convertApiSceneToScene] 🔍 场景${index + 1} 原始数据:`, {
    type: apiScene.type,
    reference_asset_path: apiScene.reference_asset_path,
    scene_id: apiScene.scene_id,
    script_content: apiScene.script_content,
    hasSceneId: 'scene_id' in apiScene,
    hasScriptContent: 'script_content' in apiScene
  });
  
  // 检测是数据库格式还是API格式
  const isDbFormat = 'scene_id' in apiScene || 'script_content' in apiScene;
  
  if (isDbFormat) {
    // 数据库格式
    const duration = apiScene.estimated_duration || apiScene.duration || 5;
    
    // 处理场景类型
    // 兼容两种类型格式：
    // 1. 标准格式：'mixed_media' | 'ai_generated'（API/数据库标准）
    // 2. 前端格式：'real' | 'ai' | 'empty'（前端内部使用）
    let sceneType: 'ai' | 'real' | 'empty' = 'empty';
    if (apiScene.type === 'mixed_media' || apiScene.type === 'real') {
      sceneType = 'real';
      console.log(`[convertApiSceneToScene] ✅ 场景${index + 1}: 数据库格式 - 实拍视频 (${apiScene.type})`);
    } else if (apiScene.type === 'ai_generated' || apiScene.type === 'ai') {
      sceneType = 'ai';
      console.log(`[convertApiSceneToScene] ✅ 场景${index + 1}: 数据库格式 - AI生成 (${apiScene.type})`);
    } else {
      sceneType = apiScene.type || 'empty';
      console.log(`[convertApiSceneToScene] ⚠️ 场景${index + 1}: 数据库格式 - 未知类型:`, apiScene.type);
    }
    
    // 处理素材路径
    let assetUrl = apiScene.asset_url || apiScene.assetUrl;
    if (apiScene.reference_asset_path) {
      assetUrl = apiScene.reference_asset_path;
      console.log(`[convertApiSceneToScene] 📎 场景${index + 1}: 使用 reference_asset_path:`, assetUrl);
    }
    
    return {
      id: apiScene.scene_id || index + 1,
      type: sceneType,
      script: apiScene.script_content || apiScene.narration || '',
      duration: String(duration),
      narration: apiScene.narration,
      isAiGenerated: sceneType === 'ai',
      
      // AI 生成相关
      visualPrompt: apiScene.visual_description || '',
      motionPrompt: apiScene.camera_movement || apiScene.cameraMovement || apiScene.motion_prompt || apiScene.motionPrompt || '',
      generationStatus: (apiScene.generation_status || (assetUrl ? 'image_selected' : 'idle')) as any,
      
      // ⭐ 图片分辨率设置（根据画幅比例）
      imageResolution: apiScene.imageResolution || getImageResolutionByAspectRatio(aspectRatio),
      
      // 素材相关
      assetUrl: assetUrl,
      videoUrl: apiScene.video_url || apiScene.videoUrl,
      footageStatus: assetUrl ? 'filled' : 'empty',
      
      // 剪辑相关
      clipStartTime: apiScene.clip_start_time || apiScene.clip_start || 0,
      clipEndTime: apiScene.clip_end_time || apiScene.clip_end || duration,
      
      // 后期处理
      postProcessing: apiScene.post_processing || {},
      transitionType: (apiScene.transition_type || 'none') as any,
      
      // AI 创意说明
      designReason: apiScene.design_reason || apiScene.designReason,
      creativeNotes: apiScene.creative_notes || apiScene.creativeNotes,
      
      // 意图驱动标签（从后端生成）
      intentTags: apiScene.intentTags || apiScene.intent_tags,

      // 分镜板详情字段（LLM 生成，兼容 snake_case 和 camelCase）
      size: apiScene.shot_size || apiScene.shotSize || apiScene.size || '',
      perspective: apiScene.perspective || '',
      equipment: apiScene.equipment || '',
      focalLength: apiScene.focal_length || apiScene.focalLength || '',
      dialogue: apiScene.dialogue || '',
      notes: apiScene.notes || '',
    };
  } else {
    // API 格式 (脚本生成)
    const duration = parseInt(apiScene.duration) || parseInt(apiScene.estimated_duration) || 5;
    
    // 处理场景类型
    // type: "mixed_media" -> 实拍视频素材
    // type: "ai_generated" + reference_asset_path -> 图生视频
    // type: "ai_generated" + 无reference_asset_path -> 纯AI生成
    let sceneType: 'ai' | 'real' | 'empty' = 'empty';
    let assetUrl = apiScene.assetUrl;
    let footageStatus: 'empty' | 'filled' = 'empty';
    let generationStatus: any = 'idle';
    
    // 兼容多种素材字段名：reference_asset_path, assetUrl, asset_url
    const assetPath = apiScene.reference_asset_path || apiScene.assetUrl || apiScene.asset_url;
    
    if (apiScene.type === 'mixed_media' && assetPath) {
      // 实拍视频素材
      sceneType = 'real';
      assetUrl = assetPath;
      footageStatus = 'filled';
      console.log(`[convertApiSceneToScene] 场景${index + 1}: 实拍视频素材 (mixed_media)`, assetUrl);
    } else if (apiScene.type === 'ai_generated' && assetPath) {
      // 图生视频（图片素材）
      sceneType = 'ai';
      assetUrl = assetPath;
      footageStatus = 'filled';
      generationStatus = 'image_selected'; // 已有图片素材，可直接进入图生视频
      console.log(`[convertApiSceneToScene] 场景${index + 1}: 图片素材，需要图生视频`, assetUrl);
    } else if (apiScene.type === 'ai_generated') {
      // 纯AI生成
      sceneType = 'ai';
      generationStatus = 'idle'; // 需要先生成图片再生成视频
      console.log(`[convertApiSceneToScene] 场景${index + 1}: 纯AI生成`);
    }
    
    return {
      id: index + 1,
      type: sceneType,
      script: apiScene.script_content || apiScene.narration || '',
      duration: String(duration),
      narration: apiScene.script_content || apiScene.narration || '',
      isAiGenerated: sceneType === 'ai',
      
      // AI 生成相关
      visualPrompt: apiScene.visual_description || '',
      motionPrompt: apiScene.camera_movement || apiScene.cameraMovement || apiScene.motionPrompt || '',
      generationStatus: generationStatus,
      
      // ⭐ 图片分辨率设置（根据画幅比例）
      imageResolution: getImageResolutionByAspectRatio(aspectRatio),
      
      // 素材相关
      assetUrl: assetUrl,
      videoUrl: apiScene.videoUrl,
      footageStatus: footageStatus,
      
      // 剪辑相关
      clipStartTime: apiScene.clip_start_time || apiScene.clip_start || 0,
      clipEndTime: apiScene.clip_end_time || apiScene.clip_end || duration,
      
      // 后期处理
      postProcessing: {},
      transitionType: 'none',
      
      // AI 创意说明
      designReason: apiScene.design_reason || apiScene.designReason,
      creativeNotes: apiScene.creative_notes || apiScene.creativeNotes,
      
      // 意图驱动标签（从后端生成）
      intentTags: apiScene.intentTags || apiScene.intent_tags,

      // 分镜板详情字段（LLM 生成，兼容 snake_case 和 camelCase）
      size: apiScene.shot_size || apiScene.shotSize || apiScene.size || '',
      perspective: apiScene.perspective || '',
      equipment: apiScene.equipment || '',
      focalLength: apiScene.focal_length || apiScene.focalLength || '',
      dialogue: apiScene.dialogue || '',
      notes: apiScene.notes || '',
    };
  }
};

/**
 * 删除确认模态框
 */
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border p-6 rounded-lg shadow-lg w-[400px] animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 text-destructive mb-4">
          <AlertTriangle size={24} />
          <h3 className="text-lg font-semibold">确认删除场景？</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          此操作无法撤销。该场景及其所有设置将被永久删除。
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 批量生成确认对话框
 */
const BatchGenerationConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  type,
  count
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
  type: 'image' | 'video';
  count: number;
}) => {
  if (!isOpen) return null;

  const title = type === 'image' ? '确认批量生成图片' : '确认批量生成视频';
  const icon = type === 'image' ? <ImagePlus size={24} className="text-primary" /> : <Video size={24} className="text-primary" />;
  const message = type === 'image' 
    ? `将为 ${count} 个场景生成图片` 
    : `将为 ${count} 个场景生成视频`;
  const warning = type === 'image'
    ? '这可能需要几分钟时间。'
    : '这可能需要较长时间。';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border p-6 rounded-lg shadow-lg w-[400px] animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          {icon}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="mb-6">
          <p className="text-sm text-foreground mb-2">{message}</p>
          <p className="text-sm text-muted-foreground">{warning}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 批量生成结果对话框
 */
const BatchGenerationResultModal = ({ 
  isOpen, 
  onClose,
  type,
  successCount,
  failCount
}: { 
  isOpen: boolean; 
  onClose: () => void;
  type: 'image' | 'video';
  successCount: number;
  failCount: number;
}) => {
  if (!isOpen) return null;

  const title = type === 'image' ? '批量生成图片完成！' : '批量生成视频完成！';
  const icon = type === 'image' ? <ImagePlus size={24} className="text-primary" /> : <Video size={24} className="text-primary" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border p-6 rounded-lg shadow-lg w-[400px] animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          {icon}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between py-2 px-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <span className="text-sm font-medium text-foreground">成功</span>
            <span className="text-lg font-bold text-green-600">{successCount} 个场景</span>
          </div>
          <div className="flex items-center justify-between py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-md">
            <span className="text-sm font-medium text-foreground">失败</span>
            <span className="text-lg font-bold text-red-600">{failCount} 个场景</span>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 脚本生成加载遮罩 (实时进度版)
// ============================================================
const ScriptGenerationLoadingOverlay = ({ taskStatus }: { taskStatus: ScriptTaskStatus | null }) => {
  const steps = useMemo(() => [
    { id: 'initializing', title: '准备创作环境', icon: <Sparkles size={16} /> },
    { id: 'analyzing_assets', title: 'AI 视觉分析素材', icon: <BrainCircuit size={16} /> },
    { id: 'generating', title: '构思分镜脚本', icon: <LayoutTemplate size={16} /> },
    { id: 'completed', title: '生成完成', icon: <CheckCircle2 size={16} /> },
  ], []);

  // 计算当前步骤索引
  const currentStepIndex = useMemo(() => {
    if (!taskStatus) return 0;
    if (taskStatus.status === 'completed') return steps.length;
    
    // generating covers "parsing" too effectively for user
    if (taskStatus.step === 'parsing') return 2; 
    
    const idx = steps.findIndex(s => s.id === taskStatus.step);
    return idx >= 0 ? idx : 0;
  }, [taskStatus, steps]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-[480px] p-8 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI 正在创作脚本
            </h3>
            <p className="text-xs text-muted-foreground">
              正在分析您的需求并构建分镜画面
            </p>
          </div>

          {/* Steps List */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;

              return (
                <div key={step.id} className="relative">
                  <div className={`flex items-center gap-3 ${isPending ? 'opacity-30' : 'opacity-100'} transition-opacity duration-300`}>
                    {/* Icon Box */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 z-10 bg-card
                      ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : ''}
                      ${isCurrent ? 'bg-primary/10 border-primary/50 text-primary scale-110 shadow-[0_0_10px_rgba(var(--primary),0.3)]' : ''}
                      ${isPending ? 'bg-muted border-border text-muted-foreground' : ''}
                    `}>
                      {isCompleted ? <CheckCircle2 size={14} /> : step.icon}
                    </div>

                    {/* Text Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                          {step.title}
                        </span>
                        {isCurrent && taskStatus && (
                           <span className="text-[10px] text-primary font-mono opacity-80">
                             {taskStatus.progress}%
                           </span>
                        )}
                      </div>
                      
                      {/* Progress Bar for Current Step */}
                      {isCurrent && (
                        <div className="mt-1 space-y-1.5 animate-in slide-in-from-left-2 duration-300">
                           <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-primary rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: `${taskStatus?.progress || 0}%` }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                              />
                           </div>
                           <div className="text-[10px] text-muted-foreground">
                              {taskStatus?.details || '处理中...'}
                           </div>
                        </div>
                      )}
                      
                      {/* Completed State Line */}
                      {isCompleted && (
                        <div className="h-0.5 w-full bg-primary/20 rounded-full mt-2" />
                      )}
                    </div>
                  </div>
                  
                  {/* Connecting Line */}
                  {index < steps.length - 1 && (
                    <div className={`
                      absolute left-4 top-8 w-px h-6 -ml-px transition-colors duration-300 -z-0
                      ${index < currentStepIndex ? 'bg-primary' : 'bg-border/50'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 批量生成加载遮罩
// ============================================================
const BatchGenerationLoadingOverlay = ({ 
  type, 
  progress 
}: { 
  type: 'image' | 'video'; 
  progress: { current: number; total: number; currentSceneId: number | null } 
}) => {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const title = type === 'image' ? '批量生成图片中' : '批量生成视频中';
  const icon = type === 'image' ? <ImagePlus size={20} /> : <Video size={20} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-[480px] p-8 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="text-primary">{icon}</div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {title}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              正在处理场景，请稍候...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.currentSceneId && `场景 ${progress.currentSceneId}`}
              </span>
              <span className="text-primary font-semibold">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="relative w-full h-2 bg-muted/20 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-primary">{percentage}%</span>
            </div>
          </div>

          {/* Status Message */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {type === 'image' 
                ? '每个场景约需要 10-20 秒生成图片...' 
                : '每个场景约需要 30-60 秒生成视频...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 音频创作加载遮罩 (实时进度版)
// ============================================================
const MusicCreationLoadingOverlay = ({ taskStatus }: { taskStatus: musicCreationApi.TaskStatus | null }) => {
  const steps = useMemo(() => [
    { id: 'preparing', title: '准备分镜素材', icon: <LayoutTemplate size={16} /> },
    { id: 'concatenating', title: '视频智能拼接', icon: <FileVideo size={16} /> },
    { id: 'uploading', title: '上传云端存储', icon: <UploadCloud size={16} /> },
    { id: 'analyzing', title: 'AI 视觉分析', icon: <BrainCircuit size={16} /> },
    { id: 'completed', title: '生成配乐蓝图', icon: <Music size={16} /> },
  ], []);

  // 计算当前步骤索引
  const currentStepIndex = useMemo(() => {
    if (!taskStatus) return 0;
    if (taskStatus.status === 'completed' || taskStatus.step === 'completed') return steps.length;
    return steps.findIndex(s => s.id === taskStatus.step);
  }, [taskStatus, steps]);

  // 获取当前步骤的子进度信息
  const subProgressInfo = useMemo(() => {
    if (!taskStatus?.subProgress) return null;
    return taskStatus.subProgress;
  }, [taskStatus]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl w-[480px] p-8 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI 音频创作中
            </h3>
            <p className="text-xs text-muted-foreground">
              正在为您生成专属的配乐方案
            </p>
          </div>

          {/* Steps List */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;

              return (
                <div key={step.id} className="relative">
                  <div className={`flex items-center gap-3 ${isPending ? 'opacity-30' : 'opacity-100'} transition-opacity duration-300`}>
                    {/* Icon Box */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 z-10 bg-card
                      ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : ''}
                      ${isCurrent ? 'bg-primary/10 border-primary/50 text-primary scale-110 shadow-[0_0_10px_rgba(var(--primary),0.3)]' : ''}
                      ${isPending ? 'bg-muted border-border text-muted-foreground' : ''}
                    `}>
                      {isCompleted ? <CheckCircle2 size={14} /> : step.icon}
                    </div>

                    {/* Text Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                          {step.title}
                        </span>
                        {isCurrent && taskStatus && (
                           <span className="text-[10px] text-primary font-mono opacity-80">
                             {taskStatus.progress}%
                           </span>
                        )}
                      </div>
                      
                      {/* Sub-status / Progress Bar */}
                      {isCurrent && subProgressInfo && taskStatus && (
                        <div className="mt-1 space-y-1.5 animate-in slide-in-from-left-2 duration-300">
                           {/* Progress Bar Background */}
                           <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-primary rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: `${taskStatus.progress}%` }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                              />
                           </div>
                           
                           {/* Detailed Info */}
                           <div className="flex justify-between items-end text-[10px] text-muted-foreground">
                              <span>{subProgressInfo.item || taskStatus.details}</span>
                              {subProgressInfo.total > 0 && (
                                <span className="font-mono">
                                  {subProgressInfo.current}/{subProgressInfo.total}
                                </span>
                              )}
                           </div>
                        </div>
                      )}
                      
                      {/* Completed State Line */}
                      {isCompleted && (
                        <div className="h-0.5 w-full bg-primary/20 rounded-full mt-2" />
                      )}
                    </div>
                  </div>
                  
                  {/* Connecting Line */}
                  {index < steps.length - 1 && (
                    <div className={`
                      absolute left-4 top-8 w-px h-6 -ml-px transition-colors duration-300 -z-0
                      ${index < currentStepIndex ? 'bg-primary' : 'bg-border/50'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Info */}
          <div className="text-center pt-2 border-t border-border/50 mt-2">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 text-primary/70 text-[10px]">
                {taskStatus?.status === 'error' ? (
                  <>
                     <AlertTriangle size={10} />
                     <span className="text-destructive">{taskStatus.error || '发生错误'}</span>
                  </>
                ) : (
                  <>
                     <Loader2 size={10} className="animate-spin" />
                     {taskStatus?.details || '正在初始化...'}
                  </>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LocationState {
  scriptData?: ScriptResponse;
  userPrompt?: string;
  projectTitle?: string;
  title?: string;
  projectId?: string;
  uploadedAssets?: any[];
  generationMode?: string;
  creationIntent?: CreationIntent;
  inspirationProposal?: any; // 灵感激发模式选择的方案
  
  isGenerating?: boolean; // 标记是否需要触发脚本生成
  needExpandScript?: boolean; // 新增：标记灵感方案需要扩展为详细脚本
  
  // 从脚本编辑页面传递的参数
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3'; // ⭐ 画幅比例
  artStyle?: string; // 艺术风格
  customStyleImage?: File; // 自定义风格图片
  customScenes?: any[]; // 用户编辑的场景数据
  inspirationData?: any; // 灵感数据（包含proposal、visualStyle等）
}

// ============================================================
// 主组件
// ============================================================
export const VisualStoryboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从 location.state 和 URL 获取数据
  const locationState = location.state as LocationState | null;
  const intentFromRoute = locationState?.creationIntent;
  const scriptData = locationState?.scriptData;
  const userPrompt = intentFromRoute?.prompt || locationState?.userPrompt;
  const uploadedAssets = intentFromRoute?.uploadedAssets || locationState?.uploadedAssets;
  const generationMode = intentFromRoute?.generationMode || locationState?.generationMode;
  const inspirationProposal = intentFromRoute?.selectedProposal || locationState?.inspirationProposal; // 灵感方案
  const shouldGenerate = locationState?.isGenerating; // 是否需要生成脚本
  
  // ⭐ 从脚本编辑页面传递的参数
  const aspectRatioFromScript = intentFromRoute?.aspectRatio || locationState?.aspectRatio; // 画幅比例
  const artStyleFromScript = intentFromRoute?.artStyle || locationState?.artStyle; // 艺术风格
  const customScenesFromScript = locationState?.customScenes; // 用户编辑的场景
  const inspirationDataFromScript = locationState?.inspirationData; // 灵感数据
  
  console.log('[VisualStoryboardPage] 📐 接收到的画幅比例:', aspectRatioFromScript);
  
  // 从 URL 参数或 state 获取 projectId
  const urlParams = new URLSearchParams(location.search);
  const urlProjectId = urlParams.get('projectId');
  const stateProjectId = locationState?.projectId;
  const projectId = stateProjectId || urlProjectId;
  
  console.log('[VisualStoryboardPage] 🔑 项目ID信息:', {
    urlProjectId,
    stateProjectId,
    finalProjectId: projectId,
    hasProjectId: !!projectId
  });

  // 控制何时保存到 localStorage
  const [shouldSaveToStorage, setShouldSaveToStorage] = useState(!shouldGenerate);
  
  // 项目加载状态
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [loadProjectError, setLoadProjectError] = useState<string | null>(null);

  // 脚本生成状态
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [scriptTaskStatus, setScriptTaskStatus] = useState<ScriptTaskStatus | null>(null);
  
  // 保存生成参数以支持重新生成
  const [savedUserPrompt, setSavedUserPrompt] = useState<string | undefined>(userPrompt);
  const [savedUploadedAssets, setSavedUploadedAssets] = useState<any[] | undefined>(uploadedAssets);
  const [savedGenerationMode, setSavedGenerationMode] = useState<string | undefined>(generationMode);
  const [workbenchIntent, setWorkbenchIntent] = useState<CreationIntent | null>(intentFromRoute || null);
  const [workbenchAspectRatio, setWorkbenchAspectRatio] = useState<CreationAspectRatio>(
    (aspectRatioFromScript || DEFAULT_CREATION_ASPECT_RATIO) as CreationAspectRatio
  );
  const [workbenchArtStyle, setWorkbenchArtStyle] = useState(artStyleFromScript || DEFAULT_CREATION_ART_STYLE);
  const [isQuickAutomationPaused, setIsQuickAutomationPaused] = useState(false);
  const quickAutomationStartedRef = useRef(false);
  const [agentPreview, setAgentPreview] = useState<AgentCardFeedback | null>(null);
  const [agentApplied, setAgentApplied] = useState<AgentCardFeedback | null>(null);
  const agentAppliedTimerRef = useRef<number | null>(null);

  // ============================================================
  // 初始化数据（优先级处理）
  // ============================================================
  const initialData: { scenes: Scene[]; title: string; selectedId: number | null } = useMemo(() => {
    // Priority 0: 使用从脚本编辑页面传递的自定义场景（最高优先级）
    if (customScenesFromScript && Array.isArray(customScenesFromScript) && customScenesFromScript.length > 0) {
      console.log('[VisualStoryboardPage] ✨ 使用脚本编辑页面的自定义场景，共', customScenesFromScript.length, '个场景');
      
      // 将 ScriptEditorPage 的 SceneItem 格式转换为 VisualStoryboardPage 的 Scene 格式
      const scenes: Scene[] = customScenesFromScript.map((sceneItem: any, index: number) => {
        // 确定场景类型
        let sceneType: 'ai' | 'real' = 'ai';
        if (sceneItem.assetType === 'real_footage' || sceneItem.assetType === 'image') {
          sceneType = 'real';
        }
        const linkedAssetUrl = sceneItem.assetUrl
          || sceneItem.reference_asset_path
          || (sceneItem.assetId ? uploadedAssets?.find((a: any) => a.id === sceneItem.assetId)?.url : undefined);
        
        return {
          id: index + 1,
          type: sceneType,
          duration: sceneItem.duration ? `${sceneItem.duration}s` : '5s',
          script: sceneItem.description || '',
          narration: sceneItem.narration || '',
          isAiGenerated: true,
          visualPrompt: sceneItem.visualPrompt || `${sceneItem.description}. ${sceneItem.visualStyle || ''}`,
          motionPrompt: sceneItem.motionPrompt || sceneItem.cameraMovement || '',
          generationStatus: linkedAssetUrl ? 'image_selected' as const : 'idle' as const,
          footageStatus: linkedAssetUrl ? 'filled' as const : 'empty' as const,
          assetUrl: linkedAssetUrl,
          imageResolution: getImageResolutionByAspectRatio(aspectRatioFromScript),
          postProcessing: {},
          transitionType: 'none' as const,
          // 如果有关联的素材
          // 摄影参数（从脚本编辑页透传）
          size: sceneItem.size || '',
          perspective: sceneItem.perspective || '',
          equipment: sceneItem.equipment || '',
          focalLength: sceneItem.focalLength || '',
          dialogue: sceneItem.dialogue || '',
          notes: sceneItem.notes || '',
          // 添加创意说明
          designReason: sceneItem.designReason || '',
          creativeNotes: [
            sceneItem.visualStyle ? `视觉风格: ${sceneItem.visualStyle}` : '',
            sceneItem.bgmStyle ? `配乐风格: ${sceneItem.bgmStyle}` : '',
            sceneItem.cameraMovement ? `镜头运动: ${sceneItem.cameraMovement}` : ''
          ].filter((note): note is string => !!note) // 过滤掉空字符串
        };
      });
      
      // 使用灵感数据中的标题,或者使用自定义标题
      const title: string =
        inspirationDataFromScript?.proposal?.title ||
        locationState?.projectTitle ||
        locationState?.title ||
        scriptData?.title ||
        '未命名项目';
      
      return {
        scenes: scenes,
        title: title,
        selectedId: 1
      };
    }
    
    // Priority 1: 使用灵感方案数据（从灵感激发模式选择方案后）
    if (inspirationProposal && shouldGenerate) {
      const needExpand = locationState?.needExpandScript;
      
      if (needExpand) {
        // 需要扩展：先返回 loading 状态，等待 useEffect 调用 AI
        console.log('[VisualStoryboardPage] ✨ 灵感方案需要扩展，返回加载状态');
        return {
          scenes: [],
          title: '正在生成详细脚本...',
          selectedId: null
        };
      } else {
        // 不需要扩展：直接使用简洁版（降级）
        console.log('[VisualStoryboardPage] ⚠️ 使用简洁版灵感方案');
        
        // 将灵感方案转换为场景
        const scenes: Scene[] = inspirationProposal.roughScript.scenes.map((scene: any, index: number) => ({
          id: index + 1,
          type: 'ai' as const,
          duration: `${scene.duration || 5}s`,
          script: scene.description,
          narration: scene.narration || '',
          isAiGenerated: true,
          visualPrompt: `${scene.description}. ${inspirationProposal.visualStyle || ''}. ${scene.visualStyle || ''}`,
          motionPrompt: scene.cameraMovement || scene.camera_movement || '',
          generationStatus: (scene.assetPath || scene.reference_asset_path) ? 'image_selected' as const : 'idle' as const,
          footageStatus: (scene.assetPath || scene.reference_asset_path) ? 'filled' as const : 'empty' as const,
          assetUrl: scene.assetPath || scene.reference_asset_path || undefined,
          // 摄影参数
          size: scene.size || scene.shot_size || '',
          perspective: scene.perspective || '',
          equipment: scene.equipment || '',
          focalLength: scene.focalLength || scene.focal_length || '',
          dialogue: scene.dialogue || '',
          notes: scene.notes || '',
          // 创意说明
          designReason: inspirationProposal.reasoning,
          creativeNotes: [
            `风格: ${scene.visualStyle || inspirationProposal.visualStyle}`,
            `配乐: ${scene.bgmStyle || inspirationProposal.bgmStyle}`,
          ]
        }));

        return {
          scenes: scenes,
          title: inspirationProposal.title,
          selectedId: 1
        };
      }
    }

    // Priority 2: 使用新生成的脚本数据（从首页点击"开始创作"后）
    if (scriptData && shouldGenerate) {
      console.log('[VisualStoryboardPage] ✅ 使用新生成的脚本数据');
      return {
        scenes: scriptData.scenes.map((apiScene, index) => convertApiSceneToScene(apiScene, index, aspectRatioFromScript)),
        title: scriptData.title,
        selectedId: 1
      };
    }

    // Priority 3: 从URL加载项目（如果提供了projectId）
    // 注意：这里只返回初始空状态，实际加载在useEffect中进行
    if (projectId) {
      console.log('[VisualStoryboardPage] ⏳ 准备加载项目:', projectId);
      // 禁用localStorage缓存，直接返回空状态等待从数据库加载
      // const cached = loadFromStorage();
      // if (cached) return cached;
      
      // 返回空状态等待加载
      return {
        scenes: [],
        title: '加载中...',
        selectedId: null
      };
    }

    // Priority 4: 如果是从重新生成/编辑后的状态进入（location.state），可能没有scriptData但有scenes
    // 这里其实跟Priority 2类似，暂时保留逻辑

    // Priority 5: 禁用localStorage恢复，改为只从数据库还原
    // const savedData = loadFromStorage();
    // if (savedData) {
    //   // 恢复保存的生成参数
    //   if (savedData.userPrompt) setSavedUserPrompt(savedData.userPrompt);
    //   if (savedData.uploadedAssets) setSavedUploadedAssets(savedData.uploadedAssets);
    //   if (savedData.generationMode) setSavedGenerationMode(savedData.generationMode);
    //
    //   return savedData;
    // }

    // Priority 6: 使用默认数据（直接访问或无其他数据）
    console.log('[VisualStoryboardPage] ✅ 使用默认场景数据');
    // const defaultScenes = ... (removed strict dependency, using empty if needed)
    return {
      scenes: [], 
      title: '新建项目',
      selectedId: 1
    };
  }, [scriptData, shouldGenerate, userPrompt, projectId, customScenesFromScript, aspectRatioFromScript, inspirationDataFromScript, uploadedAssets, locationState?.projectTitle, locationState?.title]);

  // ============================================================
  // 状态管理
  // ============================================================
  const [projectTitle, setProjectTitle] = useState(initialData.title);
  const [scenes, setScenes] = useState<Scene[]>(initialData.scenes);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(initialData.selectedId);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<videoExportApi.ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<videoExportApi.ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [sceneToDelete, setSceneToDelete] = useState<number | null>(null);
  
  // 交互状态：悬停和展开
  const [hoveredSceneId, setHoveredSceneId] = useState<number | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  
  // 批量生成状态
  const [isBatchGeneratingImages, setIsBatchGeneratingImages] = useState(false);
  const [isBatchGeneratingVideos, setIsBatchGeneratingVideos] = useState(false);
  const [batchGenerationProgress, setBatchGenerationProgress] = useState<{
    current: number;
    total: number;
    currentSceneId: number | null;
  }>({ current: 0, total: 0, currentSceneId: null });
  
  // 视频播放弹窗
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

  // 批量生成弹窗状态
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  const [showBatchResultModal, setShowBatchResultModal] = useState(false);
  const [batchModalConfig, setBatchModalConfig] = useState<{
    type: 'image' | 'video';
    count: number;
    successCount: number;
    failCount: number;
  }>({ type: 'image', count: 0, successCount: 0, failCount: 0 });

  // 可调整侧边栏宽度（新 UI 不再使用，保留避免报错）
  const leftSidebarWidth = 250;
  const rightSidebarWidth = 300;
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // ── 新 UI 状态 ──────────────────────────────────────────────
  const [storyboardMode, setStoryboardMode] = useState<'image' | 'video'>('image');
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [aiDirectorInput, setAiDirectorInput] = useState('');
  const [draggedShotIdx, setDraggedShotIdx] = useState<number | null>(null);

  // ── AI Director 对话状态 ──────────────────────────────────
  const [aiDirectorMessages, setAiDirectorMessages] = useState<Array<{role: 'user' | 'assistant'; content: string}>>([]);
  const [aiDirectorHistory, setAiDirectorHistory] = useState<AiChatMessage[]>([]);
  const [isAiDirectorLoading, setIsAiDirectorLoading] = useState(false);
  const aiDirectorAbortRef = useRef<AbortController | null>(null);
  const aiDirectorChatEndRef = useRef<HTMLDivElement | null>(null);

  const getWorkbenchIntentForSave = useCallback((): CreationIntent | null => {
    if (workbenchIntent) {
      return {
        ...workbenchIntent,
        prompt: savedUserPrompt || workbenchIntent.prompt,
        uploadedAssets: (savedUploadedAssets as any) || workbenchIntent.uploadedAssets,
        generationMode: (savedGenerationMode as any) || workbenchIntent.generationMode,
        selectedProposal: workbenchIntent.selectedProposal || inspirationProposal,
        aspectRatio: workbenchAspectRatio,
        artStyle: workbenchArtStyle,
      };
    }

    if (!savedUserPrompt && !inspirationProposal && !(savedUploadedAssets && savedUploadedAssets.length > 0)) {
      return null;
    }

    return createCreationIntent({
      inputMode: savedUploadedAssets && savedUploadedAssets.length > 0 ? 'assets' : 'article',
      publishGoal: 'refine_handoff',
      prompt: savedUserPrompt || '',
      uploadedAssets: (savedUploadedAssets as any) || [],
      generationMode: (savedGenerationMode as any) || 'ai_generated',
      selectedProposal: inspirationProposal,
      proposals: inspirationProposal ? [inspirationProposal] : [],
      aspectRatio: workbenchAspectRatio,
      artStyle: workbenchArtStyle,
    });
  }, [
    inspirationProposal,
    savedGenerationMode,
    savedUploadedAssets,
    savedUserPrompt,
    workbenchArtStyle,
    workbenchAspectRatio,
    workbenchIntent,
  ]);

  const buildStoryboardSaveContext = useCallback(() => {
    const intent = getWorkbenchIntentForSave();
    if (!intent) {
      return {
        userPrompt: savedUserPrompt,
        uploadedAssets: savedUploadedAssets,
        generationMode: savedGenerationMode,
        aspectRatio: workbenchAspectRatio,
        artStyle: workbenchArtStyle,
      };
    }

    return {
      ...buildCreationSettings(intent),
      userPrompt: intent.prompt,
      uploadedAssets: intent.uploadedAssets,
      generationMode: intent.generationMode,
      assetTheme: intent.assetTheme,
      selectedProposal: intent.selectedProposal,
      proposalAlternatives: intent.proposalAlternatives,
      publishGoal: intent.publishGoal,
      inputMode: intent.inputMode,
      aspectRatio: intent.aspectRatio,
      artStyle: intent.artStyle,
      flowVersion: intent.flowVersion,
      creationIntent: intent,
    };
  }, [
    getWorkbenchIntentForSave,
    savedGenerationMode,
    savedUploadedAssets,
    savedUserPrompt,
    workbenchArtStyle,
    workbenchAspectRatio,
  ]);

  // ============================================================
  // 处理侧边栏拖动调整宽度
  // ============================================================
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        // 新 UI 不再使用可调整宽度，保留空逻辑
        void e.clientX;
      }
      if (isResizingRight) {
        // 新 UI 不再使用可调整宽度，保留空逻辑
        void e.clientX;
      }
    };

    const handleMouseUp = () => {
      if (isResizingLeft || isResizingRight) {
        setIsResizingLeft(false);
        setIsResizingRight(false);
        document.body.style.cursor = '';
      }
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  // 自动滚动到 AI Director 对话底部
  useEffect(() => {
    if (aiDirectorChatEndRef.current) {
      aiDirectorChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiDirectorMessages, isAiDirectorLoading]);

  // ... (keeping other handlers same)

  // ============================================================
  // 扩展灵感方案为详细脚本（调用AI）
  // ============================================================
  useEffect(() => {
    const expandInspirationScript = async () => {
      // 检查是否需要扩展脚本
      const needExpand = locationState?.needExpandScript;
      if (!inspirationProposal || !needExpand || !projectId) {
        return;
      }

      // 避免重复调用
      if (isGeneratingScript || scenes.length > 0) {
        return;
      }

      console.log('[VisualStoryboardPage] ✨ 开始扩展灵感脚本...');
      setIsGeneratingScript(true);
      setGenerateError(null);

      try {
        // 调用 API 扩展脚本
        const result = await expandProposalToScript({
          proposal: inspirationProposal,
          userPrompt: savedUserPrompt || '',
          assets: savedUploadedAssets || []
        });

        if (result.success && result.data && result.data.scenes) {
          console.log('[VisualStoryboardPage] ✅ 脚本扩展成功，场景数:', result.data.scenes.length);
          
          // 转换 API 返回的场景格式为前端 Scene 格式
          const detailedScenes: Scene[] = result.data.scenes.map((apiScene: any, index: number) => ({
            id: index + 1,
            type: (apiScene.type === 'mixed_media' ? 'real' : 'ai') as 'ai' | 'real',
            duration: `${apiScene.estimated_duration || 5}s`,
            script: apiScene.script_content || apiScene.visual_description || '',
            narration: apiScene.narration || '',
            isAiGenerated: apiScene.type !== 'mixed_media',
            visualPrompt: apiScene.visual_description || '',
            motionPrompt: apiScene.camera_movement || '',
            generationStatus: apiScene.reference_asset_path ? 'image_selected' as const : 'idle' as const,
            footageStatus: apiScene.reference_asset_path ? 'filled' : 'empty',
            assetUrl: apiScene.reference_asset_path || undefined,
            // 摄影参数（来自后端 expandProposalToScript 透传的字段）
            size: apiScene.shot_size || '',
            perspective: apiScene.perspective || '',
            equipment: apiScene.equipment || '',
            focalLength: apiScene.focal_length || '',
            dialogue: apiScene.dialogue || '',
            notes: apiScene.notes || '',
            designReason: inspirationProposal.reasoning,
            creativeNotes: [
              `风格: ${inspirationProposal.visualStyle}`,
              `配乐: ${inspirationProposal.bgmStyle}`,
            ]
          }));

          // 更新场景
          setScenes(detailedScenes);
          setProjectTitle(result.data.title || inspirationProposal.title);
          if (detailedScenes.length > 0) {
            setSelectedSceneId(detailedScenes[0].id);
          }

          // 立即保存到数据库
          console.log('[VisualStoryboardPage] 💾 保存扩展后的脚本到数据库...');
          const normalizedScenes = detailedScenes.map(scene => normalizeSceneForSave(scene));
          const saveResult = await saveStoryboard(projectId, {
            scenes: normalizedScenes,
            title: result.data.title || inspirationProposal.title,
            ...buildStoryboardSaveContext(),
          });

          if (saveResult.success) {
            console.log('[VisualStoryboardPage] ✅ 扩展脚本已成功保存到数据库');
            // 清除导航标记
            sessionStorage.removeItem('storyboard_navigation_flag');
          }

        } else {
          throw new Error('脚本扩展失败：返回数据异常');
        }

      } catch (error) {
        console.error('[VisualStoryboardPage] ❌ 扩展脚本失败:', error);
        setGenerateError(error instanceof Error ? error.message : '扩展脚本失败');
        
        // 失败时使用简洁版本（降级处理）
        console.log('[VisualStoryboardPage] ⚠️ 降级使用简洁版分镜');
        const fallbackScenes: Scene[] = inspirationProposal.roughScript.scenes.map((scene: any, index: number) => ({
          id: index + 1,
          type: 'ai' as const,
          duration: `${scene.duration || 5}s`,
          script: scene.description,
          narration: scene.narration || '',
          isAiGenerated: true,
          visualPrompt: `${scene.description}. ${inspirationProposal.visualStyle || ''}`,
          motionPrompt: scene.cameraMovement || scene.camera_movement || '',
          generationStatus: 'idle' as const,
          footageStatus: 'empty' as const,
          // 摄影参数（直接来自灵感方案的场景）
          size: scene.size || scene.shot_size || '',
          perspective: scene.perspective || '',
          equipment: scene.equipment || '',
          focalLength: scene.focalLength || scene.focal_length || '',
          dialogue: scene.dialogue || '',
          notes: scene.notes || '',
          designReason: inspirationProposal.reasoning,
          creativeNotes: [
            `风格: ${scene.visualStyle || inspirationProposal.visualStyle}`,
            `配乐: ${scene.bgmStyle || inspirationProposal.bgmStyle}`,
          ]
        }));
        setScenes(fallbackScenes);
        setProjectTitle(inspirationProposal.title);
        if (fallbackScenes.length > 0) {
          setSelectedSceneId(fallbackScenes[0].id);
        }
        
      } finally {
        setIsGeneratingScript(false);
      }
    };

    expandInspirationScript();
  }, [inspirationProposal, locationState?.needExpandScript, projectId, isGeneratingScript, scenes.length]);

  // ============================================================
  // 灵感数据初始化后立即保存到数据库（简洁版，已由上面的扩展逻辑替代）
  // ============================================================
  useEffect(() => {
    const saveInspirationData = async () => {
      // 只在以下条件下保存：
      // 1. 有 projectId
      // 2. 有 inspirationProposal（灵感方案）
      // 3. 有 scenes 数据且不为空
      // 4. shouldGenerate 为 true（首次生成）
      // 5. 不需要扩展脚本（needExpandScript 为 false）
      const needExpand = locationState?.needExpandScript;
      if (!projectId || !inspirationProposal || scenes.length === 0 || !shouldGenerate || needExpand) {
        return;
      }

      console.log('[VisualStoryboardPage] 💾 灵感数据初始化完成，立即保存到数据库...');
      
      try {
        const normalizedScenes = scenes.map(scene => normalizeSceneForSave(scene));
        const saveResult = await saveStoryboard(projectId, {
          scenes: normalizedScenes,
          title: projectTitle,
          ...buildStoryboardSaveContext(),
        });
        
        if (saveResult.success) {
          console.log('[VisualStoryboardPage] ✅ 灵感数据已成功保存到数据库');
          // 清除导航标记，避免重复保存
          sessionStorage.removeItem('storyboard_navigation_flag');
        } else {
          console.error('[VisualStoryboardPage] ⚠️ 灵感数据保存失败:', saveResult.error);
        }
      } catch (saveError) {
        console.error('[VisualStoryboardPage] ❌ 灵感数据保存异常:', saveError);
      }
    };

    saveInspirationData();
  }, [projectId, inspirationProposal, scenes.length, shouldGenerate, projectTitle, savedUserPrompt, savedUploadedAssets, savedGenerationMode, locationState?.needExpandScript]);

  // ============================================================
  // 从数据库加载项目数据（当有 projectId 时）
  // ============================================================
  useEffect(() => {
    const loadProjectFromDatabase = async () => {
      // 只在以下条件下加载：
      // 1. 有 projectId
      // 2. 没有通过 scriptData 传入新生成的数据
      // 3. 当前没有正在加载
      if (!projectId || (scriptData && shouldGenerate) || (intentFromRoute && shouldGenerate) || isLoadingProject) {
        return;
      }

      // 检查是否是首次导航（有导航标记）还是刷新
      const navigationFlag = sessionStorage.getItem('storyboard_navigation_flag');
      
      // 如果已经从 location.state 获得了 scriptData，且是首次导航（不是刷新），直接使用
      // 如果是刷新（没有导航标记），则从数据库加载最新数据
      if (scriptData && scriptData.scenes && scriptData.scenes.length > 0 && navigationFlag) {
        console.log('[VisualStoryboardPage] ✅ 使用 location.state 传入的 scriptData（首次导航）');
        const convertedScenes = scriptData.scenes.map((apiScene: any, index: number) => 
          convertApiSceneToScene(apiScene, index, aspectRatioFromScript)
        );
        setScenes(convertedScenes);
        setProjectTitle(scriptData.title || '未命名项目');
        if (convertedScenes.length > 0) {
          setSelectedSceneId(convertedScenes[0].id);
        }
        setShouldSaveToStorage(true);
        return;
      }
      
      // 如果是刷新（没有导航标记）或没有 scriptData，从数据库加载最新数据
      if (!navigationFlag && scriptData) {
        console.log('[VisualStoryboardPage] 🔄 检测到页面刷新，忽略 location.state，从数据库加载最新数据');
      }

      console.log('[VisualStoryboardPage] 🔄 从数据库加载项目:', projectId);
      setIsLoadingProject(true);
      setLoadProjectError(null);

      try {
        const result = await getProject(projectId);
        
        if (result.success && result.data) {
          const project = result.data;
          console.log('[VisualStoryboardPage] ✅ 项目加载成功:', project.title);
          
          // 更新项目标题
          setProjectTitle(project.title || '未命名项目');
          
          // 恢复生成参数 - 重要：从数据库恢复userPrompt
          if (project.userPrompt) {
            setSavedUserPrompt(project.userPrompt);
            console.log('[VisualStoryboardPage] 📝 恢复用户提示词:', project.userPrompt.substring(0, 50) + '...');
          } else {
            // 如果没有userPrompt，尝试使用description或title作为fallback
            const fallbackPrompt = project.description || project.title || '';
            if (fallbackPrompt) {
              setSavedUserPrompt(fallbackPrompt);
              console.warn('[VisualStoryboardPage] ⚠️ 项目中没有userPrompt，使用fallback:', fallbackPrompt.substring(0, 50) + '...');
            } else {
              console.warn('[VisualStoryboardPage] ⚠️ 项目中没有userPrompt，且无法找到fallback');
            }
          }
          if (project.uploadedAssets) setSavedUploadedAssets(project.uploadedAssets);
          if (project.generationMode) setSavedGenerationMode(project.generationMode);
          const recoveredIntent = mergeCreationIntentFromProject(project);
          if (recoveredIntent) {
            setWorkbenchIntent(recoveredIntent);
            setSavedUserPrompt(recoveredIntent.prompt);
            setSavedUploadedAssets(recoveredIntent.uploadedAssets);
            setSavedGenerationMode(recoveredIntent.generationMode);
            setWorkbenchAspectRatio(recoveredIntent.aspectRatio);
            setWorkbenchArtStyle(recoveredIntent.artStyle);
          } else if (project.settings) {
            if (project.settings.aspectRatio) setWorkbenchAspectRatio(project.settings.aspectRatio);
            if (project.settings.artStyle) setWorkbenchArtStyle(project.settings.artStyle);
          }
          
          // 加载分镜数据
          if (project.storyboardData && Array.isArray(project.storyboardData) && project.storyboardData.length > 0) {
            console.log('[VisualStoryboardPage] 📋 加载分镜数据，共', project.storyboardData.length, '个场景');
            console.log('[VisualStoryboardPage] 📋 第一个场景数据:', project.storyboardData[0]);
            
            // 转换分镜数据格式
            const convertedScenes = project.storyboardData.map((sceneData: any, index: number) => {
              // 如果数据已经是 Scene 格式，需要确保类型字段正确
              if (sceneData.id && sceneData.script !== undefined) {
                console.log(`[VisualStoryboardPage] 场景${sceneData.id} 使用已有格式, type:`, sceneData.type, ', assetUrl:', sceneData.assetUrl, ', videoUrl:', sceneData.videoUrl, ', voiceoverUrl:', sceneData.voiceoverUrl, ', generationStatus:', sceneData.generationStatus);
                
                // 转换类型字段：标准格式 -> 前端格式
                let normalizedType = sceneData.type;
                if (sceneData.type === 'mixed_media') {
                  normalizedType = 'real';
                  console.log(`[VisualStoryboardPage] 场景${sceneData.id} 类型转换: mixed_media -> real`);
                } else if (sceneData.type === 'ai_generated') {
                  normalizedType = 'ai';
                  console.log(`[VisualStoryboardPage] 场景${sceneData.id} 类型转换: ai_generated -> ai`);
                  // 调试：检查AI场景的视频数据
                  if (sceneData.videoUrl) {
                    console.log(`[VisualStoryboardPage] ✅ 场景${sceneData.id} 从数据库加载了videoUrl:`, sceneData.videoUrl);
                  } else {
                    console.debug(`[VisualStoryboardPage] 场景${sceneData.id} 数据库中没有videoUrl`);
                  }
                }
                
                return {
                  ...sceneData,
                  type: normalizedType,
                  // 确保视频 URL 经过代理（避免 CDN 跨域/过期问题）
                  videoUrl: sceneData.videoUrl ? proxyVideoUrl(sceneData.videoUrl) : sceneData.videoUrl,
                } as Scene;
              }
              // 否则从 API 格式转换
              console.log(`[VisualStoryboardPage] 场景${index} 需要格式转换`);
              return convertApiSceneToScene(sceneData, index, aspectRatioFromScript);
            });
            
            console.log('[VisualStoryboardPage] ✅ 转换后的场景数据:', convertedScenes);
            setScenes(convertedScenes);
            
            // 选中第一个场景
            if (convertedScenes.length > 0) {
              setSelectedSceneId(convertedScenes[0].id);
            }
          } else {
            console.log('[VisualStoryboardPage] ⚠️ 项目没有分镜数据');
            // 如果有来自脚本编辑页的场景数据（StyleSelectionPage传入），保留已初始化的场景，不清空
            if (customScenesFromScript && customScenesFromScript.length > 0) {
              console.log('[VisualStoryboardPage] ✅ DB无分镜数据但有脚本场景数据，保留已初始化的场景，等待自动保存');
              sessionStorage.removeItem('storyboard_navigation_flag');
            } else {
              setScenes([]);
              setSelectedSceneId(null);
            }
          }
          
          // 启用保存到 localStorage
          setShouldSaveToStorage(true);
          
        } else {
          throw new Error(result.error || '加载项目失败');
        }
        
      } catch (error: any) {
        console.error('[VisualStoryboardPage] ❌ 从数据库加载项目失败:', error);
        setLoadProjectError(error.message || '加载项目失败');
        
        // 禁用localStorage降级，改为仅从数据库加载
        // 尝试从 localStorage 恢复
        // const cached = loadFromStorage();
        // if (cached) {
        //   console.log('[VisualStoryboardPage] 💾 从 localStorage 恢复数据作为降级');
        //   setScenes(cached.scenes);
        //   setProjectTitle(cached.title);
        //   setSelectedSceneId(cached.selectedId);
        // }
      } finally {
        setIsLoadingProject(false);
      }
    };

    loadProjectFromDatabase();
  }, [projectId, scriptData, shouldGenerate, customScenesFromScript, intentFromRoute]); // 依赖这些参数

  // ============================================================
  // 自动保存场景更改（防抖）
  // ============================================================
  useEffect(() => {
    // 如果没有 projectId 或者正在加载项目，不进行自动保存
    if (!projectId || isLoadingProject || scenes.length === 0) {
      return;
    }
    
    // 防抖：延迟保存，避免频繁调用
    const saveTimer = setTimeout(async () => {
      console.log('[VisualStoryboardPage] ⏰ 触发自动保存（场景更新）...');
      try {
        const normalizedScenes = scenes.map(scene => normalizeSceneForSave(scene));
        const saveResult = await saveStoryboard(projectId, {
          scenes: normalizedScenes,
          title: projectTitle,
          ...buildStoryboardSaveContext(),
        });
        if (saveResult.success) {
          console.log('[VisualStoryboardPage] ✅ 自动保存成功');
        } else {
          console.error('[VisualStoryboardPage] ⚠️ 自动保存失败:', saveResult.error);
        }
      } catch (saveError) {
        console.error('[VisualStoryboardPage] ❌ 自动保存异常:', saveError);
      }
    }, 2000); // 2秒防抖延迟
    
    return () => clearTimeout(saveTimer);
  }, [scenes, projectTitle, projectId, isLoadingProject, savedUserPrompt, savedUploadedAssets, savedGenerationMode]);

  // ============================================================
  // 页面卸载前强制保存（处理刷新/关闭页面的情况）
  // ============================================================
  useEffect(() => {
    if (!projectId || scenes.length === 0) {
      return;
    }

    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      console.log('[VisualStoryboardPage] 🔄 页面即将卸载，强制保存数据...');
      try {
        const normalizedScenes = scenes.map(scene => normalizeSceneForSave(scene));
        // 使用 sendBeacon 进行异步保存，即使页面关闭也能完成
        const data = JSON.stringify({
          scenes: normalizedScenes,
          title: projectTitle,
          ...buildStoryboardSaveContext(),
        });
        
        const blob = new Blob([data], { type: 'application/json' });
        const sent = navigator.sendBeacon(
          apiUrl(`/api/v1/project/${projectId}/storyboard`),
          blob
        );
        
        if (sent) {
          console.log('[VisualStoryboardPage] ✅ 使用 sendBeacon 发送保存请求');
        } else {
          console.warn('[VisualStoryboardPage] ⚠️ sendBeacon 发送失败，尝试同步保存');
          // 降级到同步保存
          fetch(apiUrl(`/api/v1/project/${projectId}/storyboard`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true // 保持连接直到请求完成
          }).catch(err => {
            console.error('[VisualStoryboardPage] ❌ 同步保存失败:', err);
          });
        }
      } catch (error) {
        console.error('[VisualStoryboardPage] ❌ beforeunload 保存异常:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [projectId, scenes, projectTitle, buildStoryboardSaveContext]);

  // ============================================================
  // 自动触发脚本生成（当从首页跳转且isGenerating为true时）
  // ============================================================
  useEffect(() => {
    const autoGenerateScript = async () => {
      // 🔒 防止刷新误触发：检查导航标记
      const navigationFlag = sessionStorage.getItem('storyboard_navigation_flag');
      
      // 如果没有导航标记，说明是刷新或直接访问URL，不应该自动生成
      if (!navigationFlag) {
        console.log('[VisualStoryboardPage] 🔄 无导航标记，跳过自动生成（可能是刷新或直接访问）');
        return;
      }
      
      // 清除导航标记（一次性使用）
      sessionStorage.removeItem('storyboard_navigation_flag');
      console.log('[VisualStoryboardPage] ✅ 检测到正常导航，清除导航标记');

      if (shouldSkipLegacyAutoScriptGeneration({
        hasInspirationProposal: Boolean(inspirationProposal),
        needExpandScript: Boolean(locationState?.needExpandScript),
        shouldGenerate: Boolean(shouldGenerate),
      })) {
        console.log('[VisualStoryboardPage] 跳过旧脚本生成：当前入口由方案展开流程生成镜头卡');
        return;
      }
      
      // 只在以下条件下自动生成：
      // 1. shouldGenerate 为 true（明确标记需要生成）
      // 2. 有 userPrompt
      // 3. 没有 scriptData（否则会在 initialData 中处理）
      // 4. 当前场景列表为空
      // 5. 不在生成中
      // 6. 不在加载项目中
      // 
      // 注意：即使有 projectId，只要 shouldGenerate=true，也应该生成
      // （这是从首页创建新项目的情况，projectId 是新创建的空项目）
      if (!shouldGenerate || !userPrompt || scriptData || scenes.length > 0 || isGeneratingScript || isLoadingProject) {
        if (projectId && !shouldGenerate && scenes.length === 0) {
          console.log('[VisualStoryboardPage] ⏸️ 跳过自动生成：项目已存在，应该从数据库加载');
        }
        return;
      }

      console.log('[VisualStoryboardPage] 🔄 自动触发脚本生成...', userPrompt.substring(0, 50) + '...');
      console.log('[VisualStoryboardPage] 🔑 项目ID:', projectId || '无');
      setIsGeneratingScript(true);
      setGenerateError(null);
      setScriptTaskStatus(null);

      try {
        const result = await generateScriptAsync({
          user_prompt: userPrompt,
          uploaded_assets: uploadedAssets || [],
          generation_mode: generationMode as any,
          art_style: workbenchArtStyle || undefined,
          aspect_ratio: workbenchAspectRatio || undefined,
        }, (status) => {
           setScriptTaskStatus(status);
        });

        console.log('[VisualStoryboardPage] ✅ 脚本生成成功:', result);
        console.log('[VisualStoryboardPage] 📊 后端返回的场景数据（前3个）:', result.scenes.slice(0, 3));
        const newScenes = result.scenes.map((apiScene, index) => convertApiSceneToScene(apiScene, index, workbenchAspectRatio));
        console.log('[VisualStoryboardPage] 📊 转换后的场景数据（前3个）:', newScenes.slice(0, 3));
        setScenes(newScenes);
        setProjectTitle(result.title);
        if (newScenes.length > 0) {
          setSelectedSceneId(newScenes[0].id);
        }
        
        setShouldSaveToStorage(true);

        // 💾 保存到数据库
        if (projectId) {
          console.log('[VisualStoryboardPage] 💾 保存场景数据到数据库...');
          try {
            // 转换场景类型为标准格式（'real' -> 'mixed_media', 'ai' -> 'ai_generated'）
            const normalizedScenes = newScenes.map(scene => normalizeSceneForSave(scene));
            
            const saveResult = await saveStoryboard(projectId, {
              scenes: normalizedScenes,
              title: result.title,
              ...buildStoryboardSaveContext(),
            });
            if (saveResult.success) {
              console.log('[VisualStoryboardPage] ✅ 场景数据已保存到数据库');
            } else {
              console.error('[VisualStoryboardPage] ⚠️ 保存到数据库失败:', saveResult.error);
            }
          } catch (saveError) {
            console.error('[VisualStoryboardPage] ❌ 保存到数据库异常:', saveError);
          }
        } else {
          console.warn('[VisualStoryboardPage] ⚠️ 没有 projectId，无法保存到数据库');
        }

      } catch (error) {
        console.error('[VisualStoryboardPage] ❌ 脚本生成失败:', error);
        setGenerateError(error instanceof Error ? error.message : '脚本生成失败');
        setScriptTaskStatus(prev => prev ? { ...prev, status: 'error', error: error instanceof Error ? error.message : String(error) } : null);
      } finally {
        setIsGeneratingScript(false);
      }
    };

    autoGenerateScript();
  }, [shouldGenerate, userPrompt, scriptData, scenes.length, isGeneratingScript, uploadedAssets, generationMode, isLoadingProject, inspirationProposal, locationState?.needExpandScript]);

  // ============================================================
  // 辅助函数
  // ============================================================
  const updateScene = (id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(scene => 
      scene.id === id ? { ...scene, ...updates } : scene
    ));
  };

  const addScene = async () => {
    const newId = Math.max(...scenes.map(s => s.id), 0) + 1;
    const newScene: Scene = {
      id: newId,
      type: 'ai',
      script: '新场景',
      duration: '5s',
      narration: '',
      isAiGenerated: true,
      visualPrompt: '请输入场景描述...',
      motionPrompt: '',
      generationStatus: 'idle',
      footageStatus: 'empty',
      transitionType: 'none',
      postProcessing: {},
      clipStartTime: 0,
      clipEndTime: 5
    };
    const updatedScenes = [...scenes, newScene];
    setScenes(updatedScenes);
    setSelectedSceneId(newId);
    setTimeout(() => {
      document.getElementById(`scene-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // 💾 保存到数据库
    if (projectId) {
      console.log('[VisualStoryboardPage] 💾 添加场景后保存到数据库...');
      try {
        const normalizedScenes = updatedScenes.map(scene => normalizeSceneForSave(scene));
        const saveResult = await saveStoryboard(projectId, {
          scenes: normalizedScenes,
          title: projectTitle,
          ...buildStoryboardSaveContext(),
        });
        if (saveResult.success) {
          console.log('[VisualStoryboardPage] ✅ 场景添加已保存到数据库');
        } else {
          console.error('[VisualStoryboardPage] ⚠️ 保存到数据库失败:', saveResult.error);
        }
      } catch (saveError) {
        console.error('[VisualStoryboardPage] ❌ 保存到数据库异常:', saveError);
      }
    }
  };

  const deleteScene = (id: number) => {
    setSceneToDelete(id);
  };

  const confirmDeleteScene = async () => {
    if (sceneToDelete !== null) {
      const updatedScenes = scenes.filter(s => s.id !== sceneToDelete);
      setScenes(updatedScenes);
      if (selectedSceneId === sceneToDelete) setSelectedSceneId(null);
      setSceneToDelete(null);
      
      // 💾 保存到数据库
      if (projectId) {
        console.log('[VisualStoryboardPage] 💾 删除场景后保存到数据库...');
        try {
          const normalizedScenes = updatedScenes.map(scene => normalizeSceneForSave(scene));
          const saveResult = await saveStoryboard(projectId, {
            scenes: normalizedScenes,
            title: projectTitle,
            ...buildStoryboardSaveContext(),
          });
          if (saveResult.success) {
            console.log('[VisualStoryboardPage] ✅ 场景删除已保存到数据库');
          } else {
            console.error('[VisualStoryboardPage] ⚠️ 保存到数据库失败:', saveResult.error);
          }
        } catch (saveError) {
          console.error('[VisualStoryboardPage] ❌ 保存到数据库异常:', saveError);
        }
      }
    }
  };

  const duplicateScene = async (id: number) => {
    const sceneToCopy = scenes.find(s => s.id === id);
    if (!sceneToCopy) return;
    
    const newId = Math.max(...scenes.map(s => s.id), 0) + 1;
    const newScene = { ...sceneToCopy, id: newId };
    
    const index = scenes.findIndex(s => s.id === id);
    const newScenes = [...scenes];
    newScenes.splice(index + 1, 0, newScene);
    
    setScenes(newScenes);
    setSelectedSceneId(newId);
    setTimeout(() => {
      document.getElementById(`scene-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // 💾 保存到数据库
    if (projectId) {
      console.log('[VisualStoryboardPage] 💾 复制场景后保存到数据库...');
      try {
        const normalizedScenes = newScenes.map(scene => normalizeSceneForSave(scene));
        const saveResult = await saveStoryboard(projectId, {
          scenes: normalizedScenes,
          title: projectTitle,
          ...buildStoryboardSaveContext(),
        });
        if (saveResult.success) {
          console.log('[VisualStoryboardPage] ✅ 场景复制已保存到数据库');
        } else {
          console.error('[VisualStoryboardPage] ⚠️ 保存到数据库失败:', saveResult.error);
        }
      } catch (saveError) {
        console.error('[VisualStoryboardPage] ❌ 保存到数据库异常:', saveError);
      }
    }
  };

  const handleSceneSelect = (id: number) => {
    setSelectedSceneId(id);
    setTimeout(() => {
      document.getElementById(`scene-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  // ============================================================
  // 新建项目
  // ============================================================
  const handleNewProject = () => {
    // 禁用localStorage清除，改为仅使用数据库
    // clearAllStorage();
    console.log('[VisualStoryboardPage] ✅ 跳转到首页');
    navigate('/');
  };

  // ============================================================
  // AI Director Agent：应用 changes 到 Scene[] 
  // ============================================================
  const applyAiDirectorChanges = (changes: AiChange[]) => {
    // #region agent log
    console.log('[AI-Director][H-D] applyAiDirectorChanges', {changesCount:changes.length, changes:changes.slice(0,3)});
    // #endregion
    setScenes(prev => {
      let updated = prev.map(s => ({ ...s }));

      // 1. 处理 edit
      for (const c of changes) {
        if (c.type === 'edit' && c.sceneIndex !== undefined && c.sceneIndex >= 0 && c.sceneIndex < updated.length) {
          const fields = c.fields || {};
          // 将 SceneItem 字段映射到 Scene 字段
          const mapped: Partial<Scene> = {};
          if (fields.description !== undefined) mapped.script = fields.description;
          if (fields.narration !== undefined) mapped.narration = fields.narration;
          if (fields.duration !== undefined) mapped.duration = String(fields.duration);
          // cameraMovement 暂时忽略（Scene 中无此字段）
          updated[c.sceneIndex] = { ...updated[c.sceneIndex], ...mapped };
        }
      }

      // 2. 处理 add（倒序插入避免偏移）
      const adds = changes.filter(c => c.type === 'add' && c.afterIndex !== undefined);
      adds.sort((a, b) => (b.afterIndex ?? 0) - (a.afterIndex ?? 0));
      for (const c of adds) {
        const insertAt = Math.max(0, (c.afterIndex ?? -1) + 1);
        const sceneData = c.scene || {};
        const newId = Date.now() + Math.floor(Math.random() * 10000);
        const newScene: Scene = {
          id: newId,
          type: 'ai',
          isAiGenerated: true,
          script: sceneData.description || '',
          narration: sceneData.narration || '',
          duration: String(sceneData.duration ?? 5),
          visualPrompt: sceneData.description || '',
          motionPrompt: '',
          generationStatus: 'idle',
          footageStatus: 'empty',
        };
        updated.splice(insertAt, 0, newScene);
      }

      // 3. 处理 delete（倒序删除避免偏移）
      const deletes = changes.filter(c => c.type === 'delete' && c.sceneIndex !== undefined);
      deletes.sort((a, b) => (b.sceneIndex ?? 0) - (a.sceneIndex ?? 0));
      for (const c of deletes) {
        if ((c.sceneIndex ?? -1) >= 0 && (c.sceneIndex ?? -1) < updated.length) {
          updated.splice(c.sceneIndex!, 1);
        }
      }

      return updated;
    });
  };

  // ── 发送 AI Director 消息 ──────────────────────────────────
  const handleAiDirectorSend = async () => {
    const input = aiDirectorInput.trim();
    // #region agent log
    console.log('[AI-Director][H-B/H-D] send triggered', {input, isLoading:isAiDirectorLoading, scenesCount:scenes.length});
    fetch(apiUrl('/api/script-edit/debug-log'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'send-triggered',data:{input,isLoading:isAiDirectorLoading,scenesCount:scenes.length}})}).catch(()=>{});
    // #endregion
    if (!input || isAiDirectorLoading) return;

    setAiDirectorInput('');
    setAiDirectorMessages(prev => [...prev, { role: 'user', content: input }]);
    setAiDirectorHistory(prev => [...prev, { role: 'user', content: input }]);
    setIsAiDirectorLoading(true);

    const controller = new AbortController();
    aiDirectorAbortRef.current = controller;

    try {
      // 将 Scene[] 转换为 SceneItem 格式传给 API
      const sceneItems = scenes.map((s, i) => ({
        id: String(s.id),
        sceneNumber: i + 1,
        description: s.script || '',
        narration: s.narration || '',
        assetType: (s.type === 'real' ? 'real_footage' : 'ai_generated') as any,
        duration: parseFloat(s.duration) || 5,
      }));

      // #region agent log
      console.log('[AI-Director][H-A/H-C] calling API', {userInput:input, sceneCount:sceneItems.length, sample:sceneItems[0]});
      // #endregion

      const result = await chatWithAI({
        userInput: input,
        currentScenes: sceneItems,
        conversationHistory: aiDirectorHistory,
        userPrompt: savedUserPrompt,
        proposal: inspirationProposal,
      }, controller.signal);

      // #region agent log
      console.log('[AI-Director][H-A/H-E] API response', {success:result.success, error:result.error, action:result.data?.action, changesCount:result.data?.changes?.length, aiMessage:result.data?.message});
      fetch(apiUrl('/api/script-edit/debug-log'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'api-response',data:{success:result.success,error:result.error,action:result.data?.action,changesCount:result.data?.changes?.length}})}).catch(()=>{});
      // #endregion

      if (result.error === 'cancelled') return;

      if (result.success && result.data) {
        const { message, changes } = result.data;
        setAiDirectorMessages(prev => [...prev, { role: 'assistant', content: message }]);
        setAiDirectorHistory(prev => [...prev, { role: 'assistant', content: message }]);
        if (changes && changes.length > 0) {
          applyAiDirectorChanges(changes);
        }
      } else {
        throw new Error(result.error || 'AI 响应失败');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'CanceledError') return;
      // #region agent log
      console.log('[AI-Director][H-A] error caught', {errName:err?.name, errMsg:err?.message});
      fetch(apiUrl('/api/script-edit/debug-log'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'error-caught',data:{errName:err?.name,errMsg:err?.message}})}).catch(()=>{});
      // #endregion
      console.error('[AI Director] 对话失败:', err);
      setAiDirectorMessages(prev => [...prev, { role: 'assistant', content: '抱歉，遇到了一些问题，请重试。' }]);
    } finally {
      aiDirectorAbortRef.current = null;
      setIsAiDirectorLoading(false);
    }
  };

  // ── 停止 AI Director ──────────────────────────────────────
  const handleAiDirectorStop = () => {
    if (aiDirectorAbortRef.current) {
      aiDirectorAbortRef.current.abort();
      aiDirectorAbortRef.current = null;
    }
    setIsAiDirectorLoading(false);
    setAiDirectorMessages(prev => [...prev, { role: 'assistant', content: '已停止。' }]);
  };

  // ============================================================
  // Storyboard AI Director 回调（供 StoryboardDirectorPanel 使用）
  // ============================================================

  /**
   * 保存最新 scenes 的 ref，供异步回调（onRegenerateShot / onRegenerateAll）
   * 读取当前值，避免 React 状态快照过期问题。
   * handleDirectorScenesChange 中同步更新，确保 onRegenerateShot 能读到正确数据。
   */
  const latestScenesRef = useRef<Scene[]>(scenes);
  useEffect(() => { latestScenesRef.current = scenes; }, [scenes]);

  const clearAgentAppliedSoon = useCallback(() => {
    if (agentAppliedTimerRef.current !== null) {
      window.clearTimeout(agentAppliedTimerRef.current);
    }
    agentAppliedTimerRef.current = window.setTimeout(() => {
      setAgentApplied(null);
      agentAppliedTimerRef.current = null;
    }, AGENT_APPLIED_VISIBLE_MS);
  }, []);

  const scrollToAgentFeedback = useCallback((feedback: AgentCardFeedback | null) => {
    const firstShotId = feedback?.shotIds?.[0];
    if (typeof firstShotId !== 'number') return;
    window.setTimeout(() => {
      document.getElementById(`scene-${firstShotId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);
  }, []);

  useEffect(() => {
    return () => {
      if (agentAppliedTimerRef.current !== null) {
        window.clearTimeout(agentAppliedTimerRef.current);
      }
    };
  }, []);

  const handleDirectorPreviewActionsChange = useCallback((preview: StoryboardAssistantActionPreview | null) => {
    if (!preview) {
      setAgentPreview(null);
      return;
    }

    const feedback = buildAgentFeedbackFromAssistantEvent({
      shotIds: preview.affectedShotIds,
      fields: preview.fields,
      actions: preview.actions,
      scenes: latestScenesRef.current,
      summary: preview.actionIntent,
      label: 'AI 待确认',
    });
    setAgentPreview(feedback);
  }, []);

  const handleDirectorActionsApplied = useCallback((event: StoryboardAssistantActionsEvent) => {
    setAgentPreview(null);

    const feedback = buildAgentFeedbackFromAssistantEvent({
      shotIds: event.affectedShotIds,
      fields: event.fields,
      actions: event.appliedActions,
      scenes: event.type === 'undone' ? event.restoredScenes : event.nextScenes,
      summary: event.actionIntent,
      label: event.type === 'undone' ? 'AI 已恢复' : 'AI 已更新',
    });
    if (!feedback) return;

    setAgentApplied(feedback);
    scrollToAgentFeedback(feedback);
    clearAgentAppliedSoon();
  }, [clearAgentAppliedSoon, scrollToAgentFeedback]);

  /**
   * handleAutoFill 定义在本组件后段，通过 ref 桥接避免前向引用错误。
   * handleAutoFillRef.current 在 handleAutoFill 定义后立即同步赋值。
   */
  const handleAutoFillRef = useRef<(scene: Scene) => Promise<void>>(async () => {});

  /** AI Director 修改 scenes 后的回调：更新状态并触发 localStorage 持久化 */
  const handleDirectorScenesChange = useCallback((nextScenes: Scene[]) => {
    latestScenesRef.current = nextScenes; // 在 setState 前同步更新 ref
    setScenes(nextScenes);
    setShouldSaveToStorage(true);
  }, []);

  /**
   * AI Director 触发单个分镜重新生成时的回调。
   * - image 模式：复用 handleAutoFill 触发图片生成（通过 ref 避免前向引用）
   * - video 模式：applyStoryboardActions 已将 generationStatus 设为 image_selected，
   *              用户可通过"批量视频"按钮触发生成
   */
  const handleDirectorRegenerateShot = useCallback((shotId: number) => {
    const scene = latestScenesRef.current.find(s => s.id === shotId);
    if (!scene) return;
    const feedback: AgentCardFeedback = {
      shotIds: [shotId],
      fieldMap: { [shotId]: ['generation'] },
      label: 'AI 触发生成',
      isBatch: false,
    };
    setAgentPreview(null);
    setAgentApplied(feedback);
    scrollToAgentFeedback(feedback);
    clearAgentAppliedSoon();
    handleAutoFillRef.current(scene);
  }, [clearAgentAppliedSoon, scrollToAgentFeedback]);

  /**
   * AI Director 触发全局重新生成时的回调。
   * 读取 latestScenesRef 中最新的 scenes（已由 handleDirectorScenesChange 同步更新），
   * 计算出需要生成的场景数量，然后弹出批量生成确认框。
   */
  const handleDirectorRegenerateAll = useCallback(() => {
    const latestScenes = latestScenesRef.current;
    if (storyboardMode === 'image') {
      const count = latestScenes.filter(s =>
        s.type === 'ai' && (s.generationStatus === 'idle' || !s.assetUrl) &&
        (s.visualPrompt?.trim() || s.script?.trim())
      ).length;
      setBatchModalConfig({ type: 'image', count, successCount: 0, failCount: 0 });
      setShowBatchConfirmModal(true);
    } else {
      const count = latestScenes.filter(s =>
        s.type === 'ai' && s.assetUrl && s.generationStatus === 'image_selected'
      ).length;
      setBatchModalConfig({ type: 'video', count, successCount: 0, failCount: 0 });
      setShowBatchConfirmModal(true);
    }
  }, [storyboardMode]);

  // ============================================================
  // 重新生成分镜
  // ============================================================
  const handleRegenerate = async () => {
    if (!savedUserPrompt) {
      alert('无法重新生成分镜\n\n当前项目缺少生成参数。\n请从首页重新创建项目，或者使用"新建项目"按钮开始新的创作。');
      return;
    }

    const confirmRegenerate = window.confirm(
      '确定要重新生成分镜吗？\n\n当前的分镜内容和所有编辑将被清除。'
    );
    
    if (!confirmRegenerate) {
      return;
    }

    console.log('[VisualStoryboardPage] 🔄 开始重新生成分镜...');
    setIsGeneratingScript(true);
    setGenerateError(null);
    setScriptTaskStatus(null);

    try {
      const result = await generateScriptAsync({
        user_prompt: savedUserPrompt,
        uploaded_assets: savedUploadedAssets || [],
        generation_mode: savedGenerationMode as any,
        art_style: workbenchArtStyle || undefined,
        aspect_ratio: workbenchAspectRatio || undefined,
      }, (status) => {
         setScriptTaskStatus(status);
      });

      console.log('[VisualStoryboardPage] ✅ 分镜重新生成成功:', result);
      const newScenes = result.scenes.map((apiScene, index) => convertApiSceneToScene(apiScene, index, workbenchAspectRatio));
      setScenes(newScenes);
      setProjectTitle(result.title);
      setSelectedSceneId(newScenes[0]?.id || null);
      
      // 禁用localStorage清除，改为仅使用数据库
      // 清除旧的localStorage（会在下次保存时重新写入）
      // clearAllStorage();
      
      setShouldSaveToStorage(true);

    } catch (error) {
      console.error('[VisualStoryboardPage] ❌ 分镜重新生成失败:', error);
      setGenerateError(error instanceof Error ? error.message : '重新生成失败');
      alert(`重新生成失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // ============================================================
  // 批量生成图片
  // ============================================================
  const handleBatchGenerateImages = () => {
    // 筛选出需要生成图片的AI场景（类型为ai且还没有图片且有提示词）
    const aiScenes = scenes.filter(scene => 
      scene.type === 'ai' && 
      !scene.assetUrl &&
      (scene.visualPrompt?.trim() || scene.script?.trim())
    );
    
    if (aiScenes.length === 0) {
      setBatchModalConfig({ 
        type: 'image', 
        count: 0, 
        successCount: 0, 
        failCount: 0 
      });
      // 显示提示：没有需要生成的场景
      return;
    }
    
    // 显示确认弹窗
    setBatchModalConfig({ 
      type: 'image', 
      count: aiScenes.length, 
      successCount: 0, 
      failCount: 0 
    });
    setShowBatchConfirmModal(true);
  };
  
  const executeBatchGenerateImages = async () => {
    setShowBatchConfirmModal(false);
    
    // 只处理有提示词的AI场景，跳过没有填写提示词的场景
    const aiScenes = scenes.filter(scene => 
      scene.type === 'ai' && 
      !scene.assetUrl &&
      (scene.visualPrompt?.trim() || scene.script?.trim())
    );
    
    console.log(`[批量生成] 🎨 开始为 ${aiScenes.length} 个场景并发生成图片...`);
    setIsBatchGeneratingImages(true);
    setBatchGenerationProgress({ current: 0, total: aiScenes.length, currentSceneId: null });
    
    let completedCount = 0;
    
    // 单个场景的生成函数（不立即执行，仅定义）
    const makeGenerateTask = (scene: typeof aiScenes[0], index: number) => async () => {
      try {
        updateScene(scene.id, { generationStatus: 'generating_image' });
        
        console.log(`[批量生成] 🎨 开始生成场景 ${scene.id} 的图片 (${index + 1}/${aiScenes.length})...`);
        
        // 优先使用用户在卡片里直接编辑的 Description（script）
        const originalPrompt = scene.script?.trim() || scene.visualPrompt?.trim() || '';
        const cinematicPrompt = buildCinematicPrompt(scene, originalPrompt);
        const promptText = addStyleToPrompt(cinematicPrompt, workbenchArtStyle);
        console.log(`[批量生成] 🎨 场景 ${scene.id} 完整提示词:`, promptText);
        
        const aspectRatio = (workbenchAspectRatio || '16:9') as '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | '21:9';
        const imageSize = getRecommendedSize(aspectRatio, '2K');
        console.log(`[批量生成] 📐 场景 ${scene.id} 使用画幅比例: ${aspectRatio}, 尺寸: ${imageSize}`);
        
        const result = await imageGenApi.textToImage(promptText, {
          size: imageSize,
          watermark: true,
          response_format: 'url',
        });
        
        console.log(`[批量生成] ✅ 场景 ${scene.id} 图片生成成功`);
        
        const firstImageUrl = result.imageUrls[0];
        updateScene(scene.id, { 
          assetUrl: firstImageUrl,
          generationStatus: 'image_selected' 
        });
        
        completedCount++;
        setBatchGenerationProgress({ 
          current: completedCount, 
          total: aiScenes.length, 
          currentSceneId: scene.id 
        });
        
        return { success: true, sceneId: scene.id };
      } catch (error) {
        console.error(`[批量生成] ❌ 场景 ${scene.id} 图片生成失败:`, error);
        updateScene(scene.id, { generationStatus: 'idle' });
        
        completedCount++;
        setBatchGenerationProgress({ 
          current: completedCount, 
          total: aiScenes.length, 
          currentSceneId: scene.id 
        });
        
        return { success: false, sceneId: scene.id, error };
      }
    };
    
    // 真正的并发限制：每批最多同时发出 2 个请求，批次间间隔 1 秒
    const CONCURRENCY = 2;
    const results = [];
    const taskFns = aiScenes.map((scene, index) => makeGenerateTask(scene, index));
    
    for (let i = 0; i < taskFns.length; i += CONCURRENCY) {
      const batch = taskFns.slice(i, i + CONCURRENCY);
      // 在这里才真正启动这批任务，保证并发数不超过 CONCURRENCY
      const batchResults = await Promise.allSettled(batch.map(fn => fn()));
      results.push(...batchResults);
      // 批次间等待 1 秒，避免触发 ARK API 限速
      if (i + CONCURRENCY < taskFns.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 统计结果
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    setIsBatchGeneratingImages(false);
    setBatchGenerationProgress({ current: 0, total: 0, currentSceneId: null });
    
    console.log(`[批量生成] 🎨 批量生成图片完成: 成功 ${successCount}, 失败 ${failCount}`);
    
    // 显示结果弹窗
    setBatchModalConfig({ 
      type: 'image', 
      count: aiScenes.length, 
      successCount, 
      failCount 
    });
    setShowBatchResultModal(true);
  };

  useEffect(() => {
    if (workbenchIntent?.publishGoal !== 'fast_publish') return;
    if (isQuickAutomationPaused || quickAutomationStartedRef.current) return;
    if (isGeneratingScript || isBatchGeneratingImages || scenes.length === 0) return;

    const hasPendingImages = scenes.some(scene =>
      scene.type === 'ai' &&
      !scene.assetUrl &&
      (scene.visualPrompt?.trim() || scene.script?.trim())
    );
    if (!hasPendingImages) return;

    quickAutomationStartedRef.current = true;
    executeBatchGenerateImages();
  }, [isBatchGeneratingImages, isGeneratingScript, isQuickAutomationPaused, scenes, workbenchIntent?.publishGoal]);
  
  // ============================================================
  // 批量生成视频
  // ============================================================
  const handleBatchGenerateVideos = () => {
    // 筛选出需要生成视频的AI场景（有图片但还没有视频）
    const scenesWithImages = scenes.filter(scene => 
      scene.type === 'ai' && 
      scene.assetUrl && 
      scene.generationStatus === 'image_selected'
    );
    
    if (scenesWithImages.length === 0) {
      // 可以显示一个提示弹窗
      return;
    }
    
    // 显示确认弹窗
    setBatchModalConfig({ 
      type: 'video', 
      count: scenesWithImages.length, 
      successCount: 0, 
      failCount: 0 
    });
    setShowBatchConfirmModal(true);
  };
  
  const executeBatchGenerateVideos = async () => {
    setShowBatchConfirmModal(false);
    
    const scenesWithImages = scenes.filter(scene => 
      scene.type === 'ai' && 
      scene.assetUrl && 
      scene.generationStatus === 'image_selected'
    );
    
    console.log(`[批量生成] 🎬 开始为 ${scenesWithImages.length} 个场景并发生成视频...`);
    setIsBatchGeneratingVideos(true);
    setBatchGenerationProgress({ current: 0, total: scenesWithImages.length, currentSceneId: null });
    
    let completedCount = 0;
    
    // 为每个场景创建生成任务
    const generateTasks = scenesWithImages.map(async (scene, index) => {
      try {
        // 更新状态为生成中
        updateScene(scene.id, { generationStatus: 'generating_video' });
        
        console.log(`[批量生成] 🎬 开始生成场景 ${scene.id} 的视频 (${index + 1}/${scenesWithImages.length})...`);
        
        const originalPrompt = scene.motionPrompt || scene.visualPrompt || scene.script || '';
        // 添加艺术风格提示词
        const promptText = addStyleToPrompt(originalPrompt, workbenchArtStyle);
        console.log(`[批量生成] 🎬 场景 ${scene.id} 添加风格后的提示词:`, promptText);
        
        const duration = parseInt(scene.duration) || 5;
        const frames = duration === 5 ? 121 : 241;
        
        // 根据选择的画幅比例设置视频比例
        const aspectRatio = (workbenchAspectRatio || '16:9') as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
        console.log(`[批量生成] 📐 场景 ${scene.id} 使用视频画幅比例: ${aspectRatio}`);
        
        // 使用即梦3.0 Pro模式生成视频（默认模型）
        const result = await imageApi.imageToVideo(scene.assetUrl!, promptText, {
          frames,
          model: 'jimeng-pro',
          aspectRatio
        });
        
        console.log(`[批量生成] ✅ 场景 ${scene.id} 视频生成成功`);
        
        updateScene(scene.id, { 
          videoUrl: proxyVideoUrl(result.videoUrl),
          generationStatus: 'completed' 
        });
        
        // 更新进度
        completedCount++;
        setBatchGenerationProgress({ 
          current: completedCount, 
          total: scenesWithImages.length, 
          currentSceneId: scene.id 
        });
        
        return { success: true, sceneId: scene.id };
      } catch (error) {
        console.error(`[批量生成] ❌ 场景 ${scene.id} 视频生成失败:`, error);
        updateScene(scene.id, { generationStatus: 'image_selected' });
        
        // 更新进度
        completedCount++;
        setBatchGenerationProgress({ 
          current: completedCount, 
          total: scenesWithImages.length, 
          currentSceneId: scene.id 
        });
        
        return { success: false, sceneId: scene.id, error };
      }
    });
    
    // 并发执行所有任务，最多同时2个请求（视频生成比较耗时，减少并发数）
    const CONCURRENCY = 2;
    const results = [];
    
    for (let i = 0; i < generateTasks.length; i += CONCURRENCY) {
      const batch = generateTasks.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
    }
    
    // 统计结果
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    setIsBatchGeneratingVideos(false);
    setBatchGenerationProgress({ current: 0, total: 0, currentSceneId: null });
    
    console.log(`[批量生成] 🎬 批量生成视频完成: 成功 ${successCount}, 失败 ${failCount}`);
    
    // 显示结果弹窗
    setBatchModalConfig({ 
      type: 'video', 
      count: scenesWithImages.length, 
      successCount, 
      failCount 
    });
    setShowBatchResultModal(true);
  };
  
  // ============================================================
  // 导出粗剪
  // ============================================================
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress(null);
      setExportResult(null);
      setExportError(null);

      console.log('📤 开始导出粗剪，共', scenes.length, '个分镜');
      const exportableScenes = videoExportApi.getExportableVideoScenes(scenes);

      if (exportableScenes.length === 0) {
        const message = '请先生成视频或上传视频素材，再导出粗剪。';
        setExportError(message);
        alert(message);
        return;
      }

      // 调用导出API（带进度）
      const result = await videoExportApi.exportRoughCutWithProgress(
        exportableScenes,
        (progress) => {
          console.log('📊 导出进度:', progress);
          setExportProgress(progress);
        }
      );

      console.log('✅ 导出成功:', result);
      setExportResult(result);
      setExportProgress(null);

    } catch (error) {
      console.error('❌ 导出失败:', error);
      setExportError(error instanceof Error ? error.message : '导出失败');
      setExportProgress(null);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCloseExportDialog = () => {
    setIsExporting(false);
    setExportProgress(null);
    setExportResult(null);
    setExportError(null);
  };

  const handleDownloadExport = () => {
    if (exportResult) {
      const downloadUrl = assetUrl(exportResult.videoUrl);
      videoExportApi.downloadFile(downloadUrl, exportResult.filename);
    }
  };

  // ============================================================
  // 音配创作（拼接视频 → 上传TOS → AI分析 → 跳转）
  // ============================================================
  
  const selectedScene = scenes.find(s => s.id === selectedSceneId);
  
  // 对比模式状态
  const [isCompareMode, setIsCompareMode] = useState(false);

  const hasGeneratedVisuals = scenes.some(scene => scene.assetUrl || scene.videoUrl);

  const applyWorkbenchAspectRatio = (nextRatio: CreationAspectRatio) => {
    const shouldRegenerate = hasGeneratedVisuals && window.confirm('已生成的画面不会自动改变画幅。是否清除已生成画面，并按新画幅重新生成？\n\n取消则只应用到后续生成。');
    setWorkbenchAspectRatio(nextRatio);
    setScenes(prev => prev.map(scene => ({
      ...scene,
      imageResolution: getImageResolutionByAspectRatio(nextRatio),
      ...(shouldRegenerate ? {
        assetUrl: undefined,
        videoUrl: undefined,
        generationStatus: 'idle' as const,
        footageStatus: 'empty' as const,
      } : {}),
    })));
    setWorkbenchIntent(prev => prev ? { ...prev, aspectRatio: nextRatio } : prev);
  };

  const applyWorkbenchArtStyle = (nextStyle: string) => {
    const shouldRegenerate = hasGeneratedVisuals && window.confirm('已生成的画面不会自动改变风格。是否清除已生成画面，并按新风格重新生成？\n\n取消则只应用到后续生成。');
    setWorkbenchArtStyle(nextStyle);
    setScenes(prev => prev.map(scene => shouldRegenerate
      ? { ...scene, assetUrl: undefined, videoUrl: undefined, generationStatus: 'idle', footageStatus: 'empty' }
      : scene
    ));
    setWorkbenchIntent(prev => prev ? { ...prev, artStyle: nextStyle } : prev);
  };

  const handleAdvancedScriptEdit = () => {
    navigate('/script-editor', {
      state: {
        proposal: workbenchIntent?.selectedProposal || inspirationProposal,
        uploadedAssets: savedUploadedAssets || [],
        userPrompt: savedUserPrompt || '',
        generationMode: savedGenerationMode || 'ai_generated',
        savedScenes: scenes,
        projectId,
        aspectRatio: workbenchAspectRatio,
        artStyle: workbenchArtStyle,
      },
    });
  };

  // ── 可编辑单元格（内联组件）────────────────────────────────────
  const EditableCell = ({ value, onChange, isDescription, placeholder = 'Empty', maxHeight }: {
    value: string;
    onChange?: (v: string) => void;
    isDescription?: boolean;
    placeholder?: string;
    maxHeight?: number;
  }) => {
    const [text, setText] = React.useState(value);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => { setText(value); }, [value]);

    React.useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const nextHeight = maxHeight
          ? Math.min(textareaRef.current.scrollHeight, maxHeight)
          : textareaRef.current.scrollHeight;
        textareaRef.current.style.height = `${nextHeight}px`;
        textareaRef.current.style.overflowY = maxHeight && textareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
      }
    }, [text, maxHeight]);

    const handleBlur = () => { onChange?.(text); };

    return (
      <div className={`bg-neutral-100 dark:bg-white/5 rounded-md border border-neutral-200 dark:border-white/5 focus-within:border-cyan-500/50 focus-within:bg-cyan-500/10 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all ${isDescription ? 'p-1.5' : 'px-1.5 py-1'}`}>
        <textarea
          ref={textareaRef}
          className={`w-full bg-transparent border-none outline-none resize-none text-neutral-700 dark:text-neutral-300 placeholder-neutral-400 dark:placeholder-neutral-600 ${isDescription ? 'text-[11px] leading-relaxed' : 'text-[10px]'}`}
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleBlur}
          rows={1}
          placeholder={placeholder}
          style={{ display: 'block', minHeight: isDescription ? '48px' : '15px' }}
        />
      </div>
    );
  };

  // ── 分镜卡片拖拽处理 ──────────────────────────────────────────
  const handleShotDragStart = (e: React.DragEvent, index: number) => {
    setDraggedShotIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleShotDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleShotDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedShotIdx === null || draggedShotIdx === index) return;
    const newScenes = [...scenes];
    const dragged = newScenes[draggedShotIdx];
    newScenes.splice(draggedShotIdx, 1);
    newScenes.splice(index, 0, dragged);
    setScenes(newScenes);
    setDraggedShotIdx(null);
  };

  // ── 单个分镜卡片自动填充（AI生成图片）─────────────────────────
  const handleAutoFill = async (scene: Scene) => {
    // 始终根据当前字段重新生成图片（与 storyboardMode 无关）
    // 优先使用用户在卡片里直接编辑的 Description（script），
    // 保证修改后的描述能反映到生成结果中
    const rawPrompt = scene.script?.trim() || scene.visualPrompt?.trim();
    if (!rawPrompt) {
      alert('请先填写该分镜的画面内容，再点击生成画面。');
      return;
    }
    updateScene(scene.id, { generationStatus: 'generating_image' });
    try {
      const cinematicPrompt = buildCinematicPrompt(scene, rawPrompt);
      const styledPrompt = workbenchArtStyle ? addStyleToPrompt(cinematicPrompt, workbenchArtStyle) : cinematicPrompt;
      const enhancedPrompt = enhancePromptWithAspectRatio(styledPrompt, workbenchAspectRatio);
      const aspectRatio = (workbenchAspectRatio || '16:9') as '16:9' | '9:16' | '1:1' | '4:3';
      const sizeStr = getRecommendedSize(aspectRatio, '2K');
      const result = await imageGenApi.textToImage(enhancedPrompt, { size: sizeStr as any });
      if (result.imageUrls && result.imageUrls.length > 0) {
        updateScene(scene.id, {
          assetUrl: result.imageUrls[0],
          generationStatus: 'image_selected',
          footageStatus: 'filled',
        });
      } else {
        updateScene(scene.id, { generationStatus: scene.assetUrl ? 'image_selected' : 'idle' });
        alert('图片生成失败：未返回图片，请重试。');
      }
    } catch (err: any) {
      console.error('[Auto-fill] 图片生成失败:', err);
      updateScene(scene.id, { generationStatus: scene.assetUrl ? 'image_selected' : 'idle' });
      alert(`图片生成失败：${err?.message || '请检查网络或稍后重试'}`);
    }
  };

  /** 单个分镜视频生成（供 handleAutoFill / handleDirectorRegenerateShot 复用） */
  const generateVideoForScene = async (scene: Scene) => {
    if (!scene.assetUrl) return;
    updateScene(scene.id, { generationStatus: 'generating_video' });
    try {
      const originalPrompt = scene.motionPrompt || scene.visualPrompt || scene.script || '';
      const promptText = workbenchArtStyle ? addStyleToPrompt(originalPrompt, workbenchArtStyle) : originalPrompt;
      const duration = parseInt(scene.duration) || 5;
      const frames = duration === 5 ? 121 : 241;
      const aspectRatio = (workbenchAspectRatio || '16:9') as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
      const result = await imageApi.imageToVideo(scene.assetUrl, promptText, {
        frames,
        model: 'jimeng-pro',
        aspectRatio,
      });
      updateScene(scene.id, {
        videoUrl: proxyVideoUrl(result.videoUrl),
        generationStatus: 'completed',
      });
    } catch {
      updateScene(scene.id, { generationStatus: 'image_selected' });
    }
  };

  // 将 handleAutoFill 赋给 ref，供 handleDirectorRegenerateShot 使用（绕过前向引用限制）
  handleAutoFillRef.current = handleAutoFill;

  // ============================================================
  // 渲染（新版 UI）
  // ============================================================
  return (
    <div className="nm-flow-page nm-storyboard-page flex flex-col h-full w-full min-w-0 bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 overflow-hidden font-sans">
      {/* ── 分镜工具条 ─────────────────────────────────────────── */}
      <div className="nm-workbench-toolbar border-b border-neutral-200 dark:border-white/10 bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-md flex flex-col gap-2 px-3 py-2 flex-shrink-0 z-20 lg:h-11 lg:flex-row lg:items-center lg:justify-between lg:px-4">
        <div className="flex w-full items-center justify-end gap-1">
          <button onClick={handleBatchGenerateImages} disabled={isBatchGeneratingImages || isBatchGeneratingVideos || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-3 py-1.5 text-[11px] font-medium text-cyan-700 transition-colors hover:bg-cyan-500/20 disabled:opacity-50 dark:text-cyan-300">
            {isBatchGeneratingImages ? <><Loader2 size={12} className="animate-spin" />{batchGenerationProgress.current}/{batchGenerationProgress.total}</> : <><ImagePlus size={12} />生成图片</>}
          </button>

          <button onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:text-white">
            {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {isExporting ? '处理中' : '导出'}
          </button>

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-neutral-200 bg-white/70 px-2 py-1.5 text-[11px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:text-white">
              <MoreHorizontal size={14} />
              更多
            </summary>
            <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#111114]">
              <button onClick={handleAdvancedScriptEdit}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5">
                <FileVideo size={13} />
                高级脚本
              </button>
              <button onClick={handleRegenerate} disabled={isGeneratingScript}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-white/5">
                {isGeneratingScript ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {isGeneratingScript ? '生成中' : '重生成分镜'}
              </button>
              <button onClick={handleBatchGenerateVideos} disabled={isBatchGeneratingVideos || isBatchGeneratingImages || scenes.length === 0}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-white/5">
                {isBatchGeneratingVideos ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />}
                批量生成视频
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* ── 新版主内容区域 ───────────────────────────────────────── */}
      <div className={`nm-storyboard-workbench ${isAiSidebarOpen ? 'nm-ai-sidebar-open' : ''} flex-1 flex min-w-0 overflow-hidden relative`}>
        <div className="nm-storyboard-day-blueprint" aria-hidden="true">
          <span className="nm-storyboard-day-kicker">STORYBOARD</span>
          <span className="nm-storyboard-day-count">{String(Math.max(scenes.length, 1)).padStart(2, '0')}</span>
          <span className="nm-storyboard-day-note">SHOT LIST / VISUAL DRAFT</span>
        </div>

        {/* 主分镜板区域 */}
        <div className="flex-1 relative flex min-w-0 flex-col h-full overflow-hidden">

          {/* 顶部标题栏 */}
          <div className="nm-page-heading flex flex-col gap-4 px-4 py-5 shrink-0 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
              <h2 className="text-2xl font-medium text-neutral-900 dark:text-white flex items-center gap-3">
                <div className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                分镜
              </h2>
              <div className="nm-metadata-pill flex items-center gap-2 text-neutral-400 text-sm bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <Lightbulb size={14} className="text-amber-400" />
                <span>{scenes.length} 个分镜</span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setIsAdvancedMode(prev => !prev)}
                aria-pressed={isAdvancedMode}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isAdvancedMode
                    ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300'
                    : 'border-neutral-200 bg-white/60 text-neutral-500 hover:text-neutral-800 dark:border-white/10 dark:bg-black/40 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
                title="显示每个分镜的镜头参数"
              >
                <SlidersHorizontal size={15} />
                高级模式
              </button>

            {/* Image / Video Mode Toggle */}
            <div className="nm-mode-toggle flex w-full items-center bg-white/60 dark:bg-black/40 backdrop-blur-md border border-neutral-200 dark:border-white/10 rounded-lg p-1 shadow-sm dark:shadow-none sm:w-auto">
              <button
                onClick={() => setStoryboardMode('image')}
                className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all sm:flex-none sm:px-4 ${
                  storyboardMode === 'image'
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-[inset_0_0_10px_rgba(34,211,238,0.2)] border border-cyan-500/30'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 border border-transparent'
                }`}
              >
                <ImageIcon size={15} className={storyboardMode === 'image' ? 'text-cyan-500 dark:text-cyan-400' : ''} />
                图片
              </button>
              <button
                onClick={() => setStoryboardMode('video')}
                className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all sm:flex-none sm:px-4 ${
                  storyboardMode === 'video'
                    ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 shadow-[inset_0_0_10px_rgba(139,92,246,0.2)] border border-violet-500/30'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 border border-transparent'
                }`}
              >
                <Film size={15} className={storyboardMode === 'video' ? 'text-violet-500 dark:text-violet-400' : ''} />
                视频
              </button>
            </div>
            </div>
          </div>

          {workbenchIntent?.publishGoal === 'fast_publish' && (
            <div className="mx-4 mb-3 flex flex-col gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-800 dark:text-cyan-200 sm:mx-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">
                  {isQuickAutomationPaused ? '快速成片已暂停，可先编辑镜头卡片' : '快速成片模式：正在自动准备镜头画面'}
                </div>
                <div className="mt-0.5 text-xs text-cyan-700/80 dark:text-cyan-300/80">
                  推荐方案、默认画幅和风格已套用；你可以随时暂停，修改脚本、画面描述、素材引用和时长。
                </div>
              </div>
              <button
                onClick={() => setIsQuickAutomationPaused(prev => !prev)}
                className="shrink-0 rounded-lg border border-cyan-500/30 bg-white/60 px-3 py-1.5 text-xs font-medium text-cyan-700 transition-colors hover:bg-white dark:bg-black/30 dark:text-cyan-200 dark:hover:bg-black/50"
              >
                {isQuickAutomationPaused ? '继续自动生成' : '暂停，先编辑'}
              </button>
            </div>
          )}

          {/* 加载遮罩 */}
          {isGeneratingScript && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-50/80 dark:bg-[#050505]/80 backdrop-blur-sm">
              <ScriptGenerationLoadingOverlay taskStatus={scriptTaskStatus} />
            </div>
          )}
          {isBatchGeneratingImages && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-50/80 dark:bg-[#050505]/80 backdrop-blur-sm">
              <BatchGenerationLoadingOverlay type="image" progress={batchGenerationProgress} />
            </div>
          )}
          {isBatchGeneratingVideos && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-50/80 dark:bg-[#050505]/80 backdrop-blur-sm">
              <BatchGenerationLoadingOverlay type="video" progress={batchGenerationProgress} />
            </div>
          )}

          {/* 脚本生成失败 */}
          {generateError && (
            <div className="mx-8 p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
              <h3 className="text-base font-semibold text-red-500 mb-2">脚本生成失败</h3>
              <p className="text-sm text-red-400">{generateError}</p>
              <button onClick={handleNewProject} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
                返回首页重试
              </button>
            </div>
          )}

          {/* 分镜卡片网格 */}
          {!isGeneratingScript && !generateError && (
            <div className="nm-storyboard-scroll-panel flex-1 overflow-y-auto overflow-x-hidden px-4 pb-32 pt-2 sm:px-6 lg:px-8" id="storyboard-scroll-container">
              {agentPreview && agentPreview.shotIds.length > 1 && (
                <div className="sticky top-0 z-20 mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 backdrop-blur-md dark:text-amber-200">
                  <span>AI 待确认：将影响 {agentPreview.shotIds.length} 个分镜</span>
                  <span className="font-mono text-[10px] opacity-80">
                    {agentPreview.summary || `#${agentPreview.shotIds.join(', #')}`}
                  </span>
                </div>
              )}
              <div className="nm-storyboard-grid grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {scenes.map((scene, index) => {
                  const displayUrl = scene.assetUrl ? resolveLocalAssetUrl(scene.assetUrl) : scene.videoUrl;
                  const isGenerating = scene.generationStatus === 'generating_image' || scene.generationStatus === 'generating_video';
                  const hasVideo = !!scene.videoUrl;
                  const isSelected = selectedSceneId === scene.id;
                  const isAdvancedOpen = shouldShowAdvancedSceneParameters(isAdvancedMode);
                  const linkedAssetIndex = (savedUploadedAssets || []).findIndex((asset: any) => {
                    const value = asset.file_path || asset.url || '';
                    return value && value === scene.assetUrl;
                  });
                  const linkedAsset = linkedAssetIndex >= 0 ? (savedUploadedAssets || [])[linkedAssetIndex] : null;
                  const sourceLabel = linkedAsset
                    ? `素材 ${linkedAssetIndex + 1} · 进入分镜`
                    : scene.assetUrl
                      ? 'AI补充画面'
                      : '待生成画面';
                  const sourceTone = linkedAsset
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : scene.assetUrl
                      ? 'border-violet-400/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                      : 'border-neutral-300 bg-neutral-500/10 text-neutral-500 dark:border-white/10 dark:text-neutral-400';
                  const readableSummary = getStoryboardPreviewText(scene);
                  const narrationText = cleanStoryboardText(scene.narration || scene.dialogue || '');
                  const isAgentPreviewed = !!agentPreview?.shotIds.includes(scene.id);
                  const isAgentApplied = !!agentApplied?.shotIds.includes(scene.id);
                  const agentTone: AgentFeedbackTone = isAgentPreviewed ? 'preview' : 'applied';
                  const agentFieldMap = isAgentPreviewed ? agentPreview?.fieldMap : agentApplied?.fieldMap;
                  const agentLabel = isAgentPreviewed
                    ? agentPreview?.label || 'AI 待确认'
                    : agentApplied?.label || 'AI 已更新';

                  return (
                    <div
                      key={scene.id}
                      id={`scene-${scene.id}`}
                      draggable
                      onDragStart={(e) => handleShotDragStart(e, index)}
                      onDragOver={handleShotDragOver}
                      onDrop={(e) => handleShotDrop(e, index)}
                      onClick={() => setSelectedSceneId(scene.id)}
                      className={`nm-storyboard-card bg-white/40 dark:bg-black/40 backdrop-blur-sm border ${
                        isAgentPreviewed
                          ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.18)] ring-1 ring-amber-400/30'
                          : isAgentApplied
                            ? 'border-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.18)] ring-1 ring-cyan-400/30'
                            : isSelected
                          ? 'nm-storyboard-card-selected border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                          : 'border-neutral-200 dark:border-white/10'
                      } rounded-xl overflow-hidden flex flex-col group relative transition-all duration-300 hover:border-neutral-300 dark:hover:border-white/20 hover:bg-white/60 dark:hover:bg-black/60 cursor-pointer`}
                    >
                      {/* Drag Handle */}
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-white/60 dark:bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-neutral-200 dark:border-white/10 flex items-center gap-2">
                        <GripHorizontal size={14} className="text-neutral-700 dark:text-white" />
                      </div>

                      {/* 图片/视频区域 */}
                      <div className="nm-storyboard-media relative aspect-video bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 shrink-0 overflow-hidden">
                        {isGenerating ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <Loader2 size={24} className="animate-spin text-cyan-500" />
                            <span className="text-[10px] text-neutral-500 font-mono">
                              {scene.generationStatus === 'generating_image' ? '生成图片中...' : '生成视频中...'}
                            </span>
                          </div>
                        ) : displayUrl ? (
                          <>
                            {scene.assetUrl && (
                              <img
                                src={resolveLocalAssetUrl(scene.assetUrl)}
                                alt={`分镜 ${index + 1}`}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                            )}
                            {hasVideo && !scene.assetUrl && (
                              <video
                                src={proxyVideoUrl(scene.videoUrl!)}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                muted
                              />
                            )}
                            {hasVideo && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVideoModalUrl(proxyVideoUrl(scene.videoUrl!));
                                }}
                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/30"
                                title="播放视频"
                              >
                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                  <Play size={18} className="text-violet-600 ml-0.5" fill="currentColor" />
                                </div>
                              </button>
                            )}
                            {hasVideo && scene.assetUrl && (
                              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-violet-400 border border-violet-500/30 flex items-center gap-1 z-20">
                                <Film size={10} />
                                视频
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-400">
                            <ImageIcon size={24} className="opacity-30" />
                            <span className="text-[10px] font-mono opacity-50">无图片</span>
                          </div>
                        )}

                        {/* 分镜序号标签 */}
                        <div className="absolute top-2 left-2 bg-white/60 dark:bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-neutral-900 dark:text-white border border-neutral-200 dark:border-white/10 z-10">
                          分镜 {index + 1}
                        </div>

                        {(isAgentPreviewed || isAgentApplied) && (
                          <div className={`absolute left-2 top-9 z-20 rounded-md border px-2 py-1 text-[10px] font-medium backdrop-blur-md ${
                            isAgentPreviewed
                              ? 'border-amber-400/40 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                              : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                          }`}>
                            {agentLabel}
                          </div>
                        )}

                        <div className={`absolute bottom-2 left-2 z-10 max-w-[72%] truncate rounded-md border px-2 py-1 text-[10px] font-medium backdrop-blur-md ${sourceTone}`}>
                          {sourceLabel}
                        </div>

                        {/* 视频模式：时长标签 */}
                        {storyboardMode === 'video' && (
                          <div className="absolute top-2 right-2 bg-white/60 dark:bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1 z-10">
                            <Clock size={10} />
                            {scene.duration}s
                          </div>
                        )}

                        {/* Undo 按钮 */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateScene(scene.id, { assetUrl: undefined, videoUrl: undefined, generationStatus: 'idle', footageStatus: 'empty' }); }}
                            className="p-1.5 bg-white/60 dark:bg-black/60 hover:bg-white/80 dark:hover:bg-black/80 backdrop-blur-md rounded-md text-neutral-900 dark:text-white border border-neutral-200 dark:border-white/10 transition-colors"
                            title="清除图片"
                          >
                            <Undo2 size={14} />
                          </button>
                        </div>

                        {/* 选中边框 */}
                        {isSelected && (
                          <div className="absolute inset-0 border-2 border-cyan-500 rounded-t-xl pointer-events-none" />
                        )}
                      </div>

                      {/* 内容区域 */}
                      <div className="nm-storyboard-card-content p-3 flex-1 flex flex-col gap-3">
                        <div className={`rounded-lg border p-2.5 ${
                          hasAgentField(agentFieldMap, scene.id, 'visual')
                            ? agentTone === 'preview'
                              ? 'border-amber-400/30 bg-amber-500/10'
                              : 'border-cyan-400/30 bg-cyan-500/10'
                            : 'border-neutral-200 bg-white/60 dark:border-white/10 dark:bg-white/[0.04]'
                        }`}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <AgentFieldMark active={hasAgentField(agentFieldMap, scene.id, 'visual')} tone={agentTone} label={AGENT_FIELD_LABELS.visual} />
                            <div className="text-[10px] font-semibold tracking-[0.08em] text-cyan-600 dark:text-cyan-300">镜头重点</div>
                          </div>
                          <p className="text-[12px] leading-relaxed text-neutral-800 dark:text-neutral-100" style={clampTextStyle(3)}>
                            {readableSummary}
                          </p>
                        </div>

                        <div className={`rounded-lg border p-2 ${
                          hasAgentField(agentFieldMap, scene.id, 'narration')
                            ? agentTone === 'preview'
                              ? 'border-amber-400/30 bg-amber-500/10'
                              : 'border-cyan-400/30 bg-cyan-500/10'
                            : 'border-neutral-200 bg-neutral-50/80 dark:border-white/5 dark:bg-white/[0.03]'
                        }`}>
                          <div className="mb-1 text-[10px] font-medium text-neutral-500">旁白 / 字幕</div>
                          <AgentFieldMark active={hasAgentField(agentFieldMap, scene.id, 'narration')} tone={agentTone} label={AGENT_FIELD_LABELS.narration} />
                          <p className="text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300" style={clampTextStyle(2)}>
                            {narrationText || '这一镜暂未设置旁白'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] font-medium text-neutral-500 mb-1">时长</div>
                            <AgentFieldMark active={hasAgentField(agentFieldMap, scene.id, 'duration')} tone={agentTone} label={AGENT_FIELD_LABELS.duration} />
                            <EditableCell
                              value={String(scene.duration || '5s')}
                              onChange={(v) => updateScene(scene.id, { duration: v })}
                              placeholder="5s"
                            />
                          </div>
                          <div>
                            <div className="text-[10px] font-medium text-neutral-500 mb-1">素材引用</div>
                            <AgentFieldMark
                              active={hasAgentField(agentFieldMap, scene.id, 'asset') || hasAgentField(agentFieldMap, scene.id, 'generation')}
                              tone={agentTone}
                              label={hasAgentField(agentFieldMap, scene.id, 'generation') ? AGENT_FIELD_LABELS.generation : AGENT_FIELD_LABELS.asset}
                            />
                            <select
                              value={(savedUploadedAssets || []).some((asset: any) => (asset.file_path || asset.url) === scene.assetUrl) ? scene.assetUrl || '' : ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateScene(scene.id, {
                                  assetUrl: value || undefined,
                                  footageStatus: value ? 'filled' : 'empty',
                                  type: value ? 'real' : scene.type,
                                });
                              }}
                              className="w-full rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-1 text-[10px] text-neutral-700 outline-none dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                            >
                              <option value="">不指定</option>
                              {(savedUploadedAssets || []).map((asset: any, assetIndex: number) => {
                                const value = asset.file_path || asset.url || '';
                                return (
                                  <option key={`${value}-${assetIndex}`} value={value}>
                                    素材 {assetIndex + 1} · {getUploadedAssetName(asset, assetIndex)}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        <details
                          className="group rounded-lg border border-neutral-200 bg-white/40 dark:border-white/10 dark:bg-black/20"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                            <span>编辑完整内容</span>
                            <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
                          </summary>
                          <div className="space-y-2 border-t border-neutral-200/80 p-2.5 dark:border-white/10">
                            <div>
                              <div className="mb-1 text-[10px] font-medium text-cyan-500/80">完整画面内容</div>
                              <EditableCell
                                value={scene.script || ''}
                                onChange={(v) => updateScene(scene.id, { script: v })}
                                isDescription
                                maxHeight={120}
                                placeholder="描述这一镜要出现的画面"
                              />
                            </div>
                            <div>
                              <div className="mb-1 text-[10px] font-medium text-neutral-500">完整生成提示词</div>
                              <EditableCell
                                value={scene.visualPrompt || ''}
                                onChange={(v) => updateScene(scene.id, { visualPrompt: v })}
                                isDescription
                                maxHeight={150}
                                placeholder="给 AI 生成画面的具体描述"
                              />
                            </div>
                            <div>
                              <div className="mb-1 text-[10px] font-medium text-neutral-500">旁白 / 字幕文案</div>
                              <EditableCell
                                value={scene.narration || scene.dialogue || ''}
                                onChange={(v) => updateScene(scene.id, { narration: v, dialogue: v })}
                                placeholder="这一镜要说什么"
                              />
                            </div>
                          </div>
                        </details>

                        {isAdvancedOpen && (
                          <>
                            {storyboardMode === 'image' ? (
                              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                              <div className="grid grid-cols-1 gap-2 border-t border-neutral-200/80 p-3 dark:border-white/10 sm:grid-cols-2">
                                <div>
                                  <div className="mb-1 text-[10px] font-medium text-neutral-500">景别</div>
                                  <EditableCell value={scene.size || ''} onChange={(v) => updateScene(scene.id, { size: v })} placeholder="如：近景 / 全景" />
                                </div>
                                <div>
                                  <div className="mb-1 text-[10px] font-medium text-neutral-500">视角</div>
                                  <EditableCell value={scene.perspective || ''} onChange={(v) => updateScene(scene.id, { perspective: v })} placeholder="如：平视 / 俯拍" />
                                </div>
                                <div>
                                  <div className="mb-1 text-[10px] font-medium text-neutral-500">设备</div>
                                  <EditableCell value={scene.equipment || ''} onChange={(v) => updateScene(scene.id, { equipment: v })} placeholder="如：手持 / 三脚架" />
                                </div>
                                <div>
                                  <div className="mb-1 text-[10px] font-medium text-neutral-500">焦距</div>
                                  <EditableCell value={scene.focalLength || ''} onChange={(v) => updateScene(scene.id, { focalLength: v })} placeholder="如：35mm" />
                                </div>
                                <div>
                                  <div className="mb-1 text-[10px] font-medium text-neutral-500">画幅</div>
                                  <EditableCell
                                    value={scene.imageResolution?.aspectRatio || workbenchAspectRatio || '16:9'}
                                    onChange={(v) => updateScene(scene.id, { imageResolution: { ...scene.imageResolution, aspectRatio: v as any } })}
                                    placeholder="16:9"
                                  />
                                </div>
                                <div>
                                  <div className="mb-1 text-[10px] font-medium text-neutral-500">备注</div>
                                  <EditableCell value={scene.notes || ''} onChange={(v) => updateScene(scene.id, { notes: v })} placeholder="补充说明" />
                                </div>
                              </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                              <div className="grid grid-cols-1 gap-x-2 gap-y-2 border-t border-neutral-200/80 p-3 dark:border-white/10 sm:grid-cols-2">
                                <div>
                                  <div className="text-[10px] font-medium text-neutral-500 mb-1">运动</div>
                                  <EditableCell value={scene.motionPrompt || ''} onChange={(v) => updateScene(scene.id, { motionPrompt: v })} placeholder="镜头运动" />
                                </div>
                                <div>
                                  <div className="text-[10px] font-medium text-neutral-500 mb-1">设备</div>
                                  <EditableCell value={scene.equipment || ''} onChange={(v) => updateScene(scene.id, { equipment: v })} placeholder="拍摄设备" />
                                </div>
                                <div>
                                  <div className="text-[10px] font-medium text-neutral-500 mb-1">时长</div>
                                  <EditableCell value={`${scene.duration || '5'}s`} placeholder="时长" />
                                </div>
                                <div className="sm:col-span-2">
                                  <div className="text-[10px] font-medium text-neutral-500 mb-1">对白/旁白</div>
                                  <EditableCell value={scene.dialogue || scene.narration || ''} onChange={(v) => updateScene(scene.id, { dialogue: v })} placeholder="对白或旁白" />
                                </div>
                              </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* 底部操作栏 */}
                      <div className="nm-storyboard-card-footer p-1.5 border-t border-neutral-200 dark:border-white/5 bg-white/40 dark:bg-black/40 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateScene(scene.id); }}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 rounded transition-colors"
                            title="复制"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteScene(scene.id); }}
                            className="p-1.5 text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAutoFill(scene); }}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-1.5 text-[10px] font-medium text-cyan-700 shadow-[0_0_12px_rgba(34,211,238,0.12)] transition-colors hover:bg-cyan-500/25 hover:text-cyan-800 disabled:opacity-40 dark:text-cyan-300 dark:hover:text-cyan-100"
                          title="用当前描述生成或替换这一镜画面"
                        >
                          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          生成画面
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Shot 按钮 */}
                <button
                  onClick={addScene}
                  className="nm-storyboard-add-card min-h-[250px] border-2 border-dashed border-neutral-300 dark:border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 text-neutral-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all group bg-white/20 dark:bg-black/20 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                    <Plus size={20} />
                  </div>
                  <span className="text-xs font-medium">添加分镜</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── AI Director 侧边栏开关 ────────────────────────────── */}
        <motion.div
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          className="fixed left-0 top-1/2 z-50 -translate-y-1/2 xl:absolute"
        >
          <button
            onClick={() => { setIsAiSidebarOpen(!isAiSidebarOpen); fetch(apiUrl('/api/script-edit/debug-log'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'sidebar-toggle',data:{opening:!isAiSidebarOpen}})}).catch(()=>{}); }}
            aria-label={isAiSidebarOpen ? '收起 AI 分镜助手' : '打开 AI 分镜助手'}
            className="nm-day-edge-tab h-20 w-9 flex items-center justify-center group relative bg-white/80 dark:bg-black/70 backdrop-blur-xl border border-neutral-200 dark:border-white/10 border-l-0 rounded-r-2xl shadow-[8px_0_20px_rgba(0,0,0,0.1)] dark:shadow-[8px_0_20px_rgba(0,0,0,0.5)] hover:bg-white dark:hover:bg-black/90 transition-colors"
          >
            <div className="absolute inset-0 bg-cyan-500/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity rounded-r-2xl" />
            {isAiSidebarOpen ? (
              <ChevronLeft size={16} className="text-neutral-500 group-hover:text-cyan-400 transition-colors relative z-10" />
            ) : (
              <Bot size={18} className="text-cyan-500/70 group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all relative z-10" />
            )}
          </button>
        </motion.div>

        {isAiSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm xl:hidden"
            onClick={() => setIsAiSidebarOpen(false)}
          />
        )}

        {/* ── AI Director 侧边栏（StoryboardDirectorPanel）── */}
        <motion.div
          initial={false}
          animate={{ x: isAiSidebarOpen ? 0 : '-100%', opacity: isAiSidebarOpen ? 1 : 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          style={{ pointerEvents: isAiSidebarOpen ? 'auto' : 'none' }}
          className="fixed left-0 top-[100px] bottom-0 z-40 flex w-full flex-col overflow-hidden shadow-[20px_0_50px_rgba(0,0,0,0.4)] sm:w-[360px] xl:w-[320px]"
        >
          <StoryboardDirectorPanel
            scenes={scenes}
            mode={storyboardMode}
            selectedShotId={selectedSceneId}
            projectTitle={projectTitle}
            onScenesChange={handleDirectorScenesChange}
            onRegenerateShot={handleDirectorRegenerateShot}
            onRegenerateAll={handleDirectorRegenerateAll}
            onPreviewActionsChange={handleDirectorPreviewActionsChange}
            onActionsApplied={handleDirectorActionsApplied}
            className="nm-day-sidebar w-full h-full"
          />
        </motion.div>
      </div>

      {/* ── 弹窗与对话框 ──────────────────────────────────────────── */}
      <DeleteConfirmationModal
        isOpen={sceneToDelete !== null}
        onClose={() => setSceneToDelete(null)}
        onConfirm={confirmDeleteScene}
      />

      <BatchGenerationConfirmModal
        isOpen={showBatchConfirmModal}
        onClose={() => setShowBatchConfirmModal(false)}
        onConfirm={batchModalConfig.type === 'image' ? executeBatchGenerateImages : executeBatchGenerateVideos}
        type={batchModalConfig.type}
        count={batchModalConfig.count}
      />

      <BatchGenerationResultModal
        isOpen={showBatchResultModal}
        onClose={() => setShowBatchResultModal(false)}
        type={batchModalConfig.type}
        successCount={batchModalConfig.successCount}
        failCount={batchModalConfig.failCount}
      />


      {/* 视频播放弹窗 */}
      {videoModalUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setVideoModalUrl(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setVideoModalUrl(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 transition-colors"
            >
              ✕
            </button>
            <video
              src={videoModalUrl}
              className="w-full max-h-[80vh] object-contain"
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}
    </div>
  );
};
