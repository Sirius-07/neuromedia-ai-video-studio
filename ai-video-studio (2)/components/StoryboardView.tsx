import { Play, RefreshCw, Edit2, Trash2, Wand2, Plus, Music, Sparkles, Video, Image as ImageIcon, Film, Clock, GripHorizontal, Copy, Undo2, Send, ChevronRight, ChevronLeft, Lightbulb, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';

type Shot = {
  id: string;
  imageUrl: string;
  description: string;
  
  // Image mode fields
  size: string;
  perspective: string;
  equipment: string;
  focalLength: string;
  aspectRatio: string;
  notes: string;

  // Video mode fields
  movement: string;
  ert: string;
  dialogue: string;
  
  highlightNames?: string[];
  isSelected?: boolean;
};

const INITIAL_SHOTS: Shot[] = [
  {
    id: 'shot-1',
    imageUrl: 'https://picsum.photos/seed/cyberpunk1/800/450',
    description: 'A wide view shows the small coastal bus station under flickering lamps with fog creeping in from the ocean.',
    size: 'Extreme Long Shot',
    perspective: 'Eye-level',
    equipment: 'Steady cam',
    focalLength: '24mm',
    aspectRatio: '16:9',
    notes: 'Keep it moody',
    movement: 'Slow push-in',
    ert: '5 sec',
    dialogue: '',
  },
  {
    id: 'shot-2',
    imageUrl: 'https://picsum.photos/seed/cyberpunk2/800/450',
    description: 'The coach pulls up in front of the station and comes to a stop at the curb.',
    size: 'Long Shot',
    perspective: 'Eye-level',
    equipment: 'Tripod',
    focalLength: '35mm',
    aspectRatio: '16:9',
    notes: '',
    movement: 'Static',
    ert: '4 sec',
    dialogue: '',
    isSelected: true,
  },
  {
    id: 'shot-3',
    imageUrl: 'https://picsum.photos/seed/cyberpunk3/800/450',
    description: 'Marcus steps down from the coach with a duffel in hand and pauses on the platform.',
    size: 'Medium',
    perspective: 'Low angle',
    equipment: 'Steady cam',
    focalLength: '35mm',
    aspectRatio: '16:9',
    notes: 'Focus on expression',
    movement: 'Slight tilt up',
    ert: '5 sec',
    dialogue: '',
    highlightNames: ['Marcus'],
  },
  {
    id: 'shot-4',
    imageUrl: 'https://picsum.photos/seed/cyberpunk4/800/450',
    description: 'A close view shows Marcus taking a creased letter from his pocket and resting his thumb on the signature.',
    size: 'Close-up',
    perspective: 'Eye-level',
    equipment: 'Tripod',
    focalLength: '50mm',
    aspectRatio: '16:9',
    notes: 'Macro shot of the letter',
    movement: 'Static',
    ert: '4 sec',
    dialogue: '',
    highlightNames: ['Marcus'],
  }
];

const EditableCell = ({ value, className = "", isDescription }: any) => {
  const [text, setText] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  return (
    <div className={`bg-neutral-100 dark:bg-white/5 rounded-md border border-neutral-200 dark:border-white/5 focus-within:border-cyan-500/50 focus-within:bg-cyan-500/10 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all ${isDescription ? 'p-1.5' : 'px-1.5 py-1'}`}>
      <textarea
        ref={textareaRef}
        className={`w-full bg-transparent border-none outline-none resize-none text-neutral-700 dark:text-neutral-300 placeholder-neutral-400 dark:placeholder-neutral-600 ${isDescription ? 'text-[11px] leading-relaxed' : 'text-[10px]'} ${className}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={1}
        placeholder="Empty"
        style={{ 
          display: 'block',
          overflow: 'hidden',
          minHeight: isDescription ? '48px' : '15px'
        }}
      />
    </div>
  );
};

export function StoryboardView({ onNext }: { onNext: () => void }) {
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [shots, setShots] = useState<Shot[]>(INITIAL_SHOTS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Simple drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    
    const newShots = [...shots];
    const draggedShot = newShots[draggedIdx];
    newShots.splice(draggedIdx, 1);
    newShots.splice(index, 0, draggedShot);
    setShots(newShots);
    setDraggedIdx(null);
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden relative z-10 bg-transparent">
      {/* Main Content - Storyboard */}
      <div className="flex-1 relative flex flex-col h-full overflow-hidden">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between px-8 py-6 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-medium text-neutral-900 dark:text-white tracking-wide uppercase flex items-center gap-3">
              <div className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
              STORYBOARD
            </h2>
            <div className="flex items-center gap-2 text-neutral-400 font-mono text-sm uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/10">
              <Lightbulb size={14} className="text-amber-400" />
              <span>{shots.length} SHOTS</span>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-md border border-neutral-200 dark:border-white/10 rounded-lg p-1 shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => setMode('image')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'image' 
                  ? 'bg-cyan-500/20 text-cyan-400 shadow-[inset_0_0_10px_rgba(34,211,238,0.2)] border border-cyan-500/30' 
                  : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
              }`}
            >
              <ImageIcon size={16} className={mode === 'image' ? 'text-cyan-400' : ''} />
              Image Mode
            </button>
            <button
              onClick={() => setMode('video')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'video' 
                  ? 'bg-violet-500/20 text-violet-400 shadow-[inset_0_0_10px_rgba(139,92,246,0.2)] border border-violet-500/30' 
                  : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
              }`}
            >
              <Film size={16} className={mode === 'video' ? 'text-violet-400' : ''} />
              Video Mode
            </button>
          </div>
        </div>

        {/* Grid Shot List */}
        <div className="flex-1 overflow-y-auto px-8 pb-32 pt-4 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-stretch">
            {shots.map((shot, index) => (
              <div 
                key={shot.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`bg-white/40 dark:bg-black/40 backdrop-blur-sm border ${shot.isSelected ? 'border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'border-neutral-200 dark:border-white/10'} rounded-xl overflow-hidden flex flex-col group relative transition-all duration-300 hover:border-neutral-300 dark:hover:border-white/20 hover:bg-white/60 dark:hover:bg-black/60 h-full`}
              >
                {/* Drag Handle & Header */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-white/60 dark:bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-neutral-200 dark:border-white/10 flex items-center gap-2">
                  <GripHorizontal size={14} className="text-neutral-700 dark:text-white" />
                </div>

                {/* Image Area */}
                <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot.imageUrl} alt={`Shot ${index + 1}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="absolute top-2 left-2 bg-white/60 dark:bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-neutral-900 dark:text-white border border-neutral-200 dark:border-white/10">
                    SHOT {index + 1}
                  </div>
                  
                  {mode === 'video' && (
                    <div className="absolute top-2 right-2 bg-white/60 dark:bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                      <Clock size={10} />
                      {shot.ert}
                    </div>
                  )}

                  {/* Undo Button */}
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 bg-white/60 dark:bg-black/60 hover:bg-white/80 dark:hover:bg-black/80 backdrop-blur-md rounded-md text-neutral-900 dark:text-white border border-neutral-200 dark:border-white/10 transition-colors" title="Undo visual changes">
                      <Undo2 size={14} />
                    </button>
                  </div>

                  {shot.isSelected && (
                    <div className="absolute inset-0 border-2 border-cyan-500 rounded-t-xl pointer-events-none"></div>
                  )}
                </div>

                {/* Content Area */}
                <div className="p-3 flex-1 flex flex-col gap-3">
                  {/* Description */}
                  <div>
                    <div className="text-[8px] font-mono text-cyan-500/80 uppercase tracking-widest mb-1">Description</div>
                    <EditableCell value={shot.description} isDescription />
                  </div>

                  {/* Dynamic Fields based on mode */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    {mode === 'image' ? (
                      <>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Size</div>
                          <EditableCell value={shot.size} />
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Perspective</div>
                          <EditableCell value={shot.perspective} />
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Equipment</div>
                          <EditableCell value={shot.equipment} />
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Focal Length</div>
                          <EditableCell value={shot.focalLength} />
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Aspect Ratio</div>
                          <EditableCell value={shot.aspectRatio} />
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Notes</div>
                          <EditableCell value={shot.notes} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Movement</div>
                          <EditableCell value={shot.movement} />
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Equipment</div>
                          <EditableCell value={shot.equipment} />
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">ERT</div>
                          <EditableCell value={shot.ert} />
                        </div>
                        <div className="col-span-2">
                          <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Dialogue</div>
                          <EditableCell value={shot.dialogue} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Action Bar */}
                <div className="p-1.5 border-t border-neutral-200 dark:border-white/5 bg-white/40 dark:bg-black/40 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 rounded transition-colors"><Copy size={12} /></button>
                    <button className="p-1.5 text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"><Trash2 size={12} /></button>
                  </div>
                  <button className="p-1.5 text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                    <Sparkles size={12} />
                    Auto-fill
                  </button>
                </div>
              </div>
            ))}

            {/* Add Shot Button */}
            <button className="h-full min-h-[250px] border-2 border-dashed border-neutral-300 dark:border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 text-neutral-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all group bg-white/20 dark:bg-black/20 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <Plus size={20} />
              </div>
              <span className="text-xs font-medium tracking-wide">ADD SHOT</span>
            </button>
          </div>
        </div>
        
        {/* Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-[#050505] via-white/80 dark:via-[#050505]/80 to-transparent flex justify-center pointer-events-none z-20">
          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(34,211,238,0.6)" }}
            whileTap={{ scale: 0.98 }}
            onClick={onNext}
            className="pointer-events-auto flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-12 py-4 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)] border border-white/20"
          >
            <span className="tracking-widest uppercase text-sm">Generate Soundtrack</span>
            <Music size={18} />
          </motion.button>
        </div>
      </div>

      {/* Futuristic Sidebar Toggle */}
      <motion.div 
        animate={{ right: isSidebarOpen ? 320 : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        className="absolute top-1/2 -translate-y-1/2 z-30"
      >
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="h-24 w-8 flex items-center justify-center group relative -ml-8 bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 border-r-0 rounded-l-2xl shadow-[-8px_0_20px_rgba(0,0,0,0.1)] dark:shadow-[-8px_0_20px_rgba(0,0,0,0.5)] hover:bg-white/80 dark:hover:bg-black/80 transition-colors"
        >
          <div className="absolute inset-0 bg-cyan-500/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl"></div>
          {isSidebarOpen ? (
            <ChevronRight size={16} className="text-neutral-500 group-hover:text-cyan-400 transition-colors relative z-10" />
          ) : (
            <Bot size={18} className="text-cyan-500/70 group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all relative z-10" />
          )}
        </button>
      </motion.div>

      {/* Right Sidebar - AI Assistant */}
      <motion.div 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        className="border-l border-neutral-200 dark:border-white/10 bg-white/60 dark:bg-black/60 backdrop-blur-2xl flex flex-col shrink-0 overflow-hidden z-20 absolute right-0 top-0 bottom-0 shadow-[-20px_0_50px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="w-[320px] flex flex-col h-full">
          <div className="p-5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-white/40 dark:bg-black/40">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="font-medium text-sm text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-wide uppercase">AI Director</span>
            </div>
          </div>
          
          <div className="flex-1 p-5 overflow-y-auto space-y-6 scrollbar-hide">
            <div className="flex flex-wrap gap-2">
              <button className="text-xs px-3 py-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-full text-neutral-400 hover:text-cyan-400 transition-all shadow-sm">Make it darker</button>
              <button className="text-xs px-3 py-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-full text-neutral-400 hover:text-cyan-400 transition-all shadow-sm">Faster pacing</button>
              <button className="text-xs px-3 py-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-full text-neutral-400 hover:text-cyan-400 transition-all shadow-sm">Add a plot twist</button>
            </div>

            <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-4 text-sm text-cyan-100/80 leading-relaxed shadow-[inset_0_0_20px_rgba(34,211,238,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
              I&apos;ve generated 4 scenes based on your prompt. The pacing is fast. Would you like to add more dialogue or keep it purely visual?
              <br/><br/>
              Try saying: <span className="text-cyan-400">&quot;Make the 3rd shot a close-up&quot;</span> or <span className="text-cyan-400">&quot;Add a transition shot between 1 and 2&quot;</span>.
            </div>
          </div>

          <div className="p-5 border-t border-white/10 bg-[#111]/50">
            <div className="relative group">
              <textarea 
                placeholder="Tell AI how to adjust..." 
                className="w-full bg-white/50 dark:bg-black/50 border border-neutral-200 dark:border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder-neutral-400 dark:placeholder-neutral-600 resize-none min-h-[80px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-hover:border-neutral-300 dark:group-hover:border-white/20"
              />
              <button className="absolute right-3 bottom-3 p-2 bg-neutral-200 dark:bg-white/5 hover:bg-cyan-500/20 rounded-lg text-neutral-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-all border border-transparent hover:border-cyan-500/30">
                <Send size={14} />
              </button>
            </div>
            <button className="w-full mt-3 flex items-center justify-center gap-2 py-3 bg-white dark:bg-white/5 hover:bg-neutral-50 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10 rounded-xl text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all uppercase tracking-wider text-[11px] font-medium shadow-sm dark:shadow-none">
              <RefreshCw size={14} />
              Regenerate Storyboard
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
