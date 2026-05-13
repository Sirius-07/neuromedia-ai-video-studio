import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  FileText,
  FileVideo,
  ImageIcon,
  Layers,
  Loader2,
  Palette,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import { uploadFile, type AssetInfo } from '../api/scriptApi';
import { createProject } from '../api/projectApi';
import * as inspirationApi from '../api/inspirationApi';
import { createLogger } from '../utils/logger';
import type { InspirationProposal } from './InspirationModal';
import {
  buildCreationSettings,
  createCreationIntent,
  selectRecommendedProposal,
} from '../types/creationIntent';
import {
  getPublishGoalHelp,
  type PublishGoalHelpStepIcon,
  type StartPublishGoal,
} from './startPageFlowCopy';

const log = createLogger('StartPage');

interface StartPageProps {
  onProjectsChange?: () => void;
}

type PublishGoal = StartPublishGoal;

const helpStepIcons: Record<PublishGoalHelpStepIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  brief: FileText,
  style: Palette,
  workbench: Layers,
  result: ImageIcon,
};

function getAssetDisplayName(asset: AssetInfo): string {
  if (asset.name?.trim()) return asset.name.trim();

  const rawName = decodeURIComponent(asset.file_path.split('/').pop() || '素材');
  return rawName.replace(/^\d+_[a-z0-9-]{8}_/i, '');
}

function buildStartAssetPrompt(assets: AssetInfo[]): string {
  if (assets.length === 0) return '';

  const selectedCount = assets.filter(asset => asset.selected !== false).length;
  const referenceCount = assets.length - selectedCount;
  const parts = [`上传了 ${assets.length} 个素材`];

  if (selectedCount > 0) parts.push(`${selectedCount} 个会进入分镜并支持图生视频`);
  if (referenceCount > 0) parts.push(`${referenceCount} 个仅作为风格和主题参考`);

  return parts.join('，');
}

function getAutoSuggestion(
  newsArticle: string,
  uploadedAssets: AssetInfo[],
  publishGoal: PublishGoal,
): { type: 'ok' | 'info' | 'warn'; text: string } | null {
  const hasText = newsArticle.trim().length > 0;
  const selectedCount = uploadedAssets.filter(asset => asset.selected !== false).length;
  const referenceCount = uploadedAssets.length - selectedCount;
  const assetUsageText = referenceCount > 0
    ? `${selectedCount} 个会进入分镜，${referenceCount} 个仅作参考`
    : `${selectedCount} 个会进入分镜`;

  if (hasText) {
    const len = newsArticle.trim().length;
    if (len < 50) {
      return { type: 'warn', text: '文稿内容较短，AI 能提炼的信息可能有限，建议补充更多背景。' };
    }
    if (len > 800 && publishGoal === 'fast_publish') {
      return { type: 'info', text: '内容较丰富，AI 会先提炼核心事实，再整理成适合交接的视频样片。' };
    }
    if (uploadedAssets.length > 0) {
      return { type: 'ok', text: `文字和素材已就绪，${assetUsageText}，AI 会整理成视频样片和结构化分镜表。` };
    }
    return { type: 'ok', text: '内容已就绪，AI 会整理成一版可沟通的视频交接样片。' };
  }

  if (uploadedAssets.length === 0) return null;

  const hasVideo = uploadedAssets.some(asset => asset.file_type === 'video');

  if (hasVideo) {
    return { type: 'ok', text: `已上传 ${uploadedAssets.length} 个素材（含视频），${assetUsageText}。` };
  }

  return { type: 'ok', text: `已上传 ${uploadedAssets.length} 张图片，${assetUsageText}。` };
}

