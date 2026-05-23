import React, { useState, useRef, useEffect, useCallback } from 'react'
import { updateSoundEffects, mergeVideo } from '../api/soundtrackApi'
import { LiteEditorView } from './LiteEditorView'
import { AudioInspector } from './storyboard/AudioInspector'
import { GripVertical, Music, Volume2, Clock, Play, Pause, Trash2, ZoomIn, ZoomOut, Settings, Download, Eye, Sparkles, LayoutTemplate, Plus, FileAudio } from 'lucide-react'
import './IntegratedVideoEditor.css'
import { clsx } from 'clsx'

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
  startTime?: number // BGM起始时间
}

interface AssetMap {
  background_music: BackgroundMusic
  sound_effects: SoundEffect[]
  generatedAt: string
  batchFolder?: string
  outputDirectory?: string
  mergedVideo?: {
    videoPath: string
    videoUrl: string
    filename: string
    mergedAt: string
  }
}

// 分镜旁白数据
interface SceneNarration {
  id: number;
import { assetUrl } from '../config/api';
  narration: string;
  duration: number;
}

interface IntegratedVideoEditorProps {
  taskId: string
  videoUrl: string
  assetMap: AssetMap
  onUpdate: () => void
  // 从分镜页面传入的旁白数据
  sceneNarrations?: SceneNarration[];
}

