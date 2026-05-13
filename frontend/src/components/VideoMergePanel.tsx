import React, { useState } from 'react'
import { mergeVideo } from '../api/soundtrackApi'
import './VideoMergePanel.css'

interface VideoMergePanelProps {
  taskId: string
  assetMap: any
  onMergeComplete: (result: any) => void
}

export const VideoMergePanel: React.FC<VideoMergePanelProps> = ({
  taskId,
  assetMap,
  onMergeComplete
}) => {
  const [isMerging, setIsMerging] = useState(false)
  const [mergeProgress, setMergeProgress] = useState<string>('')
  const [mergeResult, setMergeResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMerge = async () => {
    setIsMerging(true)
    setMergeProgress('准备合成...')
    setError(null)

    try {
      // 显示进度提示
      setMergeProgress('正在调用 FFmpeg 合成视频...')
      
      const result = await mergeVideo(taskId)
      
      if (result.success) {
        setMergeProgress('合成完成！')
        setMergeResult(result.data)
        onMergeComplete(result.data)
      } else {
        throw new Error(result.error || '合成失败')
      }
    } catch (err: any) {
      console.error('视频合成失败:', err)
      setError(err.message || '合成过程出错')
      setMergeProgress('')
    } finally {
      setIsMerging(false)
    }
  }

  const sfxCount = assetMap?.sound_effects?.length || 0
  const hasBgm = !!assetMap?.background_music

  return (
    <div className="video-merge-panel">
      <div className="merge-header">
        <h3>🎬 视频合成</h3>
        <p className="merge-description">
          将生成的音效合成到原视频中，创建最终视频
        </p>
      </div>

      <div className="merge-info">
        <div className="info-card">
          <span className="info-icon">🎵</span>
          <div className="info-content">
            <div className="info-label">背景音乐</div>
            <div className="info-value">{hasBgm ? '已生成' : '无'}</div>
          </div>
        </div>

        <div className="info-card">
          <span className="info-icon">🔊</span>
          <div className="info-content">
            <div className="info-label">音效数量</div>
            <div className="info-value">{sfxCount} 个</div>
          </div>
        </div>

        <div className="info-card">
          <span className="info-icon">⏱️</span>
          <div className="info-content">
            <div className="info-label">预计时长</div>
            <div className="info-value">1-3 分钟</div>
          </div>
        </div>
      </div>

      {!mergeResult && (
        <div className="merge-actions">
          <button
            className="btn-merge"
            onClick={handleMerge}
            disabled={isMerging || sfxCount === 0}
          >
            {isMerging ? (
              <>
                <span className="spinner"></span>
                合成中...
              </>
            ) : (
              <>
                🚀 开始合成视频
              </>
            )}
          </button>

          {sfxCount === 0 && (
            <p className="warning-text">⚠️ 没有音效可合成</p>
          )}
        </div>
      )}

      {isMerging && mergeProgress && (
        <div className="merge-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <p className="progress-text">{mergeProgress}</p>
          <p className="progress-hint">
            FFmpeg 正在处理视频，这可能需要几分钟时间，请耐心等待...
          </p>
        </div>
      )}

      {error && (
        <div className="error-box">
          <h4>❌ 合成失败</h4>
          <p>{error}</p>
          <button className="btn-retry" onClick={handleMerge}>
            🔄 重试
          </button>
        </div>
      )}

      {mergeResult && (
        <div className="merge-result">
          <div className="result-header">
            <h4>✅ 合成完成！</h4>
            <p>您的视频已成功合成，包含所有音效</p>
          </div>

          <div className="result-details">
            <div className="result-item">
              <span className="result-label">文件名:</span>
              <span className="result-value">{mergeResult.mergedVideo?.filename}</span>
            </div>
            <div className="result-item">
              <span className="result-label">合成时间:</span>
              <span className="result-value">
                {new Date(mergeResult.mergedVideo?.mergedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="result-actions">
            <a
              href={`http://localhost:4300${mergeResult.mergedVideo?.videoUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-download"
            >
              📥 下载视频
            </a>
            <a
              href={`http://localhost:4300${mergeResult.mergedVideo?.videoUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-preview"
            >
              👁️ 预览视频
            </a>
          </div>

          <div className="result-video-preview">
            <video
              src={`http://localhost:4300${mergeResult.mergedVideo?.videoUrl}`}
              controls
              className="preview-video"
            >
              您的浏览器不支持视频播放
            </video>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoMergePanel





















