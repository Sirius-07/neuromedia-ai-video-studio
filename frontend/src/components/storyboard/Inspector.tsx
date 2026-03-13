import React, { useState, useEffect } from 'react';
import { 
  Settings2, Image as ImageIcon, Sparkles, Type, Palette, 
  Ratio, Aperture, Video, Gauge, Crop, Zap, Move, Wand2, Loader2, Eye
} from 'lucide-react';
// import { motion } from 'framer-motion'; // 暂时不需要
import { Scene } from './types';
import { clsx } from 'clsx';
import { SmartGenerationConsole, GenerationConfig } from './SmartGenerationConsole';
import { IntentDrivenConsole } from './IntentDrivenConsole';
import { 
  structuredPromptToText, 
  cameraControlToPrompt, 
  parseScriptToStructuredPrompt,
  getDefaultGenerationConfig 
} from './promptUtils';
import { optimizeVideoWithAI } from '../../api/videoOptimizationApi';
import { VideoPromptTags } from '../../api/tagRefinementApi';

interface InspectorProps {
  scene?: Scene;
  onUpdate?: (updates: Partial<Scene>) => void;
  onCompareToggle?: (enabled: boolean) => void;
}

export const Inspector: React.FC<InspectorProps> = ({ scene, onUpdate, onCompareToggle }) => {
  // Tab state needs to reset or adapt when scene type changes
  const [activeTab, setActiveTab] = useState<string>('first'); // 'first' | 'second' to be generic
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig | null>(null);
  
  // AI优化状态
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  
  // 前后对比模式
  const [isCompareMode, setIsCompareMode] = useState(false);

  // 初始化智能生成配置
  useEffect(() => {
    if (scene && scene.type === 'ai') {
      if (!generationConfig) {
        // 首次加载：从 scene 恢复配置或创建默认配置
        const config: GenerationConfig = {
          structuredPrompt: scene.smartGeneration?.structuredPrompt || 
            (scene.visualPrompt ? parseScriptToStructuredPrompt(scene.visualPrompt) : getDefaultGenerationConfig().structuredPrompt),
          cameraControl: scene.smartGeneration?.cameraControl || getDefaultGenerationConfig().cameraControl,
          referenceControl: scene.smartGeneration?.referenceControl || getDefaultGenerationConfig().referenceControl,
          duration: parseInt(scene.duration) || 4,
          matchNarrationDuration: scene.smartGeneration?.matchNarrationDuration || false,
          estimatedNarrationDuration: undefined
        };
        setGenerationConfig(config);
      }
    }
  }, [scene?.id]);

  // 处理智能控制台配置变化
  const handleGenerationConfigChange = (config: GenerationConfig) => {
    setGenerationConfig(config);
    
    // 同步更新到 scene
    if (onUpdate) {
      // 将结构化提示词转换为文本
      const visualPrompt = structuredPromptToText(config.structuredPrompt);
      const cameraPrompt = cameraControlToPrompt(config.cameraControl);
      const motionPrompt = cameraPrompt || scene?.motionPrompt || '';
      
      onUpdate({
        visualPrompt,
        motionPrompt,
        duration: `${config.duration}s`,
        smartGeneration: {
          structuredPrompt: config.structuredPrompt,
          cameraControl: config.cameraControl,
          referenceControl: config.referenceControl,
          matchNarrationDuration: config.matchNarrationDuration
        }
      });
    }
  };

  // 处理AI一键优化
  const handleAIOptimize = async () => {
    if (!scene || (!scene.assetUrl && !scene.videoUrl)) {
      alert('请先确保场景有视频素材');
      return;
    }
    
    // 获取视频URL（优先使用assetUrl，因为这是原始素材）
    const videoUrl = scene.assetUrl || scene.videoUrl;
    
    if (!videoUrl) {
      alert('场景缺少视频素材');
      return;
    }

    setIsOptimizing(true);
    setOptimizationResult(null);

    try {
      console.log('🎨 开始AI优化...');
      
      // 调用AI优化API
      const result = await optimizeVideoWithAI({
        video_url: videoUrl,
        project_theme: '项目主题',  // 可以从全局状态获取
        scene_script: scene.script || scene.narration || ''
      });

      console.log('✅ AI优化完成:', result);
      
      // 保存优化结果
      setOptimizationResult(result);

      // 应用优化参数到场景
      if (onUpdate && result.parameters) {
        onUpdate({
          postProcessing: {
            ...scene.postProcessing,
            brightness: result.parameters.brightness,
            contrast: result.parameters.contrast,
            saturation: result.parameters.saturation,
            colorTone: result.parameters.temperature as '原始' | '暖色调' | '冷色调' | '中性',
            sharpness: result.parameters.detail as '柔和' | '标准' | '锐利',
            denoiseLevel: result.parameters.denoiseLevel as '关闭' | '轻度' | '中度' | '重度',
            filter: result.parameters.filter
          }
        });
      }

      // 不再显示弹窗，优化结果会显示在面板中
      
    } catch (error) {
      console.error('❌ AI优化失败:', error);
      alert(`AI优化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background p-4">
        <div className="flex-1 bg-muted/30 border border-border rounded-xl flex items-center justify-center text-muted-foreground text-sm">
          Select a scene to edit
        </div>
      </div>
    );
  }

  const isReal = scene.type === 'real';

  // Define tabs based on mode
  const tabs = isReal ? [
    { id: 'filter', label: '滤镜与调色' },
    { id: 'edit', label: '画面处理' }
  ] : [
    { id: 'intent', label: '意图驱动' },
    { id: 'smart', label: '智能控制台' },
    { id: 'prompt', label: '文本模式' },
    { id: 'visuals', label: '视觉效果' }
  ];

  // Ensure active tab is valid for current mode
  const currentTab = tabs.find(t => t.id === activeTab) ? activeTab : tabs[0].id;

  return (
    <div className="flex flex-col h-full w-full bg-background p-4">
      <div className="flex-1 bg-muted/30 border border-border rounded-xl flex flex-col overflow-hidden hover-trigger">
        {/* Header */}
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            {isReal ? <Video size={16} className="text-blue-500" /> : <Sparkles size={16} className="text-purple-500" />}
            {isReal ? '后期处理控制台' : 'AI 生成控制台'}
          </h2>
          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
             <span className="bg-muted px-1.5 py-0.5 rounded">Scene {scene.id}</span>
             <span>•</span> 
             <span>{isReal ? 'Real Footage' : 'Generative AI'}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          
          {/* --- AI MODE: Intent-Driven Console (直接显示，无tab) --- */}
          {!isReal && (
            <div className="h-full p-4 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <IntentDrivenConsole
                  scriptContent={scene.script || ''}
                  initialTags={scene.intentTags}
                  onTagsChange={(tags: VideoPromptTags) => {
                    // 保存标签到 scene
                    if (onUpdate) {
                      onUpdate({ intentTags: tags });
                    }
                  }}
                  onRegenerate={() => {
                    // 触发重新生成逻辑（由父组件处理）
                    console.log('Regenerate with intent tags');
                  }}
                  isGenerating={scene.generationStatus === 'generating_image' || scene.generationStatus === 'generating_video'}
                />
              </div>
            </div>
          )}
          
          {/* --- AI MODE: Smart Generation Console (已隐藏) --- */}
          {false && !isReal && currentTab === 'smart' && generationConfig && (
            <div className="h-full p-4 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <SmartGenerationConsole
                  config={generationConfig}
                  onChange={handleGenerationConfigChange}
                  onRegenerate={() => {
                    // 触发重新生成逻辑（由父组件处理）
                    console.log('Regenerate with config:', generationConfig);
                  }}
                  isGenerating={scene.generationStatus === 'generating_image' || scene.generationStatus === 'generating_video'}
                  scriptText={scene.script}
                />
              </div>
              
              {/* AI 优化和对比模式按钮（视频生成完成后显示） */}
              {scene.videoUrl && scene.generationStatus === 'completed' && (
                <div className="pt-4 border-t border-border/50 mt-4 space-y-2">
                  <button
                    onClick={handleAIOptimize}
                    disabled={isOptimizing}
                    className={clsx(
                      "w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                      isOptimizing
                        ? "bg-primary/50 text-primary-foreground cursor-wait"
                        : "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl"
                    )}
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        AI 分析中（约1-2分钟）
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        AI 一键优化
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      const newMode = !isCompareMode;
                      setIsCompareMode(newMode);
                      onCompareToggle?.(newMode);
                    }}
                    className={clsx(
                      "w-full py-2.5 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 border",
                      isCompareMode
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-background text-foreground border-border hover:bg-accent hover:border-primary/50"
                    )}
                  >
                    <Eye size={14} />
                    {isCompareMode ? '对比模式：开启' : '前后对比'}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* --- AI MODE: Text Mode (已隐藏) --- */}
          {false && !isReal && currentTab === 'prompt' && (
            <div className="overflow-y-auto p-4 space-y-6">
              {/* Script Analysis */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Type size={14} /> 脚本分析
                </div>
                <div className="p-3 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground">
                  {scene.script ? `Analyzing context for: "${scene.script.substring(0, 50)}..."` : 'No script content.'}
                </div>
              </div>

              {/* Image Prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <ImageIcon size={14} /> 画面提示词
                </div>
                <textarea 
                  className="w-full h-32 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none font-mono"
                  value={scene.visualPrompt}
                  onChange={(e) => onUpdate?.({ visualPrompt: e.target.value })}
                  placeholder="输入画面描述..."
                />
              </div>

              {/* Motion Prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Settings2 size={14} /> 动态提示词
                </div>
                <textarea 
                  className="w-full h-24 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none font-mono"
                  value={scene.motionPrompt}
                  onChange={(e) => onUpdate?.({ motionPrompt: e.target.value })}
                  placeholder="输入动态描述..."
                />
              </div>
            </div>
          )}
          
          {/* --- REAL FOOTAGE MODE --- */}
          <div className="h-full overflow-y-auto p-4 space-y-6">{/* Wrapper for real mode content */}
        {isReal && currentTab === 'filter' && (
           <div className="h-full overflow-y-auto p-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* AI一键优化按钮 */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleAIOptimize}
                    disabled={isOptimizing || (!scene.assetUrl && !scene.videoUrl)}
                    className={clsx(
                      "col-span-2 py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                      isOptimizing
                        ? "bg-primary/50 text-primary-foreground cursor-wait"
                        : (!scene.assetUrl && !scene.videoUrl)
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl"
                    )}
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        AI 分析中（约1-2分钟）
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        AI 一键优化
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      const newMode = !isCompareMode;
                      setIsCompareMode(newMode);
                      onCompareToggle?.(newMode);
                    }}
                    disabled={!scene.assetUrl && !scene.videoUrl}
                    className={clsx(
                      "col-span-2 py-2.5 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 border",
                      isCompareMode
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-background text-foreground border-border hover:bg-accent hover:border-primary/50"
                    )}
                  >
                    <Eye size={14} />
                    {isCompareMode ? '对比模式：开启' : '前后对比'}
                  </button>
                </div>
                
                {optimizationResult && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="text-xs text-primary font-medium mb-1">✨ AI 分析结果</div>
                    <div className="text-[10px] text-muted-foreground mb-2">{optimizationResult.analysis}</div>
                    {optimizationResult.recommendations && optimizationResult.recommendations.length > 0 && (
                      <div className="space-y-1 mt-2 pt-2 border-t border-primary/10">
                        <div className="text-[10px] text-primary/70 font-medium">建议：</div>
                        {optimizationResult.recommendations.map((rec: string, i: number) => (
                          <div key={i} className="text-[10px] text-muted-foreground">• {rec}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 降噪与画质 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Sparkles size={14} /> 降噪与画质
                </div>
                
                {/* 降噪等级 */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground">降噪</label>
                  <div className="grid grid-cols-4 gap-1.5 bg-muted/50 p-1 rounded-lg">
                    {(['关闭', '轻度', '中度', '重度'] as const).map((level) => (
                      <button 
                        key={level}
                        onClick={() => onUpdate?.({ postProcessing: { ...scene.postProcessing, denoiseLevel: level } })}
                        className={clsx(
                          "py-1.5 text-[10px] font-medium rounded-md transition-all",
                          (scene.postProcessing?.denoiseLevel || '关闭') === level
                            ? "bg-background shadow-sm text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 冷暖性 */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground">冷暖性</label>
                  <div className="grid grid-cols-4 gap-1.5 bg-muted/50 p-1 rounded-lg">
                    {(['原始', '暖色调', '冷色调', '中性'] as const).map((tone) => (
                      <button 
                        key={tone}
                        onClick={() => onUpdate?.({ postProcessing: { ...scene.postProcessing, colorTone: tone } })}
                        className={clsx(
                          "py-1.5 text-[10px] font-medium rounded-md transition-all",
                          (scene.postProcessing?.colorTone || '原始') === tone
                            ? "bg-background shadow-sm text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 细节/锐度 */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground">细节</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-muted/50 p-1 rounded-lg">
                    {(['柔和', '标准', '锐利'] as const).map((sharp) => (
                      <button 
                        key={sharp}
                        onClick={() => onUpdate?.({ postProcessing: { ...scene.postProcessing, sharpness: sharp } })}
                        className={clsx(
                          "py-1.5 text-[10px] font-medium rounded-md transition-all",
                          (scene.postProcessing?.sharpness || '标准') === sharp
                            ? "bg-background shadow-sm text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {sharp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 基础颜色 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Aperture size={14} /> 基础颜色
                </div>
                <div className="space-y-3">
                  {/* 亮度 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">亮度</span>
                      <span className="text-[10px] font-mono text-foreground">
                        {scene.postProcessing?.brightness || 0}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value={scene.postProcessing?.brightness || 0}
                      onChange={(e) => onUpdate?.({ 
                        postProcessing: { 
                          ...scene.postProcessing, 
                          brightness: parseInt(e.target.value) 
                        } 
                      })}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" 
                    />
                  </div>

                  {/* 对比度 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">对比度</span>
                      <span className="text-[10px] font-mono text-foreground">
                        {scene.postProcessing?.contrast || 0}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value={scene.postProcessing?.contrast || 0}
                      onChange={(e) => onUpdate?.({ 
                        postProcessing: { 
                          ...scene.postProcessing, 
                          contrast: parseInt(e.target.value) 
                        } 
                      })}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" 
                    />
                  </div>

                  {/* 饱和度 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">饱和度</span>
                      <span className="text-[10px] font-mono text-foreground">
                        {scene.postProcessing?.saturation || 0}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-100" 
                      max="100" 
                      value={scene.postProcessing?.saturation || 0}
                      onChange={(e) => onUpdate?.({ 
                        postProcessing: { 
                          ...scene.postProcessing, 
                          saturation: parseInt(e.target.value) 
                        } 
                      })}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" 
                    />
                  </div>
                </div>
              </div>

              {/* Filter Presets */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Palette size={14} /> 风格滤镜
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['原片', '复古胶片', '冷调科技', '暖色纪实', '黑白', '高饱和'].map((filter) => (
                    <button 
                      key={filter} 
                      onClick={() => onUpdate?.({ postProcessing: { ...scene.postProcessing, filter } })}
                      className={clsx(
                        "px-3 py-2 text-xs border rounded-md transition-all text-left",
                         scene.postProcessing?.filter === filter 
                           ? "bg-primary/10 border-primary text-primary" 
                           : "border-border hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
           </div>
        )}

        {isReal && currentTab === 'edit' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Crop & Fill */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <Crop size={14} /> 裁剪与填充
                  </div>
                  <div className="flex bg-muted/50 rounded-lg p-1">
                    {[{id: 'fill', label: '高斯模糊'}, {id: 'fit', label: '黑边填充'}, {id: 'crop', label: '裁切画面'}].map((mode) => (
                      <button 
                        key={mode.id}
                        onClick={() => onUpdate?.({ postProcessing: { ...scene.postProcessing, cropMode: mode.id as any } })}
                        className={clsx(
                            "flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all",
                            scene.postProcessing?.cropMode === mode.id 
                                ? "bg-background shadow-sm text-foreground" 
                                : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
               </div>

               {/* Camera Move / Stabilization */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <Move size={14} /> 运镜与防抖
                  </div>
                  
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md border border-border">
                      <span className="text-xs">视频防抖</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" onChange={(e) => onUpdate?.({ postProcessing: { ...scene.postProcessing, stabilization: e.target.checked } })} />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                     {['推近 (Zoom In)', '拉远 (Zoom Out)', '摇摄 (Pan)', '静止'].map(move => (
                         <button key={move} className="px-2 py-1.5 text-[10px] bg-muted/30 border border-border rounded hover:bg-accent text-left">
                            {move}
                         </button>
                     ))}
                  </div>
               </div>

                {/* Speed Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                      <Gauge size={14} /> 变速控制
                    </div>
                    <span className="text-xs font-mono text-primary">1.0x</span>
                  </div>
                  <input type="range" min="0.1" max="4.0" step="0.1" defaultValue="1.0" className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Slow (0.1x)</span>
                    <span>Fast (4.0x)</span>
                  </div>
                   <div className="flex items-center gap-2 mt-2">
                      <Zap size={12} className="text-yellow-500" />
                      <span className="text-[10px] text-muted-foreground">AI 补帧已启用 (针对慢动作)</span>
                   </div>
                </div>
            </div>
        )}



        {!isReal && currentTab === 'visuals' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Style Presets */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                <Palette size={14} /> 风格预设
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['电影质感', '3D 渲染', '极简插画', '赛博朋克'].map((style) => (
                  <button 
                    key={style} 
                    onClick={() => onUpdate?.({ visualPrompt: `${scene.visualPrompt || ''}, ${style} style` })}
                    className={`px-3 py-2 text-xs border rounded-md transition-all text-left border-border hover:bg-accent hover:text-accent-foreground`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                <Ratio size={14} /> 画面比例
              </div>
              <div className="flex bg-muted/50 rounded-lg p-1">
                {['16:9', '9:16', '1:1'].map((ratio) => (
                  <button 
                    key={ratio}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${ratio === '16:9' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Motion Strength */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Video size={14} /> 运动幅度
                </div>
                <span className="text-xs font-mono text-primary">127</span>
              </div>
              <input type="range" min="1" max="255" defaultValue="127" className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Static</span>
                <span>Dynamic</span>
              </div>
            </div>

            {/* Camera Movement */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                <Settings2 size={14} /> 相机运镜
              </div>
              <select 
                className="w-full p-2 text-xs bg-muted/50 border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
                onChange={(e) => onUpdate?.({ motionPrompt: e.target.value })}
              >
                <option value="pan right">水平摇摄 (Pan)</option>
                <option value="zoom in">推近镜头 (Zoom In)</option>
                <option value="zoom out">拉远镜头 (Zoom Out)</option>
                <option value="static">静止 (Static)</option>
                <option value="handheld">手持晃动 (Handheld)</option>
              </select>
            </div>
            
            {/* Negative Prompt */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                <Aperture size={14} /> 负向提示词
              </div>
              <textarea 
                className="w-full h-20 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
                defaultValue="text, watermark, blurry, low quality, deformed, ugly"
              />
            </div>
          </div>
        )}
          </div>{/* End wrapper for real mode content */}
        </div>{/* End content container */}
      </div>
    </div>
  );
};
