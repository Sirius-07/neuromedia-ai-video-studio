/**
 * AI 转场卡片组件 - 首尾帧生成视频转场
 * 使用ComfyUI的wan2.2工作流进行首尾帧生成视频
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Play, Trash2, RefreshCw, Film, Loader2, Zap
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractLastFrame, extractFirstFrame } from '../../utils/videoFrameExtractor';
import { getProxiedImageUrl } from '../../utils/imageProxy';
import { apiUrl, proxyVideoUrl } from '../../config/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AiTransitionCardProps {
  /** 前一个场景的视频 URL（将自动提取最后一帧） */
  prevSceneVideoUrl?: string;
  /** 前一个场景的脚本内容 */
  prevSceneScript?: string;
  /** 下一个场景的第一帧图片 URL */
  nextSceneFirstFrame?: string;
  /** 下一个场景的脚本内容 */
  nextSceneScript?: string;
  /** 视频主题内容 */
  videoTheme?: string;
  /** 生成的转场视频 URL */
  transitionVideoUrl?: string;
  /** 转场时长（秒） */
  duration?: number;
  /** 生成状态 */
  status?: 'idle' | 'generating' | 'completed' | 'error';
  /** 删除转场回调 */
  onDelete?: () => void;
  /** 生成转场回调 */
  onGenerate?: (prompt: string, firstFrame: string, lastFrame: string) => void;
}

