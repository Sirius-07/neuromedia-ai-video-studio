import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, Eye, EyeOff, Play, Pause, MoreVertical, Download, Share2 } from 'lucide-react';
import { clsx } from 'clsx';

export interface VideoVersion {
  id: string;
  version: number;
  videoUrl: string;
  thumbnailUrl?: string;
  timestamp: number;
  isSelected: boolean;
  metadata?: {
    prompt?: string;
    duration?: number;
    model?: string;
  };
}

interface VersionComparisonProps {
  versions: VideoVersion[];
  onSelectVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onCompare?: (versionIds: [string, string]) => void;
  className?: string;
}

export const VersionComparison: React.FC<VersionComparisonProps> = ({
  versions,
  onSelectVersion,
  onDeleteVersion,
  onCompare,
  className
}) => {
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[string?, string?]>([undefined, undefined]);
  const [hoveredVersion, setHoveredVersion] = useState<string | null>(null);

  const selectedVersion = versions.find(v => v.isSelected);

  // 切换对比模式
  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    if (compareMode) {
      setCompareVersions([undefined, undefined]);
    }
  };

  // 选择对比版本
  const handleCompareSelect = (versionId: string) => {
    if (!compareMode) return;

    const [first, second] = compareVersions;
    if (!first) {
      setCompareVersions([versionId, undefined]);
    } else if (!second && first !== versionId) {
      setCompareVersions([first, versionId]);
      // 自动触发对比
      if (onCompare) {
        onCompare([first, versionId]);
      }
    } else {
      // 重新选择
      setCompareVersions([versionId, undefined]);
    }
  };

  return (
    <div className={clsx("flex flex-col space-y-3", className)}>
      {/* 头部控制栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            生成历史
          </span>
          <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">
            {versions.length} 个版本
          </span>
        </div>

        <button
          onClick={toggleCompareMode}
          className={clsx(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all",
            compareMode
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <Eye size={12} />
          <span>{compareMode ? '退出对比' : '对比模式'}</span>
        </button>
      </div>

      {/* 版本列表 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <AnimatePresence>
          {versions.map((version) => {
            const isComparing = compareVersions.includes(version.id);
            const isHovered = hoveredVersion === version.id;

            return (
              <motion.div
                key={version.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative flex-shrink-0"
                onMouseEnter={() => setHoveredVersion(version.id)}
                onMouseLeave={() => setHoveredVersion(null)}
              >
                <div
                  onClick={() => {
                    if (compareMode) {
                      handleCompareSelect(version.id);
                    } else {
                      onSelectVersion(version.id);
                    }
                  }}
                  className={clsx(
                    "relative w-32 h-20 rounded-lg border-2 overflow-hidden cursor-pointer transition-all group",
                    version.isSelected && !compareMode && "border-primary shadow-lg shadow-primary/30",
                    isComparing && "border-blue-500 shadow-lg shadow-blue-500/30",
                    !version.isSelected && !isComparing && "border-border hover:border-primary/50"
                  )}
                >
                  {/* 缩略图/视频 */}
                  {version.thumbnailUrl ? (
                    <img
                      src={version.thumbnailUrl}
                      alt={`Version ${version.version}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Play size={24} className="text-muted-foreground/50" />
                    </div>
                  )}

                  {/* 遮罩层（悬停时显示） */}
                  <AnimatePresence>
                    {isHovered && !compareMode && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectVersion(version.id);
                          }}
                          className="p-2 bg-primary/90 hover:bg-primary rounded-full transition-colors"
                          title="选择此版本"
                        >
                          <Check size={16} className="text-primary-foreground" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteVersion(version.id);
                          }}
                          className="p-2 bg-red-500/90 hover:bg-red-500 rounded-full transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} className="text-white" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 版本标签 */}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-background/90 backdrop-blur-sm rounded text-[10px] font-bold">
                    V{version.version}
                  </div>

                  {/* 选中标记 */}
                  {version.isSelected && !compareMode && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1 right-1 p-1 bg-primary rounded-full"
                    >
                      <Check size={12} className="text-primary-foreground" />
                    </motion.div>
                  )}

                  {/* 对比选中标记 */}
                  {isComparing && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-500 rounded text-[10px] font-bold text-white"
                    >
                      {compareVersions[0] === version.id ? '1' : '2'}
                    </motion.div>
                  )}

                  {/* 时长（如果有） */}
                  {version.metadata?.duration && (
                    <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-background/90 backdrop-blur-sm rounded text-[9px] font-mono">
                      {version.metadata.duration.toFixed(1)}s
                    </div>
                  )}
                </div>

                {/* 时间戳 */}
                <div className="mt-1 text-[9px] text-muted-foreground text-center">
                  {new Date(version.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* 添加新版本提示 */}
        {versions.length === 0 && (
          <div className="flex-shrink-0 w-32 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground">
            <Play size={20} />
            <span className="text-[10px] mt-1">点击生成</span>
          </div>
        )}
      </div>

      {/* 对比模式提示 */}
      <AnimatePresence>
        {compareMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
          >
            <div className="flex items-start gap-2 text-xs text-blue-600">
              <Eye size={14} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">对比模式已激活</div>
                <div className="text-blue-600/80">
                  {!compareVersions[0] && '请选择第一个版本'}
                  {compareVersions[0] && !compareVersions[1] && '请选择第二个版本进行对比'}
                  {compareVersions[0] && compareVersions[1] && '正在对比两个版本'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 当前选中版本详情 */}
      {selectedVersion && !compareMode && (
        <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">当前版本: V{selectedVersion.version}</span>
            <div className="flex items-center gap-1">
              <button
                className="p-1 hover:bg-muted rounded transition-colors"
                title="下载"
              >
                <Download size={12} />
              </button>
              <button
                className="p-1 hover:bg-muted rounded transition-colors"
                title="分享"
              >
                <Share2 size={12} />
              </button>
              <button
                className="p-1 hover:bg-muted rounded transition-colors"
                title="更多"
              >
                <MoreVertical size={12} />
              </button>
            </div>
          </div>

          {selectedVersion.metadata && (
            <div className="space-y-1 text-[10px] text-muted-foreground">
              {selectedVersion.metadata.model && (
                <div>模型: {selectedVersion.metadata.model}</div>
              )}
              {selectedVersion.metadata.prompt && (
                <div className="line-clamp-2">
                  Prompt: {selectedVersion.metadata.prompt}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 分屏对比弹窗组件
export const ComparisonModal: React.FC<{
  versions: [VideoVersion, VideoVersion];
  onClose: () => void;
  onSelect: (versionId: string) => void;
}> = ({ versions, onClose, onSelect }) => {
  const [leftPlaying, setLeftPlaying] = useState(false);
  const [rightPlaying, setRightPlaying] = useState(false);
  const leftVideoRef = useRef<HTMLVideoElement>(null);
  const rightVideoRef = useRef<HTMLVideoElement>(null);

  const togglePlayLeft = () => {
    if (leftVideoRef.current) {
      if (leftPlaying) {
        leftVideoRef.current.pause();
      } else {
        leftVideoRef.current.play();
      }
      setLeftPlaying(!leftPlaying);
    }
  };

  const togglePlayRight = () => {
    if (rightVideoRef.current) {
      if (rightPlaying) {
        rightVideoRef.current.pause();
      } else {
        rightVideoRef.current.play();
      }
      setRightPlaying(!rightPlaying);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-6xl bg-card border border-border rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">版本对比</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded transition-colors"
          >
            <EyeOff size={18} />
          </button>
        </div>

        {/* 分屏内容 */}
        <div className="grid grid-cols-2 gap-px bg-border">
          {/* 左侧 */}
          <div className="bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">V{versions[0].version}</span>
              <button
                onClick={() => onSelect(versions[0].id)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                选择此版本
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={leftVideoRef}
                src={versions[0].videoUrl}
                className="w-full h-full object-contain"
                loop
              />
              <button
                onClick={togglePlayLeft}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
              >
                {leftPlaying ? <Pause size={48} className="text-white" /> : <Play size={48} className="text-white" />}
              </button>
            </div>

            {versions[0].metadata?.prompt && (
              <div className="text-xs text-muted-foreground line-clamp-3">
                {versions[0].metadata.prompt}
              </div>
            )}
          </div>

          {/* 右侧 */}
          <div className="bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">V{versions[1].version}</span>
              <button
                onClick={() => onSelect(versions[1].id)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                选择此版本
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={rightVideoRef}
                src={versions[1].videoUrl}
                className="w-full h-full object-contain"
                loop
              />
              <button
                onClick={togglePlayRight}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
              >
                {rightPlaying ? <Pause size={48} className="text-white" /> : <Play size={48} className="text-white" />}
              </button>
            </div>

            {versions[1].metadata?.prompt && (
              <div className="text-xs text-muted-foreground line-clamp-3">
                {versions[1].metadata.prompt}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};








