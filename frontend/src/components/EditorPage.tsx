import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { getProject } from '../api/projectApi'
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  Scissors, Layers, Download, Video, Music, Mic,
  Activity, Sparkles, Zap, RefreshCw, Plus,
  ArrowLeft, Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  voiceUrl?: string   // generated voiceover
}

interface SfxItem {
  id: string
  name: string
  startTime: number
  duration: number
  color: string
}

const VOICE_ACTORS = [
  { id: 'stable-male',       name: '央视男声', avatar: '👨' },
  { id: 'energetic-female',  name: '活力女声', avatar: '👩' },
  { id: 'narrator',          name: '沉稳旁白', avatar: '🎙️' },
  { id: 'gentle-female',     name: '温柔女声', avatar: '💁‍♀️' },
]

const MOCK_SFX: SfxItem[] = [
  { id: 'sfx-1', name: 'Whoosh_01',       startTime: 60,  duration: 100, color: 'amber' },
  { id: 'sfx-2', name: 'Drone_Flyby_Heavy', startTime: 300, duration: 140, color: 'amber' },
  { id: 'sfx-3', name: 'Impact_Sub',      startTime: 540, duration: 80,  color: 'amber' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function getSceneDuration(scene: SceneData) {
  if (!scene.duration) return 3
  const d = typeof scene.duration === 'string'
    ? parseFloat(scene.duration.replace('s', ''))
    : scene.duration
  return isNaN(d) ? 3 : d
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

  // ── Left: Audio Synthesis ─────────────────────────────────────────────────
  const [musicPrompt, setMusicPrompt] = useState('Heavy cyberpunk synthwave, 120bpm, driving bassline, atmospheric pads.')
  const [selectedMood, setSelectedMood] = useState('Dark')

  // ── Left: SFX ─────────────────────────────────────────────────────────────
  const [sfxPrompt, setSfxPrompt] = useState('')
  const [sfxList, setSfxList] = useState<SfxItem[]>(MOCK_SFX)
  const [isGeneratingSfx, setIsGeneratingSfx] = useState(false)

  // ── Right: Voiceover ──────────────────────────────────────────────────────
  const [selectedActor, setSelectedActor] = useState('stable-male')
  const [voiceSpeed, setVoiceSpeed] = useState(1.0)
  const [voiceEmotion, setVoiceEmotion] = useState<'calm' | 'energetic'>('calm')
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false)
  const [voiceProgress, setVoiceProgress] = useState(0)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [playingVoiceIdx, setPlayingVoiceIdx] = useState<number | null>(null)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)

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

  // ── SFX generation (mock) ─────────────────────────────────────────────────
  const handleGenerateSfx = async () => {
    if (!sfxPrompt.trim()) return
    setIsGeneratingSfx(true)
    await new Promise(r => setTimeout(r, 1200))
    const newSfx: SfxItem = {
      id: `sfx-${Date.now()}`,
      name: sfxPrompt.slice(0, 18),
      startTime: Math.floor(Math.random() * 600),
      duration: 80 + Math.floor(Math.random() * 80),
      color: 'amber',
    }
    setSfxList(prev => [...prev, newSfx])
    setSfxPrompt('')
    setIsGeneratingSfx(false)
  }

  // ── Voiceover generation ──────────────────────────────────────────────────
  const handleGenerateVoiceover = async () => {
    const valid = scenes.filter(s => s.narration?.trim())
    if (valid.length === 0) {
      alert('分镜中没有旁白内容，请先在分镜页面填写旁白文案。')
      return
    }
    setIsGeneratingVoice(true)
    setVoiceProgress(0)
    setVoiceStatus('准备生成配音...')
    try {
      const fullText = valid.map(s => s.narration).join('\n')
      setVoiceStatus('正在调用 AI 配音服务...')
      setVoiceProgress(15)
      const res = await fetch('http://localhost:3000/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          voice: selectedActor,
          speed: voiceSpeed,
          emotion: voiceEmotion === 'calm' ? 'neutral' : 'happy',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || '配音生成失败')
      setVoiceProgress(100)
      setVoiceStatus('配音生成成功！')
      setScenes(prev => prev.map((s, i) => ({
        ...s,
        voiceUrl: data.audio_url ? `http://localhost:3000${data.audio_url}` : s.voiceUrl,
      })))
      setTimeout(() => { setVoiceStatus(''); setVoiceProgress(0) }, 2000)
    } catch (err) {
      console.error(err)
      setVoiceStatus('')
      setVoiceProgress(0)
      alert(`配音生成失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setIsGeneratingVoice(false)
    }
  }

  const handlePlayVoice = (url: string | undefined, idx: number) => {
    if (!url) return
    if (playingVoiceIdx === idx) {
      voiceAudioRef.current?.pause()
      setPlayingVoiceIdx(null)
      return
    }
    voiceAudioRef.current?.pause()
    const audio = new Audio(url)
    voiceAudioRef.current = audio
    audio.onended = () => setPlayingVoiceIdx(null)
    audio.play()
    setPlayingVoiceIdx(idx)
  }

  // ── Timeline helpers ──────────────────────────────────────────────────────
  const playheadPx = totalDuration > 0
    ? (currentTime / totalDuration) * Math.max(1200, scenes.length * 120)
    : 120

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 overflow-hidden font-sans">

      {/* Sub-toolbar */}
      <div className="h-11 border-b border-neutral-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md flex items-center px-4 gap-3 shrink-0 z-10">
        <button
          onClick={() => projectId ? navigate(`/storyboard?projectId=${projectId}`) : navigate('/storyboard')}
          className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors text-xs font-mono tracking-wider"
        >
          <ArrowLeft size={14} />
          STORYBOARD
        </button>
      </div>

      {/* ── Top: three-column split ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden border-b border-neutral-200 dark:border-white/[0.05]">

        {/* ── LEFT: Audio Synthesis + SFX ──────────────────────────────── */}
        <div className="w-72 shrink-0 border-r border-neutral-200 dark:border-white/[0.05] bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            {/* Audio Synthesis */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={13} className="text-emerald-500" />
                <h3 className="text-[10px] font-mono tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">Audio Synthesis</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Music Prompt</label>
                  <textarea
                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl p-3 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 resize-none outline-none focus:border-emerald-500/50 transition-colors h-16"
                    value={musicPrompt}
                    onChange={e => setMusicPrompt(e.target.value)}
                    placeholder="Describe the music style..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Mood</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Epic', 'Dark', 'Serene', 'Upbeat'].map(m => (
                      <button
                        key={m}
                        onClick={() => setSelectedMood(m)}
                        className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                          selectedMood === m
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                            : 'bg-white dark:bg-white/5 text-neutral-500 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'
                        }`}
                      >{m}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Tempo</label>
                    <span className="text-[11px] font-mono text-neutral-500">120 BPM</span>
                  </div>
                  <div className="h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="w-1/2 h-full bg-emerald-500 rounded-full" />
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity">
                  <Sparkles size={13} />
                  Generate Audio
                </button>
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-neutral-200 dark:border-white/[0.06]" />

            {/* SFX Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={13} className="text-amber-500" />
                <h3 className="text-[10px] font-mono tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">Sound Effects</h3>
              </div>
              <div className="space-y-3">
                {/* SFX Generate */}
                <div className="flex gap-2">
                  <input
                    className="flex-1 min-w-0 bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-amber-500/50 transition-colors"
                    placeholder="描述音效，如：城市街道噪声"
                    value={sfxPrompt}
                    onChange={e => setSfxPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerateSfx()}
                  />
                  <button
                    onClick={handleGenerateSfx}
                    disabled={isGeneratingSfx || !sfxPrompt.trim()}
                    className="shrink-0 w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-40"
                  >
                    {isGeneratingSfx
                      ? <RefreshCw size={13} className="animate-spin" />
                      : <Plus size={13} />}
                  </button>
                </div>

                {/* SFX List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {sfxList.map((sfx, i) => (
                    <motion.div
                      key={sfx.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-lg group"
                    >
                      <Zap size={11} className="text-amber-500 shrink-0" />
                      <span className="flex-1 text-[11px] text-neutral-700 dark:text-neutral-300 truncate">{sfx.name}</span>
                      <span className="text-[10px] font-mono text-neutral-400">{(sfx.duration / 100).toFixed(1)}s</span>
                      <button
                        onClick={() => setSfxList(prev => prev.filter(s => s.id !== sfx.id))}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all text-[10px]"
                      >✕</button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ── CENTER: Video Player ──────────────────────────────────────── */}
        <div className="flex-1 relative flex items-center justify-center p-6 bg-neutral-100/30 dark:bg-transparent">
          <div className="w-full max-w-3xl aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-neutral-200 dark:border-white/10">
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

        {/* ── RIGHT: Voiceover ──────────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-l border-neutral-200 dark:border-white/[0.05] bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Header */}
            <div className="flex items-center gap-2">
              <Mic size={13} className="text-violet-500" />
              <h3 className="text-[10px] font-mono tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">AI Voiceover</h3>
            </div>

            {/* Voice actor grid */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">配音员</label>
              <div className="grid grid-cols-4 gap-1.5">
                {VOICE_ACTORS.map(actor => (
                  <button
                    key={actor.id}
                    onClick={() => setSelectedActor(actor.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all border ${
                      selectedActor === actor.id
                        ? 'bg-violet-500/10 border-violet-500/40 text-violet-500'
                        : 'bg-white dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xl leading-none">{actor.avatar}</span>
                    <span className="text-[9px] leading-tight">{actor.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Speed & Emotion */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">语速</label>
                  <span className="text-[11px] font-mono text-neutral-500">{voiceSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range" min="0.5" max="2.0" step="0.1" value={voiceSpeed}
                  onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 bg-neutral-200 dark:bg-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">情感</label>
                <div className="flex bg-neutral-100 dark:bg-white/5 rounded-lg p-0.5 border border-neutral-200 dark:border-white/10">
                  {(['calm', 'energetic'] as const).map(e => (
                    <button
                      key={e}
                      onClick={() => setVoiceEmotion(e)}
                      className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-all ${
                        voiceEmotion === e
                          ? 'bg-white dark:bg-white/10 shadow-sm text-neutral-900 dark:text-white'
                          : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      }`}
                    >{e === 'calm' ? '👔 沉稳' : '⚡ 激昂'}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            {scenes.some(s => s.narration?.trim()) && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-200 dark:border-violet-500/20">
                <div className="text-center">
                  <div className="text-base font-bold text-neutral-800 dark:text-white">
                    {scenes.filter(s => s.narration?.trim()).length}
                  </div>
                  <div className="text-[9px] text-neutral-500">分镜数</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-neutral-800 dark:text-white">
                    {scenes.reduce((sum, s) => sum + (s.narration?.length || 0), 0)}
                  </div>
                  <div className="text-[9px] text-neutral-500">总字数</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-neutral-800 dark:text-white">
                    {scenes.reduce((sum, s) => sum + getSceneDuration(s), 0).toFixed(0)}s
                  </div>
                  <div className="text-[9px] text-neutral-500">总时长</div>
                </div>
              </div>
            )}

            {/* Generate button + progress */}
            <button
              onClick={handleGenerateVoiceover}
              disabled={isGeneratingVoice}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isGeneratingVoice
                  ? 'bg-violet-400/50 text-white cursor-wait'
                  : 'bg-gradient-to-r from-violet-500 to-pink-500 text-white hover:from-violet-600 hover:to-pink-600 shadow-lg shadow-violet-500/20'
              }`}
            >
              {isGeneratingVoice
                ? <><RefreshCw size={13} className="animate-spin" />生成中...</>
                : <><Sparkles size={13} />一键生成旁白</>}
            </button>

            <AnimatePresence>
              {isGeneratingVoice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-500">{voiceStatus}</span>
                    <span className="font-medium text-violet-500">{voiceProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                      animate={{ width: `${voiceProgress}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider */}
            <div className="border-t border-neutral-200 dark:border-white/[0.06]" />

            {/* Voiceover list */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">旁白列表</label>
              {scenes.length === 0 && (
                <p className="text-[11px] text-neutral-400 py-2">暂无分镜数据</p>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                {scenes.map((scene, i) => (
                  <div
                    key={scene.id ?? i}
                    className="p-3 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl space-y-1.5 hover:border-violet-300 dark:hover:border-violet-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-neutral-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-neutral-500">
                          S{String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-neutral-400">{getSceneDuration(scene).toFixed(1)}s</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {scene.voiceUrl && (
                          <span className="text-[9px] text-emerald-500 flex items-center gap-0.5">
                            <Check size={9} />已生成
                          </span>
                        )}
                        <button
                          onClick={() => handlePlayVoice(scene.voiceUrl, i)}
                          disabled={!scene.voiceUrl}
                          className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                            scene.voiceUrl
                              ? playingVoiceIdx === i
                                ? 'bg-violet-500 text-white'
                                : 'bg-neutral-100 dark:bg-white/10 text-neutral-500 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:text-violet-500'
                              : 'bg-neutral-100 dark:bg-white/5 text-neutral-300 cursor-not-allowed'
                          }`}
                        >
                          {playingVoiceIdx === i ? <Pause size={10} /> : <Play size={10} />}
                        </button>
                      </div>
                    </div>
                    {scene.narration ? (
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2">{scene.narration}</p>
                    ) : (
                      <p className="text-[11px] text-neutral-400 italic">无旁白</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Bottom: Timeline ──────────────────────────────────────────────── */}
      <div className="h-72 bg-white dark:bg-neutral-900 flex flex-col shrink-0">

        {/* Toolbar */}
        <div className="h-11 border-b border-neutral-200 dark:border-white/[0.05] flex items-center justify-between px-4 bg-neutral-50 dark:bg-neutral-950 shrink-0">
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
          <div className="w-48 shrink-0 border-r border-neutral-200 dark:border-white/[0.05] bg-neutral-50 dark:bg-neutral-950 flex flex-col z-20">
            <div className="h-6 border-b border-neutral-200 dark:border-white/[0.05] bg-neutral-100 dark:bg-[#0a0a0a]" />
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] flex items-center px-4 text-xs font-medium text-neutral-500 gap-2">
              <Video size={13} className="text-indigo-400" /> Video Track
            </div>
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] flex items-center px-4 text-xs font-medium text-neutral-500 gap-2">
              <Music size={13} className="text-emerald-400" /> BGM
            </div>
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] flex items-center px-4 text-xs font-medium text-neutral-500 gap-2">
              <Mic size={13} className="text-violet-400" /> Voiceover
            </div>
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] flex items-center px-4 text-xs font-medium text-neutral-500 gap-2">
              <Zap size={13} className="text-amber-400" /> SFX
            </div>
          </div>

          {/* Track content */}
          <div className="flex-1 relative overflow-x-auto bg-neutral-100 dark:bg-[#0a0a0a]">
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

            {/* BGM Track */}
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] relative flex items-center px-1">
              <div
                className="absolute left-0 h-12 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-500/30 rounded-md flex flex-col justify-center overflow-hidden hover:border-emerald-400 transition-colors cursor-pointer"
                style={{ width: `${Math.max(scenes.length + 3, 8) * 120}px` }}
              >
                <span className="px-2 text-[10px] text-emerald-700 dark:text-emerald-400/80 font-medium">BGM Track</span>
                <div className="w-full flex items-center gap-[1px] px-1 opacity-40">
                  {Array.from({ length: 150 }).map((_, i) => (
                    <div key={i} className="flex-1 bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ height: `${((Math.sin(i * 0.5) + 1) / 2) * 60 + 10}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Voiceover Track */}
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] relative flex items-center px-1">
              {scenes.map((s, i) => {
                const offset = scenes.slice(0, i).reduce((acc, sc) => acc + getSceneDuration(sc), 0)
                const w = Math.max(40, getSceneDuration(s) * 20)
                return (
                  <div
                    key={s.id ?? i}
                    className={`absolute h-10 rounded-md flex items-center px-2 text-[9px] font-medium transition-colors cursor-pointer ${
                      s.voiceUrl
                        ? 'bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300'
                        : 'bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-400 border-dashed'
                    }`}
                    style={{ left: `${offset * 20}px`, width: `${w}px` }}
                  >
                    <span className="truncate">{s.voiceUrl ? `S${String(i + 1).padStart(2, '0')} 旁白` : `S${i + 1}`}</span>
                  </div>
                )
              })}
            </div>

            {/* SFX Track */}
            <div className="h-16 border-b border-neutral-200 dark:border-white/[0.05] relative flex items-center">
              {sfxList.map(sfx => (
                <div
                  key={sfx.id}
                  className="absolute h-10 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-md flex items-center px-2 hover:border-amber-400 transition-colors cursor-pointer"
                  style={{ left: `${sfx.startTime}px`, width: `${sfx.duration}px` }}
                >
                  <span className="text-[10px] text-amber-700 dark:text-amber-400/80 truncate">{sfx.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditorPage
