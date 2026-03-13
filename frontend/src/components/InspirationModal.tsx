/**
 * 灵感激发模式弹窗组件
 * 展示情绪分析和创意方案生成
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RefreshCw, Loader2, Check, Maximize2, Lock, Unlock, ChevronDown, ChevronUp, Star, Zap, Clock, MapPin } from 'lucide-react';
import * as inspirationApi from '../api/inspirationApi';
import { AssetInfo } from '../api/scriptApi';

// 导出类型定义
export interface InspirationProposal {
  title: string;
  tags: string[];
  styleTags?: string[];
  paceTag?: string;
  scenarioTags?: string[];
  isRecommended?: boolean;
  recommendationReason?: string;
  reasoning: string;
  visualStyle: string;
  bgmStyle: string;
  roughScript: {
    scenes: Array<{
      type: string;
      description: string;
      script?: string;
      duration: number;
      visual?: string;
      assetPath?: string | null;
    }>;
  };
}

interface InspirationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProposal: (proposal: InspirationProposal) => void;
  uploadedAssets: AssetInfo[];
  userPrompt: string;
  generationMode?: 'ai_generated' | 'ai_plus_real' | 'pure_real';
}

type AnalysisStep = 'generating' | 'complete';

export const InspirationModal: React.FC<InspirationModalProps> = ({
  isOpen,
  onClose,
  onSelectProposal,
  uploadedAssets,
  userPrompt,
  generationMode = 'ai_generated',
}) => {
  const [step, setStep] = useState<AnalysisStep>('generating');
  const [proposals, setProposals] = useState<InspirationProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<InspirationProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState<InspirationProposal | null>(null);
  // 锁定状态：记录被锁定的方案索引
  const [lockedIndices, setLockedIndices] = useState<Set<number>>(new Set());
  // 分镜展开状态：记录已展开分镜预览的方案索引
  const [openSceneIndices, setOpenSceneIndices] = useState<Set<number>>(new Set());

  // 开始生成流程
  useEffect(() => {
    if (isOpen && proposals.length === 0) {
      startGeneration();
    }
  }, [isOpen]);

  const startGeneration = async () => {
    setStep('generating');
    setError(null);

    try {
      const proposalsResult = await inspirationApi.generateProposals(
        null,
        uploadedAssets,
        userPrompt,
        generationMode
      );

      if (!proposalsResult.success || !proposalsResult.data) {
        throw new Error(proposalsResult.error || '方案生成失败');
      }

      setProposals(proposalsResult.data.proposals);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    }
  };

  // 换一批：仅替换未锁定的方案
  const handleRefresh = async () => {
    if (isRefreshing) return;

    const unlockedCount = proposals.length - lockedIndices.size;
    if (unlockedCount === 0) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const proposalsResult = await inspirationApi.generateProposals(
        null,
        uploadedAssets,
        userPrompt,
        generationMode
      );

      if (!proposalsResult.success || !proposalsResult.data) {
        throw new Error(proposalsResult.error || '方案生成失败');
      }

      const newData = proposalsResult.data.proposals;
      const updated = [...proposals];
      let newIdx = 0;

      for (let i = 0; i < updated.length; i++) {
        if (!lockedIndices.has(i) && newIdx < newData.length) {
          updated[i] = newData[newIdx++];
        }
      }

      setProposals(updated);

      // 如果选中的方案被替换了，清空选择
      if (selectedProposal) {
        const selectedIdx = proposals.indexOf(selectedProposal);
        if (selectedIdx !== -1 && !lockedIndices.has(selectedIdx)) {
          setSelectedProposal(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 切换方案锁定状态
  const toggleLock = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLockedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 切换分镜预览展开/收起
  const toggleScenes = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenSceneIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectProposal = (proposal: InspirationProposal) => {
    setSelectedProposal(proposal);
  };

  const handleConfirm = () => {
    if (selectedProposal) {
      onSelectProposal(selectedProposal);
    }
  };

  const handleClose = () => {
    setStep('generating');
    setProposals([]);
    setSelectedProposal(null);
    setError(null);
    setLockedIndices(new Set());
    setOpenSceneIndices(new Set());
    onClose();
  };

  // 节奏标签颜色
  const getPaceColor = (pace?: string) => {
    if (!pace) return 'text-neutral-400 bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/5';
    if (pace === '快') return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20';
    if (pace === '舒缓') return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20';
    return 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20';
  };

  if (!isOpen) return null;

  const lockedCount = lockedIndices.size;
  const refreshLabel = lockedCount > 0
    ? `替换其余 ${proposals.length - lockedCount} 版`
    : '换一批';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* 主弹窗 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-[90vw] max-w-6xl max-h-[90vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* 标题区域 */}
          <div className="p-6 border-b border-neutral-200 dark:border-white/5 bg-white dark:bg-neutral-900 relative shrink-0">
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 p-2 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="text-cyan-400" size={24} />
              <h2 className="text-2xl font-medium text-neutral-900 dark:text-white tracking-wide">灵感实验室</h2>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">AI 正在为你寻找最佳创意方案...</p>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 p-6 overflow-y-auto scrollbar-hide bg-neutral-50/50 dark:bg-neutral-950/50">
            {/* 错误提示 */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                <button
                  onClick={startGeneration}
                  className="mt-2 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-300 underline"
                >
                  重试
                </button>
              </div>
            )}

            {/* 生成状态 */}
            <div className="bg-white dark:bg-neutral-800/50 rounded-xl p-4 flex items-center gap-3 mb-8 border border-neutral-200 dark:border-white/5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step === 'generating' ? 'bg-cyan-500/20' : 'bg-emerald-500/20'}`}>
                {step === 'generating' ? (
                  <Loader2 size={14} className="text-cyan-400 animate-spin" />
                ) : (
                  <Check size={14} className="text-emerald-400" />
                )}
              </div>
              <div>
                <div className="text-neutral-900 dark:text-white font-medium text-sm flex items-center gap-2">
                  <Sparkles size={14} className="text-cyan-400" />
                  {step === 'generating' ? 'AI 正在生成创意方案...' : 'AI 已完成创意方案生成'}
                </div>
                <div className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5">
                  {step === 'generating'
                    ? (generationMode === 'ai_plus_real' ? 'AI 正在分析实拍素材并将其融入创意方案...' : 'AI 正在分析您的需求并创作方案...')
                    : `已生成 ${proposals.length} 个匹配方案`}
                </div>
              </div>
            </div>

            {/* 方案展示 */}
            {step === 'complete' && proposals.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-neutral-900 dark:text-white font-medium">选择你喜欢的创意方案</h3>
                    {lockedCount > 0 && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">
                        已锁定 {lockedCount} 版 · 点击「{refreshLabel}」仅重新生成其余方案
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg transition-colors border border-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    {refreshLabel}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {proposals.map((proposal, index) => {
                    const isLocked = lockedIndices.has(index);
                    const isScenesOpen = openSceneIndices.has(index);
                    const isSelected = selectedProposal === proposal;
                    const isRecommended = proposal.isRecommended;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleSelectProposal(proposal)}
                        className={`group relative rounded-2xl border transition-all cursor-pointer flex flex-col overflow-hidden ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/10 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
                            : isLocked
                            ? 'border-amber-400/60 dark:border-amber-500/40 bg-amber-50/30 dark:bg-amber-900/5'
                            : 'border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800/30 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 hover:border-neutral-300 dark:hover:border-white/20'
                        }`}
                      >
                        {/* AI 推荐徽章 */}
                        {isRecommended && (
                          <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-1.5 flex items-center gap-1.5 z-10">
                            <Star size={11} className="text-white fill-white" />
                            <span className="text-white text-[11px] font-semibold tracking-wide">AI 推荐优先尝试</span>
                          </div>
                        )}

                        {/* 绝对定位的操作按钮（右上角） */}
                        <div className={`absolute right-3 flex items-center gap-1 z-20 ${isRecommended ? 'top-8' : 'top-3'}`}>
                          {/* 锁定按钮：锁定时常驻显示，未锁定时悬停才显示 */}
                          <button
                            onClick={(e) => toggleLock(index, e)}
                            title={isLocked ? '解锁此方案' : '锁定此方案（换一批时保留）'}
                            className={`p-1.5 rounded-md transition-all ${
                              isLocked
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 opacity-100'
                                : 'bg-neutral-100/80 dark:bg-white/5 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/10 hover:text-neutral-600 dark:hover:text-neutral-300 opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                          </button>
                          {/* 放大按钮 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedProposal(proposal); }}
                            className="p-1.5 rounded-md bg-neutral-100/80 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors opacity-0 group-hover:opacity-100"
                            title="查看完整方案"
                          >
                            <Maximize2 size={13} />
                          </button>
                        </div>

                        {/* 卡片主体 */}
                        <div className={`p-5 flex flex-col gap-3 ${isRecommended ? 'pt-9' : ''}`}>
                          {/* 标题 */}
                          <h4 className="text-base font-medium text-neutral-900 dark:text-white leading-tight pr-16">
                            {proposal.title}
                          </h4>

                          {/* 三维度标签 */}
                          <div className="flex flex-col gap-1.5">
                            {/* 风格 */}
                            {proposal.styleTags && proposal.styleTags.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono shrink-0 w-8">风格</span>
                                {proposal.styleTags.map((tag, i) => (
                                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* 节奏 */}
                            {proposal.paceTag && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono shrink-0 w-8">节奏</span>
                                <span className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${getPaceColor(proposal.paceTag)}`}>
                                  {proposal.paceTag === '快' && <Zap size={9} />}
                                  {proposal.paceTag === '舒缓' && <Clock size={9} />}
                                  {proposal.paceTag}
                                </span>
                              </div>
                            )}
                            {/* 适用场景 */}
                            {proposal.scenarioTags && proposal.scenarioTags.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono shrink-0 w-8">场景</span>
                                {proposal.scenarioTags.map((tag, i) => (
                                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                                    <MapPin size={9} />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* 兼容旧版：如果没有结构化标签则显示旧 tags */}
                            {!proposal.styleTags && proposal.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {proposal.tags.map((tag, i) => (
                                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></span>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* AI 推荐原因 */}
                          {isRecommended && proposal.recommendationReason && (
                            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-500/20 rounded-lg p-2.5 text-[12px] text-violet-700 dark:text-violet-300 leading-relaxed">
                              <Sparkles size={11} className="inline mr-1.5 text-violet-500 -mt-0.5" />
                              {proposal.recommendationReason}
                            </div>
                          )}

                          {/* 推荐理由 */}
                          <div className="bg-white/50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                            <Sparkles size={12} className="inline mr-1.5 text-cyan-400 -mt-0.5" />
                            {proposal.reasoning}
                          </div>

                          {/* 分镜预览折叠按钮 */}
                          <button
                            onClick={(e) => toggleScenes(index, e)}
                            className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                          >
                            <span className="text-xs font-mono">
                              分镜预览（共 {proposal.roughScript.scenes.length} 个）
                            </span>
                            {isScenesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {/* 分镜列表（折叠展开） */}
                          <AnimatePresence>
                            {isScenesOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-2 relative pt-1">
                                  <div className="absolute left-[11px] top-3 bottom-2 w-px bg-neutral-200 dark:bg-white/10"></div>
                                  {proposal.roughScript.scenes.map((scene, sceneIndex) => {
                                    const isRealShot = scene.type === 'mixed_media' || (scene as any).isRealShot;
                                    return (
                                      <div
                                        key={sceneIndex}
                                        className="flex gap-3 relative z-10"
                                        onClick={(e) => e.stopPropagation()}
                                        onWheel={(e) => e.stopPropagation()}
                                      >
                                        <div className="w-6 h-6 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 flex items-center justify-center text-[10px] text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5">
                                          {sceneIndex + 1}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          {isRealShot && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit">
                                              实拍
                                            </span>
                                          )}
                                          <span className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                            {scene.description} <span className="text-neutral-400">({scene.duration}s)</span>
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 锁定蒙层提示 */}
                        {isLocked && (
                          <div className="px-5 py-2 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200/50 dark:border-amber-500/20 flex items-center gap-1.5 shrink-0">
                            <Lock size={11} className="text-amber-500" />
                            <span className="text-[11px] text-amber-600 dark:text-amber-400">已锁定，换一批时保留此版</span>
                          </div>
                        )}

                        {/* 选中标记 */}
                        {isSelected && (
                          <div className="bg-cyan-500 text-neutral-950 text-sm font-medium py-2.5 flex items-center justify-center gap-2 shrink-0">
                            <Check size={16} />
                            已选中
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* 放大详情弹窗 */}
                <AnimatePresence>
                  {expandedProposal && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[60] flex items-center justify-center"
                      onClick={() => setExpandedProposal(null)}
                    >
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-[90vw] max-w-2xl max-h-[80vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                      >
                        {/* 弹窗头部 */}
                        <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/5 flex items-start justify-between shrink-0">
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2 mb-2">
                              {expandedProposal.isRecommended && (
                                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-violet-600 dark:text-violet-300 border border-violet-300/30 dark:border-violet-500/30">
                                  <Star size={10} className="fill-current" />
                                  AI 推荐
                                </span>
                              )}
                              <h3 className="text-neutral-900 dark:text-white font-medium text-xl">{expandedProposal.title}</h3>
                            </div>
                            {/* 三维度标签 */}
                            <div className="flex flex-wrap gap-2">
                              {expandedProposal.styleTags?.map((tag, i) => (
                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">{tag}</span>
                              ))}
                              {expandedProposal.paceTag && (
                                <span className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${getPaceColor(expandedProposal.paceTag)}`}>
                                  {expandedProposal.paceTag === '快' && <Zap size={9} />}
                                  {expandedProposal.paceTag === '舒缓' && <Clock size={9} />}
                                  {expandedProposal.paceTag}
                                </span>
                              )}
                              {expandedProposal.scenarioTags?.map((tag, i) => (
                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                                  <MapPin size={9} />{tag}
                                </span>
                              ))}
                              {/* 兼容旧版 */}
                              {!expandedProposal.styleTags && expandedProposal.tags.map((tag, i) => (
                                <span key={i} className="text-[11px] px-2 py-1 rounded-md bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></span>{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedProposal(null)}
                            className="p-2 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {/* 弹窗正文（可滚动） */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                          {/* AI 推荐原因 */}
                          {expandedProposal.isRecommended && expandedProposal.recommendationReason && (
                            <div className="p-4 bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/30 dark:to-cyan-950/30 border border-violet-200 dark:border-violet-500/20 rounded-xl">
                              <p className="text-xs text-violet-500 dark:text-violet-400 font-medium mb-1 flex items-center gap-1">
                                <Star size={11} className="fill-current" /> AI 推荐理由
                              </p>
                              <p className="text-neutral-700 dark:text-cyan-100/80 text-sm leading-relaxed">
                                {expandedProposal.recommendationReason}
                              </p>
                            </div>
                          )}

                          {/* 推荐理由 */}
                          <div className="p-4 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-500/20 rounded-xl">
                            <p className="text-neutral-700 dark:text-cyan-100/80 text-sm">
                              <Sparkles size={13} className="inline mr-2 text-cyan-500 -mt-0.5" />
                              {expandedProposal.reasoning}
                            </p>
                          </div>

                          {/* 视觉风格 & BGM */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl">
                              <p className="text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase tracking-wider mb-1">🎨 视觉风格</p>
                              <p className="text-neutral-700 dark:text-neutral-300 text-sm">{expandedProposal.visualStyle}</p>
                            </div>
                            <div className="p-3 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl">
                              <p className="text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase tracking-wider mb-1">🎵 配乐风格</p>
                              <p className="text-neutral-700 dark:text-neutral-300 text-sm">{expandedProposal.bgmStyle}</p>
                            </div>
                          </div>

                          {/* 完整分镜列表 */}
                          <div>
                            <p className="text-neutral-500 dark:text-neutral-400 text-sm font-mono uppercase tracking-wider mb-3">
                              完整分镜（{expandedProposal.roughScript.scenes.length} 个 · 共约 {expandedProposal.roughScript.scenes.reduce((s, sc) => s + sc.duration, 0)}s）
                            </p>
                            <div className="space-y-2">
                              {expandedProposal.roughScript.scenes.map((scene, i) => {
                                const isRealShot = scene.type === 'mixed_media' || (scene as any).isRealShot;
                                return (
                                  <div
                                    key={i}
                                    className={`p-3 rounded-xl flex items-start gap-3 ${
                                      isRealShot
                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                                        : 'bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/5'
                                    }`}
                                  >
                                    <span className="shrink-0 w-6 h-6 rounded-full bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-400 text-xs flex items-center justify-center font-medium">
                                      {i + 1}
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        {isRealShot && (
                                          <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-medium">实拍</span>
                                        )}
                                        <span className="text-neutral-400 text-xs">{scene.duration}s</span>
                                      </div>
                                      <p className="text-neutral-700 dark:text-neutral-300 text-sm">{scene.description}</p>
                                      {(scene as any).visualStyle && (
                                        <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1 italic">{(scene as any).visualStyle}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* 弹窗底部 */}
                        <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/5 flex justify-end gap-3 shrink-0 bg-white dark:bg-neutral-900">
                          <button
                            onClick={() => setExpandedProposal(null)}
                            className="px-4 py-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors text-sm hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg"
                          >
                            关闭
                          </button>
                          <button
                            onClick={() => { handleSelectProposal(expandedProposal); setExpandedProposal(null); }}
                            className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 hover:opacity-90 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-cyan-500/20"
                          >
                            选择此方案
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* 底部操作栏 */}
          {step === 'complete' && (
            <div className="px-6 py-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-white/5 flex items-center justify-end gap-4 shrink-0">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedProposal}
                className={`px-8 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  selectedProposal
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/25 hover:opacity-90'
                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 cursor-not-allowed'
                }`}
              >
                <Sparkles size={16} />
                确定选择并生成
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
