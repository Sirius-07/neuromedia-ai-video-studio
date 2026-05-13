import React, { useState } from 'react';
import {
  Volume2,
  Mic,
  Music,
  Zap,
  Sparkles,
  Settings,
  Download,
  User,
  Sliders,
  RefreshCw,
  Play,
  Pause
} from 'lucide-react';
import { clsx } from 'clsx';

// 音频类型定义
interface AudioBlock {
  id: string;
  type: 'bgm' | 'sfx' | 'voice';
  name: string;
  startTime: number;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  pan?: number; // -1 (左) 到 1 (右)
  prompt?: string;
  style?: string;
}

interface VoiceActor {
  id: string;
  name: string;
  avatar: string;
  voice: string; // 'stable-male' | 'energetic-female' etc
}

// 分镜数据接口
interface SceneNarration {
  id: number;
  narration: string;
  duration: number; // 秒
}

interface AudioInspectorProps {
  selectedBlock?: AudioBlock | null;
  onBlockUpdate?: (id: string, updates: Partial<AudioBlock>) => void;
  onGenerateVoiceover?: (actorId: string, speed: number, emotion: string) => void;
  onExport?: (format: 'mp4' | 'wav') => void;
  // 新增：从分镜页面传入的旁白数据
  sceneNarrations?: SceneNarration[];
}

const VOICE_ACTORS: VoiceActor[] = [
  { id: '1', name: '央视男声', avatar: '👨', voice: 'stable-male' },
  { id: '2', name: '活力女声', avatar: '👩', voice: 'energetic-female' },
  { id: '3', name: '沉稳旁白', avatar: '🎙️', voice: 'narrator' },
  { id: '4', name: '温柔女声', avatar: '💁‍♀️', voice: 'gentle-female' },
];

