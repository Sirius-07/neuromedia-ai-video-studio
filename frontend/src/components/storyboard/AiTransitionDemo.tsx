/**
 * AI 转场组件演示页面
 * 用于测试和展示 AiTransitionCard 组件
 */

import React, { useState } from 'react';
import { AiTransitionCard } from './AiTransitionCard';

export const AiTransitionDemo: React.FC = () => {
  const [transitionVideoUrl, setTransitionVideoUrl] = useState<string | undefined>();
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [duration, setDuration] = useState(1);

  // 模拟场景数据
  const mockSceneA = {
    lastFrame: 'https://picsum.photos/400/225?random=1',
    script: '最新AI大模型发布，训练效率提升300%，支持多模态实时交互！'
  };

  const mockSceneB = {
    firstFrame: 'https://picsum.photos/400/225?random=2',
    script: '魔羯们注射器射力强动，冲破效率提升力在抗战中！'
  };

  const handleGenerate = async (prompt: string, duration: number) => {
    console.log('生成 AI 转场:', { prompt, duration });
    setStatus('generating');
    setDuration(duration);

    // 模拟 API 调用
    setTimeout(() => {
      // 这里应该调用实际的 API
      setTransitionVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
      setStatus('completed');
    }, 3000);
  };

  const handleDelete = () => {
    setTransitionVideoUrl(undefined);
    setStatus('idle');
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">AI 转场组件演示</h1>
          <p className="text-sm text-muted-foreground">
            展示如何在两个场景之间使用 AI 生成平滑过渡视频
          </p>
        </div>

        {/* 模拟场景 A */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">场景 1</span>
            <span className="text-sm font-medium">场景 A</span>
          </div>
          <img 
            src={mockSceneA.lastFrame} 
            alt="Scene A" 
            className="w-full rounded-md mb-2"
          />
          <p className="text-xs text-muted-foreground">{mockSceneA.script}</p>
        </div>

        {/* AI 转场卡片 */}
        <AiTransitionCard
          prevSceneLastFrame={mockSceneA.lastFrame}
          nextSceneFirstFrame={mockSceneB.firstFrame}
          prevSceneScript={mockSceneA.script}
          nextSceneScript={mockSceneB.script}
          transitionVideoUrl={transitionVideoUrl}
          duration={duration}
          status={status}
          onDelete={handleDelete}
          onGenerate={handleGenerate}
        />

        {/* 模拟场景 B */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">场景 2</span>
            <span className="text-sm font-medium">场景 B</span>
          </div>
          <img 
            src={mockSceneB.firstFrame} 
            alt="Scene B" 
            className="w-full rounded-md mb-2"
          />
          <p className="text-xs text-muted-foreground">{mockSceneB.script}</p>
        </div>

        {/* 使用说明 */}
        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold">使用说明</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>点击"添加 AI 转场"按钮展开编辑器</li>
            <li>调整提示词描述过渡效果</li>
            <li>拖动滑块设置转场时长（0.5-2.0秒）</li>
            <li>点击"生成 AI 转场"开始生成</li>
            <li>生成后可悬停预览完整序列</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AiTransitionDemo;





