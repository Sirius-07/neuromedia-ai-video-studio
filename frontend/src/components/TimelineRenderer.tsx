import React, { useEffect, useState } from 'react'
import { convertTimestampToSeconds, formatDuration } from '../utils/timeUtils'
import './TimelineRenderer.css'

/**
 * 轨道片段接口
 */
export interface TrackClip {
  trackId: string       // 轨道ID（例如：'V1', 'A1', 'A2'）
  fileUrl: string       // 音频文件URL
  startTime: number     // 开始时间（秒）
  duration: number      // 时长（秒）
  type: 'video' | 'bgm' | 'sfx'  // 类型
  label: string         // 显示标签
  volume?: number       // 音量（0-1）
}

interface TimelineRendererProps {
  assetMap: any  // 最终资产地图
}

/**
 * TimelineRenderer - 时间轴渲染组件
 * 
 * 根据 finalAssetMap 自动生成轨道片段并渲染到时间轴
 */
export const TimelineRenderer: React.FC<TimelineRendererProps> = ({ assetMap }) => {
  const [trackClips, setTrackClips] = useState<TrackClip[]>([])
  const [totalDuration, setTotalDuration] = useState(0)

  useEffect(() => {
    if (!assetMap) {
      return
    }

    console.log('📊 处理 assetMap，生成轨道片段...', assetMap)

    const clips: TrackClip[] = []

    // 1️⃣ 添加视频轨道（V1）- 占位符
    // 在实际应用中，这里会是真实的视频文件
    clips.push({
      trackId: 'V1',
      fileUrl: '', // 视频文件URL（这里为空，因为我们只处理音频）
      startTime: 0,
      duration: assetMap.totalDuration || 60,
      type: 'video',
      label: `视频主轨道 (${assetMap.videoId})`,
      volume: 1.0
    })

    // 2️⃣ 添加背景音乐轨道（A1）
    if (assetMap.background_music) {
      const bgm = assetMap.background_music
      const startTime = bgm.startTime 
        ? convertTimestampToSeconds(bgm.startTime) 
        : 0

      clips.push({
        trackId: 'A1',
        fileUrl: bgm.file_url,
        startTime: startTime,
        duration: bgm.duration,
        type: 'bgm',
        label: `BGM: ${bgm.prompt}`,
        volume: bgm.volume || 0.6
      })

      console.log(`🎵 添加 BGM 到轨道 A1: ${bgm.file_url} (开始: ${startTime}s, 时长: ${bgm.duration}s)`)
    }

    // 3️⃣ 添加音效轨道（A2, A3, A4, ...）
    if (assetMap.sound_effects && Array.isArray(assetMap.sound_effects)) {
      assetMap.sound_effects.forEach((sfx: any, index: number) => {
        const startTime = convertTimestampToSeconds(sfx.timestamp)
        const trackId = `A${index + 2}` // A2, A3, A4, ...

        clips.push({
          trackId: trackId,
          fileUrl: sfx.file_url,
          startTime: startTime,
          duration: sfx.duration,
          type: 'sfx',
          label: `SFX: ${sfx.prompt}`,
          volume: sfx.volume || 0.8
        })

        console.log(`🔊 添加 SFX 到轨道 ${trackId}: ${sfx.file_url} (开始: ${startTime}s, 时长: ${sfx.duration}s)`)
      })
    }

    // 计算总时长
    const maxEndTime = Math.max(
      ...clips.map(clip => clip.startTime + clip.duration)
    )
    setTotalDuration(maxEndTime)

    // 保存轨道片段
    setTrackClips(clips)

    console.log('✅ 轨道片段生成完成:', clips)
    console.log(`📏 总时长: ${maxEndTime}秒`)

  }, [assetMap])

  if (!assetMap) {
    return (
      <div className="timeline-renderer">
        <p className="empty-message">等待资产地图数据...</p>
      </div>
    )
  }

  return (
    <div className="timeline-renderer">
      <div className="timeline-header">
        <h3>🎬 时间轴预览</h3>
        <div className="timeline-info">
          <span>总轨道数: {trackClips.length}</span>
          <span>总时长: {formatDuration(totalDuration)}</span>
        </div>
      </div>

      <div className="timeline-container">
        {/* 时间标尺 */}
        <div className="timeline-ruler">
          {Array.from({ length: Math.ceil(totalDuration / 10) + 1 }, (_, i) => (
            <div key={i} className="ruler-mark" style={{ left: `${(i * 10 / totalDuration) * 100}%` }}>
              <span>{i * 10}s</span>
            </div>
          ))}
        </div>

        {/* 轨道列表 */}
        <div className="timeline-tracks">
          {trackClips.map((clip, index) => (
            <div key={index} className="track-row">
              <div className="track-label">
                <span className={`track-badge track-${clip.type}`}>{clip.trackId}</span>
                <span className="track-name">{clip.label}</span>
              </div>
              
              <div className="track-content">
                <div 
                  className={`track-clip clip-${clip.type}`}
                  style={{
                    left: `${(clip.startTime / totalDuration) * 100}%`,
                    width: `${(clip.duration / totalDuration) * 100}%`
                  }}
                  title={`${clip.label}\n开始: ${clip.startTime.toFixed(2)}s\n时长: ${clip.duration}s\n音量: ${(clip.volume || 1) * 100}%`}
                >
                  <div className="clip-content">
                    <span className="clip-time">{clip.startTime.toFixed(2)}s</span>
                    <span className="clip-duration">{formatDuration(clip.duration)}</span>
                  </div>
                  {clip.fileUrl && (
                    <div className="clip-url" title={clip.fileUrl}>
                      🔗 {clip.fileUrl.split('/').pop()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 轨道片段详情（调试用） */}
      <details className="track-clips-details">
        <summary>📋 查看轨道片段数据（用于集成时间轴库）</summary>
        <pre>{JSON.stringify(trackClips, null, 2)}</pre>
      </details>

      {/* 集成说明 */}
      <div className="integration-guide">
        <h4>🔧 集成时间轴库指南</h4>
        <p>
          <code>trackClips</code> 数组已生成，可以用于集成以下时间轴库：
        </p>
        <ul>
          <li><strong>wavesurfer.js</strong> - 音频波形可视化</li>
          <li><strong>Tone.js</strong> - 音频播放和同步</li>
          <li><strong>React DnD</strong> - 拖拽式时间轴编辑</li>
          <li><strong>自定义Canvas</strong> - 完全自定义的时间轴渲染</li>
        </ul>
      </div>
    </div>
  )
}





