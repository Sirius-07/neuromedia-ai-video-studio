/**
 * 魔法指令框组件
 * 支持自然语言输入，智能提示
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface MagicInputProps {
  onSend: (instruction: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

/**
 * 智能提示文案（轮播）
 */
const PLACEHOLDER_SUGGESTIONS = [
  '试试输入：把背景改成雪山',
  '试试输入：让主角看起来更悲伤一点',
  '试试输入：加点雨',
  '试试输入：变成赛博朋克风格',
  '试试输入：去掉人物',
  '试试输入：改成夜晚场景',
  '试试输入：添加电影感',
  '试试输入：让镜头推进'
];

export const MagicInput: React.FC<MagicInputProps> = ({
  onSend,
  isLoading = false,
  placeholder
}) => {
  const [instruction, setInstruction] = useState('');
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 轮播 placeholder
  useEffect(() => {
    if (placeholder) return; // 如果提供了固定 placeholder，不轮播
    
    const interval = setInterval(() => {
      setCurrentPlaceholderIndex((prev) => 
        (prev + 1) % PLACEHOLDER_SUGGESTIONS.length
      );
    }, 3000);
    
    return () => clearInterval(interval);
  }, [placeholder]);
  
  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [instruction]);
  
  const handleSend = () => {
    if (instruction.trim() && !isLoading) {
      onSend(instruction.trim());
      setInstruction('');  // 清空输入框
      
      // 重置输入框高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 或 Cmd+Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };
  
  const displayPlaceholder = placeholder || PLACEHOLDER_SUGGESTIONS[currentPlaceholderIndex];
  
  return (
    <div className="space-y-2">
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles size={16} className="text-primary" />
        <span>魔法指令</span>
      </div>
      
      {/* 输入框容器 */}
      <div
        className={clsx(
          "relative flex items-end gap-2 p-3 rounded-lg border-2 transition-all",
          isLoading 
            ? "border-primary/30 bg-primary/5" 
            : "border-border hover:border-primary/50 focus-within:border-primary bg-background"
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={displayPlaceholder}
          disabled={isLoading}
          rows={1}
          className={clsx(
            "flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/50",
            "min-h-[24px] max-h-[120px] overflow-y-auto",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        />
        
        {/* 发送按钮 */}
        <motion.button
          onClick={handleSend}
          disabled={!instruction.trim() || isLoading}
          whileTap={{ scale: 0.95 }}
          className={clsx(
            "flex items-center justify-center w-8 h-8 rounded-md transition-all shrink-0",
            instruction.trim() && !isLoading
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          title="发送指令 (Ctrl+Enter)"
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 size={16} />
            </motion.div>
          ) : (
            <Send size={16} />
          )}
        </motion.button>
      </div>
      
      {/* 提示文本 */}
      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] border border-border">Ctrl</kbd>
        <span>+</span>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] border border-border">Enter</kbd>
        <span>快速发送</span>
      </p>
    </div>
  );
};

