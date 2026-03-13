/**
 * 智能标签云组件
 * 可视化展示并支持删除标签
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, MapPin, Palette, Move, Loader2 } from 'lucide-react';
import { VideoPromptTags } from '../../api/tagRefinementApi';
import { clsx } from 'clsx';

interface SmartTagCloudProps {
  tags: VideoPromptTags;
  onRemoveTag: (category: keyof VideoPromptTags, tag: string) => void;
  isLoading?: boolean;
}

/**
 * 分类配置
 */
const CATEGORY_CONFIG = {
  subjects: {
    label: '主体',
    icon: User,
    color: 'blue',
    bgClass: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
    hoverClass: 'hover:bg-blue-500/20'
  },
  environment: {
    label: '环境',
    icon: MapPin,
    color: 'amber',
    bgClass: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
    hoverClass: 'hover:bg-amber-500/20'
  },
  style: {
    label: '风格',
    icon: Palette,
    color: 'purple',
    bgClass: 'bg-purple-500/10 border-purple-500/30 text-purple-600',
    hoverClass: 'hover:bg-purple-500/20'
  },
  action: {
    label: '动态',
    icon: Move,
    color: 'rose',
    bgClass: 'bg-rose-500/10 border-rose-500/30 text-rose-600',
    hoverClass: 'hover:bg-rose-500/20'
  }
};

/**
 * 单个标签组件
 */
const TagItem: React.FC<{
  text: string;
  category: keyof VideoPromptTags;
  onRemove: () => void;
}> = ({ text, category, onRemove }) => {
  const config = CATEGORY_CONFIG[category];
  
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all",
        config.bgClass,
        config.hoverClass
      )}
    >
      <span>{text}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
        title="删除此标签"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
};

/**
 * 标签分类组
 */
const TagCategory: React.FC<{
  category: keyof VideoPromptTags;
  tags: string[];
  onRemoveTag: (tag: string) => void;
}> = ({ category, tags, onRemoveTag }) => {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  
  if (tags.length === 0) return null;
  
  return (
    <div className="space-y-2">
      {/* 分类标题 */}
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon size={14} className={clsx('text-' + config.color + '-500')} />
        <span>{config.label}</span>
        <span className="text-[10px] opacity-60">({tags.length})</span>
      </div>
      
      {/* 标签列表 */}
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {tags.map((tag) => (
            <TagItem
              key={`${category}-${tag}`}
              text={tag}
              category={category}
              onRemove={() => onRemoveTag(tag)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * 智能标签云主组件
 */
export const SmartTagCloud: React.FC<SmartTagCloudProps> = ({
  tags,
  onRemoveTag,
  isLoading = false
}) => {
  // 计算总标签数
  const totalCount = Object.values(tags).reduce((sum, arr) => sum + arr.length, 0);
  
  return (
    <div className="relative space-y-4">
      {/* 加载态遮罩 */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-lg flex items-center justify-center"
          >
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 size={20} />
              </motion.div>
              <span>AI 正在分析中...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">画面标签</h4>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            共 {totalCount} 个标签
          </span>
        )}
      </div>
      
      {/* 空状态 */}
      {totalCount === 0 && !isLoading && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p>暂无标签</p>
          <p className="text-xs mt-1">系统将自动分析脚本生成标签</p>
        </div>
      )}
      
      {/* 标签分类列表 */}
      {totalCount > 0 && (
        <div className="space-y-4">
          <TagCategory
            category="subjects"
            tags={tags.subjects}
            onRemoveTag={(tag) => onRemoveTag('subjects', tag)}
          />
          <TagCategory
            category="environment"
            tags={tags.environment}
            onRemoveTag={(tag) => onRemoveTag('environment', tag)}
          />
          <TagCategory
            category="style"
            tags={tags.style}
            onRemoveTag={(tag) => onRemoveTag('style', tag)}
          />
          <TagCategory
            category="action"
            tags={tags.action}
            onRemoveTag={(tag) => onRemoveTag('action', tag)}
          />
        </div>
      )}
    </div>
  );
};