export const IntegratedVideoEditor: React.FC<IntegratedVideoEditorProps> = ({
  taskId,
  videoUrl,
  assetMap,
  onUpdate,
  sceneNarrations = []
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelineScrollContainerRef = useRef<HTMLDivElement>(null)
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null)
  const effectAudiosRef = useRef<Map<number, HTMLAudioElement>>(new Map())
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const sidebarItemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [editedEffects, setEditedEffects] = useState<SoundEffect[]>([])
  const [editedBgm, setEditedBgm] = useState<BackgroundMusic | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [selectedEffect, setSelectedEffect] = useState<number | null>(null)
  
  // Timeline Zoom & Layout State
  const [containerWidth, setContainerWidth] = useState(0)
  const [pxPerSec, setPxPerSec] = useState(20)
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [isDraggingBgmEdge, setIsDraggingBgmEdge] = useState<'left' | 'right' | null>(null)
  const [isDraggingBgm, setIsDraggingBgm] = useState(false)
  const [playingPreviewIndex, setPlayingPreviewIndex] = useState<number | null>(null)
  
  // Layout State
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(300)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)

  // Initialize container width
  useEffect(() => {
    const updateWidth = () => {
      if (timelineScrollContainerRef.current) {
        setContainerWidth(timelineScrollContainerRef.current.clientWidth)
      }
    }
    
    updateWidth()
    window.addEventListener('resize', updateWidth)
    
    const observer = new ResizeObserver(updateWidth)
    if (timelineScrollContainerRef.current) {
      observer.observe(timelineScrollContainerRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateWidth)
      observer.disconnect()
    }
  }, [])

  // Auto-fit zoom initially
  useEffect(() => {
    if (duration > 0 && containerWidth > 0) {
      const minPps = containerWidth / duration
      setPxPerSec(Math.max(20, minPps)) 
    }
  }, [duration, containerWidth])

  // Scroll sidebar item into view when selected
  useEffect(() => {
    if (selectedEffect !== null) {
      const el = sidebarItemRefs.current.get(selectedEffect)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [selectedEffect])

  // Prevent default browser zoom on Ctrl+Wheel
  useEffect(() => {
    const container = timelineScrollContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
        const minPps = duration > 0 ? containerWidth / duration : 1
        const maxPps = 200
        
        setPxPerSec(prev => {
          const next = prev * zoomFactor
          return Math.max(minPps, Math.min(next, maxPps))
        })
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [duration, containerWidth])

  // Resize Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        setLeftSidebarWidth(Math.max(200, Math.min(e.clientX, 500)));
      }
      if (isResizingRight) {
        setRightSidebarWidth(Math.max(250, Math.min(window.innerWidth - e.clientX, 500)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      document.body.style.cursor = 'default';
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  useEffect(() => {
    if (assetMap) {
      setEditedEffects([...assetMap.sound_effects])
      const bgm = assetMap.background_music ? { 
        ...assetMap.background_music, 
        startTime: 0 
      } : null
      setEditedBgm(bgm)
      if (bgm) {
        setDuration(Math.max(bgm.startTime + bgm.duration, videoRef.current?.duration || 0))
      }
    }
  }, [assetMap])

  // Audio Initialization
  useEffect(() => {
    if (editedBgm && !bgmAudioRef.current) {
      const bgmAudio = new Audio(assetUrl(editedBgm.file_url))
      bgmAudio.loop = false
      bgmAudio.volume = editedBgm.volume
      bgmAudioRef.current = bgmAudio
    }

    editedEffects.forEach((effect, index) => {
      if (!effectAudiosRef.current.has(index)) {
        const audio = new Audio(assetUrl(effect.file_url))
        audio.volume = effect.volume
        effectAudiosRef.current.set(index, audio)
      }
    })

    return () => {
      if (bgmAudioRef.current) bgmAudioRef.current.pause()
      effectAudiosRef.current.forEach(audio => audio.pause())
    }
  }, [editedBgm, editedEffects])

  // Video Time Update & Audio Sync
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      const currentVideoTime = video.currentTime
      setCurrentTime(currentVideoTime)

      if (editedBgm && bgmAudioRef.current) {
        const bgmStartTime = editedBgm.startTime || 0
        const bgmEndTime = bgmStartTime + editedBgm.duration
        
        if (currentVideoTime >= bgmStartTime && currentVideoTime < bgmEndTime) {
          const bgmCurrentTime = currentVideoTime - bgmStartTime
          if (bgmAudioRef.current.paused && isPlaying) {
            bgmAudioRef.current.currentTime = bgmCurrentTime
            bgmAudioRef.current.play().catch(() => {})
          }
          bgmAudioRef.current.volume = editedBgm.volume
        } else {
          if (!bgmAudioRef.current.paused) bgmAudioRef.current.pause()
        }
      }

      editedEffects.forEach((effect, index) => {
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
    }

    const handleLoadedMetadata = () => {
      const videoDuration = video.duration
      const maxDuration = editedBgm 
        ? Math.max(videoDuration, (editedBgm.startTime || 0) + editedBgm.duration)
        : videoDuration
      setDuration(maxDuration)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => {
      setIsPlaying(false)
      if (bgmAudioRef.current) bgmAudioRef.current.pause()
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
  }, [editedBgm, editedEffects, isPlaying])

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
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.pause()
    else video.play()
  }

  const handleSeek = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current
    if (!timeline) return
    const rect = timeline.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickedTime = (x / rect.width) * duration
    handleSeek(clickedTime)
  }

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains('playhead') || 
        (e.target as HTMLElement).classList.contains('bgm-resize-handle')) {
      return
    }
    setIsDraggingTimeline(true)
    handleTimelineClick(e)
  }

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingTimeline || isDraggingPlayhead || isDraggingBgmEdge || isDraggingBgm) {
      const timeline = timelineRef.current
      if (!timeline) return
      
      const rect = timeline.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const newTime = (x / rect.width) * duration

      if (isDraggingTimeline || isDraggingPlayhead) {
        handleSeek(newTime)
      } else if (isDraggingBgmEdge && editedBgm) {
        if (isDraggingBgmEdge === 'right') {
          const bgmStartTime = editedBgm.startTime || 0
          const newDuration = Math.max(1, newTime - bgmStartTime)
          setEditedBgm({ ...editedBgm, duration: newDuration })
          setHasChanges(true)
        } else if (isDraggingBgmEdge === 'left') {
          const bgmEndTime = (editedBgm.startTime || 0) + editedBgm.duration
          const newStartTime = Math.max(0, Math.min(newTime, bgmEndTime - 1))
          const newDuration = bgmEndTime - newStartTime
          setEditedBgm({ ...editedBgm, startTime: newStartTime, duration: newDuration })
          setHasChanges(true)
        }
      } else if (isDraggingBgm && editedBgm) {
        const maxStartTime = duration - editedBgm.duration
        setEditedBgm({ ...editedBgm, startTime: Math.max(0, Math.min(newTime, maxStartTime)) })
        setHasChanges(true)
      }
    }
  }

  const handleTimelineMouseUp = () => {
    setIsDraggingTimeline(false)
    setIsDraggingPlayhead(false)
    setIsDraggingBgmEdge(null)
    setIsDraggingBgm(false)
  }

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDraggingPlayhead(true)
  }

  const handleBgmEdgeMouseDown = (edge: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDraggingBgmEdge(edge)
  }

  // Global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingTimeline(false)
      setIsDraggingPlayhead(false)
      setIsDraggingBgmEdge(null)
      setIsDraggingBgm(false)
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead || isDraggingBgmEdge || isDraggingBgm) {
        const timeline = timelineRef.current
        if (!timeline) return
        
        const rect = timeline.getBoundingClientRect()
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
        const newTime = (x / rect.width) * duration

        if (isDraggingPlayhead) {
          handleSeek(newTime)
        } else if (isDraggingBgmEdge && editedBgm) {
          // ... (same as in handleTimelineMouseMove)
          if (isDraggingBgmEdge === 'right') {
            const bgmStartTime = editedBgm.startTime || 0
            const newDuration = Math.max(1, newTime - bgmStartTime)
            setEditedBgm({ ...editedBgm, duration: newDuration })
            setHasChanges(true)
          } else if (isDraggingBgmEdge === 'left') {
            const bgmEndTime = (editedBgm.startTime || 0) + editedBgm.duration
            const newStartTime = Math.max(0, Math.min(newTime, bgmEndTime - 1))
            const newDuration = bgmEndTime - newStartTime
            setEditedBgm({ ...editedBgm, startTime: newStartTime, duration: newDuration })
            setHasChanges(true)
          }
        } else if (isDraggingBgm && editedBgm) {
          const maxStartTime = duration - editedBgm.duration
          setEditedBgm({ ...editedBgm, startTime: Math.max(0, Math.min(newTime, maxStartTime)) })
          setHasChanges(true)
        }
      }
    }

    if (isDraggingTimeline || isDraggingPlayhead || isDraggingBgmEdge || isDraggingBgm) {
      document.addEventListener('mouseup', handleGlobalMouseUp)
      document.addEventListener('mousemove', handleGlobalMouseMove)
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [isDraggingTimeline, isDraggingPlayhead, isDraggingBgmEdge, isDraggingBgm, duration, editedBgm])

  const handleEffectDragStart = (index: number, e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('effectIndex', index.toString())
    setSelectedEffect(index)
  }

  const handleEffectMouseDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEffect(index)
    
    // Auto-seek to effect start when clicked
    const effect = editedEffects[index]
    if (effect) {
      const effectTime = timestampToSeconds(effect.timestamp)
      handleSeek(effectTime)
      
      // Scroll timeline to center the effect
      if (timelineScrollContainerRef.current) {
        const effectPosition = effectTime * pxPerSec
        const containerWidth = timelineScrollContainerRef.current.clientWidth
        const scrollPosition = effectPosition - containerWidth / 2
        timelineScrollContainerRef.current.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'smooth'
        })
      }
    }
  }

  const handleEffectDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const timeline = timelineRef.current
    if (!timeline) return

    const effectIndex = parseInt(e.dataTransfer.getData('effectIndex'))
    const rect = timeline.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newTime = Math.max(0, Math.min((x / rect.width) * duration, duration))

    const updated = [...editedEffects]
    updated[effectIndex] = {
      ...updated[effectIndex],
      timestamp: secondsToTimestamp(newTime)
    }
    setEditedEffects(updated)
    setHasChanges(true)
    setSelectedEffect(null)
  }

  const handleVolumeChange = (index: number, newVolume: number) => {
    const updated = [...editedEffects]
    updated[index] = { ...updated[index], volume: newVolume }
    setEditedEffects(updated)
    setHasChanges(true)
  }

  const handleBgmVolumeChange = (newVolume: number) => {
    if (editedBgm) {
      setEditedBgm({ ...editedBgm, volume: newVolume })
      setHasChanges(true)
    }
  }

  const handleBgmDurationChange = (newDuration: number) => {
    if (editedBgm) {
      setEditedBgm({ ...editedBgm, duration: Math.max(1, Math.min(newDuration, duration)) })
      setHasChanges(true)
    }
  }

  const handleBgmStartTimeChange = (newStartTime: number) => {
    if (editedBgm) {
      const maxStartTime = duration - editedBgm.duration
      setEditedBgm({ ...editedBgm, startTime: Math.max(0, Math.min(newStartTime, maxStartTime)) })
      setHasChanges(true)
    }
  }

  const handleBgmDragStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDraggingBgm(true)
  }

  const handleDeleteEffect = (index: number) => {
    const updated = editedEffects.filter((_, i) => i !== index)
    setEditedEffects(updated)
    setHasChanges(true)
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      await updateSoundEffects(taskId, {
        sound_effects: editedEffects,
        background_music: editedBgm
      })
      setHasChanges(false)
      alert('配置已保存！')
      onUpdate()
    } catch (error: any) {
      console.error('保存失败:', error)
      alert(`保存失败: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleMergeVideo = async () => {
    if (!confirm('确定要合成视频吗？这可能需要几分钟时间。')) return
    setIsMerging(true)
    try {
      const result = await mergeVideo(taskId)
      if (result.success) {
        alert('视频合成完成！')
        onUpdate()
      }
    } catch (error: any) {
      console.error('合成失败:', error)
      alert(`合成失败: ${error.message}`)
    } finally {
      setIsMerging(false)
    }
  }

  const togglePreviewAudio = (url: string, index: number, volume: number) => {
    if (playingPreviewIndex === index && previewAudioRef.current) {
      previewAudioRef.current.pause()
      setPlayingPreviewIndex(null)
      previewAudioRef.current = null
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
      const audio = new Audio(assetUrl(url))
      audio.volume = volume
      audio.play().catch(() => {})
      previewAudioRef.current = audio
      setPlayingPreviewIndex(index)
      audio.onended = () => {
        setPlayingPreviewIndex(null)
        previewAudioRef.current = null
      }
    }
  }

  useEffect(() => {
    if (previewAudioRef.current && playingPreviewIndex !== null) {
      if (playingPreviewIndex === -1 && editedBgm) {
        previewAudioRef.current.volume = editedBgm.volume
      } else if (playingPreviewIndex >= 0 && editedEffects[playingPreviewIndex]) {
        previewAudioRef.current.volume = editedEffects[playingPreviewIndex].volume
      }
    }
  }, [editedBgm?.volume, editedEffects, playingPreviewIndex])

  // Zoom controls
  const handleZoomIn = () => {
    setPxPerSec(prev => Math.min(prev * 1.2, 200))
  }

  const handleZoomOut = () => {
    const minPps = duration > 0 ? containerWidth / duration : 1
    setPxPerSec(prev => Math.max(prev * 0.8, minPps))
  }

  const timelineTotalWidth = duration * pxPerSec

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden font-sans">
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <div style={{ width: leftSidebarWidth }} className="relative flex-shrink-0 bg-background border-r border-border flex flex-col">
          <div className="p-4 border-b border-border/50">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Music size={14} className="text-primary" />
              音频素材
            </h2>
            <div className="text-[10px] text-muted-foreground mt-1">
              Background Music & Sound Effects
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {editedBgm && (
                <div className="bg-card border border-primary/20 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                      <Music size={12} /> BGM
                    </span>
                    <button 
                      onClick={() => togglePreviewAudio(editedBgm.file_url, -1, editedBgm.volume)}
                      className={clsx("p-1.5 rounded-full transition-colors", playingPreviewIndex === -1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                    >
                      {playingPreviewIndex === -1 ? <Pause size={10} /> : <Play size={10} />}
                    </button>
                  </div>
                  <div className="space-y-1">
                     <p className="text-xs font-medium truncate" title={editedBgm.mood}>{editedBgm.mood} · {editedBgm.genre}</p>
                     <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                       <Clock size={10} /> {formatTime(editedBgm.duration)}
                     </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                     <Volume2 size={12} className="text-muted-foreground" />
                     <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={editedBgm.volume}
                        onChange={(e) => handleBgmVolumeChange(parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                  </div>
                </div>
             )}

             <div className="space-y-2">
               <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                  <span>音效 ({editedEffects.length})</span>
                  <Plus size={12} className="cursor-pointer hover:text-primary" />
               </div>
               
               {editedEffects.map((effect, index) => (
                 <div 
                    key={index}
                    ref={(el) => {
                      if (el) sidebarItemRefs.current.set(index, el);
                      else sidebarItemRefs.current.delete(index);
                    }}
                    className={clsx(
                      "group bg-muted/30 border border-border rounded-lg p-3 transition-all hover:bg-accent/50 hover:border-primary/30 cursor-pointer",
                      selectedEffect === index && "ring-2 ring-purple-500 border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                    )}
                    onClick={() => {
                      setSelectedEffect(index)
                      const effectTime = timestampToSeconds(effect.timestamp)
                      handleSeek(effectTime)
                      
                      // Scroll timeline to center the effect
                      if (timelineScrollContainerRef.current) {
                        const effectPosition = effectTime * pxPerSec
                        const containerWidth = timelineScrollContainerRef.current.clientWidth
                        const scrollPosition = effectPosition - containerWidth / 2
                        timelineScrollContainerRef.current.scrollTo({
                          left: Math.max(0, scrollPosition),
                          behavior: 'smooth'
                        })
                      }
                    }}
                    draggable
                    onDragStart={(e) => handleEffectDragStart(index, e)}
                 >
                    <div className="flex items-start justify-between gap-2">
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                             <span className="text-[10px] font-mono bg-muted px-1 rounded text-muted-foreground">#{index + 1}</span>
                             <span className="text-xs font-medium truncate">{effect.category}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2" title={effect.description}>{effect.description}</p>
                       </div>
                       <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePreviewAudio(effect.file_url, index, effect.volume)
                          }}
                          className={clsx("flex-shrink-0 p-1.5 rounded-full transition-colors", playingPreviewIndex === index ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-0 group-hover:opacity-100")}
                        >
                          {playingPreviewIndex === index ? <Pause size={10} /> : <Play size={10} />}
                        </button>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                       <span className="text-[10px] font-mono text-muted-foreground">{effect.timestamp}</span>
                       <button 
                         onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('确定删除此音效?')) handleDeleteEffect(index)
                         }}
                         className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <Trash2 size={12} />
                       </button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
          
          <div 
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50 flex items-center justify-center group"
            onMouseDown={() => { setIsResizingLeft(true); document.body.style.cursor = 'col-resize'; }}
          >
            <div className="w-4 h-8 rounded-full bg-border group-hover:bg-primary flex items-center justify-center -mr-2 shadow-sm transition-colors">
              <GripVertical size={10} className="text-muted-foreground group-hover:text-primary-foreground" />
            </div>
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
           <div className="flex-1 flex items-center justify-center overflow-hidden relative p-2">
              <div className="relative max-w-full max-h-full flex items-center justify-center">
                 <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain rounded-lg shadow-2xl bg-black"
                    style={{ maxHeight: '100%', maxWidth: '100%' }}
                    controls={false}
                    onClick={handlePlayPause}
                 />
                 
                 {!isPlaying && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-lg"
                      onClick={handlePlayPause}
                    >
                       <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 hover:scale-110 transition-all">
                          <Play size={36} className="text-white fill-white ml-1" />
                       </div>
                    </div>
                 )}
              </div>
           </div>
           
           <div className="h-10 border-t border-border bg-card/50 backdrop-blur flex items-center justify-between px-4 flex-shrink-0">
               <div className="flex items-center gap-4">
                  <button onClick={handlePlayPause} className="text-foreground hover:text-primary transition-colors">
                     {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <span className="text-xs font-mono text-muted-foreground">
                     {formatTime(currentTime)} <span className="text-muted-foreground/50">/</span> {formatTime(duration)}
                  </span>
               </div>
               
               <div className="flex items-center gap-2">
                  <button onClick={handleZoomOut} className="p-1.5 hover:bg-muted rounded transition-colors">
                     <ZoomOut size={16} className="text-muted-foreground hover:text-primary" />
                     <span className="sr-only">Zoom Out</span>
                  </button>
                  <span className="text-xs text-muted-foreground w-16 text-center font-mono">
                    {Math.round(pxPerSec)} px/s
                  </span>
                  <button onClick={handleZoomIn} className="p-1.5 hover:bg-muted rounded transition-colors">
                     <ZoomIn size={16} className="text-muted-foreground hover:text-primary" />
                     <span className="sr-only">Zoom In</span>
                  </button>
               </div>
           </div>

           <div className="h-56 flex-shrink-0 border-t border-border bg-background flex flex-col">
             <div className="h-7 border-b border-border/50 flex items-center justify-between px-4 bg-muted/20 flex-shrink-0">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                   <Clock size={12} /> 时间轴
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  按住 Ctrl/Cmd + 滚轮缩放
                </span>
             </div>
             
             <div 
                ref={timelineScrollContainerRef}
                className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar"
             >
                <div 
                   className="h-full relative min-w-full bg-background"
                   style={{ width: `${Math.max(containerWidth, timelineTotalWidth)}px` }}
                >
                   {/* Time Ruler */}
                   <div className="h-5 border-b border-border/50 relative bg-muted/10 select-none">
                      {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                        <div 
                          key={i} 
                          className="absolute top-0 bottom-0 border-l border-border/30 text-[9px] text-muted-foreground pl-1 pt-0.5"
                          style={{ left: `${i * pxPerSec}px` }}
                        >
                          {i % 5 === 0 && <span>{i}s</span>}
                        </div>
                      ))}
                   </div>
                   
                   {/* Playhead */}
                   <div 
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
                      style={{ left: `${currentTime * pxPerSec}px` }}
                   >
                      <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-sm border border-white/20 pointer-events-auto cursor-ew-resize playhead" onMouseDown={handlePlayheadMouseDown} />
                   </div>

                   {/* Tracks Container */}
                   <div 
                      ref={timelineRef}
                      className="absolute inset-0 top-5"
                      onMouseDown={handleTimelineMouseDown}
                      onMouseMove={handleTimelineMouseMove}
                      onMouseUp={handleTimelineMouseUp}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleEffectDrop}
                   >
                      {/* Video Track */}
                      <div className="h-10 border-b border-border/30 relative bg-muted/5 group">
                         <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono z-10 pointer-events-none">V1 Video</div>
                         <div className="absolute inset-y-1 left-0 right-0 bg-blue-500/10 border border-blue-500/20 rounded mx-1"></div>
                      </div>

                      {/* BGM Track */}
                      <div className="h-10 border-b border-border/30 relative bg-muted/5 group">
                         <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono z-10 pointer-events-none">A1 BGM</div>
                         {editedBgm && (
                            <div 
                               className="absolute top-1 bottom-1 bg-purple-500/20 border border-purple-500/40 rounded cursor-move overflow-hidden group hover:bg-purple-500/30 transition-colors"
                               style={{ 
                                  left: `${(editedBgm.startTime || 0) * pxPerSec}px`,
                                  width: `${editedBgm.duration * pxPerSec}px` 
                               }}
                               onMouseDown={handleBgmDragStart}
                            >
                               <div className="absolute left-0 top-0 bottom-0 w-2 bg-purple-500/50 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-purple-500 bgm-resize-handle" onMouseDown={(e) => handleBgmEdgeMouseDown('left', e)} />
                               <div className="absolute right-0 top-0 bottom-0 w-2 bg-purple-500/50 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-purple-500 bgm-resize-handle" onMouseDown={(e) => handleBgmEdgeMouseDown('right', e)} />
                               
                               <div className="w-full px-3 h-full flex items-center justify-between text-[10px] text-purple-200 select-none">
                                  <span className="truncate w-full">{editedBgm.mood}</span>
                               </div>
                            </div>
                         )}
                      </div>

                      {/* SFX Tracks */}
                      {editedEffects.map((effect, index) => {
                         const startTime = timestampToSeconds(effect.timestamp)
                         
                         return (
                            <div key={index} className="h-10 border-b border-border/30 relative bg-muted/5 group">
                               <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono z-10 pointer-events-none">A{index + 2} SFX</div>
                               <div 
                                  className={clsx(
                                     "absolute top-1 bottom-1 rounded cursor-move overflow-hidden border transition-all",
                                     selectedEffect === index 
                                        ? "bg-purple-500/30 border-purple-500 ring-2 ring-purple-500 shadow-lg shadow-purple-500/30 z-10" 
                                        : "bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30"
                                  )}
                                  style={{
                                     left: `${startTime * pxPerSec}px`,
                                     width: `${effect.duration * pxPerSec}px`
                                  }}
                                  draggable
                                  onDragStart={(e) => handleEffectDragStart(index, e)}
                                  onMouseDown={(e) => handleEffectMouseDown(index, e)}
                               >
                                  <div className="w-full px-2 h-full flex items-center text-[10px] text-amber-200 select-none truncate">
                                     {effect.category}
                                  </div>
                               </div>
                            </div>
                         )
                      })}
                      
                      {Array.from({ length: Math.max(0, 4 - editedEffects.length) }).map((_, i) => (
                         <div key={`empty-${i}`} className="h-10 border-b border-border/30 relative bg-muted/5"></div>
                      ))}
                   </div>
                </div>
             </div>
           </div>
        </div>

        {/* Right Sidebar - 智能混音控制台 */}
        <div style={{ width: rightSidebarWidth }} className="relative flex-shrink-0 bg-background border-l border-border flex flex-col">
           <div 
            className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50 flex items-center justify-center group"
            onMouseDown={() => { setIsResizingRight(true); document.body.style.cursor = 'col-resize'; }}
          >
            <div className="w-4 h-8 rounded-full bg-border group-hover:bg-primary flex items-center justify-center -ml-2 shadow-sm transition-colors">
              <GripVertical size={10} className="text-muted-foreground group-hover:text-primary-foreground" />
            </div>
          </div>

          {/* Header */}
          <div className="p-4 border-b border-border/50">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Volume2 size={14} className="text-purple-500" />
              {selectedEffect !== null ? '对象编辑模式' : '智能混音控制台'}
            </h2>
            <div className="text-[10px] text-muted-foreground mt-1">
              {selectedEffect !== null 
                ? `编辑音效 #${selectedEffect + 1}`
                : '未选中音频块 - 显示全局设置'}
            </div>
            
            {/* 分镜旁白数据统计 */}
            {sceneNarrations.length > 0 && (
              <div className="mt-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] text-purple-600 dark:text-purple-400 font-medium">📝 分镜旁白已加载</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {sceneNarrations.filter(s => s.narration && s.narration.trim()).length}
                    </div>
                    <div className="text-[8px] text-muted-foreground">分镜</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {sceneNarrations.reduce((sum, s) => sum + (s.narration?.length || 0), 0)}
                    </div>
                    <div className="text-[8px] text-muted-foreground">字数</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {sceneNarrations.reduce((sum, s) => sum + s.duration, 0).toFixed(0)}s
                    </div>
                    <div className="text-[8px] text-muted-foreground">时长</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {selectedEffect === null ? (
              /* ========== 全局混音模式 ========== */
              <>
                {/* AI 配音生成 - 使用 AudioInspector 组件 */}
                {sceneNarrations.length > 0 && (
                  <>
                    <AudioInspector
                      sceneNarrations={sceneNarrations}
                      onGenerateVoiceover={(actorId, speed, emotion) => {
                        console.log('🎤 生成配音:', { actorId, speed, emotion });
                        // TODO: 处理生成的配音，添加到时间轴
                      }}
                    />
                    
                    {/* 分割线 */}
                    <div className="border-t border-border/50" />
                  </>
                )}
                
                {/* 音量平衡 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <Volume2 size={14} className="text-blue-500" />
                    音量平衡 (Balance)
                  </div>

                  {/* BGM 推子 */}
                  {editedBgm && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Music size={12} className="text-purple-400" />
                          <span className="text-[10px] text-muted-foreground">BGM</span>
                        </div>
                        <span className="text-[10px] font-mono text-foreground">
                          {Math.round(editedBgm.volume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={editedBgm.volume}
                        onChange={(e) => {
                          const newVolume = parseFloat(e.target.value)
                          setEditedBgm(editedBgm ? { ...editedBgm, volume: newVolume } : null)
                          setHasChanges(true)
                        }}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>
                  )}

                  {/* SFX 全局音量提示 */}
                  <div className="p-3 bg-muted/30 border border-border/50 rounded-lg">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <FileAudio size={12} className="text-yellow-400" />
                      <span>SFX 音效 ({editedEffects.length}个)</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      💡 点击左侧列表中的音效或时间轴上的音频块，可在右侧面板精细调整单个音效的音量、位置等参数
                    </p>
                  </div>
                </div>

                {/* 分割线 */}
                <div className="border-t border-border/50" />

                {/* 操作区域 */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">操作</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={handleSaveChanges}
                      disabled={!hasChanges || isSaving}
                      className="flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? <Sparkles size={14} className="animate-spin" /> : <Settings size={14} />}
                      {isSaving ? '保存中...' : '保存更改'}
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      disabled={!hasChanges}
                      className="flex items-center justify-center gap-2 py-2.5 bg-muted text-foreground rounded-lg font-medium text-xs hover:bg-muted/80 disabled:opacity-50 transition-colors"
                    >
                      重置
                    </button>
                  </div>
                </div>

                {/* 导出设置 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <Download size={14} className="text-green-500" />
                    导出设置 (Export)
                  </div>

                  <button 
                    onClick={handleMergeVideo}
                    disabled={isMerging || hasChanges}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-bold text-sm hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isMerging ? <Sparkles size={14} className="animate-spin" /> : <LayoutTemplate size={14} />}
                    {isMerging ? '合成中...' : '合成并导出'}
                  </button>
                  {hasChanges && <p className="text-[10px] text-amber-500 text-center">⚠️ 请先保存更改才能合成</p>}
                </div>

                {/* 合成完成提示 */}
                {assetMap.mergedVideo && (
                  <div className="space-y-3 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-right-4">
                    <div className="text-xs font-semibold text-green-500 uppercase flex items-center gap-2">
                      <Sparkles size={12} /> 合成完成
                    </div>
                    <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
                      <div className="text-xs space-y-1">
                        <p className="font-medium truncate" title={assetMap.mergedVideo.filename}>{assetMap.mergedVideo.filename}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(assetMap.mergedVideo.mergedAt).toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={assetUrl(assetMap.mergedVideo.videoUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2 bg-card border border-border hover:bg-accent text-foreground rounded-md text-xs transition-colors"
                        >
                          <Eye size={12} /> 预览
                        </a>
                        <a
                          href={assetUrl(assetMap.mergedVideo.videoUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-md text-xs transition-colors"
                          download
                        >
                          <Download size={12} /> 下载
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ========== 对象编辑模式 (选中音效时) ========== */
              <>
                {selectedEffect < editedEffects.length && (() => {
                  const effect = editedEffects[selectedEffect]
                  const effectStartTime = timestampToSeconds(effect.timestamp)

                  return (
                    <>
                      {/* 音效信息卡片 */}
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <FileAudio size={14} className="text-yellow-500" />
                          <span className="text-xs font-semibold text-yellow-500">
                            编辑音效 #{selectedEffect + 1}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {effect.category} · {effect.description}
                        </div>
                      </div>

                      {/* 定位微调 */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">
                          定位微调
                        </div>
                        <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-2">
                          <label className="text-[10px] text-muted-foreground">
                            触发时间 (秒)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={duration}
                            step="0.1"
                            value={effectStartTime.toFixed(3)}
                            onChange={(e) => {
                              const newTime = parseFloat(e.target.value)
                              if (!isNaN(newTime) && newTime >= 0) {
                                const newTimestamp = secondsToTimestamp(newTime)
                                const updated = [...editedEffects]
                                updated[selectedEffect] = { ...effect, timestamp: newTimestamp }
                                setEditedEffects(updated)
                                setHasChanges(true)
                              }
                            }}
                            className="w-full px-3 py-2 bg-background border border-border rounded-md text-xs font-mono text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            placeholder="00:05.100"
                          />
                          <div className="text-[9px] text-muted-foreground">
                            💡 提示：精确到毫秒级，可手动输入时间
                          </div>
                        </div>
                      </div>

                      {/* 音量控制 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">音量</span>
                          <span className="text-[10px] font-mono text-foreground">
                            {Math.round(effect.volume * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={effect.volume}
                          onChange={(e) => {
                            const newVolume = parseFloat(e.target.value)
                            const updated = [...editedEffects]
                            updated[selectedEffect] = { ...effect, volume: newVolume }
                            setEditedEffects(updated)
                            setHasChanges(true)
                          }}
                          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                      </div>

                      {/* 时长信息 */}
                      <div className="p-3 bg-muted/30 border border-border rounded-lg">
                        <div className="text-[10px] text-muted-foreground space-y-1">
                          <div className="flex justify-between">
                            <span>时长:</span>
                            <span className="font-mono">{effect.duration.toFixed(1)}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>结束时间:</span>
                            <span className="font-mono">{(effectStartTime + effect.duration).toFixed(1)}s</span>
                          </div>
                        </div>
                      </div>

                      {/* 返回全局视图按钮 */}
                      <button
                        onClick={() => setSelectedEffect(null)}
                        className="w-full py-2 bg-muted text-foreground rounded-lg font-medium text-xs hover:bg-muted/80 transition-colors border border-border"
                      >
                        ← 返回全局混音
                      </button>
                    </>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default IntegratedVideoEditor