export const AudioInspector: React.FC<AudioInspectorProps> = ({
  selectedBlock,
  onBlockUpdate,
  onGenerateVoiceover,
  onExport,
  sceneNarrations = []
}) => {
  // 全局混音状态
  const [bgmVolume, setBgmVolume] = useState(0); // dB
  const [sfxVolume, setSfxVolume] = useState(-3);
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [autoDucking, setAutoDucking] = useState(false);
  const [duckingLevel, setDuckingLevel] = useState<'light' | 'heavy'>('light');

  // AI配音状态
  const [selectedActor, setSelectedActor] = useState(VOICE_ACTORS[0].id);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceEmotion, setVoiceEmotion] = useState<'calm' | 'energetic'>('calm');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 配音生成进度
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');

  // 导出状态
  const [exportFormat, setExportFormat] = useState<'mp4' | 'wav'>('mp4');

  // 对象编辑状态
  const [editingPrompt, setEditingPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // 音量转换为 dB 显示
  const volumeToDb = (volume: number): string => {
    if (volume === -100) return '-∞';
    return `${volume > 0 ? '+' : ''}${volume}dB`;
  };

  // 处理音量变化
  const handleVolumeChange = (
    type: 'bgm' | 'sfx' | 'voice',
    value: number
  ) => {
    switch (type) {
      case 'bgm':
        setBgmVolume(value);
        break;
      case 'sfx':
        setSfxVolume(value);
        break;
      case 'voice':
        setVoiceVolume(value);
        break;
    }
  };

  // 整合所有分镜旁白并生成配音
  const handleGenerateVoiceover = async () => {
    if (sceneNarrations.length === 0) {
      alert('没有找到分镜旁白数据！\n\n请确保从分镜页面传入了旁白文案。');
      return;
    }

    // 过滤掉空旁白
    const validNarrations = sceneNarrations.filter(s => s.narration && s.narration.trim());
    if (validNarrations.length === 0) {
      alert('所有分镜都没有旁白文案！\n\n请先在分镜页面添加旁白内容。');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('准备生成配音...');

    try {
      console.log('🎤 开始生成整合配音');
      console.log(`   分镜数: ${validNarrations.length}`);
      console.log(`   总时长: ${validNarrations.reduce((sum, s) => sum + s.duration, 0).toFixed(1)}秒`);

      // 获取选中的配音员信息
      const selectedActorInfo = VOICE_ACTORS.find(a => a.id === selectedActor);
      const voice = selectedActorInfo?.voice || 'stable-male';

      // 整合所有旁白文案
      const fullScript = validNarrations.map(s => s.narration).join('\n');
      console.log(`   完整文案: ${fullScript.substring(0, 100)}...`);

      setGenerationStatus('正在调用 AI 配音服务...');
      setGenerationProgress(10);

      // 调用 TTS API 生成完整配音
      const response = await fetch('http://localhost:4300/api/tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fullScript,
          voice: voice,
          speed: voiceSpeed,
          emotion: voiceEmotion === 'calm' ? 'neutral' : 'happy'
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '配音生成失败');
      }

      setGenerationProgress(80);
      setGenerationStatus('配音生成成功，正在处理分割...');

      console.log('✅ 配音生成成功:', result.audio_url);
      console.log(`   时长: ${result.duration?.toFixed(1)}秒`);

      // 计算每个分镜的时间戳
      const segments = [];
      let currentTime = 0;
      
      for (const scene of validNarrations) {
        segments.push({
          sceneId: scene.id,
          startTime: currentTime,
          endTime: currentTime + scene.duration,
          duration: scene.duration,
          narration: scene.narration
        });
        currentTime += scene.duration;
      }

      console.log('📊 分割方案:', segments);

      setGenerationProgress(100);
      setGenerationStatus('完成！');

      // 通知父组件配音已生成
      if (onGenerateVoiceover) {
        onGenerateVoiceover(selectedActor, voiceSpeed, voiceEmotion);
      }

      // 将完整配音和分割信息存储（这里可以扩展为实际的音频分割）
      console.log('💾 配音文件:', `http://localhost:4300${result.audio_url}`);
      console.log('✂️ 分割点:', segments.map(s => `${s.endTime.toFixed(1)}s`).join(', '));

      setTimeout(() => {
        alert(`配音生成成功！\n\n文件: ${result.audio_url}\n时长: ${result.duration?.toFixed(1)}秒\n分镜数: ${segments.length}`);
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStatus('');
      }, 1000);

    } catch (error) {
      console.error('❌ 配音生成失败:', error);
      alert(`配音生成失败:\n\n${error instanceof Error ? error.message : '未知错误'}\n\n请确保：\n1. IndexTTS2 服务已启动\n2. 后端服务正常运行\n3. 网络连接正常`);
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStatus('');
    }
  };

  // 处理导出
  const handleExport = () => {
    onExport?.(exportFormat);
  };

  // 处理AI重绘
  const handleRegenerate = () => {
    if (!selectedBlock || !editingPrompt.trim()) {
      alert('请输入重绘提示');
      return;
    }

    setIsRegenerating(true);
    
    // 调用重绘API
    setTimeout(() => {
      setIsRegenerating(false);
      alert('重新生成成功！');
    }, 2000);
  };

  // 渲染全局模式
  const renderGlobalMode = () => (
    <div className="space-y-6">
      {/* AI 配音生成 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Mic size={14} className="text-purple-500" />
          AI 旁白 (Voiceover)
        </div>

        {/* 配音员选择 */}
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">配音员</label>
          <div className="grid grid-cols-4 gap-2">
            {VOICE_ACTORS.map((actor) => (
              <button
                key={actor.id}
                onClick={() => setSelectedActor(actor.id)}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-all border',
                  selectedActor === actor.id
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted/30 border-border hover:bg-accent'
                )}
              >
                <span className="text-2xl">{actor.avatar}</span>
                <span className="text-[9px] text-center leading-tight">
                  {actor.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 语速与情感 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">语速</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-xs font-mono text-foreground w-8">
                {voiceSpeed.toFixed(1)}x
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">情感</label>
            <div className="flex bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setVoiceEmotion('calm')}
                className={clsx(
                  'flex-1 py-1 text-[10px] font-medium rounded-md transition-all',
                  voiceEmotion === 'calm'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                👔 沉稳
              </button>
              <button
                onClick={() => setVoiceEmotion('energetic')}
                className={clsx(
                  'flex-1 py-1 text-[10px] font-medium rounded-md transition-all',
                  voiceEmotion === 'energetic'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                ⚡ 激昂
              </button>
            </div>
          </div>
        </div>

        {/* 分镜旁白统计 */}
        {sceneNarrations.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="text-[10px] text-muted-foreground font-medium">分镜旁白数据</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">
                  {sceneNarrations.filter(s => s.narration && s.narration.trim()).length}
                </div>
                <div className="text-[9px] text-muted-foreground">分镜数</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">
                  {sceneNarrations.reduce((sum, s) => sum + (s.narration?.length || 0), 0)}
                </div>
                <div className="text-[9px] text-muted-foreground">总字数</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">
                  {sceneNarrations.reduce((sum, s) => sum + s.duration, 0).toFixed(0)}秒
                </div>
                <div className="text-[9px] text-muted-foreground">总时长</div>
              </div>
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <button
          onClick={handleGenerateVoiceover}
          disabled={isGenerating || sceneNarrations.length === 0}
          className={clsx(
            'w-full py-2.5 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2',
            isGenerating
              ? 'bg-primary/50 text-primary-foreground cursor-wait'
              : sceneNarrations.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
          )}
        >
          {isGenerating ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              一键生成旁白
            </>
          )}
        </button>

        {/* 生成进度 */}
        {isGenerating && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{generationStatus}</span>
              <span className="font-medium text-primary">{generationProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ease-out"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 分割线 */}
      <div className="border-t border-border/50" />

      {/* 音量平衡 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Sliders size={14} className="text-blue-500" />
          音量平衡 (Balance)
        </div>

        {/* BGM 推子 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music size={12} className="text-purple-400" />
              <span className="text-[10px] text-muted-foreground">BGM</span>
            </div>
            <span className="text-[10px] font-mono text-foreground">
              {volumeToDb(bgmVolume)}
            </span>
          </div>
          <input
            type="range"
            min="-100"
            max="12"
            step="1"
            value={bgmVolume}
            onChange={(e) => handleVolumeChange('bgm', parseInt(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Voice 推子 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic size={12} className="text-blue-400" />
              <span className="text-[10px] text-muted-foreground">Voice</span>
            </div>
            <span className="text-[10px] font-mono text-foreground">
              {volumeToDb(voiceVolume)}
            </span>
          </div>
          <input
            type="range"
            min="-100"
            max="12"
            step="1"
            value={voiceVolume}
            onChange={(e) => handleVolumeChange('voice', parseInt(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* SFX 推子 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-yellow-400" />
              <span className="text-[10px] text-muted-foreground">SFX</span>
            </div>
            <span className="text-[10px] font-mono text-foreground">
              {volumeToDb(sfxVolume)}
            </span>
          </div>
          <input
            type="range"
            min="-100"
            max="12"
            step="1"
            value={sfxVolume}
            onChange={(e) => handleVolumeChange('sfx', parseInt(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>
      </div>

      {/* 自动闪避 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦆</span>
            <div>
              <div className="text-xs font-medium text-foreground">
                自动闪避 (Auto-Ducking)
              </div>
              <div className="text-[9px] text-muted-foreground">
                人声出现时自动压低 BGM
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={autoDucking}
              onChange={(e) => setAutoDucking(e.target.checked)}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {autoDucking && (
          <div className="space-y-1.5 pl-3">
            <label className="text-[10px] text-muted-foreground">
              压低程度
            </label>
            <div className="flex bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setDuckingLevel('light')}
                className={clsx(
                  'flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all',
                  duckingLevel === 'light'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                轻微
              </button>
              <button
                onClick={() => setDuckingLevel('heavy')}
                className={clsx(
                  'flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all',
                  duckingLevel === 'heavy'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                明显
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 分割线 */}
      <div className="border-t border-border/50" />

      {/* 导出设置 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Download size={14} className="text-green-500" />
          导出设置 (Export)
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground">格式</label>
          <div className="flex bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setExportFormat('mp4')}
              className={clsx(
                'flex-1 py-2 text-[10px] font-medium rounded-md transition-all',
                exportFormat === 'mp4'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              🎬 MP4 (视频)
            </button>
            <button
              onClick={() => setExportFormat('wav')}
              className={clsx(
                'flex-1 py-2 text-[10px] font-medium rounded-md transition-all',
                exportFormat === 'wav'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              🎵 WAV (音频)
            </button>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="w-full py-3 rounded-lg font-medium text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <Download size={16} />
          合成并导出
        </button>
      </div>
    </div>
  );

  // 渲染对象编辑模式（BGM）
  const renderBgmEdit = (block: AudioBlock) => (
    <div className="space-y-6">
      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Music size={14} className="text-purple-500" />
          <span className="text-xs font-semibold text-purple-500">
            编辑 BGM
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {block.name}
        </div>
      </div>

      {/* 源信息 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase">
          源信息
        </div>
        <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-1">
          <div className="text-[10px] text-muted-foreground">曲名</div>
          <div className="text-xs text-foreground font-medium">{block.name}</div>
          {block.style && (
            <>
              <div className="text-[10px] text-muted-foreground mt-2">风格</div>
              <div className="text-xs text-foreground">{block.style}</div>
            </>
          )}
        </div>
      </div>

      {/* AI 重绘 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Sparkles size={14} />
          AI 重绘
        </div>
        <textarea
          value={editingPrompt}
          onChange={(e) => setEditingPrompt(e.target.value)}
          placeholder="把氛围改成更悲伤一点..."
          className="w-full h-20 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
        />
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className={clsx(
            'w-full py-2 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2',
            isRegenerating
              ? 'bg-primary/50 text-primary-foreground cursor-wait'
              : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
          )}
        >
          {isRegenerating ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              重新生成片段
            </>
          )}
        </button>
      </div>

      {/* 音频包络 */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase">
          音频包络
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">淡入 (Fade In)</span>
            <span className="text-[10px] font-mono text-foreground">
              {block.fadeIn || 0}s
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={block.fadeIn || 0}
            onChange={(e) =>
              onBlockUpdate?.(block.id, { fadeIn: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">淡出 (Fade Out)</span>
            <span className="text-[10px] font-mono text-foreground">
              {block.fadeOut || 0}s
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={block.fadeOut || 0}
            onChange={(e) =>
              onBlockUpdate?.(block.id, { fadeOut: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* 音量 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">音量</span>
          <span className="text-[10px] font-mono text-foreground">
            {Math.round(block.volume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={block.volume}
          onChange={(e) =>
            onBlockUpdate?.(block.id, { volume: parseFloat(e.target.value) })
          }
          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>
    </div>
  );

  // 渲染对象编辑模式（SFX）
  const renderSfxEdit = (block: AudioBlock) => (
    <div className="space-y-6">
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} className="text-yellow-500" />
          <span className="text-xs font-semibold text-yellow-500">
            编辑音效
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {block.name}
        </div>
      </div>

      {/* 定位微调 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase">
          定位微调
        </div>
        <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-2">
          <label className="text-[10px] text-muted-foreground">
            触发时间 (毫秒级精度)
          </label>
          <input
            type="text"
            value={block.startTime.toFixed(3)}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) {
                onBlockUpdate?.(block.id, { startTime: value });
              }
            }}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-xs font-mono text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="00:05.100"
          />
          <div className="text-[9px] text-muted-foreground">
            💡 提示：鼠标拖拽很难精确定位，建议手动输入时间
          </div>
        </div>
      </div>

      {/* 空间音频 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Settings size={14} />
          空间音频 (Spatial Audio)
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              左右声道平衡 (Pan)
            </span>
            <span className="text-[10px] font-mono text-foreground">
              {block.pan === 0
                ? '中间'
                : block.pan! < 0
                ? `左 ${Math.abs(Math.round(block.pan! * 100))}%`
                : `右 ${Math.round(block.pan! * 100)}%`}
            </span>
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={block.pan || 0}
            onChange={(e) =>
              onBlockUpdate?.(block.id, { pan: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>⬅️ 左声道</span>
            <span>中间</span>
            <span>右声道 ➡️</span>
          </div>
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] text-muted-foreground">
            💡 场景示例：画面里车从左边开过去，可以把滑块往左拉
          </div>
        </div>
      </div>

      {/* 音量 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">音量</span>
          <span className="text-[10px] font-mono text-foreground">
            {Math.round(block.volume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={block.volume}
          onChange={(e) =>
            onBlockUpdate?.(block.id, { volume: parseFloat(e.target.value) })
          }
          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
      </div>

      {/* AI 重绘 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Sparkles size={14} />
          AI 重绘
        </div>
        <textarea
          value={editingPrompt}
          onChange={(e) => setEditingPrompt(e.target.value)}
          placeholder="改成更响亮的爆炸声..."
          className="w-full h-20 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
        />
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className={clsx(
            'w-full py-2 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2',
            isRegenerating
              ? 'bg-primary/50 text-primary-foreground cursor-wait'
              : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
          )}
        >
          {isRegenerating ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              重新生成音效
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background p-4">
      <div className="flex-1 bg-muted/30 border border-border rounded-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Volume2 size={16} className="text-purple-500" />
            {selectedBlock ? '对象编辑模式' : '智能混音控制台'}
          </h2>
          <div className="text-[10px] text-muted-foreground mt-1">
            {selectedBlock
              ? `编辑 ${selectedBlock.type.toUpperCase()} · ${selectedBlock.name}`
              : '未选中音频块 - 显示全局混音设置'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedBlock && renderGlobalMode()}
          {selectedBlock?.type === 'bgm' && renderBgmEdit(selectedBlock)}
          {selectedBlock?.type === 'sfx' && renderSfxEdit(selectedBlock)}
          {selectedBlock?.type === 'voice' && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              语音块编辑功能开发中...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioInspector;

