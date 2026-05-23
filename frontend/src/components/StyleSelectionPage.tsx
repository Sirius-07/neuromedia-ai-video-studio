import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Square, Tv, Plus, Check, Loader2 } from 'lucide-react';
import { createProject, updateProject } from '../api/projectApi';
import { InspirationProposal } from './InspirationModal';
import {
  buildCreationSettings,
  type CreationAspectRatio,
  type CreationIntent,
  withCreationVisualSelection,
} from '../types/creationIntent';

// ── Static Data ───────────────────────────────────────────────────────────────

const RATIOS = [
  { id: '16:9', label: '横屏', icon: Monitor, desc: '视频号 / 网页' },
  { id: '9:16', label: '竖屏', icon: Smartphone, desc: '抖音 / 短视频' },
  { id: '1:1', label: '方形', icon: Square, desc: '社媒信息流' },
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
    proposal: routeProposal,
    inspirationProposal,
    creationIntent,
    needExpandScript = false,
    isGenerating = false,
    aspectRatio: initialAspectRatio = '16:9',
    artStyle: initialArtStyle = '',
    settingInput = '',
  } = (location.state || {}) as {
    projectId?: string | null;
    scenes?: any[];
    userPrompt?: string;
    uploadedAssets?: any[];
    generationMode?: string;
    proposal?: InspirationProposal;
    inspirationProposal?: InspirationProposal;
    creationIntent?: CreationIntent;
    needExpandScript?: boolean;
    isGenerating?: boolean;
    aspectRatio?: string;
    artStyle?: string;
    settingInput?: string;
  };

  const proposal = creationIntent?.selectedProposal || routeProposal || inspirationProposal;
  const prompt = creationIntent?.prompt || userPrompt;
  const assets = creationIntent?.uploadedAssets || uploadedAssets;
  const mode = creationIntent?.generationMode || generationMode;
  const [selectedRatio, setSelectedRatio] = useState(creationIntent?.aspectRatio || initialAspectRatio);
  const [selectedStyle, setSelectedStyle] = useState(() => {
    const style = creationIntent?.artStyle || initialArtStyle;
    return ART_STYLES.some(option => option.id === style) ? style : '';
  });
  const [customStyleFile, setCustomStyleFile] = useState<File | null>(null);
  const [customStylePreview, setCustomStylePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const handleSelectRatio = (ratioId: string, _ratioLabel: string) => {
    setSelectedRatio(ratioId);
  };

  const handleSelectStyle = (styleId: string, _styleName: string) => {
    setSelectedStyle(styleId);
  };

  // Mark project as being on style-selection so sidebar can restore correctly
  useEffect(() => {
    if (initialProjectId) {
      updateProject(initialProjectId, {
        settings: {
          ...(creationIntent ? buildCreationSettings(creationIntent) : {}),
          generationMode: mode,
          uploadedAssets: assets,
          inspirationMode: true,
          inspirationProposal: proposal,
          aspectRatio: selectedRatio,
          artStyle: creationIntent?.artStyle || initialArtStyle || undefined,
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
    const updatedIntent = creationIntent
      ? withCreationVisualSelection(creationIntent, selectedRatio as CreationAspectRatio, selectedStyle)
      : null;

    try {
      if (!finalProjectId) {
        const result = await createProject({
          title: proposal?.title || '未命名项目',
          description: prompt,
          userPrompt: prompt,
          settings: {
            ...(updatedIntent ? buildCreationSettings(updatedIntent) : {}),
            generationMode: updatedIntent?.generationMode || mode,
            uploadedAssets: updatedIntent?.uploadedAssets || assets,
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
            ...(updatedIntent ? buildCreationSettings(updatedIntent) : {}),
            generationMode: updatedIntent?.generationMode || mode,
            uploadedAssets: updatedIntent?.uploadedAssets || assets,
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
        creationIntent: updatedIntent || undefined,
        inspirationProposal: updatedIntent?.selectedProposal || proposal,
        needExpandScript,
        isGenerating,
        userPrompt: prompt,
        uploadedAssets: updatedIntent?.uploadedAssets || assets,
        generationMode: updatedIntent?.generationMode || mode,
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
  const selectionStatus = (() => {
    if (!selectedRatio && !selectedStyle) return '请选择画幅和风格';
    if (selectedRatio && !selectedStyle) return '已选画幅，还需选择风格';
    if (!selectedRatio && selectedStyle) return '已选风格，还需选择画幅';
    return '已选好，可以生成分镜';
  })();

  return (
    <div className="nm-flow-page nm-style-selection-page flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-8 relative z-10 h-full">
      <div className="nm-selection-canvas max-w-5xl mx-auto w-full pb-24 sm:pb-28">

        {/* Title */}
        <div className="nm-page-title text-center mb-12 sm:mb-16 mt-6 sm:mt-8">
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 dark:text-white mb-3">
            选择你的视觉风格
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto leading-6">
            先选发布比例，再选画面风格。之后 AI 会生成分镜图。
          </p>
        </div>

        {/* ── Aspect Ratio ─────────────────────────────────── */}
        <div className="nm-page-section mb-12 sm:mb-16">
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
                  className={`nm-option-card relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col items-center text-center gap-4 ${
                    isSelected
                      ? 'nm-option-card-selected bg-cyan-50 dark:bg-cyan-500/10 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.15)]'
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
        <div className="nm-page-section">
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
                  className={`nm-style-option-card relative rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 group aspect-video ${
                    isSelected
                      ? 'nm-option-card-selected border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
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
              className={`nm-style-option-card nm-custom-style-card relative rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-3 aspect-video overflow-hidden ${
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
      <div className="nm-day-action-bar sticky sm:absolute bottom-0 left-0 right-0 -mx-4 sm:mx-0 mt-10 p-4 sm:p-6 bg-gradient-to-t from-neutral-50 via-neutral-50/95 dark:from-[#050505] dark:via-[#050505]/95 to-transparent flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto font-mono text-[11px] sm:text-xs text-center sm:text-left text-neutral-500 dark:text-neutral-500">
          {canConfirm && (
            <span className="text-cyan-500">✓ {selectionStatus}</span>
          )}
          {!canConfirm && selectionStatus}
        </div>

        <motion.button
          whileHover={canConfirm ? { scale: 1.02, boxShadow: '0 0 25px rgba(34,211,238,0.4)' } : {}}
          whileTap={canConfirm ? { scale: 0.98 } : {}}
          onClick={handleConfirm}
          disabled={!canConfirm || isSubmitting}
          className={`pointer-events-auto flex w-full sm:w-auto items-center justify-center gap-2 px-4 sm:px-10 py-3 sm:py-3.5 rounded-xl font-medium transition-all shadow-lg border border-white/10 font-mono tracking-wider text-[13px] sm:text-sm whitespace-nowrap ${
            canConfirm && !isSubmitting
              ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-cyan-500/20 cursor-pointer'
              : 'bg-neutral-200 dark:bg-white/10 text-neutral-400 cursor-not-allowed shadow-none'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              正在生成分镜...
            </>
          ) : (
            <>
              生成分镜
              <Check size={18} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
