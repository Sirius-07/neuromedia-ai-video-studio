import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Lock, Unlock, Check, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface ScriptSyncButtonProps {
  scriptText: string;
  currentPrompt: string;
  lockedTags?: string[]; // 锁定的标签（不被覆盖）
  onSync: (newPrompt: string) => void;
  onSyncWithLLM?: (scriptText: string, lockedTags: string[]) => Promise<string>;
  className?: string;
}

export const ScriptSyncButton: React.FC<ScriptSyncButtonProps> = ({
  scriptText,
  currentPrompt,
  lockedTags = [],
  onSync,
  onSyncWithLLM,
  className
}) => {
  const [hasModification, setHasModification] = useState(false);
  const [lastSyncedScript, setLastSyncedScript] = useState(scriptText);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // 检测脚本是否被修改
  useEffect(() => {
    if (scriptText !== lastSyncedScript) {
      setHasModification(true);
      setSyncStatus('idle');
    }
  }, [scriptText, lastSyncedScript]);

  // 执行同步
  const handleSync = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('脚本内容为空');
      setSyncStatus('error');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMessage('');

    try {
      let newPrompt: string;

      if (onSyncWithLLM) {
        // 调用 LLM API
        newPrompt = await onSyncWithLLM(scriptText, lockedTags);
      } else {
        // Fallback：简单提取关键词
        newPrompt = extractKeywordsFromScript(scriptText, lockedTags);
      }

      onSync(newPrompt);
      setLastSyncedScript(scriptText);
      setHasModification(false);
      setSyncStatus('success');

      // 3秒后重置成功状态
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);

    } catch (error) {
      console.error('同步失败:', error);
      setErrorMessage(error instanceof Error ? error.message : '同步失败');
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // 简单的关键词提取（Fallback）
  const extractKeywordsFromScript = (script: string, locked: string[]): string => {
    // 简化版本：提取名词和动词
    const keywords: string[] = [];
    
    // 常见主体词
    const subjects = ['人物', '建筑', '风景', '动物', '车辆', '老人', '少年', '女孩', '男孩', '广州塔'];
    // 常见环境词
    const environments = ['晨光', '夕阳', '夜晚', '雨天', '晴天', '室内', '室外', '街道', '公园'];
    // 常见动作词
    const actions = ['奔跑', '行走', '跳舞', '飞行', '站立', '坐下', '欢呼', '挥手', '打太极'];

    subjects.forEach(word => {
      if (script.includes(word) && !keywords.includes(word)) {
        keywords.push(word);
      }
    });

    environments.forEach(word => {
      if (script.includes(word) && !keywords.includes(word)) {
        keywords.push(word);
      }
    });

    actions.forEach(word => {
      if (script.includes(word) && !keywords.includes(word)) {
        keywords.push(word);
      }
    });

    // 保留锁定的标签
    const lockedPromptPart = locked.length > 0 ? locked.join(', ') + ', ' : '';
    const extractedPrompt = keywords.join(', ');

    return lockedPromptPart + extractedPrompt;
  };

  return (
    <div className={clsx("inline-flex flex-col gap-2", className)}>
      <motion.button
        onClick={handleSync}
        disabled={isSyncing || !hasModification}
        className={clsx(
          "relative flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all",
          hasModification && !isSyncing
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
            : "bg-muted text-muted-foreground cursor-not-allowed",
          syncStatus === 'success' && "bg-green-500 text-white",
          syncStatus === 'error' && "bg-red-500 text-white"
        )}
        whileHover={hasModification && !isSyncing ? { scale: 1.02 } : {}}
        whileTap={hasModification && !isSyncing ? { scale: 0.98 } : {}}
      >
        {/* 状态图标 */}
        <AnimatePresence mode="wait">
          {isSyncing ? (
            <motion.div
              key="syncing"
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw size={16} />
            </motion.div>
          ) : syncStatus === 'success' ? (
            <motion.div
              key="success"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Check size={16} />
            </motion.div>
          ) : syncStatus === 'error' ? (
            <motion.div
              key="error"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <AlertCircle size={16} />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Sparkles size={16} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 按钮文本 */}
        <span>
          {isSyncing ? '同步中...' : 
           syncStatus === 'success' ? '同步成功' :
           syncStatus === 'error' ? '同步失败' :
           '同步至画面提示词'}
        </span>

        {/* 修改提示红点 */}
        {hasModification && !isSyncing && syncStatus === 'idle' && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          />
        )}
      </motion.button>

      {/* 锁定标签提示 */}
      {lockedTags.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600">
          <Lock size={10} />
          <span>已锁定 {lockedTags.length} 个标签，不会被覆盖</span>
        </div>
      )}

      {/* 错误提示 */}
      <AnimatePresence>
        {syncStatus === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600"
          >
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 标签锁定管理器组件
export const TagLockManager: React.FC<{
  tags: string[];
  lockedTags: string[];
  onToggleLock: (tag: string) => void;
}> = ({ tags, lockedTags, onToggleLock }) => {
  if (tags.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">
        标签锁定（同步时保留）
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => {
          const isLocked = lockedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => onToggleLock(tag)}
              className={clsx(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                isLocked
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-600"
                  : "bg-muted/50 border border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
              <span>{tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};