export const StartPage: React.FC<StartPageProps> = ({ onProjectsChange }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newsArticle, setNewsArticle] = useState('');
  const [publishGoal] = useState<PublishGoal>('refine_handoff');
  const [uploadedAssets, setUploadedAssets] = useState<AssetInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [flowHelpGoal, setFlowHelpGoal] = useState<PublishGoal | null>(null);

  useEffect(() => {
    setUploadedAssets(prev =>
      prev.map(asset => ({ ...asset, selected: asset.selected !== false })),
    );
  }, []);

  useEffect(() => {
    if (!flowHelpGoal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFlowHelpGoal(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flowHelpGoal]);

  const getVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('无法读取视频时长'));
      };
      video.src = window.URL.createObjectURL(file);
    });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) continue;

        let duration: number | undefined;
        if (isVideo) {
          try {
            duration = await getVideoDuration(file);
          } catch {
            duration = undefined;
          }
        }

        const asset = await uploadFile(file);
        setUploadedAssets(prev => [
          ...prev,
          { ...asset, name: file.name, duration: duration || asset.duration, selected: true },
        ]);
      }
    } catch (error) {
      log.error('上传失败:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAsset = (index: number) => {
    setUploadedAssets(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAssetSelection = (index: number) => {
    setUploadedAssets(prev =>
      prev.map((asset, i) => (i === index ? { ...asset, selected: !asset.selected } : asset)),
    );
  };

  const trimmedArticle = newsArticle.trim();
  const assetPrompt = buildStartAssetPrompt(uploadedAssets);
  const userPrompt = trimmedArticle && assetPrompt
    ? `${trimmedArticle}\n\n素材补充：${assetPrompt}`
    : trimmedArticle || assetPrompt;
  const effectiveInputMode = uploadedAssets.length > 0 ? 'assets' : 'article';
  const generationMode = uploadedAssets.length > 0
    ? 'ai_plus_real'
    : 'ai_generated';
  const hasGenerationInput = trimmedArticle.length > 0 || uploadedAssets.length > 0;
  const canGenerate = !isUploading && !isGenerating && hasGenerationInput;
  const generateButtonLabel = isGenerating
    ? '正在生成交接样片...'
    : isUploading
      ? '素材上传中...'
      : hasGenerationInput
        ? '生成交接样片'
        : '先输入报道或上传素材';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const proposalsResult = await inspirationApi.generateProposals(
        null as any,
        uploadedAssets,
        userPrompt,
        generationMode,
        trimmedArticle || undefined,
        publishGoal,
      );

      if (!proposalsResult.success || !proposalsResult.data?.proposals?.length) {
        throw new Error(proposalsResult.error || '交接样片生成失败，请重试');
      }

      const proposals = proposalsResult.data.proposals as InspirationProposal[];
      const proposal = selectRecommendedProposal(proposals);
      if (!proposal) throw new Error('没有可用的视频交接方案，请重试');

      const intent = createCreationIntent({
        inputMode: effectiveInputMode,
        publishGoal,
        prompt: userPrompt,
        uploadedAssets,
        generationMode,
        proposals,
        selectedProposal: proposal,
      });

      log.debug('自动选择推荐视频方案:', proposal.title);

      const projectResult = await createProject({
        title: proposal.title,
        description: userPrompt,
        userPrompt,
        settings: {
          ...buildCreationSettings(intent),
          currentPage: 'handoff',
          inspirationMode: true,
          handoffFlowVersion: 'handoff_sample_v1',
          customScenes: proposal.roughScript?.scenes || [],
          selectedAssetIds: uploadedAssets
            .filter(asset => asset.selected !== false)
            .map(asset => asset.file_path || asset.url || asset.name || '')
            .filter(Boolean),
          newsArticle: trimmedArticle || undefined,
        },
      });

      if (!projectResult.success || !projectResult.data) {
        alert('创建项目失败，请重试');
        return;
      }

      const project = projectResult.data;
      onProjectsChange?.();

      navigate('/handoff', {
        state: {
          projectId: project.id,
          projectData: project,
          creationIntent: intent,
          proposal,
          inspirationProposal: proposal,
          scenes: proposal.roughScript?.scenes || [],
          assets: uploadedAssets,
          selectedAssetIds: uploadedAssets
            .filter(asset => asset.selected !== false)
            .map(asset => asset.file_path || asset.url || asset.name || '')
            .filter(Boolean),
          uploadedAssets,
          userPrompt,
          reportText: trimmedArticle || userPrompt,
          projectTitle: proposal.title,
          generationMode,
          publishGoal,
          aspectRatio: intent.aspectRatio,
          artStyle: intent.artStyle,
          newsArticle: trimmedArticle || undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建项目失败，请重试';
      setGenerationError(message);
      alert(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const suggestion = getAutoSuggestion(newsArticle, uploadedAssets, publishGoal);
  const flowHelp = flowHelpGoal ? getPublishGoalHelp(flowHelpGoal) : null;

  return (
    <div className="nm-start-page flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-5xl mx-auto w-full relative z-10 h-full">
      <div className="nm-day-annotation-layer" aria-hidden="true">
        <div className="nm-day-blue-rail" />
        <div className="nm-day-side-note">
          <strong>SCENE<br />01</strong>
          AI x STORYBOARD<br />
          FROM BRIEF TO<br />
          COLLABORATIVE CUT
        </div>
        <div className="nm-day-right-note">
          PANEL<br />
          INPUT<br />
          refine key brief<br />
          guide creation path
        </div>
        <div className="nm-day-bottom-track" />
      </div>

      <div className="nm-start-title text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-5 text-xs font-mono tracking-widest text-cyan-500 uppercase">
          <FileText size={12} />
          开始创作
        </div>
        <h1 className="text-4xl font-light tracking-tight text-neutral-900 dark:text-white mb-3">
          制作新闻视频交接样片
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-base max-w-xl mx-auto">
          传入报道和素材，快速表达你想要的视频效果。
        </p>
      </div>

      <div className="nm-editorial-panel nm-start-panel w-full bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="relative">
            <textarea
              className="w-full rounded-xl border border-neutral-200 bg-white/60 p-4 text-sm leading-relaxed text-neutral-900 outline-none transition-colors placeholder-neutral-400 focus:border-cyan-400 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder-neutral-500 dark:focus:border-cyan-500 sm:min-h-[190px] min-h-[170px] resize-none"
              placeholder="粘贴文稿，写一句想法，或直接上传素材。"
              value={newsArticle}
              onChange={event => setNewsArticle(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && event.metaKey && canGenerate) {
                  event.preventDefault();
                  handleGenerate();
                }
              }}
              disabled={isGenerating}
            />
            {newsArticle.trim().length > 0 && (
              <div className="absolute bottom-3 right-4 text-[10px] font-mono text-neutral-400">
                {newsArticle.trim().length} 字
              </div>
            )}
          </div>

          {uploadedAssets.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                勾选素材会进入分镜并支持图生视频；取消勾选则仅作为风格和主题参考。
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {uploadedAssets.map((asset, index) => {
                  const assetName = getAssetDisplayName(asset);
                  const isSelected = asset.selected !== false;

                  return (
                    <div
                      key={`${asset.file_path}-${index}`}
                      className="relative group rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-neutral-100 dark:bg-neutral-800 aspect-video"
                    >
                      {asset.file_type === 'image' ? (
                        <img
                          src={`http://localhost:4300${asset.file_path.startsWith('/') ? '' : '/'}${asset.file_path}`}
                          alt={assetName}
                          className="w-full h-full object-cover"
                          onError={event => {
                            (event.target as HTMLImageElement).src = '';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-200 dark:bg-neutral-700 gap-1">
                          <FileVideo size={20} className="text-neutral-400" />
                          {asset.duration && (
                            <span className="text-[10px] text-neutral-500">{asset.duration}s</span>
                          )}
                        </div>
                      )}

                      <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-medium backdrop-blur ${
                        isSelected
                          ? 'bg-cyan-500/90 text-white'
                          : 'bg-black/55 text-white/80'
                      }`}>
                        {isSelected ? '进分镜' : '仅参考'}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeAsset(index)}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`移除 ${assetName}`}
                      >
                        <X size={10} />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleAssetSelection(index)}
                        className="absolute bottom-0 left-0 right-0 bg-black/65 p-1.5 flex items-center gap-1 cursor-pointer text-left transition-colors hover:bg-black/80"
                        aria-label={`${isSelected ? '已加入分镜，点击改为仅参考' : '仅作为参考，点击加入分镜'}：${assetName}`}
                        title={assetName}
                      >
                        {isSelected
                          ? <CheckSquare size={11} className="text-cyan-300 shrink-0" />
                          : <div className="w-2.5 h-2.5 border border-white/70 rounded-sm shrink-0" />
                        }
                        <span className="min-w-0 truncate text-[9px] text-white">
                          {assetName}
                        </span>
                      </button>
                    </div>
                  );
                })}

                {isUploading && (
                  <div className="rounded-xl border border-neutral-200 dark:border-white/10 aspect-video flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                    <Loader2 size={18} className="animate-spin text-neutral-400" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 text-neutral-400 transition-colors hover:border-cyan-400 hover:bg-cyan-50/60 hover:text-cyan-600 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
                  disabled={isUploading}
                  aria-label="继续添加素材"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-current">
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
                  </span>
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    {isUploading ? '上传中...' : '添加素材'}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    图片 / 视频
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[96px] cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 text-left transition-colors hover:border-cyan-400 hover:bg-cyan-50/40 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/5"
            >
              {isUploading ? (
                <Loader2 size={24} className="animate-spin text-neutral-400" />
              ) : (
                <>
                  <Paperclip size={22} className="shrink-0 text-neutral-300 transition-colors dark:text-neutral-600" />
                  <span className="min-w-0">
                    <span className="block text-sm text-neutral-500 dark:text-neutral-400">
                      可选：上传图片 / 视频作为素材
                    </span>
                    <span className="mt-1 block text-xs text-neutral-300 dark:text-neutral-600">
                      支持 MP4 / MOV / JPG / PNG
                    </span>
                  </span>
                </>
              )}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={event => handleFileUpload(event.target.files)}
            className="hidden"
            multiple
            accept="image/*,video/*"
          />
        </div>

        <div className="space-y-3 border-t border-neutral-100 p-3 dark:border-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">输出内容</span>
              <div className="inline-flex w-full items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100/70 px-3 py-2 text-xs text-neutral-600 shadow-inner dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300 sm:w-auto">
                <Layers size={13} className="text-cyan-500" />
                <span className="font-medium text-neutral-800 dark:text-neutral-100">视频交接样片</span>
                <span className="text-neutral-400">+</span>
                <FileText size={13} className="text-violet-500" />
                <span>结构化分镜表</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs font-medium transition-all shadow-lg sm:w-auto ${
                !canGenerate
                  ? 'bg-neutral-200 text-neutral-400 shadow-none dark:bg-white/10'
                  : 'nm-day-primary-cta bg-gradient-to-r from-cyan-500 to-violet-600 text-white hover:opacity-90 shadow-cyan-500/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {generateButtonLabel}
                </>
              ) : (
                <>
                  {generateButtonLabel}
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {suggestion && (
        <div className={`mt-4 w-full flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs ${
          suggestion.type === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : suggestion.type === 'info'
              ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400'
              : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
        }`}>
          {suggestion.type === 'ok' && <CheckCircle size={14} className="shrink-0 mt-0.5" />}
          {suggestion.type === 'info' && <FileText size={14} className="shrink-0 mt-0.5" />}
          {suggestion.type === 'warn' && <AlertCircle size={14} className="shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{suggestion.text}</span>
        </div>
      )}

      {generationError && (
        <div className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {generationError}。文稿、素材和主题已保留，可以直接重试。
        </div>
      )}

      {flowHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setFlowHelpGoal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-goal-help-title"
            className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-950"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5 dark:border-white/10">
              <div>
                <p className="mb-2 text-xs font-mono tracking-widest text-cyan-600 dark:text-cyan-300">
                  CREATION FLOW
                </p>
                <h2 id="publish-goal-help-title" className="text-xl font-semibold text-neutral-900 dark:text-white">
                  {flowHelp.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {flowHelp.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFlowHelpGoal(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-700 dark:border-white/10 dark:hover:text-white"
                aria-label="关闭流程说明"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${
                flowHelpGoal === 'fast_publish'
                  ? 'border-cyan-500/20 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300'
                  : 'border-violet-500/20 bg-violet-500/5 text-violet-700 dark:text-violet-300'
              }`}>
                {flowHelp.resultLabel}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {flowHelp.steps.map(step => {
                  const StepIcon = helpStepIcons[step.icon];

                  return (
                    <div
                      key={step.title}
                      className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50/70 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="relative aspect-[16/8] overflow-hidden border-b border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-neutral-900">
                        <img
                          src={step.imageSrc}
                          alt={step.imageAlt}
                          className="h-full w-full object-cover object-top"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                        <div className={`absolute left-3 top-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/60 bg-white/90 shadow-sm backdrop-blur ${
                          flowHelpGoal === 'fast_publish'
                            ? 'text-cyan-600'
                            : 'text-violet-600'
                        }`}>
                          <StepIcon size={17} />
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