export const AiTransitionCard: React.FC<AiTransitionCardProps> = ({
  prevSceneVideoUrl,
  prevSceneScript = '',
  nextSceneFirstFrame,
  nextSceneScript = '',
  videoTheme = '',
  transitionVideoUrl,
  duration = 2,
  status = 'idle',
  onDelete,
  onGenerate
}) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [prevSceneLastFrame, setPrevSceneLastFrame] = useState<string | undefined>(undefined);
  const [nextSceneFirstFrameExtracted, setNextSceneFirstFrameExtracted] = useState<string | undefined>(undefined);
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);
  const [isExtractingNextFrame, setIsExtractingNextFrame] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 获取代理后的URL（绕过跨域限制）
  const getProxiedVideoUrl = (originalUrl: string | undefined) => {
    if (!originalUrl) return undefined;
    if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) {
      return originalUrl;
    }
    return proxyVideoUrl(originalUrl);
  };

  // 自动提取前一个场景的最后一帧（视频）或直接使用图片
  useEffect(() => {
    if (!prevSceneVideoUrl) {
      setPrevSceneLastFrame(undefined);
      return;
    }

    // 判断是视频还是图片
    const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(prevSceneVideoUrl) || 
                    prevSceneVideoUrl.includes('/proxy/video');
    
    // 如果是图片或base64，直接使用
    if (!isVideo || prevSceneVideoUrl.startsWith('data:') || prevSceneVideoUrl.startsWith('blob:')) {
      console.log('🖼️ [转场卡片] 前一个场景是图片，直接使用:', prevSceneVideoUrl.substring(0, 100));
      setPrevSceneLastFrame(prevSceneVideoUrl);
      setIsExtractingFrame(false);
      return;
    }

    // 如果是视频，提取最后一帧
    let cancelled = false;
    setIsExtractingFrame(true);

    const proxiedUrl = getProxiedVideoUrl(prevSceneVideoUrl);
    console.log('🎬 [转场卡片] 开始提取视频最后一帧:', { 原始URL: prevSceneVideoUrl, 代理URL: proxiedUrl });

    extractLastFrame(proxiedUrl)
      .then((frameDataUrl) => {
        if (!cancelled) {
          console.log('✅ [转场卡片] 视频帧提取成功');
          setPrevSceneLastFrame(frameDataUrl);
          setIsExtractingFrame(false);
        }
      })
      .catch((error) => {
        console.error('❌ [转场卡片] 提取视频帧失败:', error);
        if (!cancelled) {
          setIsExtractingFrame(false);
          // 提取失败时，尝试直接使用原URL（可能是图片）
          setPrevSceneLastFrame(prevSceneVideoUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [prevSceneVideoUrl]);

  // 自动提取下一个场景的首帧（如果是视频）
  useEffect(() => {
    if (!nextSceneFirstFrame) {
      setNextSceneFirstFrameExtracted(undefined);
      return;
    }

    // 判断是视频还是图片
    const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(nextSceneFirstFrame) || 
                    nextSceneFirstFrame.includes('/proxy/video');
    
    // 如果是图片或base64，直接使用
    if (!isVideo || nextSceneFirstFrame.startsWith('data:') || nextSceneFirstFrame.startsWith('blob:')) {
      console.log('🖼️ [转场卡片] 下一个场景是图片，直接使用:', nextSceneFirstFrame.substring(0, 100));
      setNextSceneFirstFrameExtracted(nextSceneFirstFrame);
      return;
    }

    // 如果是视频，提取首帧
    let cancelled = false;
    setIsExtractingNextFrame(true);

    const proxiedUrl = getProxiedVideoUrl(nextSceneFirstFrame);
    console.log('🎬 [转场卡片] 开始提取下一个场景视频首帧:', { 原始URL: nextSceneFirstFrame, 代理URL: proxiedUrl });

    extractFirstFrame(proxiedUrl)
      .then((frameDataUrl) => {
        if (!cancelled) {
          console.log('✅ [转场卡片] 下一个场景首帧提取成功');
          setNextSceneFirstFrameExtracted(frameDataUrl);
          setIsExtractingNextFrame(false);
        }
      })
      .catch((error) => {
        console.error('❌ [转场卡片] 提取下一个场景首帧失败:', error);
        if (!cancelled) {
          setIsExtractingNextFrame(false);
          // 提取失败时，尝试直接使用原URL（可能是图片）
          setNextSceneFirstFrameExtracted(nextSceneFirstFrame);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nextSceneFirstFrame]);

  const handleGenerate = () => {
    if (!prevSceneLastFrame || !nextSceneFirstFrameExtracted) {
      console.error('❌ [转场卡片] 缺少首帧或尾帧', { 
        prevSceneLastFrame: !!prevSceneLastFrame, 
        nextSceneFirstFrameExtracted: !!nextSceneFirstFrameExtracted 
      });
      return;
    }
    
    const prompt = customPrompt || 'smooth transition between scenes';
    onGenerate?.(prompt, prevSceneLastFrame, nextSceneFirstFrameExtracted);
  };

  // 生成AI转场提示词
  const handleGeneratePrompt = async () => {
    if (!prevSceneLastFrame || !nextSceneFirstFrameExtracted) {
      console.error('❌ [转场卡片] 缺少首帧或尾帧', { 
        prevSceneLastFrame: !!prevSceneLastFrame, 
        nextSceneFirstFrameExtracted: !!nextSceneFirstFrameExtracted 
      });
      return;
    }

    console.log('🤖 [转场卡片] 开始AI分析...');
    console.log('   📹 视频主题:', videoTheme);
    console.log('   📝 前一场景:', prevSceneScript?.substring(0, 50) + '...');
    console.log('   📝 后一场景:', nextSceneScript?.substring(0, 50) + '...');
    console.log('   🖼️ 首帧长度:', prevSceneLastFrame?.length || 0, '字符');
    console.log('   🖼️ 尾帧长度:', nextSceneFirstFrameExtracted?.length || 0, '字符');

    setIsGeneratingPrompt(true);

    try {
      // 调用AI模型生成转场提示词（包含图片分析）
      console.log('📤 [转场卡片] 发送请求到AI服务...');
      
      const response = await fetch(apiUrl('/api/v1/transition/generate-prompt'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prev_scene_script: prevSceneScript,
          next_scene_script: nextSceneScript,
          video_theme: videoTheme,
          first_frame_base64: prevSceneLastFrame,
          last_frame_base64: nextSceneFirstFrameExtracted,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '生成转场提示词失败');
      }

      const result = await response.json();
      if (result.success && result.prompt) {
        setCustomPrompt(result.prompt);
        console.log('✅ [转场卡片] AI分析完成！');
        console.log('   💡 生成的提示词:', result.prompt);
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      console.error('❌ [转场卡片] AI分析失败:', error);
      // 使用默认提示词
      const defaultPrompt = `从"${prevSceneScript.substring(0, 20)}..."平滑过渡到"${nextSceneScript.substring(0, 20)}..."`;
      setCustomPrompt(defaultPrompt);
      console.log('   🔄 使用默认提示词:', defaultPrompt);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const isGenerating = status === 'generating';
  const hasVideo = !!transitionVideoUrl && status === 'completed';

  return (
    <div className="relative w-full py-4">
      {/* 连接线 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-border via-purple-500/30 to-border"></div>

      {/* 转场卡片 - 与 SceneCard 相同的宽度 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className={cn(
          "bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 rounded-xl overflow-hidden transition-all duration-200 shadow-lg backdrop-blur-sm",
          "border-purple-500/30"
        )}>
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">AI 转场</h3>
                <p className="text-xs text-muted-foreground">首尾帧生成视频转场</p>
              </div>
            </div>
            
            {/* 删除按钮 */}
            <button
              onClick={onDelete}
              className="p-2 hover:bg-destructive/10 rounded-md transition-colors group"
              title="删除转场"
            >
              <Trash2 size={16} className="text-muted-foreground group-hover:text-destructive" />
            </button>
          </div>

          {/* 主要内容区域 */}
          <div className="p-6">
            {!hasVideo ? (
              /* 生成前/生成中 */
              <div className="space-y-4">
                {/* 首尾帧显示 */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  {/* 首帧（上一个场景的最后一帧） */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">首帧</p>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border-2 border-purple-500/30">
                      {isExtractingFrame ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <RefreshCw size={24} className="animate-spin text-purple-500" />
                        </div>
                      ) : prevSceneLastFrame ? (
                        <img 
                          src={prevSceneLastFrame.startsWith('http') ? getProxiedImageUrl(prevSceneLastFrame) : prevSceneLastFrame}
                          alt="首帧" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                          等待提取...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 中间箭头 */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                    <Sparkles size={20} className="text-purple-500" />
                    <div className="w-12 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                </div>

                  {/* 尾帧（下一个场景的首帧） */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">尾帧</p>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border-2 border-blue-500/30">
                      {isExtractingNextFrame ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <RefreshCw size={24} className="animate-spin text-blue-500" />
                        </div>
                      ) : nextSceneFirstFrameExtracted ? (
                        <img 
                          src={nextSceneFirstFrameExtracted.startsWith('http') ? getProxiedImageUrl(nextSceneFirstFrameExtracted) : nextSceneFirstFrameExtracted}
                          alt="尾帧" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                          无图片
                        </div>
                      )}
                    </div>
                  </div>
                      </div>

                {/* 提示词输入框 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">
                      转场描述（可选）
                    </label>
                    {/* AI转场提示词按钮 */}
                    <button
                      onClick={handleGeneratePrompt}
                      disabled={isGeneratingPrompt || !prevSceneLastFrame || !nextSceneFirstFrameExtracted}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                        isGeneratingPrompt || !prevSceneLastFrame || !nextSceneFirstFrameExtracted
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-500 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/30"
                      )}
                      title={
                        !prevSceneLastFrame || !nextSceneFirstFrameExtracted
                          ? "请等待首尾帧加载完成"
                          : "AI分析首尾帧画面，生成最佳转场提示词"
                      }
                    >
                      {isGeneratingPrompt ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          AI分析中...
                        </>
                      ) : (
                        <>
                          <Zap size={12} />
                          AI转场提示词
                        </>
                      )}
                    </button>
                    </div>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="例如：镜头缓慢推进，画面自然过渡..."
                    className="w-full h-20 bg-muted/50 border border-border rounded-md p-3 text-sm text-foreground focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                    disabled={isGenerating || isGeneratingPrompt}
                  />
                </div>

                {/* 生成按钮 */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prevSceneLastFrame || !nextSceneFirstFrame}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all",
                    isGenerating || !prevSceneLastFrame || !nextSceneFirstFrame
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-lg hover:scale-[1.02]"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      生成转场视频
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* 已生成视频 - 替换首尾帧显示区域 */
              <div className="space-y-4">
                {/* 视频预览 */}
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black border-2 border-green-500/30">
                  <video
                    ref={videoRef}
                    src={transitionVideoUrl}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-green-500/90 backdrop-blur-sm rounded text-xs font-semibold text-white flex items-center gap-1">
                    <Play size={12} />
                    转场已生成
          </div>
              </div>
              
                {/* 重新生成按钮 */}
                <button
                  onClick={handleGenerate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCw size={14} />
                  重新生成
                </button>
              </div>
          )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
