import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Paperclip,
  X,
  Loader2,
  FileVideo,
  CheckSquare,
  Bot,
  Users,
  Clapperboard,
} from 'lucide-react';
import { uploadFile, AssetInfo } from '../api/scriptApi';
import { createProject } from '../api/projectApi';
import { createLogger } from '../utils/logger';
import { InspirationModal, InspirationProposal } from './InspirationModal';

const log = createLogger('StartPage');

interface StartPageProps {
  onProjectsChange?: () => void;
}

export const StartPage: React.FC<StartPageProps> = ({ onProjectsChange }) => {
  const navigate = useNavigate();

  // ── Core State ───────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [generationMode, setGenerationMode] = useState<'ai_generated' | 'ai_plus_real' | 'pure_real'>('ai_generated');
  const [uploadedAssets, setUploadedAssets] = useState<AssetInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInspirationModal, setShowInspirationModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure assets have selected prop when mode changes
  useEffect(() => {
    setUploadedAssets(prev =>
      prev.map(asset => ({ ...asset, selected: asset.selected !== false }))
    );
  }, [generationMode]);

  // ── File Upload ──────────────────────────────────────────────────────────
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
          try { duration = await getVideoDuration(file); } catch {}
        }

        const asset = await uploadFile(file);
        setUploadedAssets(prev => [
          ...prev,
          { ...asset, duration: duration || asset.duration, selected: true },
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
      prev.map((asset, i) => (i === index ? { ...asset, selected: !asset.selected } : asset))
    );
  };

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (generationMode === 'pure_real') {
      await handleDirectGenerate();
      return;
    }

    // AI / mixed: open Inspiration Lab
    setShowInspirationModal(true);
  };

  const handleDirectGenerate = async () => {
    setIsGenerating(true);
    try {
      const projectResult = await createProject({
        title: prompt.slice(0, 50) || '未命名项目',
        description: prompt,
        userPrompt: prompt,
        settings: { generationMode, uploadedAssets },
      });

      if (projectResult.success && projectResult.data) {
        const project = projectResult.data;
        onProjectsChange?.();
        sessionStorage.setItem('storyboard_navigation_flag', 'true');
        navigate(`/storyboard?projectId=${project.id}`, {
          state: {
            projectId: project.id,
            userPrompt: prompt,
            uploadedAssets,
            generationMode,
            isGenerating: true,
          },
        });
      } else {
        sessionStorage.setItem('storyboard_navigation_flag', 'true');
        navigate('/storyboard', {
          state: { userPrompt: prompt, uploadedAssets, generationMode, isGenerating: true },
        });
      }
    } catch {
      sessionStorage.setItem('storyboard_navigation_flag', 'true');
      navigate('/storyboard', {
        state: { userPrompt: prompt, uploadedAssets, generationMode, isGenerating: true },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInspirationSelect = async (proposal: InspirationProposal) => {
    log.debug('📝 用户选择了灵感方案:', proposal.title);
    setShowInspirationModal(false);
    setIsGenerating(true);

    try {
      const projectResult = await createProject({
        title: proposal.title,
        description: prompt,
        userPrompt: prompt,
        settings: {
          generationMode,
          uploadedAssets,
          inspirationMode: true,
          selectedProposal: proposal,
        },
      });

      if (!projectResult.success || !projectResult.data) {
        alert('创建项目失败，请重试');
        return;
      }

      const project = projectResult.data;
      onProjectsChange?.();

      const selectedAssetIds = uploadedAssets
        .filter(a => a.selected !== false)
        .map((a, i) => a.file_path || `asset-${i}`);

      sessionStorage.setItem('storyboard_navigation_flag', 'true');
      navigate(`/script-editor?projectId=${project.id}`, {
        state: {
          projectId: project.id,
          proposal,
          uploadedAssets,
          selectedAssetIds,
          userPrompt: prompt,
          generationMode,
        },
      });
    } catch {
      alert('创建项目失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = !!prompt.trim() && !isUploading && !isGenerating;
  const modeMap = { ai_generated: 'ai', ai_plus_real: 'mixed', pure_real: 'live' } as const;
  const currentMode = modeMap[generationMode];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full relative z-10 h-full">

      {/* Title Area */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 mb-6 shadow-xl dark:shadow-2xl">
          <Sparkles className="text-cyan-500 dark:text-white" size={32} />
        </div>
        <h1 className="text-4xl font-light tracking-tight text-neutral-900 dark:text-white mb-4">
          今天我们创作什么？
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">
          描述你的创意构想，AI 将为你生成脚本、分镜和配乐。
        </p>
      </div>

      {/* Input Card */}
      <div className="w-full bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-2 backdrop-blur-xl shadow-2xl focus-within:border-cyan-400/50 dark:focus-within:border-white/20 transition-colors">

        {/* Uploaded Asset Thumbnails */}
        {uploadedAssets.length > 0 && (
          <div className="flex gap-3 p-3 overflow-x-auto border-b border-neutral-100 dark:border-white/5">
            {uploadedAssets.map((asset, index) => (
              <div
                key={index}
                className="relative group shrink-0 w-28 rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden bg-neutral-100 dark:bg-neutral-800"
              >
                {asset.file_type === 'image' ? (
                  <img
                    src={`http://localhost:3000${asset.file_path.startsWith('/') ? '' : '/'}${asset.file_path}`}
                    alt="素材"
                    className="w-full h-20 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                    }}
                  />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center bg-neutral-200 dark:bg-neutral-700">
                    <FileVideo size={24} className="text-neutral-400" />
                  </div>
                )}

                {/* Remove Button */}
                <button
                  onClick={() => removeAsset(index)}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>

                {/* Scene/Reference Toggle */}
                <div
                  onClick={() => toggleAssetSelection(index)}
                  className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1.5 flex items-center gap-1.5 cursor-pointer text-xs text-white hover:bg-black/80 transition-colors"
                >
                  {asset.selected !== false ? (
                    <CheckSquare size={12} className="text-cyan-400 shrink-0" />
                  ) : (
                    <div className="w-3 h-3 border border-neutral-400 rounded-sm shrink-0" />
                  )}
                  <span className="truncate text-[10px]">
                    {asset.file_type === 'video' ? 'Video' : 'Image'}
                  </span>
                </div>
              </div>
            ))}
            {isUploading && (
              <div className="shrink-0 w-28 h-20 rounded-lg border border-neutral-200 dark:border-white/10 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                <Loader2 size={20} className="animate-spin text-neutral-400" />
              </div>
            )}
          </div>
        )}

        {/* Textarea */}
        <textarea
          className="w-full bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 p-4 resize-none outline-none text-lg min-h-[140px]"
          placeholder="例如：制作一个宣传广州文化的短片，展现传统建筑、美食和民俗风情..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && canGenerate) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          disabled={isGenerating}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-t border-neutral-100 dark:border-white/5 mt-2">
          <div className="flex items-center gap-3">

            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-black/50 rounded-lg p-1 border border-neutral-200 dark:border-white/5">
              <button
                onClick={() => setGenerationMode('ai_generated')}
                className={`p-2 rounded-md transition-colors ${
                  currentMode === 'ai'
                    ? 'bg-white dark:bg-white/10 text-cyan-500 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
                }`}
                title="AI 生成模式：全部由 AI 创作"
              >
                <Bot size={16} />
              </button>
              <button
                onClick={() => setGenerationMode('ai_plus_real')}
                className={`p-2 rounded-md transition-colors ${
                  currentMode === 'mixed'
                    ? 'bg-white dark:bg-white/10 text-violet-500 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
                }`}
                title="AI + 实拍混合模式"
              >
                <Users size={16} />
              </button>
              <button
                onClick={() => setGenerationMode('pure_real')}
                className={`p-2 rounded-md transition-colors ${
                  currentMode === 'live'
                    ? 'bg-white dark:bg-white/10 text-fuchsia-500 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
                }`}
                title="纯实拍剪辑模式"
              >
                <Clapperboard size={16} />
              </button>
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-white/10" />

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              title="上传图片 / 视频素材"
              disabled={isUploading}
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={e => handleFileUpload(e.target.files)}
              className="hidden"
              multiple
              accept="image/*,video/*"
            />

            {/* Mode Label */}
            <span className="text-xs text-neutral-400 dark:text-neutral-600 font-mono tracking-wider">
              {generationMode === 'ai_generated' && 'AI ONLY'}
              {generationMode === 'ai_plus_real' && 'AI + REAL'}
              {generationMode === 'pure_real' && 'REAL ONLY'}
            </span>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg font-mono text-sm tracking-wider ${
              !canGenerate
                ? 'bg-neutral-200 dark:bg-white/10 text-neutral-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white hover:opacity-90 shadow-cyan-500/20'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                GENERATING...
              </>
            ) : (
              <>
                GENERATE SCRIPT
                <Sparkles size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inspiration Modal (uses existing backend API) */}
      <InspirationModal
        isOpen={showInspirationModal}
        onClose={() => setShowInspirationModal(false)}
        onSelectProposal={handleInspirationSelect}
        uploadedAssets={uploadedAssets}
        userPrompt={prompt}
        generationMode={generationMode}
      />
    </div>
  );
};
