import React, { useMemo, useRef, useState } from 'react';
import { Upload, FileImage, FileVideo, Hash, Sparkles, Tag, ChevronDown, ChevronRight, MessageSquare, LayoutTemplate, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Asset, Scene } from './types';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ScriptSyncButton } from './ScriptSyncButton';
import { convertScriptToPrompt } from '../../api/scriptSyncApi';
import { getProxiedImageUrl } from '../../utils/imageProxy';

interface SidebarProps {
  scenes: Scene[];
  selectedSceneId: number | null;
  onSelectScene: (id: number) => void;
  onAssetDragStart?: (asset: Asset) => void;
  assets?: Asset[];
  onUploadAsset?: (files: FileList | null) => void;
  onUpdateScene?: (id: number, updates: Partial<Scene>) => void;
  onDeleteScene?: (id: number) => void;
  expandedSceneIds?: number[];
  onToggleExpansion?: (id: number) => void;
  hoveredSceneId?: number | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  scenes, 
  selectedSceneId, 
  onSelectScene, 
  onAssetDragStart,
  assets = [],
  onUploadAsset,
  onUpdateScene,
  onDeleteScene,
  expandedSceneIds = [],
  onToggleExpansion,
  hoveredSceneId
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  // Mock AI Recommendation Logic
  const recommendedAssetIds = useMemo(() => {
    if (!selectedScene || selectedScene.type !== 'real') return [];
    
    // Simple keyword matching based on script
    const script = selectedScene.script || '';
    const keywords = ['会议', '采访', '风景', '科技', '主持人'];
    
    const matchedKeywords = keywords.filter(k => script.includes(k));
    
    if (matchedKeywords.length === 0) return [];

    return assets
      .filter(asset => asset.tags?.some(tag => matchedKeywords.some(k => tag.includes(k) || k.includes(tag))))
      .map(a => a.id);
  }, [selectedScene, assets]);

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
    if (onAssetDragStart) onAssetDragStart(asset);
  };
  
  // 处理点击上传
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onUploadAsset) {
      onUploadAsset(e.target.files);
    }
    // 清空 input，允许重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 处理拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onUploadAsset && e.dataTransfer.files) {
      onUploadAsset(e.dataTransfer.files);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Function to toggle expansion manually
  const toggleExpansion = (id: number) => {
    if (onToggleExpansion) {
      onToggleExpansion(id);
    }
  };

  // Effect to sync selection with scroll but NOT expansion (user request)
  // Or maybe initial expansion? The prompt says "Click arrow to expand, click others to jump".
  // So we don't auto-expand on select anymore.
  
  return (
    <div className="flex flex-col h-full w-full bg-background p-4">
      {/* Project Assets Section - 暂时隐藏 */}
      {assets.length > 0 && onUploadAsset && (
        <div className="p-4 border-b border-border flex-1 flex flex-col min-h-0">
          {/* ... Assets UI code (omitted for brevity if unchanged, but keeping context) ... */}
          {/* Note: In real implementation I should keep the assets section if needed, 
              but the user focus is on script outline. I'll keep the assets logic but ensure the layout structure matches user request. 
              The user asked for a rounded rectangle with gray background for the script outline.
          */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">项目素材</h2>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{assets.length}</span>
          </div>
          
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          
          {/* Dropzone */}
          <div 
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-accent/50 transition-colors cursor-pointer mb-4 group"
            onClick={handleUploadClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="p-2 rounded-full bg-muted group-hover:bg-muted/80 mb-2 transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">拖拽上传素材</p>
          </div>

          {/* Asset Grid */}
          <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 pb-4">
            {assets.map((asset) => {
              const isRecommended = recommendedAssetIds.includes(asset.id);
              const isDimmed = recommendedAssetIds.length > 0 && !isRecommended;

              return (
                <div 
                  key={asset.id} 
                  className={clsx(
                    "aspect-square bg-muted rounded-lg relative group overflow-visible cursor-grab active:cursor-grabbing transition-all duration-300",
                    isRecommended ? "ring-2 ring-green-500 shadow-lg shadow-green-500/20 z-10 scale-[1.02]" : "",
                    isDimmed ? "opacity-40 grayscale-[0.5] scale-95" : "hover:scale-[1.02]"
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, asset)}
                >
                  <div className="relative w-full h-full overflow-hidden rounded-lg">
                    <img 
                      src={asset.thumbnail}
                      alt={`Asset ${asset.id}`} 
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Type Icon */}
                    <div className="absolute top-1.5 right-1.5 bg-black/60 p-1 rounded-md text-white backdrop-blur-sm">
                      {asset.type === 'video' ? <FileVideo size={12} /> : <FileImage size={12} />}
                    </div>

                    {/* Tags (Hover) */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                       <div className="flex flex-wrap gap-1">
                         {asset.tags?.map(tag => (
                           <span key={tag} className="text-[8px] bg-white/20 text-white px-1 py-0.5 rounded flex items-center gap-0.5">
                             <Tag size={8} /> {tag}
                           </span>
                         ))}
                       </div>
                    </div>
                  </div>

                  {/* Recommended Badge */}
                  {isRecommended && (
                    <div className="absolute -top-2 -left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                      <Sparkles size={10} />
                      推荐
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Script Outline Section - New Design */}
      <div className={clsx(
        "flex flex-col flex-1 min-h-0",
        assets.length > 0 && onUploadAsset ? "mt-4" : ""
      )}>
        <div className="flex-1 bg-muted/30 border border-border rounded-xl flex flex-col overflow-hidden">
            <div className="p-3 pb-2 border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <LayoutTemplate size={14} className="text-muted-foreground" />
                      脚本大纲
                  </h2>
                  
                  {/* Script Sync Button */}
                  {selectedScene && (
                    <ScriptSyncButton
                      scriptText={selectedScene.script}
                      currentPrompt={selectedScene.visualPrompt}
                      lockedTags={selectedScene.scriptSync?.lockedTags || []}
                      onSync={(newPrompt) => {
                        if (onUpdateScene && selectedSceneId) {
                          onUpdateScene(selectedSceneId, { 
                            visualPrompt: newPrompt,
                            scriptSync: {
                              ...selectedScene.scriptSync,
                              lastSyncedScript: selectedScene.script
                            }
                          });
                        }
                      }}
                      onSyncWithLLM={async (scriptText, lockedTags) => {
                        const response = await convertScriptToPrompt({
                          scriptText,
                          lockedTags,
                          sceneType: selectedScene.type
                        });
                        return response.data?.visualPrompt || '';
                      }}
                      className="scale-75 origin-right"
                    />
                  )}
                </div>
            </div>
            
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
                 {scenes.map((scene) => {
                    const isSelected = selectedSceneId === scene.id;
                    const isExpanded = expandedSceneIds.includes(scene.id);
                    const isHovered = hoveredSceneId === scene.id;
                    
                    // 计算实际时长
                    // 对于实拍视频，使用裁剪区域计算；对于AI视频，使用 duration 字段
                    const getActualDuration = () => {
                      if (scene.type === 'real' && scene.clipStartTime !== undefined && scene.clipEndTime !== undefined) {
                        // 实拍视频：根据裁剪区域计算
                        const duration = scene.clipEndTime - scene.clipStartTime;
                        return `${duration.toFixed(1)}秒`;
                      }
                      // AI视频或没有裁剪信息的视频：使用 duration 字段
                      const duration = typeof scene.duration === 'number' ? scene.duration : parseInt(String(scene.duration) || '0');
                      return `${duration}秒`;
                    };
                    
                    // 获取缩略图URL
                    // 逻辑：
                    // 1. AI分镜 (type === 'ai'): 
                    //    - 如果已生成完成，优先显示 videoUrl，然后是选中的版本缩略图
                    //    - 如果未生成，不显示任何内容（不显示 assetUrl，那只是参考图）
                    // 2. 实拍分镜 (type === 'real'):
                    //    - 显示 assetUrl（实拍素材）
                    let thumbnailUrl = null;
                    
                    if (scene.type === 'ai') {
                      // AI分镜：只在生成完成后显示内容
                      if (scene.generationStatus === 'completed') {
                        thumbnailUrl = scene.videoUrl || 
                          (scene.versions && scene.versions.find(v => v.isSelected)?.thumbnailUrl);
                      }
                      // 如果还在生成中或未生成，不显示任何缩略图
                    } else if (scene.type === 'real') {
                      // 实拍分镜：显示素材
                      thumbnailUrl = scene.assetUrl;
                    }
                    
                    // 禁用localStorage读取，改为仅使用数据库
                    
                    // 确保使用代理URL（图片和视频都需要代理）
                    if (thumbnailUrl) {
                      // 检查是否是视频URL
                      const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(thumbnailUrl);
                      if (isVideo) {
                        // 视频URL使用视频代理
                        thumbnailUrl = `http://localhost:4300/api/v1/proxy/video?url=${encodeURIComponent(thumbnailUrl)}`;
                      } else {
                        // 图片URL使用图片代理
                      thumbnailUrl = getProxiedImageUrl(thumbnailUrl);
                      }
                    }
                    
                    console.log(`[Sidebar] 场景${scene.id} (${scene.type}) 缩略图:`, {
                      generationStatus: scene.generationStatus,
                      thumbnailUrl: thumbnailUrl || '无',
                      videoUrl: scene.videoUrl || '无',
                      assetUrl: scene.assetUrl || '无'
                    });
                    
                    return (
                      <div 
                        key={scene.id} 
                        className={clsx(
                          "flex flex-col rounded-lg transition-all duration-200 border group/scene",
                          isSelected 
                            ? "bg-card border-primary/50 shadow-md ring-1 ring-primary/20" 
                            : "bg-card/50 border-transparent",
                          isHovered && !isSelected && "border-purple-400/80 shadow-lg -translate-y-1 bg-card ring-2 ring-purple-400/30 z-10",
                          isHovered && isSelected && "-translate-y-1 shadow-lg ring-2 ring-purple-400/40 z-10 border-purple-400"
                        )}
                      >
                        {/* Scene Header Item */}
                        <div 
                          onClick={() => onSelectScene(scene.id)}
                          className="flex items-center gap-2 p-2.5 cursor-pointer"
                        >
                          {/* 缩略图（新增） */}
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border">
                            {thumbnailUrl ? (
                              <>
                                {/* 如果是视频URL，用video标签提取首帧 */}
                                {thumbnailUrl.match(/\.(mp4|mov|avi|webm|mkv)(\?|$)/i) || thumbnailUrl.includes('/proxy/video') ? (
                                  <video
                                    src={thumbnailUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                    onError={(e) => {
                                      console.error(`[Sidebar] 场景${scene.id} 视频缩略图加载失败:`, thumbnailUrl);
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={thumbnailUrl}
                                    alt={`Scene ${scene.id}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      console.error(`[Sidebar] 场景${scene.id} 图片缩略图加载失败:`, thumbnailUrl);
                                      // 显示占位符
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon size={16} className="text-muted-foreground/50" />
                              </div>
                            )}
                            
                            {/* 场景编号标识（叠加在缩略图上） */}
                            <div className={clsx(
                              "absolute bottom-0.5 right-0.5 w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shadow-sm",
                              scene.type === 'ai' && "bg-purple-500 text-white",
                              scene.type === 'real' && "bg-blue-500 text-white",
                              scene.type === 'empty' && "bg-muted text-muted-foreground"
                            )}>
                              {scenes.indexOf(scene) + 1}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={clsx("font-medium text-xs", isSelected ? "text-foreground" : "text-muted-foreground")}>
                                分镜 {scene.id}
                              </span>
                              <span className="text-[10px] text-muted-foreground opacity-70 bg-muted/50 px-1.5 py-0.5 rounded">
                                {getActualDuration()}
                              </span>
                            </div>
                          </div>
                          
                          {/* 删除按钮 */}
                          {onDeleteScene && (
                            <button
                              className="p-1 opacity-0 group-hover/scene:opacity-100 hover:bg-red-500/10 hover:text-red-500 text-muted-foreground rounded transition-all shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteScene(scene.id);
                              }}
                              title="删除分镜"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          
                          <div 
                            className="p-1 cursor-pointer hover:bg-muted rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpansion(scene.id);
                            }}
                          >
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                               <ChevronDown size={14} className={clsx(isExpanded ? "text-primary" : "text-muted-foreground/50")} />
                            </motion.div>
                          </div>
                        </div>

                        {/* Dropdown Content (Narration/Subtitle) */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 pt-0">
                                <div className="pl-8">
                                   {/* Subtitle/Narration Input */}
                                   <div className="space-y-2">
                                     <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                        <MessageSquare size={10} />
                                        字幕 / 旁白
                                     </div>
                                     <textarea
                                        value={scene.narration || ''}
                                        onChange={(e) => onUpdateScene?.(scene.id, { narration: e.target.value })}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full p-2.5 text-xs bg-muted/50 border border-border/50 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[220px] leading-relaxed"
                                        placeholder="输入旁白内容..."
                                     />
                                   </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
    </div>
  );
};
