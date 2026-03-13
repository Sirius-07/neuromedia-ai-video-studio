import React, { useState, useRef } from 'react';
import { AudioInspector } from './storyboard/AudioInspector';
import { EnhancedAudioTimeline } from './storyboard/EnhancedAudioTimeline';
import { Music, Zap, Mic, Upload, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

// 音频块数据类型
interface AudioBlock {
  id: string;
  type: 'bgm' | 'sfx' | 'voice';
  name: string;
  startTime: number;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  pan?: number;
  prompt?: string;
  style?: string;
  waveform?: number[];
}

// 素材库数据类型
interface AudioAsset {
  id: string;
  name: string;
  category: string;
  duration: number;
  description: string;
  tags: string[];
  previewUrl?: string;
}

// 模拟素材库数据
const MOCK_ASSETS: AudioAsset[] = [
  {
    id: 'bgm-1',
    name: '转场音效',
    category: 'BGM',
    duration: 12,
    description: '适合用于场景过渡的流畅音乐',
    tags: ['转场', '流畅', '现代']
  },
  {
    id: 'bgm-2',
    name: '环绕低音效',
    category: 'BGM',
    duration: 15,
    description: '深沉有力的低音环绕效果',
    tags: ['低音', '环绕', '震撼']
  },
  {
    id: 'sfx-1',
    name: '轻快白噪声',
    category: 'SFX',
    duration: 5,
    description: '清新自然的白噪声音效',
    tags: ['白噪声', '清新', '自然']
  },
  {
    id: 'sfx-2',
    name: '柔和白噪声',
    category: 'SFX',
    duration: 23,
    description: '温和舒适的白噪声背景',
    tags: ['白噪声', '柔和', '舒适']
  },
  {
    id: 'sfx-3',
    name: '轻柔白噪声',
    category: 'SFX',
    duration: 8,
    description: '轻盈柔和的白噪声',
    tags: ['白噪声', '轻柔']
  },
  {
    id: 'sfx-4',
    name: '柔和白噪声2',
    category: 'SFX',
    duration: 22,
    description: '另一种柔和的白噪声效果',
    tags: ['白噪声', '柔和']
  },
  {
    id: 'sfx-5',
    name: '转场白噪声',
    category: 'SFX',
    duration: 12,
    description: '用于场景转换的白噪声',
    tags: ['白噪声', '转场']
  },
  {
    id: 'sfx-6',
    name: '和风白噪声',
    category: 'SFX',
    duration: 23,
    description: '带有日式风格的白噪声',
    tags: ['白噪声', '和风', '日式']
  }
];

// 生成模拟波形数据
const generateMockWaveform = (duration: number): number[] => {
  const points = Math.min(duration * 10, 100);
  return Array.from({ length: points }, () => Math.random() * 0.6 + 0.2);
};

export const AudioCreatorPage: React.FC = () => {
  const [duration] = useState(60); // 视频总时长
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [audioBlocks, setAudioBlocks] = useState<AudioBlock[]>([
    {
      id: 'block-1',
      type: 'bgm',
      name: 'vibrant · orchestral',
      startTime: 0,
      duration: 30,
      volume: 0.8,
      fadeIn: 2,
      fadeOut: 2,
      style: 'orchestral',
      waveform: generateMockWaveform(30)
    },
    {
      id: 'block-2',
      type: 'sfx',
      name: '轻快白噪声',
      startTime: 5,
      duration: 3,
      volume: 0.6,
      pan: -0.5,
      prompt: 'Light whoosh sound effect',
      waveform: generateMockWaveform(3)
    },
    {
      id: 'block-3',
      type: 'sfx',
      name: '转场音效',
      startTime: 15,
      duration: 2,
      volume: 0.7,
      pan: 0.3,
      prompt: 'Transition sound',
      waveform: generateMockWaveform(2)
    }
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<number | null>(null);

  // 播放/暂停
  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } else {
      setIsPlaying(true);
      // 模拟播放进度
      intervalRef.current = window.setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.1;
          if (next >= duration) {
            setIsPlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return next;
        });
      }, 100);
    }
  };

  // 时间变化
  const handleTimeChange = (time: number) => {
    setCurrentTime(time);
  };

  // 音频块选中
  const handleBlockSelect = (id: string) => {
    setSelectedBlockId(id);
  };

  // 音频块移动
  const handleBlockMove = (id: string, newStartTime: number) => {
    setAudioBlocks(blocks =>
      blocks.map(block =>
        block.id === id ? { ...block, startTime: newStartTime } : block
      )
    );
  };

  // 音频块更新
  const handleBlockUpdate = (id: string, updates: Partial<AudioBlock>) => {
    setAudioBlocks(blocks =>
      blocks.map(block =>
        block.id === id ? { ...block, ...updates } : block
      )
    );
  };

  // AI配音生成
  const handleGenerateVoiceover = (actorId: string, speed: number, emotion: string) => {
    console.log('生成AI配音:', { actorId, speed, emotion });
    
    // 模拟添加旁白轨道
    const newVoiceBlock: AudioBlock = {
      id: `voice-${Date.now()}`,
      type: 'voice',
      name: '全片旁白',
      startTime: 0,
      duration: duration,
      volume: 1.0,
      waveform: generateMockWaveform(duration)
    };
    
    setAudioBlocks([...audioBlocks, newVoiceBlock]);
    alert('✅ AI配音已生成并铺设到时间轴！');
  };

  // 导出
  const handleExport = (format: 'mp4' | 'wav') => {
    console.log('导出格式:', format);
    alert(`开始导出为 ${format.toUpperCase()} 格式...`);
  };

  // 拖拽素材到时间轴
  const handleAssetDragStart = (asset: AudioAsset, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('asset', JSON.stringify(asset));
  };

  const handleTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const assetData = e.dataTransfer.getData('asset');
    if (!assetData) return;

    const asset: AudioAsset = JSON.parse(assetData);
    
    // 计算放置的时间点（简化版，实际需要更精确的计算）
    const newBlock: AudioBlock = {
      id: `block-${Date.now()}`,
      type: asset.category.toLowerCase() === 'bgm' ? 'bgm' : 'sfx',
      name: asset.name,
      startTime: currentTime,
      duration: asset.duration,
      volume: 0.8,
      waveform: generateMockWaveform(asset.duration)
    };

    setAudioBlocks([...audioBlocks, newBlock]);
  };

  // 获取选中的音频块
  const selectedBlock = audioBlocks.find(block => block.id === selectedBlockId) || null;

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* 左侧：素材库 */}
      <div className="w-64 border-r border-border flex flex-col bg-muted/10">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
            <Music size={16} className="text-purple-500" />
            背景素材 & 音效
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1">
            拖拽到时间轴使用
          </p>
        </div>

        {/* 素材分类标签 */}
        <div className="p-3 border-b border-border flex gap-2">
          <button className="px-3 py-1 text-[10px] bg-purple-500/10 text-purple-500 rounded-full border border-purple-500/20 font-medium">
            🎵 BGM (6)
          </button>
          <button className="px-3 py-1 text-[10px] bg-muted text-muted-foreground rounded-full border border-border">
            🔊 SFX (6)
          </button>
        </div>

        {/* 素材列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {MOCK_ASSETS.map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => handleAssetDragStart(asset, e)}
              className="p-3 bg-background border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all cursor-move group"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    {asset.category === 'BGM' ? '🎵' : '🔊'}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {asset.name}
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {asset.duration}s
                </span>
              </div>

              <p className="text-[10px] text-muted-foreground mb-2">
                {asset.description}
              </p>

              {/* 模拟波形预览 */}
              <div className="h-6 bg-muted/50 rounded overflow-hidden mb-2 relative">
                <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-muted-foreground/30 rounded-full"
                      style={{
                        height: `${Math.random() * 60 + 20}%`
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-1 flex-wrap">
                {asset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-[9px] bg-muted text-muted-foreground rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* 拖拽提示 */}
              <div className="mt-2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                💡 拖拽到时间轴上使用
              </div>
            </div>
          ))}

          {/* AI生成音效按钮 */}
          <button className="w-full p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg hover:from-purple-500/20 hover:to-blue-500/20 transition-all flex items-center justify-center gap-2 text-xs font-medium text-foreground">
            <Sparkles size={14} className="text-purple-500" />
            AI 生成音效
          </button>
        </div>
      </div>

      {/* 中间：视频预览和时间轴 */}
      <div className="flex-1 flex flex-col">
        {/* 视频预览区 */}
        <div className="h-64 border-b border-border bg-black flex items-center justify-center relative">
          <div className="w-full h-full max-w-4xl mx-auto bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-white/50 text-sm flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <Music size={32} className="text-white/30" />
              </div>
              <span>视频预览区</span>
              <span className="text-xs text-white/30">
                支持字幕实时叠加
              </span>
            </div>
          </div>

          {/* 播放时间显示 */}
          <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/80 rounded text-white text-xs font-mono">
            {currentTime.toFixed(1)}s / {duration}s
          </div>
        </div>

        {/* 时间轴区域 */}
        <div
          className="flex-1"
          onDrop={handleTimelineDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <EnhancedAudioTimeline
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            audioBlocks={audioBlocks}
            selectedBlockId={selectedBlockId}
            onTimeChange={handleTimeChange}
            onPlayPause={handlePlayPause}
            onBlockSelect={handleBlockSelect}
            onBlockMove={handleBlockMove}
          />
        </div>
      </div>

      {/* 右侧：音频检查器面板 */}
      <div className="w-80">
        <AudioInspector
          selectedBlock={selectedBlock}
          onBlockUpdate={handleBlockUpdate}
          onGenerateVoiceover={handleGenerateVoiceover}
          onExport={handleExport}
        />
      </div>
    </div>
  );
};

export default AudioCreatorPage;

