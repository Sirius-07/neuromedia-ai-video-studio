import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Sparkles, 
  Film, 
  Video, 
  Image as ImageIcon,
  Edit3, 
  RefreshCw, 
  MessageSquare, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  X,
  Square,
  GripVertical,
  Camera,
  Lock,
  Send,
  BotMessageSquare,
} from 'lucide-react';
import { InspirationProposal } from './InspirationModal';
import * as scriptEditApi from '../api/scriptEditApi';
import { enhanceScene as enhanceSceneApi } from '../api/scriptEditApi';
import { createProject, getProject, updateProject } from '../api/projectApi';

interface SceneItem {
  id: string;
  sceneNumber: number;
  description: string;
  visualStyle?: string;
  bgmStyle?: string;
  assetType?: 'real_footage' | 'ai_generated' | 'image'; // 素材类型
  assetId?: string; // 关联的素材ID
  duration?: number;
  // 扩展字段 - 用于后续分镜生成
  narration?: string; // 旁白/字幕文案
  visualPrompt?: string; // 视觉提示词
  motionPrompt?: string; // 运动提示词
  designReason?: string; // AI设计理由
  cameraMovement?: string; // 镜头运动
  // 分镜板展示字段
  size?: string;         // 景别（大远景/远景/中景/近景/特写/大特写）
  perspective?: string;  // 视角（平视/仰视/俯视/鸟瞰/荷兰角）
  equipment?: string;    // 拍摄设备（稳定器/三脚架/手持/摇臂/无人机）
  focalLength?: string;  // 焦距（24mm/35mm/50mm/85mm/135mm）
  dialogue?: string;     // 对白台词
  notes?: string;        // 拍摄备注
  // 新闻溯源字段
  sourceRef?: string;         // 对应原稿哪一段
  isAISupplemented?: boolean; // true = AI补充画面，false = 直接来自原稿
}

// ─── Module-level helpers (no component state dependency) ───────────────────

const isRealShot = (scene: SceneItem) =>
  scene.assetType === 'real_footage' || scene.assetType === 'image';

function getAssetTypeIcon(assetType?: string) {
  switch (assetType) {
    case 'real_footage':
      return <Video size={18} className="text-blue-500 shrink-0" />;
    case 'image':
      return <Camera size={18} className="text-emerald-500 shrink-0" />;
    case 'ai_generated':
    default:
      return <Sparkles size={18} className="text-purple-500 shrink-0" />;
  }
}

function getAssetTypeLabel(assetType?: string) {
  switch (assetType) {
    case 'real_footage': return '实拍视频';
    case 'image': return '实拍图片';
    case 'ai_generated':
    default: return 'AI生成';
  }
}

function getCameraMovementLabel(movement?: string) {
  const labels: Record<string, string> = {
    none: '静止', zoom_in: '推进', zoom_out: '拉远',
    pan_left: '左摇', pan_right: '右摇',
    tilt_up: '上摇', tilt_down: '下摇',
    drone: '航拍', roll: '翻滚',
  };
  return labels[movement || 'none'] || movement;
}

// ─── Sortable scene card ─────────────────────────────────────────────────────

interface SceneReorderItemProps {
  scene: SceneItem;
  editingSceneId: string | null;
  enhancingSceneId: string | null;
  newSceneIds: Set<string>;
  selectedSceneId: string | null;
  aiChangedIds?: Set<string>;
  isDragOverlay?: boolean;
  isLast?: boolean;
  onEditScene: (id: string, field: keyof SceneItem, value: any) => void;
  onSaveScene: (id: string) => void;
  onDeleteScene: (id: string) => void;
  onSetEditingId: (id: string | null) => void;
  onSetSelectedId: (id: string | null) => void;
  onInsertAfter: (id: string) => void;
}

