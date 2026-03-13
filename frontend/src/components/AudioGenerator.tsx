/**
 * 音频生成器组件
 * 演示如何使用 Stable Audio API
 */

import React, { useState } from 'react';
import {
  quickGenerateAudio,
  waitForCompletion,
  getAudioUrl,
  downloadAudio,
  AudioTask,
} from '../api/audioApi';

export const AudioGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('Thunder and rain sound effect');
  const [duration, setDuration] = useState(5.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [currentTask, setCurrentTask] = useState<AudioTask | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError('');
      setProgress('正在创建任务...');

      // 创建任务
      const task = await quickGenerateAudio(prompt, duration);
      setCurrentTask(task);
      setProgress(`任务已创建: ${task.taskId}`);

      // 等待完成
      const completedTask = await waitForCompletion(
        task.taskId,
        (task) => {
          setCurrentTask(task);
          setProgress(`状态: ${task.status}`);
        },
        5000 // 每 5 秒轮询一次
      );

      setCurrentTask(completedTask);
      setProgress('生成完成！');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      console.error('生成音频失败:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (currentTask?.outputFileUrl) {
      const filename = `audio_${Date.now()}.wav`;
      downloadAudio(currentTask.outputFileUrl, filename);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'processing':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🎵 AI 音频生成器</h2>

      {/* 输入区域 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            提示词 (Prompt):
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            placeholder="例: Thunder and rain sound effect"
            disabled={isGenerating}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            时长 (秒): {duration}
          </label>
          <input
            type="range"
            min="1"
            max="30"
            step="0.5"
            value={duration}
            onChange={(e) => setDuration(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            disabled={isGenerating}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: isGenerating ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? '生成中...' : '生成音频'}
        </button>
      </div>

      {/* 进度显示 */}
      {progress && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            marginBottom: '10px',
          }}
        >
          <p style={{ margin: 0 }}>{progress}</p>
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '10px',
          }}
        >
          <p style={{ margin: 0 }}>❌ {error}</p>
        </div>
      )}

      {/* 任务信息 */}
      {currentTask && (
        <div
          style={{
            padding: '15px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginBottom: '10px',
          }}
        >
          <h3>任务信息</h3>
          <p>
            <strong>ID:</strong> {currentTask.taskId}
          </p>
          <p>
            <strong>状态:</strong>{' '}
            <span style={{ color: getStatusColor(currentTask.status) }}>
              {currentTask.status}
            </span>
          </p>
          <p>
            <strong>提示词:</strong> {currentTask.prompt}
          </p>
          <p>
            <strong>时长:</strong> {currentTask.duration} 秒
          </p>

          {currentTask.status === 'completed' && currentTask.outputFileUrl && (
            <>
              <div style={{ marginTop: '15px' }}>
                <audio
                  controls
                  src={getAudioUrl(currentTask.outputFileUrl)}
                  style={{ width: '100%' }}
                >
                  您的浏览器不支持音频播放
                </audio>
              </div>

              <button
                onClick={handleDownload}
                style={{
                  marginTop: '10px',
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                下载音频
              </button>
            </>
          )}

          {currentTask.status === 'failed' && currentTask.errorMessage && (
            <p style={{ color: 'red' }}>
              <strong>错误:</strong> {currentTask.errorMessage}
            </p>
          )}
        </div>
      )}

      {/* 使用提示 */}
      <div
        style={{
          padding: '15px',
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          marginTop: '20px',
        }}
      >
        <h4>💡 提示词建议</h4>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li>音效: "Thunder sound effect, dramatic"</li>
          <li>音乐: "Piano melody, peaceful and relaxing"</li>
          <li>环境音: "Forest ambience, birds chirping"</li>
          <li>动作音: "Explosion sound effect, cinematic"</li>
        </ul>
      </div>
    </div>
  );
};

export default AudioGenerator;















