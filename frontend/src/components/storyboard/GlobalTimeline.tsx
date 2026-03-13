import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { Scene } from './types';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GlobalTimelineProps {
  scenes: Scene[];
  selectedSceneId: number | null;
  onSelectScene: (id: number) => void;
  onSceneUpdate?: (id: number, updates: Partial<Scene>) => void;
}

export const GlobalTimeline: React.FC<GlobalTimelineProps> = ({
  scenes,
  selectedSceneId,
  onSelectScene,
  onSceneUpdate
}) => {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  
  // Timeline state
  const [zoom, setZoom] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  
  // 获取场景的实际时长（秒）
  const getSceneDuration = (scene: Scene): number => {
    // 实拍视频：使用裁剪区域计算
    if (scene.type === 'real' && scene.clipStartTime !== undefined && scene.clipEndTime !== undefined) {
      return scene.clipEndTime - scene.clipStartTime;
    }
    // AI视频或没有裁剪信息：使用 duration 字段
    const duration = typeof scene.duration === 'number' ? scene.duration : parseInt(String(scene.duration) || '0');
    return duration || 3; // 默认3秒
  };
  
  // Calculate total duration
  const totalDuration = scenes.reduce((acc, scene) => {
    return acc + getSceneDuration(scene);
  }, 0);

  // Convert scene durations to timeline positions
  const scenePositions = scenes.map((scene, index) => {
    const previousDuration = scenes.slice(0, index).reduce((acc, s) => {
      return acc + getSceneDuration(s);
    }, 0);
    const duration = getSceneDuration(scene);
    
    return {
      id: scene.id,
      start: previousDuration,
      duration: duration,
      end: previousDuration + duration,
      scene
    };
  });

  // Playback control
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= totalDuration) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // Auto-scroll to follow playhead
  useEffect(() => {
    if (timelineRef.current && isPlaying) {
      const pixelsPerSecond = 100 * zoom;
      const playheadPosition = currentTime * pixelsPerSecond;
      const containerWidth = timelineRef.current.clientWidth;
      const scrollLeft = timelineRef.current.scrollLeft;
      
      if (playheadPosition > scrollLeft + containerWidth - 100) {
        timelineRef.current.scrollLeft = playheadPosition - containerWidth + 100;
      } else if (playheadPosition < scrollLeft + 100) {
        timelineRef.current.scrollLeft = playheadPosition - 100;
      }
    }
  }, [currentTime, isPlaying, zoom]);

  // Auto-scroll to selected scene
  useEffect(() => {
    if (!selectedSceneId || !timelineRef.current || isPlaying) return;
    
    // 找到选中场景在场景列表中的索引
    const sceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
    if (sceneIndex === -1) return;
    
    // 计算选中场景的开始位置
    const startTime = scenes.slice(0, sceneIndex).reduce((acc, s) => {
      return acc + getSceneDuration(s);
    }, 0);
    
    const duration = getSceneDuration(scenes[sceneIndex]);
    
    const pixelsPerSecond = 100 * zoom;
    const sceneCenterPosition = (startTime + duration / 2) * pixelsPerSecond;
    const containerWidth = timelineRef.current.clientWidth;
    
    // 滚动到场景中心位置
    const targetScrollLeft = sceneCenterPosition - containerWidth / 2;
    
    // 平滑滚动
    timelineRef.current.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth'
    });
  }, [selectedSceneId, scenes, zoom, isPlaying]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSkipForward = () => {
    setCurrentTime(Math.min(currentTime + 5, totalDuration));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 100 * zoom;
    const newTime = Math.max(0, Math.min((x / pixelsPerSecond), totalDuration));
    
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div className="w-full bg-card border-t border-border flex flex-col">
      {/* Transport Controls - 更紧凑 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50">
        {/* Left: Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRestart}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="重新开始"
          >
            <SkipBack size={14} className="text-muted-foreground hover:text-foreground" />
          </button>
          <button
            onClick={handlePlayPause}
            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause size={14} className="text-primary" />
            ) : (
              <Play size={14} className="text-primary ml-0.5" />
            )}
          </button>
          <button
            onClick={handleSkipForward}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="快进5秒"
          >
            <SkipForward size={14} className="text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Center: Time Display */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-foreground tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Right: Volume & Zoom */}
        <div className="flex items-center gap-2">
          {/* Volume Control */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title={isMuted ? '取消静音' : '静音'}
            >
              {isMuted ? (
                <VolumeX size={14} className="text-muted-foreground hover:text-foreground" />
              ) : (
                <Volume2 size={14} className="text-muted-foreground hover:text-foreground" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setVolume(newVolume);
                setIsMuted(newVolume === 0);
              }}
              className="w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${(isMuted ? 0 : volume) * 100}%, hsl(var(--muted)) ${(isMuted ? 0 : volume) * 100}%)`
              }}
            />
          </div>

          {/* Zoom Control */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              disabled={zoom <= 0.5}
              className="px-2 py-1 text-xs rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -
            </button>
            <span className="text-xs text-muted-foreground w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              disabled={zoom >= 2}
              className="px-2 py-1 text-xs rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Area - 横向滚动 + 缩小UI */}
      <div 
        ref={timelineRef}
        className="flex-1 overflow-x-auto overflow-y-hidden bg-muted/20 relative"
        style={{ 
          height: '120px', // 减小高度
          minHeight: '120px'
        }}
      >
        <div 
          ref={trackRef}
          className="relative h-full"
          style={{ 
            width: `${Math.max(totalDuration * 100 * zoom, 100)}px`,
            minWidth: '100%'
          }}
          onClick={handleSeek}
        >
          {/* Time Markers - 缩小 */}
          <div className="absolute top-0 left-0 right-0 h-6 border-b border-border/30 bg-card/30 flex items-end">
            {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, i) => {
              const position = i * 100 * zoom;
              return (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${position}px`, transform: 'translateX(-50%)' }}
                >
                  <div className="h-2 w-px bg-border/50" />
                  <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                    {i}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* Video Track - 缩小 */}
          <div className="absolute top-6 left-0 right-0" style={{ height: '50px' }}>
            <div className="absolute inset-0 flex">
              {scenePositions.map((pos, index) => {
                const width = pos.duration * 100 * zoom;
                const left = pos.start * 100 * zoom;
                const isSelected = pos.id === selectedSceneId;
                
                return (
                  <React.Fragment key={pos.id}>
                    {/* Scene Block - 缩小 */}
                    <motion.div
                      layout
                      className={clsx(
                        'absolute top-1 rounded overflow-hidden cursor-pointer group transition-all',
                        isSelected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background shadow-lg'
                          : 'hover:ring-2 hover:ring-primary/50 hover:ring-offset-1 hover:ring-offset-background'
                      )}
                      style={{ 
                        left: `${left}px`, 
                        width: `${width}px`,
                        height: '42px' // 减小高度
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectScene(pos.id);
                      }}
                    >
                      {/* Background - Thumbnail or Color */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5">
                        {(() => {
                          // 获取缩略图URL（优先级：videoUrl > assetUrl > localStorage）
                          let thumbnailUrl = pos.scene.videoUrl || pos.scene.assetUrl;
                          
                          // 禁用localStorage读取，改为仅使用数据库
                          // 如果没有缩略图，尝试从localStorage获取
                          // if (!thumbnailUrl && pos.scene.type === 'ai') {
                          //   try {
                          //     const storageKey = `scene-${pos.scene.id}-generated`;
                          //     const stored = localStorage.getItem(storageKey);
                          //     if (stored) {
                          //       const data = JSON.parse(stored);
                          //       thumbnailUrl = data.assetUrl || (data.generatedImages && data.generatedImages[0]) || data.generatedVideoUrl;
                          //     }
                          //   } catch (e) {
                          //     console.error('读取localStorage失败:', e);
                          //   }
                          // }
                          
                          // 应用代理URL
                          if (thumbnailUrl) {
                            const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(thumbnailUrl);
                            if (isVideo) {
                              thumbnailUrl = `http://localhost:3000/api/v1/proxy/video?url=${encodeURIComponent(thumbnailUrl)}`;
                            } else {
                              // 使用图片代理（如果不是已经代理过的URL）
                              if (!thumbnailUrl.startsWith('data:') && 
                                  !thumbnailUrl.startsWith('blob:') && 
                                  !thumbnailUrl.includes('/api/v1/proxy/')) {
                                thumbnailUrl = `http://localhost:3000/api/v1/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
                              }
                            }
                          }
                          
                          console.log(`[Timeline] 场景${pos.id} 最终缩略图URL:`, thumbnailUrl);
                          
                          if (!thumbnailUrl) return null;
                          
                          // 判断是视频还是图片
                          const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(thumbnailUrl) || 
                                         thumbnailUrl.includes('/proxy/video');
                          
                          return isVideo ? (
                            <video
                              src={thumbnailUrl}
                              className="w-full h-full object-cover opacity-60"
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={(e) => {
                                // 显示第一帧
                                e.currentTarget.currentTime = 0.1;
                              }}
                              onError={(e) => {
                                console.error(`[Timeline] 场景${pos.id} 视频缩略图加载失败:`, thumbnailUrl);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <img
                              src={thumbnailUrl}
                              alt={`Scene ${pos.id}`}
                              className="w-full h-full object-cover opacity-60"
                              onError={(e) => {
                                console.error(`[Timeline] 场景${pos.id} 图片缩略图加载失败:`, thumbnailUrl);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          );
                        })()}
                      </div>

                      {/* Overlay Info - 缩小 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-white">
                            场景 {pos.id}
                          </span>
                          <span className="text-[9px] font-mono text-white/80">
                            {pos.duration.toFixed(1)}秒
                          </span>
                        </div>
                      </div>

                      {/* Scene Type Badge - 缩小 */}
                      <div className={clsx(
                        "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold",
                        pos.scene.type === 'ai' && "bg-purple-500 text-white",
                        pos.scene.type === 'real' && "bg-blue-500 text-white"
                      )}>
                        {pos.scene.type === 'ai' ? 'AI' : '实拍'}
                      </div>

                      {/* Resize Handles - 缩小 */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 hover:bg-primary cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // TODO: Implement resize
                        }}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 bg-primary/0 hover:bg-primary cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // TODO: Implement resize
                        }}
                      />
                    </motion.div>

                    {/* Transition Indicator - 缩小 */}
                    {index < scenePositions.length - 1 && pos.scene.transitionType !== 'none' && (
                      <div
                        className="absolute top-1 pointer-events-none"
                        style={{
                          left: `${left + width - 6}px`,
                          width: '12px',
                          height: '42px',
                          zIndex: 10
                        }}
                      >
                        <div className="w-full h-full bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent flex items-center justify-center">
                          <div className="w-px h-full bg-yellow-500/80" />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Playhead - 缩小 */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
            style={{ left: `${currentTime * 100 * zoom}px` }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full shadow-lg" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-red-500 shadow-sm" />
          </div>
        </div>
      </div>

      {/* Status Bar - 缩小 */}
      <div className="px-3 py-1.5 border-t border-border bg-card/30 flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{scenes.length} 个场景</span>
          <span className="w-px h-3 bg-border" />
          <span>总时长: {formatTime(totalDuration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="hover:text-foreground transition-colors flex items-center gap-1">
            <Maximize2 size={10} />
            全屏
          </button>
        </div>
      </div>
    </div>
  );
};