function SceneReorderItem({
  scene,
  editingSceneId,
  enhancingSceneId,
  newSceneIds,
  selectedSceneId,
  aiChangedIds,
  isDragOverlay = false,
  isLast = false,
  onEditScene,
  onSaveScene,
  onDeleteScene,
  onSetEditingId,
  onSetSelectedId,
  onInsertAfter,
}: SceneReorderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const isSelected = selectedSceneId === scene.id;
  const isAiChanged = aiChangedIds?.has(scene.id) ?? false;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onSetSelectedId(isSelected ? null : scene.id);
      }}
      className={`nm-scene-outline-card group relative p-5 rounded-xl border transition-all select-none ${
        isDragOverlay
          ? 'cursor-grabbing bg-white dark:bg-[#111] border-cyan-500/60 shadow-2xl shadow-cyan-500/20 ring-2 ring-cyan-500/40 scale-[1.02]'
          : isAiChanged
          ? 'cursor-pointer bg-violet-50 dark:bg-violet-500/10 border-violet-400 dark:border-violet-400/60 shadow-md shadow-violet-500/15 ring-1 ring-violet-400/40'
          : isSelected && isRealShot(scene)
          ? 'cursor-default bg-blue-50 dark:bg-blue-500/8 border-blue-400 dark:border-blue-500/50 shadow-sm shadow-blue-500/10 ring-1 ring-blue-400/25'
          : isSelected
          ? 'cursor-pointer bg-cyan-50 dark:bg-cyan-500/10 border-cyan-400 dark:border-cyan-500/60 shadow-md shadow-cyan-500/15 ring-1 ring-cyan-400/30'
          : enhancingSceneId === scene.id
          ? 'cursor-pointer bg-cyan-50/50 dark:bg-cyan-500/5 border-2 border-cyan-400/40 border-dashed animate-pulse'
          : 'cursor-pointer bg-white dark:bg-white/[0.03] border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/[0.06] hover:border-neutral-300 dark:hover:border-white/20'
      }`}
    >
      {/* 场景内容（为右侧操作列预留空间） */}
      <div className="flex items-start gap-3 mr-11">
        {/* 拖拽手柄 + 序号 */}
        <div className="flex flex-col items-center gap-2 mt-1">
          <div
            {...attributes}
            {...listeners}
            className={`touch-none select-none transition-colors rounded p-0.5 ${
              isSelected || isDragOverlay
                ? 'cursor-grab active:cursor-grabbing text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                : 'cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10'
            }`}
            title="拖拽排序"
          >
            <GripVertical size={20} />
          </div>
          <div className={`px-2 py-1 rounded-md text-xs font-bold transition-colors font-mono tracking-wider ${
            isSelected || isDragOverlay
              ? 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(34,211,238,0.4)]'
              : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
          }`}>
            {scene.sceneNumber}
          </div>
        </div>

        {/* 素材类型标识 */}
        <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            scene.assetType === 'real_footage' || scene.assetType === 'image'
              ? 'bg-blue-50 dark:bg-blue-500/20 border border-blue-300 dark:border-blue-500/50'
              : 'bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10'
          }`}>
            {getAssetTypeIcon(scene.assetType)}
          </div>
          <span className={`text-[10px] font-medium whitespace-nowrap font-mono ${
            scene.assetType === 'real_footage' || scene.assetType === 'image'
              ? 'text-blue-500 dark:text-blue-400'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}>
            {getAssetTypeLabel(scene.assetType)}
          </span>
        </div>

        {/* 场景内容 */}
        <div className="flex-1 min-w-0">
          {editingSceneId === scene.id ? (
            /* ── 编辑模式：4 个维度 ── */
            <div className="space-y-3">
              {/* 1. 画面描述 (Visual Prompt) */}
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400/80 mb-1.5">
                  <span>🖼</span> 画面描述
                  <span className="text-neutral-400 dark:text-neutral-600 font-normal ml-1">· 主体 / 场景 / 动作 / 光影</span>
                </label>
                <textarea
                  value={scene.description}
                  onChange={(e) => onEditScene(scene.id, 'description', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-cyan-400/50 dark:border-cyan-500/50 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/30 placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                  rows={3}
                  placeholder="广角镜头，珠江夜景，霓虹灯倒影，高速车流虚化，营造城市活力感..."
                  autoFocus
                />
              </div>

              {/* 2. 运镜与镜头语言 */}
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-blue-500 dark:text-blue-400/80 mb-1.5">
                  <span>🎥</span> 运镜与时长
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={scene.cameraMovement || 'none'}
                    onChange={(e) => onEditScene(scene.id, 'cameraMovement', e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/10 rounded-lg text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="none">静止</option>
                    <option value="zoom_in">推进</option>
                    <option value="zoom_out">拉远</option>
                    <option value="pan_left">左摇</option>
                    <option value="pan_right">右摇</option>
                    <option value="tilt_up">上摇</option>
                    <option value="tilt_down">下摇</option>
                    <option value="drone">航拍</option>
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={scene.duration || 5}
                      onChange={(e) => onEditScene(scene.id, 'duration', Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/10 rounded-lg text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:border-cyan-500/50"
                      min={2}
                      max={15}
                    />
                    <span className="text-xs text-neutral-400 shrink-0">秒</span>
                  </div>
                </div>
              </div>

              {/* 3. 旁白 / 音效 (Audio / VO) */}
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-amber-500 dark:text-amber-400/80 mb-1.5">
                  <span>🎙</span> 旁白 / 音效
                  <span className="text-neutral-400 dark:text-neutral-600 font-normal ml-1">· 给 TTS 模型的文本，或特定音效提示</span>
                </label>
                <input
                  type="text"
                  value={scene.narration || ''}
                  onChange={(e) => onEditScene(scene.id, 'narration', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-amber-500/50 placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                  placeholder="旁白文案、字幕或特定音效，如：打铁声、雨声…"
                />
              </div>

              {/* 4. 物理属性 (Metadata) */}
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">
                  <span>📁</span> 素材来源
                </label>
                <select
                  value={scene.assetType || 'ai_generated'}
                  onChange={(e) => onEditScene(scene.id, 'assetType', e.target.value)}
                  className="w-full px-2 py-1.5 bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/10 rounded-lg text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="ai_generated">AI 生成</option>
                  <option value="real_footage">实拍视频</option>
                  <option value="image">实拍图片</option>
                </select>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 pt-1 border-t border-neutral-200 dark:border-white/10">
                {isRealShot(scene) ? (
                  <button
                    onClick={() => onSetEditingId(null)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors"
                  >
                    <Lock size={12} />
                    保存（实拍不可润色）
                  </button>
                ) : (
                  <button
                    onClick={() => onSaveScene(scene.id)}
                    disabled={enhancingSceneId === scene.id}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {enhancingSceneId === scene.id ? (
                      <><Loader2 size={12} className="animate-spin" />AI 润色中...</>
                    ) : (
                      <><Sparkles size={12} />保存润色</>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (newSceneIds.has(scene.id) && !scene.description.trim()) {
                      onDeleteScene(scene.id);
                    }
                    onSetEditingId(null);
                  }}
                  disabled={enhancingSceneId === scene.id}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  <X size={14} />
                  取消
                </button>
              </div>
            </div>
          ) : (
            /* ── 预览模式：4 个维度清晰展示 ── */
            <div className="space-y-2">
              {/* 1. 画面描述 */}
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-relaxed">
                {scene.description}
              </p>

              {/* 3. 旁白/音效（如有） */}
              {scene.narration && (
                <div className="flex items-start gap-1.5">
                  <span className="text-xs mt-0.5 shrink-0">🎙</span>
                  <p className="text-xs text-amber-500 dark:text-amber-400/70 italic leading-relaxed">
                    "{scene.narration}"
                  </p>
                </div>
              )}

              {/* 新闻溯源标注 */}
              {scene.sourceRef && (
                <div className={`flex items-start gap-1.5 px-2 py-1 rounded-md border text-[10px] leading-relaxed ${
                  scene.isAISupplemented
                    ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-400'
                    : 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                }`}>
                  <span className="shrink-0 mt-0.5">
                    {scene.isAISupplemented ? '✦' : '📰'}
                  </span>
                  <span className="truncate" title={scene.sourceRef}>
                    {scene.isAISupplemented ? 'AI补充画面' : scene.sourceRef}
                  </span>
                </div>
              )}

              {/* 2 + 4. 运镜标签 + 物理属性 */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {scene.cameraMovement && scene.cameraMovement !== 'none' && (
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400/80 rounded-full border border-blue-200 dark:border-blue-500/20 flex items-center gap-1">
                    🎥 {getCameraMovementLabel(scene.cameraMovement)}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 rounded-full border border-neutral-200 dark:border-white/10 font-mono">
                  {scene.duration || 5}s
                </span>
                {isRealShot(scene) && (
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                    实拍
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧悬浮操作列 */}
      {!isDragOverlay && editingSceneId !== scene.id && (
        <div className="absolute right-0 inset-y-0 w-10 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity border-l border-neutral-200 dark:border-white/10">
          <button
            onClick={() => onSetEditingId(scene.id)}
            className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors text-neutral-400 dark:text-neutral-500 hover:text-cyan-500 dark:hover:text-cyan-400"
            title="编辑"
          >
            <Edit3 size={15} />
          </button>
          <div className="w-4 h-px bg-neutral-200 dark:bg-white/10" />
          <button
            onClick={() => onDeleteScene(scene.id)}
            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-neutral-400/70 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400"
            title="删除"
          >
            <Trash2 size={15} />
          </button>
          {!isLast && (
            <>
              <div className="w-4 h-px bg-neutral-200 dark:bg-white/10" />
              <button
                onClick={(e) => { e.stopPropagation(); onInsertAfter(scene.id); }}
                className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors text-neutral-300 dark:text-neutral-600 hover:text-cyan-500 dark:hover:text-cyan-400 flex flex-col items-center"
                title="在此后插入新分镜"
              >
                <Plus size={13} />
                <ChevronDown size={9} className="-mt-0.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface ScriptEditorPageProps {}

export const ScriptEditorPage: React.FC<ScriptEditorPageProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 从路由获取数据
  const { 
    proposal, 
    uploadedAssets = [],
    selectedAssetIds = [], // 选中的素材file_path列表
    userPrompt = '',
    generationMode = 'ai_generated',
    savedScenes = null,
    projectId: initialProjectId = null,
    aspectRatio: stateAspectRatio,
    artStyle: stateArtStyle,
    customStyleImage: stateCustomStyleImage
  } = (location.state || {}) as {
    proposal: InspirationProposal;
    uploadedAssets: any[];
    selectedAssetIds: string[];
    userPrompt: string;
    generationMode: string;
    savedScenes?: SceneItem[] | null;
    projectId?: string | null;
    aspectRatio?: string;
    artStyle?: string;
    customStyleImage?: File;
  };
  const queryProjectId = new URLSearchParams(location.search).get('projectId');

  // 脚本场景列表
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  
  // 当前编辑的场景ID
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);

  // 记录哪些场景是用户新增的（需要AI润色）
  const [newSceneIds, setNewSceneIds] = useState<Set<string>>(new Set());
  // 记录正在被AI润色的场景ID
  const [enhancingSceneId, setEnhancingSceneId] = useState<string | null>(null);
  // 当前选中的场景ID（用于拖拽排序）
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  // 当前正在拖拽的场景ID（用于 DragOverlay）
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  // AI助手输入框
  const [aiSidebarOpen, setAiSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  );
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
  }>>([]);

  // AI 变更撤销：保存上一次操作前的场景快照
  const [undoSnapshot, setUndoSnapshot] = useState<SceneItem[] | null>(null);
  // AI 变更高亮：记录最近被 AI 修改/新增的场景 ID 集合
  const [aiChangedIds, setAiChangedIds] = useState<Set<string>>(new Set());

  // 对话历史自动滚动
  const conversationEndRef = useRef<HTMLDivElement>(null);
  // 记录欢迎消息是否已初始化（避免增删场景时重复重置）
  const welcomeInitialized = useRef(false);
  // 当前 AI 请求的取消控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  // 全局模式快捷建议
  const globalSuggestions = [
    '增加一个开场白',
    '让节奏更紧凑',
    '添加情感转折',
    '优化镜头语言',
    '增加冲突场景',
    '让开头更吸引人',
    '增加幽默元素',
    '强化高潮部分',
  ];

  // 局部模式快捷建议（针对单个分镜）
  const localSuggestions = [
    '添加慢动作',
    '修改背景音乐',
    '优化镜头角度',
    '增强视觉效果',
    '修改旁白文案',
    '调整场景时长',
    '增加特写镜头',
    '改变情绪基调',
  ];

  // 项目设置
  const [projectTitle, setProjectTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3'>((stateAspectRatio as any) || '16:9');
  const [sceneCount, setSceneCount] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [settingInput, setSettingInput] = useState(proposal?.visualStyle || ''); // 全局视觉画风
  const [globalBgm, setGlobalBgm] = useState(proposal?.bgmStyle || ''); // 全局配乐风格
  
  
  // 艺术风格 / 自定义图（用于传递给分镜页）
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>(stateArtStyle || '');
  const [customStyleImage, setCustomStyleImage] = useState<File | undefined>(stateCustomStyleImage);

  // 初始化场景数据
  useEffect(() => {
    if (!proposal) {
      if (queryProjectId) {
        let cancelled = false;
        const restoreProject = async () => {
          const result = await getProject(queryProjectId);
          if (cancelled) return;
          const project = result.data;
          const settings = project?.settings || {};
          if (result.success && project && settings.inspirationProposal) {
            navigate('/script-editor', {
              replace: true,
              state: {
                proposal: settings.inspirationProposal,
                uploadedAssets: settings.uploadedAssets || project.uploadedAssets || [],
                selectedAssetIds: settings.selectedAssetIds || [],
                userPrompt: project.userPrompt || '',
                generationMode: settings.generationMode || project.generationMode || 'ai_generated',
                savedScenes: settings.customScenes || null,
                projectId: project.id,
                aspectRatio: settings.aspectRatio || '16:9',
                artStyle: settings.artStyle,
              },
            });
            return;
          }
          navigate('/');
        };
        restoreProject();
        return () => { cancelled = true; };
      }
      navigate('/');
      return;
    }

    // 如果有保存的场景数据，直接使用
    if (savedScenes && savedScenes.length > 0) {
      setScenes(savedScenes);
      setProjectTitle(proposal.title || '未命名项目');
      setSceneCount(savedScenes.length);
      if (initialProjectId) {
        setProjectId(initialProjectId);
      }
      return;
    }

    // 否则转换proposal的粗略脚本为可编辑的场景列表
    const initialScenes: SceneItem[] = proposal.roughScript.scenes.map((scene: any, index: number) => {
      // 判断是否关联了实拍素材：优先用 assetPath 匹配 file_path
      const assetPath = scene.assetPath || scene.reference_asset_path;
      const matchedAsset = assetPath
        ? uploadedAssets.find((a: any) => a.file_path === assetPath || a.url === assetPath)
        : null;
      const isRealShot = !!matchedAsset || scene.type === 'mixed_media' || scene.isRealShot;
      const assetType = isRealShot
        ? (matchedAsset?.file_type === 'video' ? 'real_footage' as const : 'image' as const)
        : 'ai_generated' as const;

      // 清理描述：移除"开场："、"分镜1："等前缀
      let cleanDescription = scene.description || '';
      cleanDescription = cleanDescription.replace(/^(开场|结尾|分镜\d+)[：:]\s*/i, '');

      return {
        id: `scene-${index}`,
        sceneNumber: index + 1,
        description: cleanDescription,
        narration: scene.narration || '',
        visualStyle: scene.visualStyle || proposal.visualStyle,
        bgmStyle: scene.bgmStyle || proposal.bgmStyle,
        assetType,
        assetId: matchedAsset?.file_path,
        duration: scene.duration || 5,
        cameraMovement: scene.cameraMovement,
        visualPrompt: scene.visualPrompt,
        motionPrompt: scene.motionPrompt,
        designReason: scene.designReason,
        // 分镜板展示字段（AI生成）
        size: scene.size,
        perspective: scene.perspective,
        equipment: scene.equipment,
        focalLength: scene.focalLength,
        dialogue: scene.dialogue,
        notes: scene.notes,
        // 新闻溯源字段
        sourceRef: scene.sourceRef,
        isAISupplemented: scene.isAISupplemented,
      };
    });

    setScenes(initialScenes);
    setProjectTitle(proposal.title || '未命名项目');
    setSceneCount(initialScenes.length);
  }, [proposal, uploadedAssets, selectedAssetIds, savedScenes, initialProjectId, queryProjectId, navigate]);

  // 从路由 state 同步画幅与风格
  useEffect(() => {
    if (stateAspectRatio) setAspectRatio(stateAspectRatio as any);
    if (stateArtStyle) setSelectedArtStyle(stateArtStyle);
  }, [stateAspectRatio, stateArtStyle]);

  // 进入脚本编辑页时立刻把 currentPage 标记为 'script-editor'
  // 这样无论用户通过哪个路径离开，项目都能恢复到正确的步骤
  useEffect(() => {
    if (!initialProjectId || !proposal) return;
    updateProject(initialProjectId, {
      settings: {
        generationMode,
        uploadedAssets,
        selectedAssetIds,
        inspirationMode: true,
        inspirationProposal: proposal,
        aspectRatio: stateAspectRatio || '16:9',
        customScenes: savedScenes || [],
        currentPage: 'script-editor',
      },
    } as any).catch(() => {});
  // 只在挂载时运行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  // 欢迎消息只在首次进入时初始化，不随 scenes 变化重置
  useEffect(() => {
    if (proposal && !welcomeInitialized.current) {
      welcomeInitialized.current = true;
      setConversationHistory([
        {
          role: 'assistant',
          content: `我已经根据你的创意生成了分镜场景。你可以直接编辑每个场景，或者告诉我你想调整的地方，比如：\n\n• "第3个场景太平淡了，加点动作"\n• "整体节奏太慢，让它更紧凑"\n• "在第2个场景后加一个过渡"\n• "删除最后一个场景"\n\n有什么想法吗？`
        }
      ]);
    }
  }, [proposal]);

  // 对话历史更新时自动滚动到底部
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, aiLoading]);

  // 处理场景编辑
  const handleEditScene = (sceneId: string, field: keyof SceneItem, value: any) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId ? { ...scene, [field]: value } : scene
    ));
  };

  // 删除场景
  const handleDeleteScene = (sceneId: string) => {
    setScenes(scenes.filter(scene => scene.id !== sceneId));
  };

  // 添加新场景（标记为新增，保存时需AI润色）
  const handleAddScene = () => {
    const newId = `scene-${Date.now()}`;
    const newSceneNum = scenes.length + 1;
    const newScene: SceneItem = {
      id: newId,
      sceneNumber: newSceneNum,
      description: '',
      assetType: 'ai_generated',
      duration: 5
    };
    setScenes(prev => [...prev, newScene]);
    setNewSceneIds(prev => new Set(prev).add(newId));
    setEditingSceneId(newId);
  };

  // 在指定分镜后插入新分镜
  const handleInsertSceneAfter = (afterSceneId: string) => {
    const newId = `scene-${Date.now()}`;
    const newScene: SceneItem = {
      id: newId,
      sceneNumber: 0,
      description: '',
      assetType: 'ai_generated',
      duration: 5
    };
    setScenes(prev => {
      const idx = prev.findIndex(s => s.id === afterSceneId);
      const updated = [...prev];
      updated.splice(idx + 1, 0, newScene);
      return updated.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    });
    setNewSceneIds(prev => new Set(prev).add(newId));
    setEditingSceneId(newId);
  };

  // 保存并 AI 润色：所有场景（新增或已有）均调用 AI，根据完整上下文写出分镜内容
  const handleSaveScene = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) { setEditingSceneId(null); return; }

    // 实拍场景不调用 AI，直接保存关闭
    if (isRealShot(scene)) {
      setEditingSceneId(null);
      return;
    }

    // 如果描述为空则直接关闭
    if (!scene.description.trim()) {
      setEditingSceneId(null);
      return;
    }

    // 获取前后场景，供AI参考叙事连贯性
    const idx = scenes.findIndex(s => s.id === sceneId);
    const surroundingScenes = {
      prev: idx > 0 ? scenes[idx - 1] : undefined,
      next: idx < scenes.length - 1 ? scenes[idx + 1] : undefined
    };

    setEnhancingSceneId(sceneId);
    try {
      const result = await enhanceSceneApi({
        scene,
        surroundingScenes,
        allScenes: scenes,
        proposal,
        userPrompt
      });

      if (result.success && result.data?.scene) {
        const enhanced = result.data.scene;
        setScenes(prev => prev.map(s => s.id === sceneId ? enhanced : s));
        setNewSceneIds(prev => { const next = new Set(prev); next.delete(sceneId); return next; });
        setConversationHistory(prev => [...prev, {
          role: 'assistant',
          content: `✨ 已完成分镜 ${scene.sceneNumber} 的AI润色：\n\n${enhanced.description}\n\n${enhanced.designReason ? `💡 设计思路：${enhanced.designReason}` : ''}`
        }]);
      } else {
        console.error('AI润色失败:', result.error);
        alert(`AI润色失败：${result.error || '未知错误'}`);
      }
    } catch (err) {
      console.error('润色异常:', err);
      alert('AI润色请求异常，请重试');
    } finally {
      setEnhancingSceneId(null);
      setEditingSceneId(null);
    }
  };

  // 拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setSelectedSceneId(event.active.id as string);
  };

  // 拖拽结束 - 重新排序
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (over && active.id !== over.id) {
      setScenes(prev => {
        const oldIndex = prev.findIndex(s => s.id === active.id);
        const newIndex = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIndex, newIndex).map((scene, index) => ({
          ...scene,
          sceneNumber: index + 1,
        }));
      });
    }
  };

  // 保存项目
  const handleSaveProject = async () => {
    setIsSaving(true);
    
    try {
      const projectData = {
        title: projectTitle,
        description: userPrompt,
        userPrompt: userPrompt,
        settings: {
          generationMode: generationMode,
          uploadedAssets: uploadedAssets,
          selectedAssetIds: selectedAssetIds,
          inspirationMode: true,
          inspirationProposal: proposal,
          aspectRatio: aspectRatio,
          customScenes: scenes, // 保存编辑后的场景
          currentPage: 'script-editor' // 标记当前页面状态
        }
      };

      let result;
      if (projectId) {
        // 更新现有项目
        result = await updateProject(projectId, projectData);
      } else {
        // 创建新项目
        result = await createProject(projectData);
        if (result.success && result.data) {
          setProjectId(result.data.id);
        }
      }

      if (result.success) {
        console.log('✅ 项目保存成功');
      } else {
        console.error('❌ 项目保存失败:', result.error);
      }
    } catch (error) {
      console.error('❌ 保存项目异常:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 返回首页（保存后返回）
  const handleGoBack = async () => {
    await handleSaveProject();
    navigate('/');
  };

  // 停止当前 AI 请求
  const handleStopChat = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAiLoading(false);
    setConversationHistory(prev => [...prev, {
      role: 'assistant',
      content: '已停止回复。'
    }]);
  };

  // 整体重新生成分镜 - 复用 chatWithAI 的 JSON 结构化路径
  const handleRegenerateAll = async () => {
    const direction = aiInput.trim();
    const instruction = direction
      ? `整体重新优化所有分镜，方向：${direction}`
      : '整体重新优化所有分镜，提升叙事节奏和画面感，保留各场景的核心内容';
    setAiInput('');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setAiLoading(true);
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: direction ? `整体重新生成：${direction}` : '整体重新生成'
    }]);
    try {
      const result = await scriptEditApi.chatWithAI({
        userInput: instruction,
        currentScenes: scenes,
        conversationHistory,
        proposal,
        userPrompt
      }, controller.signal);

      if (result.error === 'cancelled') return; // 用户主动取消，静默处理

      if (result.success && result.data) {
        const { message, changes } = result.data;
        setConversationHistory(prev => [...prev, { role: 'assistant', content: message }]);
        if (changes && changes.length > 0) {
          applyAiChanges(changes);
        }
      } else {
        throw new Error(result.error || '重新生成失败');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.name === 'CanceledError') return;
      console.error('整体重新生成失败:', error);
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，整体重新生成遇到问题，请重试或描述更具体的修改方向。'
      }]);
    } finally {
      abortControllerRef.current = null;
      setAiLoading(false);
    }
  };

  // 与AI对话 - 直接接收结构化 JSON，应用 changes 到分镜列表
  const handleAiChat = async () => {
    if (!aiInput.trim()) return;

    const rawInput = aiInput.trim();
    const selectedScene = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) : null;

    const userMessage = selectedScene
      ? `请只修改分镜${selectedScene.sceneNumber}：${rawInput}`
      : rawInput;
    const displayMessage = selectedScene
      ? `[分镜 ${selectedScene.sceneNumber}] ${rawInput}`
      : rawInput;

    setAiInput('');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setAiLoading(true);
    setConversationHistory(prev => [...prev, { role: 'user', content: displayMessage }]);

    try {
      const result = await scriptEditApi.chatWithAI({
        userInput: userMessage,
        currentScenes: scenes,
        conversationHistory,
        proposal,
        userPrompt
      }, controller.signal);

      if (result.error === 'cancelled') return; // 用户主动取消，静默处理

      if (result.success && result.data) {
        const { message, changes } = result.data;
        setConversationHistory(prev => [...prev, { role: 'assistant', content: message }]);
        if (changes && changes.length > 0) {
          applyAiChanges(changes);
        }
      } else {
        throw new Error(result.error || 'AI响应失败');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.name === 'CanceledError') return;
      console.error('AI对话失败:', error);
      const errMsg = (error?.message || '').includes('503')
        ? 'AI 服务暂时不可用，请稍后再试。'
        : (error?.message || '').includes('timeout')
        ? 'AI 响应超时，请稍后重试或缩短指令。'
        : '抱歉，遇到了一些问题，请重试或直接手动编辑分镜。';
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: errMsg
      }]);
    } finally {
      abortControllerRef.current = null;
      setAiLoading(false);
    }
  };

  // 将 AI 返回的 changes 数组应用到 scenes，同时保存撤销快照并高亮变更场景
  const applyAiChanges = (changes: import('../api/scriptEditApi').AiChange[]) => {
    setScenes(prev => {
      // 保存快照用于撤销
      setUndoSnapshot(prev.map(s => ({ ...s })));

      let updated = prev.map(s => ({ ...s }));
      const changedIds = new Set<string>();

      // 1. 先处理 edit（直接改字段）
      for (const c of changes) {
        if (c.type === 'edit' && c.sceneIndex !== undefined && c.sceneIndex >= 0 && c.sceneIndex < updated.length) {
          updated[c.sceneIndex] = { ...updated[c.sceneIndex], ...(c.fields || {}) };
          changedIds.add(updated[c.sceneIndex].id);
        }
      }

      // 2. 处理 add（倒序插入，避免下标偏移）
      const adds = changes.filter(c => c.type === 'add' && c.afterIndex !== undefined);
      adds.sort((a, b) => (b.afterIndex ?? 0) - (a.afterIndex ?? 0));
      for (const c of adds) {
        const insertAt = (c.afterIndex ?? -1) + 1; // afterIndex=-1 → insertAt=0
        const newId = `scene-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newScene = {
          id: newId,
          sceneNumber: insertAt + 1,
          description: '',
          assetType: 'ai_generated' as const,
          duration: 5,
          ...(c.scene || {})
        };
        updated.splice(Math.max(0, insertAt), 0, newScene);
        changedIds.add(newId);
      }

      // 3. 处理 delete（倒序删除，避免下标偏移）
      const deletes = changes.filter(c => c.type === 'delete' && c.sceneIndex !== undefined);
      deletes.sort((a, b) => (b.sceneIndex ?? 0) - (a.sceneIndex ?? 0));
      for (const c of deletes) {
        if ((c.sceneIndex ?? -1) >= 0 && (c.sceneIndex ?? -1) < updated.length) {
          updated.splice(c.sceneIndex!, 1);
        }
      }

      // 更新高亮集合，2.5秒后自动清除
      if (changedIds.size > 0) {
        setAiChangedIds(changedIds);
        setTimeout(() => setAiChangedIds(new Set()), 2500);
      }

      // 重新编号
      return updated.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    });
  };

  // 撤销上一次 AI 操作
  const handleUndoAiChanges = () => {
    if (!undoSnapshot) return;
    setScenes(undoSnapshot);
    setUndoSnapshot(null);
    setAiChangedIds(new Set());
    setConversationHistory(prev => [...prev, {
      role: 'assistant',
      content: '✓ 已撤销上一次 AI 操作，分镜已恢复。'
    }]);
  };

  // 确认并继续创作 - 先保存项目再跳转到风格选择页
  const handleConfirmAndContinue = async () => {
    // Save current state so projectId is valid and scenes are persisted
    let finalProjectId = projectId;
    try {
      const projectData = {
        title: projectTitle,
        description: userPrompt,
        userPrompt,
        settings: {
          generationMode,
          uploadedAssets,
          selectedAssetIds,
          inspirationMode: true,
          inspirationProposal: proposal,
          aspectRatio,
          customScenes: scenes,
          currentPage: 'style-selection',
        },
      };
      if (projectId) {
        await updateProject(projectId, projectData);
      } else {
        const result = await createProject(projectData);
        if (result.success && result.data) {
          finalProjectId = result.data.id;
          setProjectId(finalProjectId);
        }
      }
    } catch (e) {
      console.error('[ScriptEditor] 保存失败，继续跳转:', e);
    }

    navigate('/style-selection', {
      state: {
        projectId: finalProjectId,
        scenes,
        userPrompt,
        uploadedAssets,
        generationMode,
        proposal,
        aspectRatio,
        settingInput,
        globalBgm,
      },
    });
  };

  // 风格选择确认后跳转（保留供外部调用兼容）
  const handleStyleConfirm = async (selectedAspectRatio: string, artStyle: string, customStyle?: File) => {
    setAspectRatio(selectedAspectRatio as '16:9' | '9:16' | '1:1' | '4:3');
    setSelectedArtStyle(artStyle);
    setCustomStyleImage(customStyle);
    
    console.log('[ScriptEditor] 🎬 准备跳转到分镜页面，画幅比例:', selectedAspectRatio);
    
    // ⭐ 先保存/创建项目，确保有 projectId
    let finalProjectId = projectId;
    
    if (!projectId) {
      console.log('[ScriptEditor] 📁 创建新项目...');
      try {
        const projectData = {
          title: projectTitle,
          description: userPrompt,
          userPrompt: userPrompt,
          settings: {
            generationMode: generationMode,
            uploadedAssets: uploadedAssets,
            selectedAssetIds: selectedAssetIds,
            inspirationMode: true,
            inspirationProposal: proposal,
            aspectRatio: selectedAspectRatio,
            artStyle: artStyle,
            customScenes: scenes,
            customVisualStyle: settingInput.trim() || undefined, // Setting 视觉风格
            currentPage: 'storyboard' // 标记即将进入分镜页面
          }
        };
        
        const result = await createProject(projectData);
        if (result.success && result.data) {
          finalProjectId = result.data.id;
          setProjectId(finalProjectId);
          console.log('[ScriptEditor] ✅ 项目创建成功:', finalProjectId);
        } else {
          console.error('[ScriptEditor] ❌ 项目创建失败:', result.error);
          // 即使失败也继续，降级处理
        }
      } catch (error) {
        console.error('[ScriptEditor] ❌ 创建项目异常:', error);
        // 继续跳转，降级处理
      }
    } else {
      console.log('[ScriptEditor] 💾 更新现有项目...');
      try {
        const projectData = {
          settings: {
            generationMode: generationMode,
            uploadedAssets: uploadedAssets,
            selectedAssetIds: selectedAssetIds,
            inspirationMode: true,
            inspirationProposal: proposal,
            aspectRatio: selectedAspectRatio,
            artStyle: artStyle,
            customScenes: scenes,
            customVisualStyle: settingInput.trim() || undefined, // Setting 视觉风格
            currentPage: 'storyboard'
          }
        };
        
        const result = await updateProject(projectId, projectData);
        if (result.success) {
          console.log('[ScriptEditor] ✅ 项目更新成功');
        } else {
          console.error('[ScriptEditor] ❌ 项目更新失败:', result.error);
        }
      } catch (error) {
        console.error('[ScriptEditor] ❌ 更新项目异常:', error);
      }
    }
    
    // 设置导航标记，防止被误判为刷新
    sessionStorage.setItem('storyboard_navigation_flag', 'true');
    
    // 跳转到分镜页面，传递优化后的脚本数据和风格设置
    // Setting 输入的视觉风格会覆盖默认风格，用于分镜/图片生成
    const finalVisualStyle = settingInput.trim() || proposal.visualStyle;
    console.log('[ScriptEditor] 🎬 跳转到分镜页面');
    navigate(finalProjectId ? `/storyboard?projectId=${finalProjectId}` : '/storyboard', {
      state: {
        projectId: finalProjectId,
        userPrompt,
        uploadedAssets,
        generationMode,
        customScenes: scenes, // 传递用户编辑后的场景
        aspectRatio: selectedAspectRatio, // ⭐ 画幅比例 - 用于控制生成图片/视频的尺寸
        artStyle: artStyle,
        customStyleImage: customStyle,
        inspirationData: {
          proposal,
          visualStyle: finalVisualStyle, // Setting 可自定义整体视觉风格，影响分镜生成
          bgmStyle: proposal.bgmStyle,
          aspectRatio: selectedAspectRatio
        }
      }
    });
  };

  // 获取素材类型图标（实拍素材使用相机/录像图标，更醒目）

  if (!proposal) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400">加载中...</p>
        </div>
      </div>
    );
  }

  const selectedScene = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) : null;
  const isRealShotSelected = selectedScene ? isRealShot(selectedScene) : false;

  return (
    <div className="nm-flow-page nm-script-editor-page flex-1 flex h-full overflow-hidden relative z-10">
      {/* ── Main Content ─────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 sm:p-8 sm:pb-32">
          <div className="max-w-screen-xl mx-auto">

            {/* Scene Header */}
            <div className="nm-page-heading flex flex-col items-start gap-4 mb-6 sm:flex-row sm:items-center sm:gap-6">
              <h2 className="flex w-full min-w-0 items-center gap-3 break-words text-lg font-medium tracking-wide text-neutral-900 dark:text-white sm:text-xl">
                <div className="w-1.5 h-6 shrink-0 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                {proposal.title || '脚本检查'}
              </h2>
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-neutral-600 dark:text-neutral-400 font-mono text-xs uppercase tracking-widest bg-neutral-200 dark:bg-white/5 px-3 py-1 rounded-full border border-neutral-300 dark:border-white/10">
                <Sparkles size={12} className="shrink-0 text-cyan-400" />
                <span>{scenes.length} 个分镜</span>
              </div>
              {/* Global Settings inline */}
              <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto sm:flex-nowrap">
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as any)}
                  className="min-w-20 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 font-mono"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                </select>
                <button
                  onClick={handleAddScene}
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs border border-dashed border-cyan-500/40 text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-colors font-mono tracking-wider"
                >
                  <Plus size={14} className="shrink-0" />
                  添加分镜
                </button>
              </div>
            </div>

            {/* Global Style Settings */}
            <div className="nm-editorial-panel nm-page-field-panel mb-6 bg-white/50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/10 rounded-xl p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-mono text-neutral-500 dark:text-neutral-500 uppercase tracking-widest mb-2 block">🎨 视觉画风</label>
                <textarea
                  value={settingInput}
                  onChange={(e) => setSettingInput(e.target.value)}
                  placeholder="整体视觉风格，如：高饱和对比，电影感..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-neutral-500 dark:text-neutral-500 uppercase tracking-widest mb-2 block">🎵 背景配乐</label>
                <textarea
                  value={globalBgm}
                  onChange={(e) => setGlobalBgm(e.target.value)}
                  placeholder="背景音乐风格，如：粤语 Rap，轻柔钢琴..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>
            </div>

            {/* Scene Cards with DnD */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={scenes.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {scenes.map((scene, index) => (
                    <SceneReorderItem
                      key={scene.id}
                      scene={scene}
                      editingSceneId={editingSceneId}
                      enhancingSceneId={enhancingSceneId}
                      newSceneIds={newSceneIds}
                      selectedSceneId={selectedSceneId}
                      aiChangedIds={aiChangedIds}
                      isLast={index === scenes.length - 1}
                      onEditScene={handleEditScene}
                      onSaveScene={handleSaveScene}
                      onDeleteScene={handleDeleteScene}
                      onSetEditingId={setEditingSceneId}
                      onSetSelectedId={setSelectedSceneId}
                      onInsertAfter={handleInsertSceneAfter}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragId ? (
                  <SceneReorderItem
                    scene={scenes.find(s => s.id === activeDragId)!}
                    editingSceneId={null}
                    enhancingSceneId={null}
                    newSceneIds={new Set()}
                    selectedSceneId={activeDragId}
                    isDragOverlay
                    isLast
                    onEditScene={() => {}}
                    onSaveScene={() => {}}
                    onDeleteScene={() => {}}
                    onSetEditingId={() => {}}
                    onSetSelectedId={() => {}}
                    onInsertAfter={() => {}}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            <button
              onClick={handleAddScene}
              className="mt-4 w-full py-4 border border-dashed border-neutral-300 dark:border-white/10 rounded-xl text-neutral-500 dark:text-neutral-500 hover:text-cyan-500 dark:hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all flex items-center justify-center gap-2 group"
            >
              <Plus size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium font-mono tracking-wider">添加分镜</span>
            </button>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="nm-day-action-bar absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-neutral-50 via-neutral-50/90 dark:from-[#050505] dark:via-[#050505]/80 to-transparent flex flex-col items-stretch justify-between gap-3 z-20 pointer-events-none sm:flex-row sm:items-center">
          <div className="text-xs font-mono text-neutral-500 dark:text-neutral-600 pointer-events-auto text-center sm:text-left">
            {scenes.length} 个分镜 · {scenes.filter(s => s.assetType === 'real_footage' || s.assetType === 'image').length} 个实拍素材
          </div>
          <div className="flex items-center justify-center gap-3 pointer-events-auto">
            <button
              onClick={handleGoBack}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors font-mono tracking-wider"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              {isSaving ? '保存中...' : '返回'}
            </button>
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(34,211,238,0.6)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirmAndContinue}
              className="flex flex-1 items-center justify-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)] border border-white/20 font-mono tracking-widest text-sm sm:flex-none sm:px-10"
            >
              选择风格
              <ChevronRight size={16} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── AI Sidebar edge tab: expand (closed) / collapse (open) ─── */}
      <AnimatePresence>
        {!aiSidebarOpen ? (
          <motion.button
            key="ai-expand"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={() => setAiSidebarOpen(true)}
            className="nm-day-edge-tab absolute right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 px-1.5 py-4 bg-black/60 dark:bg-black/80 backdrop-blur-xl border-l border-t border-b border-white/10 rounded-l-xl text-cyan-400 hover:text-cyan-300 hover:bg-black/80 transition-all shadow-xl"
            title="打开 AI 改稿助手"
          >
            <BotMessageSquare size={16} />
            <span className="text-[9px] font-mono tracking-widest" style={{ writingMode: 'vertical-rl' }}>改稿</span>
            <ChevronLeft size={12} className="opacity-60" />
          </motion.button>
        ) : (
          <motion.button
            key="ai-collapse"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={() => setAiSidebarOpen(false)}
            className="nm-day-edge-tab hidden md:flex absolute right-80 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1.5 px-1.5 py-4 bg-black/60 dark:bg-black/80 backdrop-blur-xl border-l border-t border-b border-white/10 rounded-l-xl text-neutral-400 hover:text-cyan-300 hover:bg-black/80 transition-all shadow-xl"
            title="收起 AI 改稿助手"
          >
            <BotMessageSquare size={16} className="text-cyan-400" />
            <span className="text-[9px] font-mono tracking-widest text-cyan-400" style={{ writingMode: 'vertical-rl' }}>改稿</span>
            <ChevronRight size={12} className="opacity-60" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Right AI Sidebar ─────────────────────────────── */}
      <AnimatePresence initial={false}>
        {aiSidebarOpen && (
          <>
            <motion.button
              key="ai-mobile-backdrop"
              type="button"
              aria-label="关闭 AI 改稿助手"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setAiSidebarOpen(false)}
              className="absolute inset-0 z-30 bg-black/45 backdrop-blur-sm md:hidden"
            />
            <motion.div
              key="ai-sidebar"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="nm-day-sidebar absolute inset-y-0 right-0 z-40 flex w-[calc(100vw-48px)] max-w-[340px] flex-col overflow-hidden border-l border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d0d0d]/95 md:relative md:right-auto md:z-20 md:w-80 md:max-w-none md:shrink-0 md:shadow-none"
            >
            <div className="w-full md:w-80 flex flex-col h-full">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/80 dark:bg-black/30 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-cyan-500 dark:text-cyan-400" />
                  <span className="font-medium text-sm text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-500 tracking-wide uppercase">
                    AI 改稿助手
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-neutral-200/60 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded border border-neutral-300/50 dark:border-white/10">
                  {selectedSceneId ? `分镜 ${selectedScene?.sceneNumber}` : '全局'}
                </span>
                <button
                  onClick={() => setAiSidebarOpen(false)}
                  className="md:hidden text-neutral-500 hover:text-neutral-200 transition-colors"
                  aria-label="关闭 AI 改稿助手"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Mode Status */}
              <div className="px-4 py-2.5 border-b border-neutral-200/60 dark:border-white/5 shrink-0">
                <AnimatePresence mode="wait">
                  {isRealShotSelected ? (
                    <motion.div key="real" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2">
                      <Lock size={12} className="text-blue-400" />
                      <span className="text-xs text-blue-400">实拍分镜已锁定</span>
                      <button onClick={() => setSelectedSceneId(null)} className="ml-auto text-[10px] text-neutral-500 hover:text-white">
                        <X size={12} />
                      </button>
                    </motion.div>
                  ) : selectedSceneId ? (
                    <motion.div key="local" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                      <span className="text-xs text-cyan-400">修改分镜 {selectedScene?.sceneNumber}</span>
                      <button onClick={() => setSelectedSceneId(null)} className="ml-auto text-[10px] text-neutral-500 hover:text-white">
                        <X size={12} />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="global" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">全局修改模式</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Quick Tags */}
              <div className="px-4 pt-3 pb-2 shrink-0">
                {!isRealShotSelected && (
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedSceneId ? localSuggestions : globalSuggestions).slice(0, 6).map(tag => (
                      <button
                        key={tag}
                        onClick={() => setAiInput(tag)}
                        disabled={aiLoading}
                        className="text-xs px-2.5 py-1 bg-neutral-100 dark:bg-white/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 border border-neutral-200 dark:border-white/10 hover:border-cyan-200 dark:hover:border-cyan-500/30 rounded-full text-neutral-600 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Conversation History */}
              <div
                className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-400/30 [&::-webkit-scrollbar-thumb]:rounded-full"
              >
                <AnimatePresence>
                  {conversationHistory.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl text-xs leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-500/20 text-neutral-800 dark:text-cyan-100/80 ml-4'
                          : 'bg-neutral-100/80 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5 text-neutral-700 dark:text-neutral-300 mr-4'
                      }`}
                    >
                      {message.content}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {aiLoading && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 px-1">
                    <Loader2 size={13} className="animate-spin text-cyan-400" />
                    AI 正在思考...
                  </div>
                )}
                <div ref={conversationEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-neutral-200 dark:border-white/10 shrink-0 space-y-2">
                <textarea
                  value={aiInput}
                  onChange={e => !isRealShotSelected && setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !aiLoading && !isRealShotSelected) { e.preventDefault(); handleAiChat(); } }}
                  placeholder={
                    isRealShotSelected ? '实拍素材不可通过 AI 修改'
                      : aiLoading ? 'AI 正在思考...'
                      : selectedSceneId ? `修改分镜 ${selectedScene?.sceneNumber}...`
                      : '告诉 AI 你想怎么改...'
                  }
                  disabled={aiLoading || isRealShotSelected}
                  className="w-full bg-neutral-50 dark:bg-black/50 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 resize-none min-h-[72px] transition-colors disabled:opacity-60 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-400/30 [&::-webkit-scrollbar-thumb]:rounded-full"
                  rows={3}
                />
                {/* Send / Stop button */}
                {aiLoading ? (
                  <button
                    onClick={handleStopChat}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-xs text-red-400 hover:text-red-300 transition-all font-mono tracking-wider"
                  >
                    <Square size={13} fill="currentColor" />
                    停止生成
                  </button>
                ) : (
                  <button
                    onClick={handleAiChat}
                    disabled={!aiInput.trim() || isRealShotSelected}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-500 hover:to-blue-600 disabled:from-neutral-300 disabled:to-neutral-300 dark:disabled:from-white/10 dark:disabled:to-white/10 rounded-xl text-xs text-white disabled:text-neutral-400 dark:disabled:text-neutral-600 transition-all font-mono tracking-wider shadow-sm disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <Send size={13} />
                    发送
                  </button>
                )}
                {/* Undo button — only when AI has made changes */}
                {undoSnapshot && !aiLoading && (
                  <button
                    onClick={handleUndoAiChanges}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-neutral-300/60 dark:border-white/10 hover:border-orange-400/60 rounded-xl text-xs text-neutral-500 dark:text-neutral-400 hover:text-orange-400 dark:hover:text-orange-400 hover:bg-orange-500/5 transition-all font-mono tracking-wider"
                  >
                    <RefreshCw size={12} />
                    撤销上次 AI 操作
                  </button>
                )}
              </div>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
