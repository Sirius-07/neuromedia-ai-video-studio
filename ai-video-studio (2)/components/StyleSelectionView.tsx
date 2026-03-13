import { Monitor, Smartphone, Square, Tv, Plus, Check } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'motion/react';
import Image from 'next/image';

const RATIOS = [
  { id: '16:9', label: 'Landscape', icon: Monitor, desc: 'YouTube, Web' },
  { id: '9:16', label: 'Portrait', icon: Smartphone, desc: 'TikTok, Reels' },
  { id: '1:1', label: 'Square', icon: Square, desc: 'Instagram' },
  { id: '4:3', label: 'Standard', icon: Tv, desc: 'Classic TV' },
];

const STYLES = [
  { id: 'anime', label: 'Anime', img: 'https://picsum.photos/seed/anime/400/225' },
  { id: 'realistic', label: 'Cinematic Realism', img: 'https://picsum.photos/seed/real/400/225' },
  { id: 'ink', label: 'Japanese Ink', img: 'https://picsum.photos/seed/ink/400/225' },
  { id: 'sketch', label: 'Pencil Sketch', img: 'https://picsum.photos/seed/sketch/400/225' },
  { id: 'vintage', label: 'B&W Vintage', img: 'https://picsum.photos/seed/vintage/400/225' },
  { id: '3d', label: '3D Animation', img: 'https://picsum.photos/seed/3d/400/225' },
];

export function StyleSelectionView({ onNext }: { onNext: () => void }) {
  const [ratio, setRatio] = useState('16:9');
  const [style, setStyle] = useState('realistic');

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-8 scrollbar-hide relative z-10">
      <div className="max-w-5xl mx-auto w-full pb-24">
        <div className="text-center mb-16 mt-8">
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 dark:text-white mb-3">Choose Your Visual Style</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Select the aspect ratio and artistic direction for your story.</p>
        </div>

        {/* Aspect Ratio */}
        <div className="mb-16">
          <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-300 mb-6 uppercase tracking-widest">Aspect Ratio</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {RATIOS.map((r, i) => {
              const Icon = r.icon;
              const isSelected = ratio === r.id;
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={r.id}
                  onClick={() => setRatio(r.id)}
                  className={`relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col items-center text-center gap-4 ${
                    isSelected 
                      ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.15)]' 
                      : 'bg-white dark:bg-[#111]/30 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-[#111]/60 hover:border-cyan-200 dark:hover:border-white/20 hover:shadow-[0_0_20px_rgba(34,211,238,0.05)]'
                  }`}
                >
                  {isSelected && (
                    <motion.div layoutId="ratioCheck" className="absolute top-3 right-3 w-5 h-5 bg-gradient-to-tr from-cyan-400 to-violet-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                      <Check size={12} className="text-white" />
                    </motion.div>
                  )}
                  <div className={`p-4 rounded-xl transition-colors duration-300 ${isSelected ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'}`}>
                    <Icon size={32} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className={`font-medium mb-1 ${isSelected ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-violet-600 dark:from-cyan-100 dark:to-white' : 'text-neutral-700 dark:text-neutral-300'}`}>{r.id} {r.label}</div>
                    <div className="text-xs text-neutral-500">{r.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Art Style */}
        <div>
          <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-300 mb-6 uppercase tracking-widest">Art Style</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {STYLES.map((s, i) => {
              const isSelected = style === s.id;
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 + 0.2, duration: 0.4, ease: "easeOut" }}
                  whileHover={{ scale: 1.03, zIndex: 10 }}
                  whileTap={{ scale: 0.98 }}
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`relative rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 group aspect-video ${
                    isSelected 
                      ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400' 
                      : 'border-neutral-200 dark:border-white/20 hover:border-cyan-400 dark:hover:border-white/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                  }`}
                >
                  <Image src={s.img} alt={s.label} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-4">
                    <span className={`font-medium text-sm ${isSelected ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-white drop-shadow-md' : 'text-white dark:text-neutral-200'}`}>{s.label}</span>
                  </div>
                  {isSelected && (
                    <motion.div layoutId="styleCheck" className="absolute top-3 right-3 w-5 h-5 bg-gradient-to-tr from-cyan-400 to-violet-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                      <Check size={12} className="text-white" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
            
            <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-white/20 hover:border-cyan-400 dark:hover:border-white/30 bg-white dark:bg-transparent hover:bg-neutral-50 dark:hover:bg-white/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 aspect-video text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                <Plus size={20} />
              </div>
              <span className="text-sm font-medium">Custom Style</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-neutral-50 via-neutral-50/90 dark:from-neutral-950 dark:via-neutral-950/90 to-transparent flex justify-center pointer-events-none">
        <motion.button 
          whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(34,211,238,0.4)" }}
          whileTap={{ scale: 0.98 }}
          onClick={onNext}
          className="pointer-events-auto flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-10 py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-cyan-500/20 border border-white/10"
        >
          <span className="tracking-wide">Generate Storyboard</span>
          <Check size={18} />
        </motion.button>
      </div>
    </div>
  );
}
