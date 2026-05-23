import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { getProject } from '../api/projectApi'
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  Scissors, Layers, Download, Video,
  ArrowLeft,
} from 'lucide-react'
import { motion } from 'framer-motion'
import './EditorPage.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface SceneData {
  id: number
  imageUrl?: string
  videoUrl?: string
  assetUrl?: string
  narration?: string
  duration?: number | string
  description?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EditorPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const projectId =
    searchParams.get('projectId') ||
    (location.state as any)?.projectId ||
    null

  // ── Video ──────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [volume, setVolume] = useState(0.75)

  // ── Project data ───────────────────────────────────────────────────────────
  const [scenes, setScenes] = useState<SceneData[]>([])
  const [roughCutVideoUrl, setRoughCutVideoUrl] = useState('')

  // ── Load project ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      try {
        const result = await getProject(projectId)
        if (!result.success || !result.data) return
        const project = result.data
        if (project.roughCutVideoUrl) setRoughCutVideoUrl(project.roughCutVideoUrl)
        const raw = project.storyboardData ?? project.storyboard
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        const arr: SceneData[] = Array.isArray(parsed) ? parsed : (parsed?.scenes ?? [])
        setScenes(arr)
      } catch (e) {
        console.error('加载项目失败', e)
      }
    }
    load()
  }, [projectId])

  // ── Video handlers ────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) v.pause(); else v.play()
    setIsPlaying(!isPlaying)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) videoRef.current.volume = val
  }

  // ── Timeline helpers ──────────────────────────────────────────────────────
  const playheadPx = totalDuration > 0
    ? (currentTime / totalDuration) * Math.max(1200, scenes.length * 120)
    : 120

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="nm-flow-page nm-video-editor-page flex flex-col h-full w-full bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 overflow-hidden font-sans">

      {/* Sub-toolbar */}
      <div className="nm-workbench-toolbar h-11 border-b border-neutral-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md flex items-center px-4 gap-3 shrink-0 z-10">
        <button
          onClick={() => projectId ? navigate(`/storyboard?projectId=${projectId}`) : navigate('/storyboard')}
          className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors text-xs font-mono tracking-wider"
        >
          <ArrowLeft size={14} />
          STORYBOARD
        </button>
      </div>

      {/* ── Video Player ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden border-b border-neutral-200 dark:border-white/[0.05]">
        <div className="nm-video-stage flex-1 relative flex items-center justify-center p-6 bg-neutral-100/30 dark:bg-transparent">
          <div className="nm-video-player-frame w-full max-w-3xl aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-neutral-200 dark:border-white/10">
            {roughCutVideoUrl || (scenes[0]?.videoUrl || scenes[0]?.assetUrl) ? (
              <video
                ref={videoRef}
                src={roughCutVideoUrl || scenes[0]?.videoUrl || scenes[0]?.assetUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime) }}
                onLoadedMetadata={() => { if (videoRef.current) setTotalDuration(videoRef.current.duration) }}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white/20 text-sm">暂无视频</span>
              </div>
            )}
            {/* Controls overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/50 to-transparent pt-16 pb-5 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <button className="text-neutral-400 hover:text-white transition-colors"><SkipBack size={18} /></button>
                  <button
                    onClick={handlePlayPause}
                    className="w-11 h-11 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform shadow-lg"
                  >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <button className="text-neutral-400 hover:text-white transition-colors"><SkipForward size={18} /></button>
                  <span className="text-neutral-300 font-mono text-sm">{fmt(currentTime)} / {fmt(totalDuration)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Volume2 size={17} className="text-neutral-400" />
                  <input type="range" min="0" max="1" step="0.05" value={volume} onChange={handleVolumeChange} className="w-20 h-1.5 accent-white cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Timeline ──────────────────────────────────────────────── */}
      <div className="nm-video-timeline h-72 bg-white dark:bg-neutral-900 flex flex-col shrink-0">

        {/* Toolbar */}
        <div className="nm-video-timeline-toolbar h-11 border-b border-neutral-200 dark:border-white/[0.05] flex items-center justify-between px-4 bg-neutral-50 dark:bg-neutral-950 shrink-0">
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md transition-colors"><Scissors size={14} /></button>
            <button className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md transition-colors"><Layers size={14} /></button>
          </div>
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(34,211,238,0.3)' }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-5 py-2 rounded-lg text-xs font-medium shadow-lg shadow-cyan-500/20 border border-white/10"
          >
            <Download size={14} />
            Export Final Video
          </motion.button>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-hidden flex">

          {/* Track headers */}
          <div className="nm-video-track-headers w-48 shrink-0 border-r border-neutral-200 dark:border-white/[0.05] bg-neutral-50 dark:bg-neutral-950 flex flex-col z-20">
            <div className="h-6 border-b border-neutral-200 dark:border-white/[0.05] bg-neutral-100 dark:bg-[#0a0a0a]" />
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] flex items-center px-4 text-xs font-medium text-neutral-500 gap-2">
              <Video size={13} className="text-indigo-400" /> Video Track
            </div>
          </div>

          {/* Track content */}
          <div className="nm-video-track-content flex-1 relative overflow-x-auto bg-neutral-100 dark:bg-[#0a0a0a]">
            {/* Time ruler */}
            <div className="h-6 border-b border-neutral-200 dark:border-white/[0.05] flex items-end text-[10px] text-neutral-500 dark:text-neutral-600 font-mono sticky top-0 bg-neutral-100 dark:bg-[#0a0a0a] z-10">
              {Array.from({ length: Math.max(scenes.length + 2, 12) }).map((_, i) => (
                <div key={i} className="border-l border-neutral-300 dark:border-white/10 pl-1 pb-0.5 min-w-[120px]">
                  00:0{i}
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-cyan-400 z-20 pointer-events-none shadow-[0_0_10px_rgba(34,211,238,0.8)]"
              style={{ left: `${playheadPx}px` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rounded-sm shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            </div>

            {/* Video Track */}
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] relative flex items-center px-1">
              <div
                className="absolute left-0 h-12 bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-500/30 rounded-md overflow-hidden flex hover:border-indigo-400 transition-colors cursor-pointer"
                style={{ width: `${Math.max(scenes.length, 5) * 120}px` }}
              >
                {(scenes.length > 0 ? scenes : Array(5).fill(null)).map((s: SceneData | null, i) => (
                  <div key={i} className="relative h-full w-[120px] shrink-0 border-r border-indigo-200 dark:border-indigo-500/20 last:border-r-0 overflow-hidden">
                    {s?.imageUrl
                      ? <img src={s.imageUrl} alt={`S${i + 1}`} className="w-full h-full object-cover opacity-80 dark:opacity-60" />
                      : <div className="w-full h-full bg-indigo-200 dark:bg-indigo-800/30 flex items-center justify-center"><span className="text-[9px] font-mono text-indigo-400">S{i + 1}</span></div>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditorPage
