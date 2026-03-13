/**
 * 意图驱动控制台
 * 整合智能标签云 + 魔法指令框 + 高级预览
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Eye, Sparkles, AlertCircle } from 'lucide-react';
import { SmartTagCloud } from './SmartTagCloud';
import { MagicInput } from './MagicInput';
import { 
  VideoPromptTags, 
  refineTags, 
  createEmptyTags, 
  tagsToPromptText 
} from '../../api/tagRefinementApi';
import { clsx } from 'clsx';

interface IntentDrivenConsoleProps {
  scriptContent: string;              // 分镜脚本内容
  initialTags?: VideoPromptTags;      // 初始标签（可选）
  onTagsChange?: (tags: VideoPromptTags) => void;  // 标签变化回调
  onRegenerate?: () => void;          // 触发重新生成
  isGenerating?: boolean;             // 是否正在生成
}

export const IntentDrivenConsole: React.FC<IntentDrivenConsoleProps> = ({
  scriptContent,
  initialTags,
  onTagsChange,
  onRegenerate,
  isGenerating = false
}) => {
  // 状态管理
  const [tags, setTags] = useState<VideoPromptTags>(initialTags || createEmptyTags());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [showAdvancedPreview, setShowAdvancedPreview] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // 监听场景切换：当 initialTags 或 scriptContent 改变时更新标签
  useEffect(() => {
    console.log('🔄 [IntentDrivenConsole] 检测到场景切换，更新标签');
    
    // 如果有新的 initialTags，直接使用
    if (initialTags) {
      const hasExistingTags = Object.values(initialTags).some(arr => arr.length > 0);
      
      if (hasExistingTags) {
        console.log('✅ [IntentDrivenConsole] 使用场景的已有标签');
        setTags(initialTags);
        setHasInitialized(true);
        setError(null);
        setAiMessage(null);
        return;
      }
    }
    
    // 如果没有标签，重置为空标签
    console.log('📋 [IntentDrivenConsole] 场景无标签，重置状态');
    setTags(createEmptyTags());
    setHasInitialized(false);
    setError(null);
    setAiMessage(null);
  }, [initialTags, scriptContent]);

  // 冷启动：自动初始化标签（只在没有 initialTags 时执行）
  useEffect(() => {
    // 如果已经初始化过，或者已经有标签，跳过
    if (hasInitialized || (tags && Object.values(tags).some(arr => arr.length > 0))) {
      return;
    }
    
    // 如果没有标签，且有脚本内容，则自动初始化
    const shouldInitialize = scriptContent && !isLoading;
    
    if (shouldInitialize) {
      console.log('🌱 [IntentDrivenConsole] 冷启动：自动初始化标签');
      handleInitialize();
    }
  }, [scriptContent, hasInitialized, tags, isLoading]);

  /**
   * 初始化标签（冷启动）
   */
  const handleInitialize = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📝 [IntentDrivenConsole] 调用 API：初始化模式');
      const response = await refineTags({
        scriptContent,
        currentTags: undefined,
        userInstruction: undefined
      });

      if (response.code === 200) {
        console.log('✅ [IntentDrivenConsole] 初始化成功:', response.data.tags);
        setTags(response.data.tags);
        setAiMessage(response.data.message);
        setHasInitialized(true);
        
        // 通知父组件
        if (onTagsChange) {
          onTagsChange(response.data.tags);
        }
      } else {
        throw new Error(response.message || '初始化失败');
      }
    } catch (err: any) {
      console.error('❌ [IntentDrivenConsole] 初始化失败:', err);
      setError(err.message || '标签初始化失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 根据用户指令修订标签（热更新）
   */
  const handleRefine = async (userInstruction: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setAiMessage(null);
      
      console.log('🔧 [IntentDrivenConsole] 调用 API：修订模式');
      console.log('💬 用户指令:', userInstruction);
      
      const response = await refineTags({
        scriptContent,
        currentTags: tags,
        userInstruction
      });

      if (response.code === 200) {
        console.log('✅ [IntentDrivenConsole] 修订成功:', response.data.tags);
        setTags(response.data.tags);
        setAiMessage(response.data.message);
        
        // 通知父组件
        if (onTagsChange) {
          onTagsChange(response.data.tags);
        }
      } else {
        throw new Error(response.message || '修订失败');
      }
    } catch (err: any) {
      console.error('❌ [IntentDrivenConsole] 修订失败:', err);
      setError(err.message || '标签修订失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 删除标签
   */
  const handleRemoveTag = (category: keyof VideoPromptTags, tag: string) => {
    const newTags = {
      ...tags,
      [category]: tags[category].filter(t => t !== tag)
    };
    setTags(newTags);
    
    // 通知父组件
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  // 生成最终提示词
  const finalPrompt = tagsToPromptText(tags);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. 智能标签云 */}
      <section className="flex-shrink-0">
        <SmartTagCloud
          tags={tags}
          onRemoveTag={handleRemoveTag}
          isLoading={isLoading}
        />
      </section>

      {/* AI 反馈消息 */}
      <AnimatePresence>
        {aiMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-600"
          >
            <Sparkles size={14} className="shrink-0 mt-0.5" />
            <span>{aiMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600"
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">操作失败</div>
              <div className="mt-0.5">{error}</div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 魔法指令框 */}
      <section className="flex-shrink-0">
        <MagicInput
          onSend={handleRefine}
          isLoading={isLoading}
        />
      </section>

      {/* 3. 高级预览（可折叠） */}
      <section className="flex-shrink-0 border-t border-border pt-3">
        <button
          onClick={() => setShowAdvancedPreview(!showAdvancedPreview)}
          className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            <Eye size={14} />
            高级预览
          </span>
          {showAdvancedPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <AnimatePresence>
          {showAdvancedPreview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 bg-muted/30 border border-border rounded-lg">
                <div className="text-[10px] text-muted-foreground mb-2">
                  最终拼接提示词（中文）
                </div>
                <div className="text-xs text-foreground font-mono leading-relaxed">
                  {finalPrompt || '（标签为空）'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* 4. 重新生成按钮 */}
      <div className="flex-shrink-0 pt-3 border-t border-border">
        <button
          onClick={onRegenerate}
          disabled={isGenerating || isLoading}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
            isGenerating || isLoading
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          )}
        >
          {isGenerating || isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles size={16} />
              </motion.div>
              <span>{isLoading ? '分析中...' : '生成中...'}</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>重新生成</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

