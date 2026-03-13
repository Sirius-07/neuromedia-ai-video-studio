import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { clsx } from 'clsx';

interface AudioBlock {
  id: string;
  type: 'bgm' | 'sfx' | 'voice';
  name: string;
  startTime: number;
  duration: number;
  volume: number;
  waveform?: number[]; // 波形数据
}

interface EnhancedAudioTimelineProps {
  duration: number; // 总时长（秒）
  currentTime: number;
  isPlaying: boolean;
  audioBlocks: AudioBlock[];
  selectedBlockId?: string | null;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onBlockSelect: (id: string) => void;
  onBlockMove: (id: string, newStartTime: number) => void;
}

const TRACK_CONFIG = [
  { id: 'video', label: 'Video', icon: '📺', color: 'bg-slate-500' },
  { id: 'voice', label: 'Voice', icon: '🗣️', color: 'bg-blue-500' },
  { id: 'bgm', label: 'BGM', icon: '🎵', color: 'bg-purple-500' },
  { id: 'sfx', label: 'SFX', icon: '🔊', color: 'bg-yellow-500' },
];

export const EnhancedAudioTimeline: React.FC<EnhancedAudioTimelineProps> = ({
  duration,
  currentTime,
  isPlaying,
  audioBlocks,
  selectedBlockId,
  onTimeChange,
  onPlayPause,
  onBlockSelect,
  onBlockMove
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100); // 缩放百分比
  const [isDragging, setIsDragging] = useState(false);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // 计算像素宽度
  const pixelPerSecond = (zoom / 100) * 50; // 基准：50px/秒
  const timelineWidth = duration * pixelPerSecond;

  // 时间转换为像素位置
  const timeToPixel = (time: number) => time * pixelPerSecond;

  // 像素位置转换为时间
  const pixelToTime = (pixel: number) => pixel / pixelPerSecond;

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  // 点击时间轴跳转
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || draggingBlockId) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = pixelToTime(x);
    onTimeChange(Math.max(0, Math.min(newTime, duration)));
  };

  // 开始拖拽音频块
  const handleBlockMouseDown = (block: AudioBlock, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingBlockId(block.id);
    setDragStartX(e.clientX);
    setDragStartTime(block.startTime);
    onBlockSelect(block.id);
  };

  // 拖拽过程中
  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingBlockId || !timelineRef.current) return;

    const deltaX = e.clientX - dragStartX;
    const deltaTime = pixelToTime(deltaX);
    const newTime = Math.max(0, Math.min(dragStartTime + deltaTime, duration - 1));

    // 实时更新位置（这里应该触发父组件的临时更新）
    onBlockMove(draggingBlockId, newTime);
  };

  // 拖拽结束
  const handleMouseUp = () => {
    setDraggingBlockId(null);
  };

  // 监听全局鼠标事件
  useEffect(() => {
    if (draggingBlockId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingBlockId, dragStartX, dragStartTime]);

  // 渲染波形图
  const renderWaveform = (block: AudioBlock, width: number, height: number) => {
    if (!block.waveform || block.waveform.length === 0) {
      // 如果没有波形数据，生成模拟波形
      const points = 50;
      const mockWaveform = Array.from({ length: points }, () => Math.random());
      return renderWaveformSvg(mockWaveform, width, height);
    }

    return renderWaveformSvg(block.waveform, width, height);
  };

  const renderWaveformSvg = (waveform: number[], width: number, height: number) => {
    const barWidth = width / waveform.length;
    const centerY = height / 2;

    return (
      <svg
        width={width}
        height={height}
        className="absolute top-0 left-0 opacity-70"
      >
        {waveform.map((value, index) => {
          const barHeight = value * height * 0.8;
          const x = index * barWidth;
          const y = centerY - barHeight / 2;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={Math.max(barWidth - 0.5, 0.5)}
              height={barHeight}
              fill="currentColor"
              className="text-white/60"
            />
          );
        })}
      </svg>
    );
  };

  // 按轨道类型分组音频块
  const getBlocksByTrack = (trackId: string) => {
    if (trackId === 'video') return [];
    return audioBlocks.filter(block => block.type === trackId);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 控制栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        {/* 左侧：播放控制 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onPlayPause}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause size={20} className="text-foreground" />
            ) : (
              <Play size={20} className="text-foreground" />
            )}
          </button>

          <div className="text-xs font-mono text-foreground tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* 右侧：音量和缩放 */}
        <div className="flex items-center gap-4">
          {/* 音量控制 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title={isMuted ? '取消静音' : '静音'}
            >
              {isMuted ? (
                <VolumeX size={16} className="text-muted-foreground" />
              ) : (
                <Volume2 size={16} className="text-muted-foreground" />
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
              className="w-20 h-1 bg-muted rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${(isMuted ? 0 : volume) * 100}%, hsl(var(--muted)) ${(isMuted ? 0 : volume) * 100}%)`
              }}
            />
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="缩小"
            >
              <ZoomOut size={16} className="text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="放大"
            >
              <ZoomIn size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* 时间轴区域 */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={containerRef}>
        <div className="flex h-full">
          {/* 左侧：轨道头 */}
          <div className="flex-shrink-0 w-24 border-r border-border bg-muted/10">
            {TRACK_CONFIG.map((track, index) => (
              <div
                key={track.id}
                className={clsx(
                  'h-16 flex items-center justify-center border-b border-border',
                  index === 0 && 'bg-muted/20'
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">{track.icon}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {track.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 右侧：时间轴内容 */}
          <div className="flex-1 relative">
            <div
              ref={timelineRef}
              className="relative h-full cursor-crosshair"
              style={{ width: `${timelineWidth}px` }}
              onClick={handleTimelineClick}
            >
              {/* 时间刻度线 */}
              <div className="absolute top-0 left-0 w-full h-6 border-b border-border bg-muted/10 flex">
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute border-l border-border/50"
                    style={{ left: `${timeToPixel(i)}px` }}
                  >
                    <span className="absolute top-1 left-1 text-[9px] text-muted-foreground">
                      {i}s
                    </span>
                  </div>
                ))}
              </div>

              {/* 各个轨道 */}
              <div className="absolute top-6 left-0 w-full">
                {TRACK_CONFIG.map((track, trackIndex) => (
                  <div
                    key={track.id}
                    className="relative h-16 border-b border-border bg-background/50"
                  >
                    {/* 视频轨道（只显示背景色） */}
                    {track.id === 'video' && (
                      <div
                        className="absolute h-full bg-slate-500/20"
                        style={{
                          left: 0,
                          width: `${timeToPixel(duration)}px`
                        }}
                      >
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          视频主轨道
                        </div>
                      </div>
                    )}

                    {/* 音频块 */}
                    {getBlocksByTrack(track.id).map((block) => {
                      const isSelected = selectedBlockId === block.id;
                      const isDraggingThis = draggingBlockId === block.id;
                      const left = timeToPixel(block.startTime);
                      const width = timeToPixel(block.duration);

                      return (
                        <div
                          key={block.id}
                          className={clsx(
                            'absolute top-1 h-14 rounded-md cursor-move transition-all overflow-hidden',
                            track.color,
                            isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-background',
                            isDraggingThis && 'opacity-60 shadow-2xl scale-105',
                            !isSelected && 'opacity-70 hover:opacity-90'
                          )}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`
                          }}
                          onMouseDown={(e) => handleBlockMouseDown(block, e)}
                        >
                          {/* 波形图背景 */}
                          <div className="relative w-full h-full">
                            {renderWaveform(block, width, 56)}

                            {/* 文字信息 */}
                            <div className="absolute inset-0 p-2 flex flex-col justify-between text-white">
                              <div className="text-[10px] font-semibold truncate">
                                {block.name}
                              </div>
                              <div className="text-[9px] opacity-80">
                                {block.duration.toFixed(1)}s
                              </div>
                            </div>
                          </div>

                          {/* 拖拽提示 */}
                          {isSelected && (
                            <div className="absolute top-0 right-0 p-1">
                              <div className="text-[8px] bg-black/50 rounded px-1 text-white">
                                拖动
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* 播放指针 */}
              <div
                className="absolute top-0 w-0.5 bg-primary z-10 pointer-events-none"
                style={{
                  left: `${timeToPixel(currentTime)}px`,
                  height: `${6 + TRACK_CONFIG.length * 64}px`
                }}
              >
                {/* 顶部三角形 */}
                <div
                  className="absolute -top-1 -left-2 w-0 h-0"
                  style={{
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '6px solid hsl(var(--primary))'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 拖拽提示 */}
      {draggingBlockId && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-primary text-primary-foreground text-xs rounded-lg shadow-lg z-20">
          💡 拖动调整音频块位置
        </div>
      )}
    </div>
  );
};

export default EnhancedAudioTimeline;

