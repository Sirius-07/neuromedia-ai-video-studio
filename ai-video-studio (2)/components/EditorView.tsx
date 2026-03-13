import { Play, Pause, SkipBack, SkipForward, Volume2, Scissors, Layers, Download, Video, Music, Mic, Sliders, Sparkles, Activity, Settings2, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';

export function EditorView() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent relative z-10">
      {/* Top Section - Split Layout */}
      <div className="flex-1 flex overflow-hidden border-b border-neutral-200 dark:border-white/5 bg-transparent">
        
        {/* Left Panel - AI Audio Synthesis */}
        <div className="w-80 shrink-0 border-r border-neutral-200 dark:border-white/5 bg-white/40 dark:bg-black/20 backdrop-blur-md p-6 flex flex-col gap-8 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Activity size={16} className="text-emerald-500" />
              <h3 className="text-[10px] font-mono tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">Audio Synthesis</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Music Prompt</label>
                <textarea 
                  className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl p-3 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 resize-none outline-none focus:border-emerald-500/50 transition-colors h-24"
                  placeholder="e.g., Cinematic synthwave with heavy bass drops and ethereal vocals..."
                  defaultValue="Heavy cyberpunk synthwave, 120bpm, driving bassline, atmospheric pads."
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Mood</label>
                <div className="flex flex-wrap gap-2">
                  {['Epic', 'Dark', 'Serene', 'Upbeat'].map((mood, i) => (
                    <button key={mood} className={`px-3 py-1.5 rounded-full text-xs transition-colors ${i === 1 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'}`}>
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Tempo</label>
                  <span className="text-xs font-mono text-neutral-500">120 BPM</span>
                </div>
                <div className="h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="w-1/2 h-full bg-emerald-500 rounded-full"></div>
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                <Sparkles size={14} />
                Generate Audio
              </button>
            </div>
          </div>
        </div>

        {/* Center - Video Player */}
        <div className="flex-1 relative flex items-center justify-center p-8">
          <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-neutral-200 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5">
            <Image src="https://picsum.photos/seed/cyberpunk1/1280/720" alt="Preview" fill className="object-cover" referrerPolicy="no-referrer" />
            
            {/* Player Controls Overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/50 to-transparent pt-20 pb-6 px-6 flex flex-col justify-end">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"><SkipBack size={20} /></button>
                  <button className="w-12 h-12 flex items-center justify-center bg-neutral-900 text-white dark:bg-white dark:text-black rounded-full hover:scale-105 transition-transform shadow-lg">
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </button>
                  <button className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"><SkipForward size={20} /></button>
                  <div className="text-neutral-600 dark:text-neutral-300 font-mono text-sm ml-2">00:00:00 / 00:00:12</div>
                </div>
                <div className="flex items-center gap-4">
                  <Volume2 size={20} className="text-neutral-400" />
                  <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer">
                    <div className="w-3/4 h-full bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-80 shrink-0 border-l border-neutral-200 dark:border-white/5 bg-white/40 dark:bg-black/20 backdrop-blur-md p-6 flex flex-col gap-8 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Settings2 size={16} className="text-neutral-500" />
              <h3 className="text-[10px] font-mono tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">Properties</h3>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl">
                <div className="flex items-center gap-3 mb-1">
                  <Video size={14} className="text-indigo-500" />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">Scene 01</span>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">Duration: 3.5s</div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-medium text-neutral-700 dark:text-neutral-300">AI Enhancements</h4>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Wand2 size={14} className="text-neutral-500" />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">Upscale to 4K</span>
                    </div>
                    <div className="w-8 h-4 bg-neutral-200 dark:bg-white/10 rounded-full relative">
                      <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Sliders size={14} className="text-neutral-500" />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">Auto Color Grade</span>
                    </div>
                    <div className="w-8 h-4 bg-indigo-500 rounded-full relative">
                      <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-white/5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Transition</label>
                <select className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-indigo-500/50 transition-colors appearance-none">
                  <option>Crossfade</option>
                  <option>Cut</option>
                  <option>Wipe</option>
                  <option>Dip to Black</option>
                </select>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom - Timeline */}
      <div className="h-80 bg-white dark:bg-neutral-900 flex flex-col shrink-0">
        {/* Timeline Toolbar */}
        <div className="h-12 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between px-4 bg-neutral-50 dark:bg-neutral-950">
          <div className="flex items-center gap-1">
            <button className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md transition-colors"><Scissors size={16} /></button>
            <button className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md transition-colors"><Layers size={16} /></button>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(34,211,238,0.3)" }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white hover:opacity-90 px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-cyan-500/20 border border-white/10"
          >
            <Download size={16} />
            Export Final Video
          </motion.button>
        </div>

        {/* Tracks Area */}
        <div className="flex-1 overflow-y-auto relative flex">
          {/* Track Headers */}
          <div className="w-56 shrink-0 border-r border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-neutral-950 flex flex-col z-20">
            <div className="h-6 border-b border-neutral-200 dark:border-white/5 bg-neutral-100 dark:bg-[#0a0a0a] sticky top-0 z-10"></div>
            <div className="h-20 border-b border-neutral-200 dark:border-white/5 flex items-center px-4 text-xs font-medium text-neutral-600 dark:text-neutral-400 gap-3">
              <Video size={16} className="text-indigo-500 dark:text-indigo-400" /> Video Track
            </div>
            <div className="h-20 border-b border-neutral-200 dark:border-white/5 flex items-center px-4 text-xs font-medium text-neutral-600 dark:text-neutral-400 gap-3">
              <Music size={16} className="text-emerald-500 dark:text-emerald-400" /> BGM (Stable Audio)
            </div>
            <div className="h-20 border-b border-neutral-200 dark:border-white/5 flex items-center px-4 text-xs font-medium text-neutral-600 dark:text-neutral-400 gap-3">
              <Mic size={16} className="text-amber-500 dark:text-amber-400" /> SFX (Auto-synced)
            </div>
          </div>

          {/* Tracks Content */}
          <div className="flex-1 relative overflow-x-auto bg-neutral-100 dark:bg-[#0a0a0a]">
            {/* Time Ruler */}
            <div className="h-6 border-b border-neutral-200 dark:border-white/5 flex items-end text-[10px] text-neutral-500 dark:text-neutral-600 font-mono sticky top-0 bg-neutral-100 dark:bg-[#0a0a0a] z-10">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="flex-1 border-l border-neutral-300 dark:border-white/10 pl-1 pb-0.5 min-w-[120px]">
                  00:0{i}
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 left-[120px] w-px bg-cyan-400 z-20 shadow-[0_0_10px_rgba(34,211,238,0.8)]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rounded-sm shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
            </div>

            {/* Video Track */}
            <div className="h-20 border-b border-neutral-200 dark:border-white/5 relative flex items-center px-2">
              <div className="absolute left-0 w-[600px] h-14 bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-500/30 rounded-md overflow-hidden flex hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-colors cursor-pointer">
                <div className="relative h-full w-[120px]"><Image src="https://picsum.photos/seed/cyberpunk1/120/60" alt="Track 1" fill className="object-cover opacity-80 dark:opacity-60" referrerPolicy="no-referrer" /></div>
                <div className="relative h-full w-[120px]"><Image src="https://picsum.photos/seed/cyberpunk2/120/60" alt="Track 2" fill className="object-cover opacity-80 dark:opacity-60" referrerPolicy="no-referrer" /></div>
                <div className="relative h-full w-[120px]"><Image src="https://picsum.photos/seed/cyberpunk3/120/60" alt="Track 3" fill className="object-cover opacity-80 dark:opacity-60" referrerPolicy="no-referrer" /></div>
                <div className="relative h-full w-[120px]"><Image src="https://picsum.photos/seed/cyberpunk1/120/60" alt="Track 4" fill className="object-cover opacity-80 dark:opacity-60" referrerPolicy="no-referrer" /></div>
                <div className="relative h-full w-[120px]"><Image src="https://picsum.photos/seed/cyberpunk2/120/60" alt="Track 5" fill className="object-cover opacity-80 dark:opacity-60" referrerPolicy="no-referrer" /></div>
              </div>
            </div>

            {/* BGM Track */}
            <div className="h-20 border-b border-neutral-200 dark:border-white/5 relative flex items-center px-2">
              <div className="absolute left-0 w-[1000px] h-14 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-500/30 rounded-md flex flex-col justify-center overflow-hidden hover:border-emerald-400 dark:hover:border-emerald-500/60 transition-colors cursor-pointer">
                <span className="px-2 pt-1 text-[10px] text-emerald-700 dark:text-emerald-400/80 font-medium z-10">Cyberpunk_Synthwave_120bpm.wav</span>
                {/* Simulated Waveform */}
                <div className="w-full h-full flex items-center gap-[1px] px-1 opacity-40 mt-1">
                  {[...Array(150)].map((_, i) => {
                    // Use a deterministic pseudo-random value based on index
                    const height = ((Math.sin(i * 0.5) + 1) / 2) * 60 + 10;
                    return (
                      <div key={i} className="flex-1 bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ height: `${height}%` }}></div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SFX Track */}
            <div className="h-20 border-b border-neutral-200 dark:border-white/5 relative flex items-center px-2">
              <div className="absolute left-[60px] w-[100px] h-10 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-md flex items-center px-2 hover:border-amber-400 dark:hover:border-amber-500/60 transition-colors cursor-pointer">
                <span className="text-[10px] text-amber-700 dark:text-amber-400/80 truncate">Whoosh_01</span>
              </div>
              <div className="absolute left-[300px] w-[150px] h-10 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-md flex items-center px-2 hover:border-amber-400 dark:hover:border-amber-500/60 transition-colors cursor-pointer">
                <span className="text-[10px] text-amber-700 dark:text-amber-400/80 truncate">Drone_Flyby_Heavy</span>
              </div>
              <div className="absolute left-[540px] w-[80px] h-10 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-md flex items-center px-2 hover:border-amber-400 dark:hover:border-amber-500/60 transition-colors cursor-pointer">
                <span className="text-[10px] text-amber-700 dark:text-amber-400/80 truncate">Impact_Sub</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
