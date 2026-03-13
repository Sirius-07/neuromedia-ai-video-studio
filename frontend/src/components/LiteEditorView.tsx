import React, { useState, useRef, useEffect } from 'react'
import './LiteEditorView.css'

interface SoundEffect {
  timestamp: string
  prompt: string
  description: string
  category: string
  duration: number
  volume: number
  file_url: string
  file_path?: string
}

interface BackgroundMusic {
  prompt: string
  mood: string
  genre: string
  duration: number
  volume: number
  file_url: string
  file_path?: string
  startTime?: number
}

interface AudioEvent {
  id: string
  name: string
  startTime: number
  duration: number
  type: 'bgm' | 'sfx'
  volume: number
  fileUrl: string
  description?: string
  prompt?: string
}

interface LiteEditorViewProps {
  videoUrl: string
  totalDuration: number
  soundEffects: SoundEffect[]
  backgroundMusic: BackgroundMusic | null
  onEffectUpdate?: (index: number, newEffect: SoundEffect) => void
  onBgmUpdate?: (newBgm: BackgroundMusic) => void
}

export const LiteEditorView: React.FC<LiteEditorViewProps> = ({
  videoUrl,
  totalDuration,
  soundEffects,
  backgroundMusic,
  onEffectUpdate,
  onBgmUpdate
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null)
  const effectAudiosRef = useRef<Map<number, HTMLAudioElement>>(new Map())
  
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(totalDuration)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  
  // 编辑状态
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState('')
  const [editingDuration, setEditingDuration] = useState(0)
  const [regeneratingEventId, setRegeneratingEventId] = useState<string | null>(null)
  const [regenerationProgress, setRegenerationProgress] = useState<string>('')
  
  // 音频播放状态
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  
  // 拖动标记点状态
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartTime, setDragStartTime] = useState(0)
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  
  // 拖动播放头状态
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // 将音效和BGM合并为统一的事件列表
  const [audioEvents, setAudioEvents] = useState<AudioEvent[]>([])

  useEffect(() => {
    const events: AudioEvent[] = []

    // 添加BGM
    if (backgroundMusic) {
      events.push({
        id: 'bgm',
        name: `${backgroundMusic.mood} - ${backgroundMusic.genre}`,
        startTime: backgroundMusic.startTime || 0,
        duration: backgroundMusic.duration,
        type: 'bgm',
        volume: backgroundMusic.volume,
        fileUrl: backgroundMusic.file_url,
        description: `背景音乐 · ${backgroundMusic.mood}`,
        prompt: backgroundMusic.prompt
      })
    }

    // 添加音效
    soundEffects.forEach((effect, index) => {
      const startTime = timestampToSeconds(effect.timestamp)
      events.push({
        id: `sfx-${index}`,
        name: effect.category,
        startTime,
        duration: effect.duration,
        type: 'sfx',
        volume: effect.volume,
        fileUrl: effect.file_url,
        description: effect.description,
        prompt: effect.prompt
      })
    })

    // 按开始时间排序
    events.sort((a, b) => a.startTime - b.startTime)
    setAudioEvents(events)
  }, [soundEffects, backgroundMusic])

  // 初始化音频对象
  useEffect(() => {
    // 初始化BGM
    if (backgroundMusic && !bgmAudioRef.current) {
      const bgmAudio = new Audio(`http://localhost:3000${backgroundMusic.file_url}`)
      bgmAudio.loop = false
      bgmAudio.volume = backgroundMusic.volume
      bgmAudioRef.current = bgmAudio
    }

    // 初始化音效
    soundEffects.forEach((effect, index) => {
      if (!effectAudiosRef.current.has(index)) {
        const audio = new Audio(`http://localhost:3000${effect.file_url}`)
        audio.volume = effect.volume
        effectAudiosRef.current.set(index, audio)
      }
    })

    return () => {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause()
      }
      effectAudiosRef.current.forEach(audio => audio.pause())
    }
  }, [backgroundMusic, soundEffects])

  // 视频播放同步
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      const currentVideoTime = video.currentTime
      setCurrentTime(currentVideoTime)

      // 同步BGM播放
      if (backgroundMusic && bgmAudioRef.current) {
        const bgmStartTime = backgroundMusic.startTime || 0
        const bgmEndTime = bgmStartTime + backgroundMusic.duration
        
        if (currentVideoTime >= bgmStartTime && currentVideoTime < bgmEndTime) {
          const bgmCurrentTime = currentVideoTime - bgmStartTime
          if (bgmAudioRef.current.paused && isPlaying) {
            bgmAudioRef.current.currentTime = bgmCurrentTime
            bgmAudioRef.current.play().catch(() => {})
          }
          bgmAudioRef.current.volume = backgroundMusic.volume
        } else {
          if (!bgmAudioRef.current.paused) {
            bgmAudioRef.current.pause()
          }
        }
      }

      // 同步音效播放
      soundEffects.forEach((effect, index) => {
        const effectStartTime = timestampToSeconds(effect.timestamp)
        const effectEndTime = effectStartTime + effect.duration
        const audio = effectAudiosRef.current.get(index)
        
        if (audio) {
          if (currentVideoTime >= effectStartTime && currentVideoTime < effectEndTime) {
            const effectCurrentTime = currentVideoTime - effectStartTime
            if (audio.paused && isPlaying) {
              audio.currentTime = effectCurrentTime
              audio.volume = effect.volume
              audio.play().catch(() => {})
            }
          } else {
            if (!audio.paused) {
              audio.pause()
              audio.currentTime = 0
            }
          }
        }
      })

      // 移除自动更新选中状态，避免与手动点击冲突
      // 只保留 active 状态用于视觉高亮，不改变 selected 状态
      // const activeEvent = audioEvents.find(
      //   event => currentVideoTime >= event.startTime && currentVideoTime < event.startTime + event.duration
      // )
      // if (activeEvent && selectedEventId !== activeEvent.id) {
      //   setSelectedEventId(activeEvent.id)
      // }
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause()
      }
      effectAudiosRef.current.forEach(audio => audio.pause())
    }

    const handleSeeked = () => {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause()
        bgmAudioRef.current.currentTime = 0
      }
      effectAudiosRef.current.forEach(audio => {
        audio.pause()
        audio.currentTime = 0
      })
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('seeked', handleSeeked)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [backgroundMusic, soundEffects, isPlaying, audioEvents, selectedEventId])

  const timestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':')
    const hours = parseInt(parts[0])
    const minutes = parseInt(parts[1])
    const seconds = parseFloat(parts[2])
    return hours * 3600 + minutes * 60 + seconds
  }

  const secondsToTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  const handlePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const handleSeek = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
  }

  const handleMarkerClick = (event: AudioEvent) => {
    // 如果正在拖动，不触发点击
    if (draggingMarkerId) return
    
    setSelectedEventId(event.id)
    handleSeek(event.startTime)
    
    // 滚动列表到对应项
    scrollToEvent(event.id)
  }

  // 开始拖动标记点
  const handleMarkerMouseDown = (event: AudioEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    setDraggingMarkerId(event.id)
    setDragStartX(e.clientX)
    setDragStartTime(event.startTime)
  }

  // 拖动标记点
  const handleMarkerDrag = (e: MouseEvent) => {
    if (!draggingMarkerId || !timelineContainerRef.current) return
    
    const container = timelineContainerRef.current
    const rect = container.getBoundingClientRect()
    const deltaX = e.clientX - dragStartX
    const deltaTime = (deltaX / rect.width) * duration
    const newTime = Math.max(0, Math.min(dragStartTime + deltaTime, duration - 0.5))
    
    // 找到对应的音效并临时更新位置（视觉反馈）
    const event = audioEvents.find(ev => ev.id === draggingMarkerId)
    if (event) {
      event.startTime = newTime
    }
  }

  // 结束拖动标记点
  const handleMarkerMouseUp = () => {
    if (!draggingMarkerId) return
    
    const event = audioEvents.find(ev => ev.id === draggingMarkerId)
    if (event) {
      if (event.type === 'sfx' && onEffectUpdate) {
        // 找到音效索引
        const effectIndex = soundEffects.findIndex((_, idx) => `sfx-${idx}` === event.id)
        if (effectIndex !== -1) {
          // 转换为时间戳格式
          const newTimestamp = secondsToTimestamp(event.startTime)
          const updatedEffect = {
            ...soundEffects[effectIndex],
            timestamp: newTimestamp
          }
          onEffectUpdate(effectIndex, updatedEffect)
        }
      } else if (event.type === 'bgm' && backgroundMusic && onBgmUpdate) {
        // 更新 BGM 的 startTime
        const updatedBgm = {
          ...backgroundMusic,
          startTime: event.startTime
        }
        onBgmUpdate(updatedBgm)
      }
    }
    
    setDraggingMarkerId(null)
  }

  // 监听全局鼠标移动和释放
  useEffect(() => {
    if (draggingMarkerId) {
      document.addEventListener('mousemove', handleMarkerDrag)
      document.addEventListener('mouseup', handleMarkerMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMarkerDrag)
        document.removeEventListener('mouseup', handleMarkerMouseUp)
      }
    }
  }, [draggingMarkerId, dragStartX, dragStartTime, duration, audioEvents])

  const handleMarkerHover = (event: AudioEvent | null, e?: React.MouseEvent) => {
    if (event && e) {
      setHoveredEventId(event.id)
      setTooltipPosition({ x: e.clientX, y: e.clientY })
    } else {
      setHoveredEventId(null)
    }
  }

  const scrollToEvent = (eventId: string) => {
    const listElement = listRef.current
    if (!listElement) return

    const eventElement = listElement.querySelector(`[data-event-id="${eventId}"]`)
    if (eventElement) {
      eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleEventCardClick = (event: AudioEvent) => {
    // 如果正在编辑，不触发跳转
    if (editingEventId === event.id) return
    
    setSelectedEventId(event.id)
    handleSeek(event.startTime)
  }

  // 开始编辑音效
  const handleStartEdit = (event: AudioEvent) => {
    setEditingEventId(event.id)
    setEditingPrompt(event.prompt || '')
    setEditingDuration(event.duration)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingEventId(null)
    setEditingPrompt('')
    setEditingDuration(0)
  }

  // 单独播放音效
  const handlePlayAudio = (event: AudioEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // 如果正在播放同一个音效，则暂停
    if (playingAudioId === event.id && previewAudioRef.current) {
      previewAudioRef.current.pause()
      setPlayingAudioId(null)
      previewAudioRef.current = null
      return
    }
    
    // 停止之前的播放
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }
    
    // 开始新的播放
    const audio = new Audio(`http://localhost:3000${event.fileUrl}`)
    audio.volume = event.volume
    audio.play().catch(() => {})
    previewAudioRef.current = audio
    setPlayingAudioId(event.id)
    
    // 播放结束后清理
    audio.onended = () => {
      setPlayingAudioId(null)
      previewAudioRef.current = null
    }
  }

  // 调整音量
  const handleVolumeChange = (event: AudioEvent, newVolume: number, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    
    // 更新预览音频的音量
    if (playingAudioId === event.id && previewAudioRef.current) {
      previewAudioRef.current.volume = newVolume
    }
    
    // 更新音效或 BGM
    if (event.type === 'sfx') {
      const effectIndex = soundEffects.findIndex((_, idx) => `sfx-${idx}` === event.id)
      if (effectIndex !== -1 && onEffectUpdate) {
        const updatedEffect = {
          ...soundEffects[effectIndex],
          volume: newVolume
        }
        onEffectUpdate(effectIndex, updatedEffect)
      }
    } else if (event.type === 'bgm' && backgroundMusic && onBgmUpdate) {
      const updatedBgm = {
        ...backgroundMusic,
        volume: newVolume
      }
      onBgmUpdate(updatedBgm)
    }
  }

  // 重新生成音效或 BGM
  const handleRegenerateEffect = async (event: AudioEvent) => {

    // 验证输入
    if (!editingPrompt.trim()) {
      alert('提示词不能为空')
      return
    }

    if (editingDuration <= 0 || editingDuration > 30) {
      alert('时长必须在 0-30 秒之间')
      return
    }

    try {
      setRegeneratingEventId(event.id)
      setRegenerationProgress('正在生成音频...')

      // 调用音频生成 API
      const { quickGenerateAudio, waitForCompletion } = await import('../api/audioApi')
      
      // 创建生成任务
      setRegenerationProgress('创建生成任务...')
      const task = await quickGenerateAudio(editingPrompt, editingDuration)
      
      // 等待任务完成
      setRegenerationProgress('等待生成完成...')
      const completedTask = await waitForCompletion(
        task.taskId,
        (progressTask) => {
          if (progressTask.status === 'processing') {
            setRegenerationProgress('正在生成音频... 请稍候')
          }
        },
        2000, // 2秒轮询一次
        5 * 60 * 1000 // 5分钟超时
      )

      if (!completedTask.outputFileUrl) {
        throw new Error('生成的音频文件 URL 不存在')
      }

      setRegenerationProgress('生成成功！正在更新...')

      // 根据类型更新数据
      if (event.type === 'sfx') {
        // 找到对应的音效索引
        const effectIndex = soundEffects.findIndex(
          (_, idx) => `sfx-${idx}` === event.id
        )

        if (effectIndex === -1) {
          throw new Error('无法找到对应的音效')
        }

        // 创建更新后的音效对象
        const updatedEffect: SoundEffect = {
          ...soundEffects[effectIndex],
          prompt: editingPrompt,
          duration: editingDuration,
          file_url: completedTask.outputFileUrl,
          description: `重新生成 - ${editingPrompt}`,
        }

        // 通知父组件更新数据
        if (onEffectUpdate) {
          onEffectUpdate(effectIndex, updatedEffect)
        }

        // 重新初始化音频对象
        const audio = new Audio(`http://localhost:3000${completedTask.outputFileUrl}`)
        audio.volume = updatedEffect.volume
        effectAudiosRef.current.set(effectIndex, audio)
      } else if (event.type === 'bgm' && backgroundMusic) {
        // 更新 BGM
        const updatedBgm: BackgroundMusic = {
          ...backgroundMusic,
          prompt: editingPrompt,
          duration: editingDuration,
          file_url: completedTask.outputFileUrl,
        }

        // 通知父组件更新数据
        if (onBgmUpdate) {
          onBgmUpdate(updatedBgm)
        }

        // 重新初始化 BGM 音频对象
        const audio = new Audio(`http://localhost:3000${completedTask.outputFileUrl}`)
        audio.volume = updatedBgm.volume
        audio.loop = false
        bgmAudioRef.current = audio
      }

      // 退出编辑模式
      setEditingEventId(null)
      setRegenerationProgress(`✅ ${event.type === 'bgm' ? 'BGM' : '音效'}已更新！`)
      
      // 3秒后清除提示
      setTimeout(() => {
        setRegenerationProgress('')
      }, 3000)

      alert(`${event.type === 'bgm' ? 'BGM' : '音效'}重新生成成功！`)

    } catch (error: any) {
      console.error('重新生成音效失败:', error)
      setRegenerationProgress('')
      alert(`生成失败: ${error.message}`)
    } finally {
      setRegeneratingEventId(null)
    }
  }

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 如果正在拖动播放头，不处理点击
    if (isDraggingPlayhead) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickedTime = (x / rect.width) * duration
    handleSeek(clickedTime)
  }

  // 开始拖动播放头
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDraggingPlayhead(true)
    
    // 暂停视频播放
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
  }

  // 拖动播放头过程中
  const handlePlayheadDrag = (e: MouseEvent) => {
    if (!isDraggingPlayhead || !progressBarRef.current) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const newTime = (x / rect.width) * duration
    
    // 实时更新视频时间（这样视频画面会跟随）
    handleSeek(newTime)
  }

  // 停止拖动播放头
  const handlePlayheadMouseUp = () => {
    setIsDraggingPlayhead(false)
  }

  // 监听播放头拖动的全局事件
  useEffect(() => {
    if (isDraggingPlayhead) {
      document.addEventListener('mousemove', handlePlayheadDrag)
      document.addEventListener('mouseup', handlePlayheadMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handlePlayheadDrag)
        document.removeEventListener('mouseup', handlePlayheadMouseUp)
      }
    }
  }, [isDraggingPlayhead, duration])

  return (
    <div className="lite-editor-view">
      {/* 视频播放器 */}
      <div className="lite-video-section">
        <video
          ref={videoRef}
          src={videoUrl}
          className="lite-video"
          controls={false}
        />
        <div className="lite-video-controls">
          <button className="lite-play-btn" onClick={handlePlayPause}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <span className="lite-time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 简易时间轴 */}
      <div className="lite-timeline-section">
        <h3 className="lite-section-title">⏱️ 时间轴</h3>
        <div className="lite-timeline-container" ref={timelineContainerRef}>
          {/* 进度条 */}
          <div 
            ref={progressBarRef}
            className="lite-progress-bar"
            onClick={handleProgressBarClick}
          >
            {/* 当前播放位置指示器 */}
            <div 
              className={`lite-playhead ${isDraggingPlayhead ? 'dragging' : ''}`}
              style={{ left: `${(currentTime / duration) * 100}%` }}
              onMouseDown={handlePlayheadMouseDown}
              title="拖动预览视频"
            />
            
            {/* 音效标记点 */}
            {audioEvents.map((event) => {
              const leftPercent = (event.startTime / duration) * 100
              const isSelected = selectedEventId === event.id
              const isActive = currentTime >= event.startTime && currentTime < event.startTime + event.duration
              const isDragging = draggingMarkerId === event.id

              return (
                <div
                  key={event.id}
                  className={`lite-marker ${event.type} ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} draggable`}
                  style={{ 
                    left: `${leftPercent}%`,
                    cursor: 'move'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMarkerClick(event)
                  }}
                  onMouseDown={(e) => handleMarkerMouseDown(event, e)}
                  onMouseEnter={(e) => handleMarkerHover(event, e)}
                  onMouseLeave={() => handleMarkerHover(null)}
                  title={`${event.name} (可拖动)`}
                />
              )
            })}
          </div>

          {/* 时间刻度 */}
          <div className="lite-time-scale">
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => {
              if (i % 5 === 0 || i === Math.ceil(duration)) {
                return (
                  <div 
                    key={i} 
                    className="lite-time-mark"
                    style={{ left: `${(i / duration) * 100}%` }}
                  >
                    {i}s
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>

        {/* Tooltip */}
        {hoveredEventId && (
          <div 
            className="lite-tooltip"
            style={{
              position: 'fixed',
              left: tooltipPosition.x,
              top: tooltipPosition.y - 80,
              transform: 'translateX(-50%)'
            }}
          >
            {(() => {
              const event = audioEvents.find(e => e.id === hoveredEventId)
              if (!event) return null
              return (
                <>
                  <div className="lite-tooltip-title">{event.name}</div>
                  <div className="lite-tooltip-time">
                    {formatTime(event.startTime)}
                  </div>
                  <div className="lite-tooltip-duration">
                    Duration: {event.duration}s
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* 音效列表 */}
      <div className="lite-audio-list-section">
        <h3 className="lite-section-title">🔊 音效清单 ({audioEvents.length})</h3>
        <div className="lite-audio-list" ref={listRef}>
          {audioEvents.map((event, index) => {
            const isSelected = selectedEventId === event.id
            const isActive = currentTime >= event.startTime && currentTime < event.startTime + event.duration

            return (
              <div
                key={event.id}
                data-event-id={event.id}
                className={`lite-audio-card ${event.type} ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => handleEventCardClick(event)}
              >
                <div className="lite-audio-card-header">
                  <span className="lite-audio-card-number">
                    {event.type === 'bgm' ? '🎵' : `#${index}`}
                  </span>
                  <span className={`lite-audio-card-badge ${event.type}`}>
                    {event.type === 'bgm' ? 'BGM' : 'SFX'}
                  </span>
                </div>

                <div className="lite-audio-card-content">
                  <h4 className="lite-audio-card-name">{event.name}</h4>
                  
                  <div className="lite-audio-card-time">
                    ⏰ {formatTime(event.startTime)}
                  </div>
                  
                  {/* 时长显示/编辑 */}
                  {editingEventId === event.id ? (
                    <div className="lite-audio-card-edit-field">
                      <label>⏱️ 时长 (秒):</label>
                      <input
                        type="number"
                        min="0.5"
                        max="30"
                        step="0.5"
                        value={editingDuration}
                        onChange={(e) => setEditingDuration(parseFloat(e.target.value))}
                        className="lite-duration-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="lite-audio-card-duration">
                      ⏱️ Duration: {event.duration}s
                    </div>
                  )}

                  {event.description && !editingEventId && (
                    <p className="lite-audio-card-desc">{event.description}</p>
                  )}

                  {/* 提示词显示/编辑 */}
                  {event.prompt && (
                    <div className="lite-audio-card-prompt">
                      <span className="lite-prompt-label">💡</span>
                      {editingEventId === event.id ? (
                        <textarea
                          value={editingPrompt}
                          onChange={(e) => setEditingPrompt(e.target.value)}
                          className="lite-prompt-input"
                          rows={3}
                          placeholder="输入音效提示词..."
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="lite-prompt-text">{event.prompt}</span>
                      )}
                    </div>
                  )}

                  {/* 音量控制 */}
                  {!editingEventId && (
                    <div className="lite-audio-card-volume-control">
                      <label>🔊 音量:</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={event.volume}
                        onChange={(e) => handleVolumeChange(event, parseFloat(e.target.value), e)}
                        className="lite-volume-slider"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="lite-volume-value">{Math.round(event.volume * 100)}%</span>
                    </div>
                  )}

                  {/* 播放控制 */}
                  {!editingEventId && (
                    <div className="lite-audio-card-play-control">
                      <button
                        className={`lite-play-audio-btn ${playingAudioId === event.id ? 'playing' : ''}`}
                        onClick={(e) => handlePlayAudio(event, e)}
                      >
                        {playingAudioId === event.id ? '⏸️ 暂停' : '▶️ 播放音效'}
                      </button>
                    </div>
                  )}

                  {/* 编辑/生成操作按钮 */}
                  {(
                    <div className="lite-audio-card-actions">
                      {editingEventId === event.id ? (
                        <>
                          <button
                            className="lite-btn lite-btn-cancel"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancelEdit()
                            }}
                            disabled={regeneratingEventId === event.id}
                          >
                            ✖️ 取消
                          </button>
                          <button
                            className="lite-btn lite-btn-regenerate"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRegenerateEffect(event)
                            }}
                            disabled={regeneratingEventId === event.id}
                          >
                            {regeneratingEventId === event.id ? '⏳ 生成中...' : '🔄 重新生成'}
                          </button>
                        </>
                      ) : (
                        <button
                          className="lite-btn lite-btn-edit"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(event)
                          }}
                        >
                          ✏️ 编辑
                        </button>
                      )}
                    </div>
                  )}

                  {/* 生成进度提示 */}
                  {regeneratingEventId === event.id && regenerationProgress && (
                    <div className="lite-regeneration-progress">
                      {regenerationProgress}
                    </div>
                  )}
                </div>

                {isActive && (
                  <div className="lite-audio-card-playing-indicator">
                    <span className="lite-playing-pulse">●</span>
                    Playing
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default LiteEditorView

