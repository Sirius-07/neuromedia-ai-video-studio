/**
 * 配音生成对话框
 * 
 * 为分镜列表批量生成 AI 配音
 */

import React, { useState, useEffect } from 'react';
import { X, Mic, Volume2, Zap, CheckCircle2, AlertCircle, Loader2, Play, Pause } from 'lucide-react';
import { Scene } from './types';
import {
  generateSceneVoiceovers,
  getAvailableVoices,
  checkTTSHealth,
  formatDuration,
  estimateVoiceoverDuration
} from '../../api/ttsApi';

interface VoiceoverGenerationDialogProps {
  scenes: Scene[];
  onClose: () => void;
  onSuccess: (updatedScenes: Scene[]) => void;
}

export const VoiceoverGenerationDialog: React.FC<VoiceoverGenerationDialogProps> = ({
  scenes,
  onClose,
  onSuccess
}) => {
  const [selectedVoice, setSelectedVoice] = useState('stable-male');
  const [speed, setSpeed] = useState(1.0);
  const [emotion, setEmotion] = useState('neutral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<Record<string, any>>({});
  
  // 预览播放状态
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  // 检查服务状态
  useEffect(() => {
    const checkService = async () => {
      const health = await checkTTSHealth();
      setServiceAvailable(health.success);
      
      if (health.success) {
        const voicesResponse = await getAvailableVoices();
        if (voicesResponse.success && voicesResponse.voices) {
          setVoices(voicesResponse.voices);
        }
      }
    };
    
    checkService();
  }, []);

  // 统计信息
  const scenesWithNarration = scenes.filter(s => s.narration && s.narration.trim());
  const totalCharacters = scenesWithNarration.reduce((sum, s) => sum + (s.narration?.length || 0), 0);
  const estimatedDuration = scenesWithNarration.reduce(
    (sum, s) => sum + estimateVoiceoverDuration(s.narration || '', speed),
    0
  );

  // 处理生成
  const handleGenerate = async () => {
    if (!serviceAvailable) {
      alert('IndexTTS2 服务不可用！\n\n请确保已启动服务：python api_server_v2.py');
      return;
    }

    if (scenesWithNarration.length === 0) {
      alert('没有找到包含旁白文案的分镜！\n\n请先为分镜添加旁白内容。');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResults([]);

    try {
      console.log('🎤 开始批量生成配音...');
      console.log(`   场景数: ${scenesWithNarration.length}`);
      console.log(`   语音: ${selectedVoice}`);
      console.log(`   语速: ${speed}`);
      console.log(`   情感: ${emotion}`);

      // 调用批量生成 API
      const response = await generateSceneVoiceovers({
        scenes: scenesWithNarration,
        voice: selectedVoice,
        speed,
        emotion
      });

      console.log('✅ 生成完成:', response);

      if (response.success) {
        setResults(response.scenes.map((s: any) => s.voiceover));
        setProgress(100);
        
        // 将结果合并回原始 scenes 数组
        const updatedScenes = scenes.map(scene => {
          const resultScene = response.scenes.find((s: any) => 
            s.narration === scene.narration || s.script === scene.script
          );
          
          if (resultScene && resultScene.voiceover?.success) {
            return {
              ...scene,
              voiceoverUrl: `http://localhost:4300${resultScene.voiceover.audio_url}`,
              voiceoverDuration: resultScene.voiceover.duration
            };
          }
          
          return scene;
        });

        // 通知父组件
        setTimeout(() => {
          onSuccess(updatedScenes);
        }, 1500);
      } else {
        alert(`生成失败: ${response.message}`);
        setIsGenerating(false);
      }

    } catch (error) {
      console.error('❌ 生成配音失败:', error);
      alert('生成配音时发生错误，请查看控制台。');
      setIsGenerating(false);
    }
  };

  // 播放预览
  const handlePlayPreview = (audioUrl: string, index: number) => {
    if (playingAudio) {
      playingAudio.pause();
      if (playingIndex === index) {
        setPlayingAudio(null);
        setPlayingIndex(null);
        return;
      }
    }

    const audio = new Audio(`http://localhost:4300${audioUrl}`);
    audio.play();
    audio.onended = () => {
      setPlayingAudio(null);
      setPlayingIndex(null);
    };
    
    setPlayingAudio(audio);
    setPlayingIndex(index);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mic size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI 配音生成</h2>
              <p className="text-xs text-muted-foreground">为分镜旁白生成专业配音</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Service Status */}
          {serviceAvailable !== null && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
              serviceAvailable
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}>
              {serviceAvailable ? (
                <>
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-medium">IndexTTS2 服务在线</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">
                    IndexTTS2 服务离线 - 请启动服务: python api_server_v2.py
                  </span>
                </>
              )}
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">{scenesWithNarration.length}</div>
              <div className="text-xs text-muted-foreground mt-1">待生成分镜</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">{totalCharacters}</div>
              <div className="text-xs text-muted-foreground mt-1">总字符数</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">{formatDuration(estimatedDuration)}</div>
              <div className="text-xs text-muted-foreground mt-1">预计时长</div>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">语音类型</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(voices).map(([key, voice]) => (
                <button
                  key={key}
                  onClick={() => setSelectedVoice(key)}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedVoice === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Volume2 size={14} className={selectedVoice === key ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-sm font-medium">{voice.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{voice.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Speed Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">语速</label>
              <span className="text-sm text-muted-foreground">{speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              disabled={isGenerating}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>慢速 0.5x</span>
              <span>正常 1.0x</span>
              <span>快速 2.0x</span>
            </div>
          </div>

          {/* Emotion Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">情感</label>
            <div className="flex gap-2">
              {['neutral', 'happy', 'serious'].map((emo) => (
                <button
                  key={emo}
                  onClick={() => setEmotion(emo)}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    emotion === emo
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {emo === 'neutral' && '中性'}
                  {emo === 'happy' && '欢快'}
                  {emo === 'serious' && '严肃'}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">生成进度</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {currentScene && (
                <p className="text-xs text-muted-foreground">正在生成: {currentScene}</p>
              )}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">生成结果</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.success
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {result.success ? (
                        <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          分镜 #{index + 1}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.success
                            ? `${result.duration?.toFixed(1)}秒 · ${result.text_length}字`
                            : result.message
                          }
                        </p>
                      </div>
                    </div>
                    {result.success && result.audio_url && (
                      <button
                        onClick={() => handlePlayPreview(result.audio_url, index)}
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                        title="播放预览"
                      >
                        {playingIndex === index ? (
                          <Pause size={14} className="text-primary" />
                        ) : (
                          <Play size={14} className="text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {isGenerating
              ? '正在生成配音...'
              : results.length > 0
              ? '配音生成完成！'
              : '配置参数后点击生成'
            }
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {results.length > 0 ? '完成' : '取消'}
            </button>
            {results.length === 0 && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !serviceAvailable || scenesWithNarration.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    开始生成
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

