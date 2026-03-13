import React, { useState, useRef, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Square, Tv, Plus, Check, Loader2 } from 'lucide-react';
import { createProject, updateProject } from '../api/projectApi';
import { InspirationProposal } from './InspirationModal';
import { CollaborationContext } from './collaboration/CollaborationPanel';
import { MEMBERS } from './collaboration/mockData';

// ── Static Data ───────────────────────────────────────────────────────────────

const RATIOS = [
  { id: '16:9', label: '横屏', icon: Monitor, desc: 'YouTube / 网页' },
  { id: '9:16', label: '竖屏', icon: Smartphone, desc: '抖音 / 短视频' },
  { id: '1:1', label: '方形', icon: Square, desc: 'Instagram' },
  { id: '4:3', label: '标准', icon: Tv, desc: '传统电视' },
];

const ART_STYLES = [
  { id: 'children', name: '儿童画', image: '/风格/儿童画.png' },
  { id: 'animation', name: '动画', image: '/风格/动画.png' },
  { id: 'japanese', name: '日本水墨画', image: '/风格/日本水墨画.png' },
  { id: 'realistic', name: '真实', image: '/风格/真实.png' },
  { id: 'pencil', name: '铅笔画', image: '/风格/铅笔画.png' },
  { id: 'retro', name: '黑白复古', image: '/风格/黑白复古.png' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const StyleSelectionPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    projectId: initialProjectId,
    scenes = [],
    userPrompt = '',
    uploadedAssets = [],
    generationMode = 'ai_generated',
    proposal,
    aspectRatio: initialAspectRatio = '16:9',
    settingInput = '',
  } = (location.state || {}) as {
    projectId?: string | null;
    scenes?: any[];
    userPrompt?: string;
    uploadedAssets?: any[];
    generationMode?: string;
    proposal?: InspirationProposal;
    aspectRatio?: string;
    settingInput?: string;
  };

  const [selectedRatio, setSelectedRatio] = useState(initialAspectRatio);
  const [selectedStyle, setSelectedStyle] = useState('');
  const [customStyleFile, setCustomStyleFile] = useState<File | null>(null);
  const [customStylePreview, setCustomStylePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const { injectEvent } = useContext(CollaborationContext);

  const handleSelectRatio = (ratioId: string, ratioLabel: string) => {
    setSelectedRatio(ratioId);
    const operator = MEMBERS[0];
    injectEvent(
      {
        id: `style_ratio_${Date.now()}`,
        actionType: 'style_changed',
        title: `画幅比例更改为 ${ratioId}`,
        summary: `视频画幅从当前比例切换为 ${ratioId} ${ratioLabel}`,
        operatorId: operator.id,
        timestamp: new Date().toISOString(),
        timeAgo: '刚刚',
        impactRoles: ['director', 'editor'],
        priority: 'low',
        stage: 'style',
      },
      {
        id: `sys_ratio_${Date.now()}`,
        type: 'system',
        systemType: 'version_saved',
        authorId: operator.id,
        description: `将画幅比例更新为 ${ratioId}`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        date: 'today',
      }
    );
  };

  const handleSelectStyle = (styleId: string, styleName: string) => {
    setSelectedStyle(styleId);
    const operator = MEMBERS[2]; // Jordan Wu – designer
    injectEvent(
      {
        id: `style_art_${Date.now()}`,
        actionType: 'style_changed',
        title: `艺术风格选定：${styleName}`,
        summary: `视觉风格已切换至「${styleName}」，将应用于全部分镜画面`,
        operatorId: operator.id,
        timestamp: new Date().toISOString(),
        timeAgo: '刚刚',
        impactRoles: ['director', 'designer'],
        priority: 'medium',
        stage: 'style',
      },
      {
        id: `sys_style_${Date.now()}`,
        type: 'system',
        systemType: 'version_saved',
        authorId: operator.id,
        description: `艺术风格更新为「${styleName}」`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        date: 'today',
      }
    );
  };

  // Mark project as being on style-selection so sidebar can restore correctly
  useEffect(() => {
    if (initialProjectId) {
      updateProject(initialProjectId, {
        settings: {
          generationMode,
          uploadedAssets,
          inspirationMode: true,
          inspirationProposal: proposal,
          aspectRatio: selectedRatio,
          customScenes: scenes,
          customVisualStyle: settingInput.trim() || undefined,
          currentPage: 'style-selection',
        },
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  const handleCustomStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomStyleFile(file);
      const reader = new FileReader();
      reader.onload = ev => setCustomStylePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      setSelectedStyle('custom');
    }
  };

  const handleConfirm = async () => {
    if (!selectedRatio || !selectedStyle) return;
    setIsSubmitting(true);

    let finalProjectId = initialProjectId ?? null;

    try {
      if (!finalProjectId) {
        const result = await createProject({
          title: proposal?.title || '未命名项目',
          description: userPrompt,
          userPrompt,
          settings: {
            generationMode,
            uploadedAssets,
            inspirationMode: true,
            inspirationProposal: proposal,
            aspectRatio: selectedRatio,
            artStyle: selectedStyle,
            customScenes: scenes,
            customVisualStyle: settingInput.trim() || undefined,
            currentPage: 'storyboard',
          },
        });
        if (result.success && result.data) finalProjectId = result.data.id;
      } else {
        await updateProject(finalProjectId, {
          settings: {
            generationMode,
            uploadedAssets,
            inspirationMode: true,
            inspirationProposal: proposal,
            aspectRatio: selectedRatio,
            artStyle: selectedStyle,
            customScenes: scenes,
            customVisualStyle: settingInput.trim() || undefined,
            currentPage: 'storyboard',
          },
        });
      }
    } catch (e) {
      console.error('[StyleSelectionPage] 保存异常:', e);
    }

    sessionStorage.setItem('storyboard_navigation_flag', 'true');
    const finalVisualStyle = settingInput.trim() || proposal?.visualStyle || '';

    navigate(finalProjectId ? `/storyboard?projectId=${finalProjectId}` : '/storyboard', {
      state: {
        projectId: finalProjectId,
        userPrompt,
        uploadedAssets,
        generationMode,
        customScenes: scenes,
        aspectRatio: selectedRatio,
        artStyle: selectedStyle,
        customStyleImage: customStyleFile ?? undefined,
        inspirationData: {
          proposal,
          visualStyle: finalVisualStyle,
          bgmStyle: proposal?.bgmStyle,
          aspectRatio: selectedRatio,
        },
      },
    });
  };

  const canConfirm = !!(selectedRatio && selectedStyle);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-8 relative z-10 h-full">
      <div className="max-w-5xl mx-auto w-full pb-28">

        {/* Title */}
        <div className="text-center mb-16 mt-8">
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 dark:text-white mb-3">
            选择你的视觉风格
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            为你的故事选择画幅比例和艺术方向。
          </p>
        </div>

        {/* ── Aspect Ratio ─────────────────────────────────── */}
        <div className="mb-16">
          <h2 className="text-[11px] font-medium text-neutral-900 dark:text-neutral-300 mb-6 uppercase tracking-widest font-mono">
            画幅比例
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {RATIOS.map((r, i) => {
              const Icon = r.icon;
              const isSelected = selectedRatio === r.id;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectRatio(r.id, r.label)}
                  className={`relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col items-center text-center gap-4 ${
                    isSelected
                      ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.15)]'
                      : 'bg-white dark:bg-[#111]/30 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-[#111]/60 hover:border-cyan-200 dark:hover:border-white/20'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="ratioCheck"
                      className="absolute top-3 right-3 w-5 h-5 bg-gradient-to-tr from-cyan-400 to-violet-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                    >
                      <Check size={12} className="text-white" />
                    </motion.div>
                  )}
                  <div
                    className={`p-4 rounded-xl transition-colors duration-300 ${
                      isSelected
                        ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                        : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    <Icon size={32} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div
                      className={`font-medium mb-1 ${
                        isSelected
                          ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-violet-600 dark:from-cyan-100 dark:to-white'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {r.id} {r.label}
                    </div>
                    <div className="text-xs text-neutral-500">{r.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Art Style ─────────────────────────────────────── */}
        <div>
          <h2 className="text-[11px] font-medium text-neutral-900 dark:text-neutral-300 mb-6 uppercase tracking-widest font-mono">
            艺术风格
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ART_STYLES.map((s, i) => {
              const isSelected = selectedStyle === s.id;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 + 0.2, duration: 0.4, ease: 'easeOut' }}
                  whileHover={{ scale: 1.03, zIndex: 10 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectStyle(s.id, s.name)}
                  className={`relative rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 group aspect-video ${
                    isSelected
                      ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                      : 'border-neutral-200 dark:border-white/20 hover:border-cyan-400 dark:hover:border-white/30'
                  }`}
                >
                  <img
                    src={s.image}
                    alt={s.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-4">
                    <span
                      className={`font-medium text-sm ${
                        isSelected
                          ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-white'
                          : 'text-white'
                      }`}
                    >
                      {s.name}
                    </span>
                  </div>
                  {isSelected && (
                    <motion.div
                      layoutId="styleCheck"
                      className="absolute top-3 right-3 w-5 h-5 bg-gradient-to-tr from-cyan-400 to-violet-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                    >
                      <Check size={12} className="text-white" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}

            {/* Custom Style Upload */}
            <label
              className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-3 aspect-video overflow-hidden ${
                customStylePreview
                  ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.25)]'
                  : 'border-neutral-300 dark:border-white/20 hover:border-cyan-400 dark:hover:border-white/30 bg-white dark:bg-transparent hover:bg-neutral-50 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <input
                ref={customInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCustomStyleUpload}
              />
              {customStylePreview ? (
                <>
                  <img src={customStylePreview} alt="自定义风格" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                    <span className="text-white text-sm font-medium">自定义风格</span>
                  </div>
                  <div className="absolute top-3 right-3 w-5 h-5 bg-gradient-to-tr from-cyan-400 to-violet-500 rounded-full flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <span className="text-sm font-medium">自定义风格</span>
                </>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* ── Bottom Action Bar ────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-neutral-50 via-neutral-50/90 dark:from-[#050505] dark:via-[#050505]/90 to-transparent flex items-center justify-between pointer-events-none">
        <div className="text-sm text-neutral-500 dark:text-neutral-500 pointer-events-auto font-mono text-xs">
          {!selectedRatio && !selectedStyle && 'SELECT RATIO + STYLE'}
          {selectedRatio && !selectedStyle && '✓ RATIO SELECTED · SELECT STYLE'}
          {!selectedRatio && selectedStyle && '✓ STYLE SELECTED · SELECT RATIO'}
          {canConfirm && (
            <span className="text-cyan-500">✓ READY TO GENERATE</span>
          )}
        </div>

        <motion.button
          whileHover={canConfirm ? { scale: 1.02, boxShadow: '0 0 25px rgba(34,211,238,0.4)' } : {}}
          whileTap={canConfirm ? { scale: 0.98 } : {}}
          onClick={handleConfirm}
          disabled={!canConfirm || isSubmitting}
          className={`pointer-events-auto flex items-center gap-2 px-10 py-3.5 rounded-xl font-medium transition-all shadow-lg border border-white/10 font-mono tracking-wider text-sm ${
            canConfirm && !isSubmitting
              ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-cyan-500/20 cursor-pointer'
              : 'bg-neutral-200 dark:bg-white/10 text-neutral-400 cursor-not-allowed shadow-none'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              GENERATING...
            </>
          ) : (
            <>
              GENERATE STORYBOARD
              <Check size={18} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
