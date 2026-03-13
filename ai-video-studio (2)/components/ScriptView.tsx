import { Plus, GripVertical, Image as ImageIcon, Video, Clock, Sparkles, Send, RefreshCw, Settings2, Music, Lightbulb, MessageSquare, MessageCircle, Copy, Trash2, ChevronRight, ChevronLeft, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

const SCRIPT_SCENES = [
  {
    scene: 1,
    shot: 1,
    type: 'ai',
    description: 'A wide view shows the small coastal bus station under flickering lamps with fog creeping in from the ocean.',
    ert: '5 sec',
    size: 'Extreme Long Shot',
    perspective: 'Eye-level',
    movement: 'Slow push-in',
    equipment: 'Steady cam',
    focalLength: '24mm',
    aspectRatio: '16:9',
    hasDialogue: true,
    dialogueActive: false,
  },
  {
    scene: 1,
    shot: 2,
    type: 'live-video',
    description: 'The coach pulls up in front of the station and comes to a stop at the curb.',
    ert: '4 sec',
    size: 'Long Shot',
    perspective: 'Eye-level',
    movement: 'Static',
    equipment: 'Tripod',
    focalLength: '35mm',
    aspectRatio: '16:9',
    hasDialogue: true,
    dialogueActive: false,
    isSelected: true,
  },
  {
    scene: 1,
    shot: 3,
    type: 'live-image',
    description: 'Marcus steps down from the coach with a duffel in hand and pauses on the platform.',
    ert: '5 sec',
    size: 'Medium',
    perspective: 'Low angle',
    movement: 'Slight tilt up',
    equipment: 'Steady cam',
    focalLength: '35mm',
    aspectRatio: '16:9',
    hasDialogue: true,
    dialogueActive: false,
    highlightNames: ['Marcus'],
  },
  {
    scene: 1,
    shot: 4,
    type: 'ai',
    description: 'A close view shows Marcus taking a creased letter from his pocket and resting his thumb on the signature.',
    ert: '4 sec',
    size: 'Close-up',
    perspective: 'Eye-level',
    movement: 'Static',
    equipment: 'Tripod',
    focalLength: '50mm',
    aspectRatio: '16:9',
    hasDialogue: true,
    dialogueActive: false,
    highlightNames: ['Marcus'],
  },
  {
    scene: 1,
    shot: 5,
    type: 'live-video',
    description: 'The station door swings open, revealing Deputy Ramirez in the doorway looking toward Marcus.',
    ert: '3 sec',
    size: 'Medium',
    perspective: 'Eye-level',
    movement: 'Static',
    equipment: 'Tripod',
    focalLength: '40mm',
    aspectRatio: '16:9',
    hasDialogue: true,
    dialogueActive: false,
    highlightNames: ['Ramirez', 'Marcus'],
  },
  {
    scene: 1,
    shot: 6,
    type: 'ai',
    description: 'Ramirez approaches Marcus on the platform, stopping in front of him as Marcus turns his gaze',
    ert: '6 sec',
    size: 'Two-shot',
    perspective: 'Eye-level',
    movement: 'Slow dolly-in',
    equipment: 'Steady cam',
    focalLength: '35mm',
    aspectRatio: '16:9',
    hasDialogue: true,
    dialogueActive: true,
    highlightNames: ['Ramirez', 'Marcus'],
  }
];

const renderDescription = (text: string, highlightNames?: string[]) => {
  if (!highlightNames) return text;
  
  let parts = [text];
  highlightNames.forEach(name => {
    const newParts: any[] = [];
    parts.forEach(part => {
      if (typeof part === 'string') {
        const split = part.split(new RegExp(`(${name})`, 'gi'));
        split.forEach(s => {
          if (s.toLowerCase() === name.toLowerCase()) {
            newParts.push(<span key={Math.random()} className="text-cyan-400 font-medium drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{s}</span>);
          } else if (s) {
            newParts.push(s);
          }
        });
      } else {
        newParts.push(part);
      }
    });
    parts = newParts;
  });
  
  return parts;
};

const EditableCell = ({ value, className, isDescription, highlightNames }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);

  if (isEditing) {
    return (
      <textarea
        autoFocus
        className={`w-full bg-white/50 dark:bg-black/50 border border-cyan-500/50 rounded-lg p-2 outline-none resize-none text-neutral-900 dark:text-white shadow-[0_0_15px_rgba(34,211,238,0.15)] focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all ${className}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setIsEditing(false)}
        rows={isDescription ? 3 : 1}
        style={{ minHeight: isDescription ? '80px' : 'auto', overflow: 'hidden' }}
      />
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)} 
      className={`cursor-text hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors border border-transparent hover:border-white/10 ${className}`}
    >
      {isDescription ? renderDescription(text, highlightNames) : text}
    </div>
  );
};

export function ScriptView({ onNext }: { onNext: () => void }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scenes, setScenes] = useState(SCRIPT_SCENES);

  const handleAddShot = () => {
    const newShot = {
      scene: 1,
      shot: scenes.length + 1,
      type: 'ai',
      description: '',
      ert: '0 sec',
      size: '',
      perspective: '',
      movement: '',
      equipment: '',
      focalLength: '',
      aspectRatio: '16:9',
      hasDialogue: false,
      dialogueActive: false,
    };
    setScenes([...scenes, newShot]);
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden relative z-10 bg-transparent">
      {/* Main Content - Script Breakdown */}
      <div className="flex-1 relative flex flex-col">
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide pb-32">
          <div className="max-w-[1400px] mx-auto">
            
            {/* Scene Header */}
            <div className="flex items-center gap-6 mb-8">
              <h2 className="text-2xl font-medium text-neutral-900 dark:text-white tracking-wide uppercase flex items-center gap-3">
                <div className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
                SCENE 1: EXT. COASTAL BUS STATION – DUSK
              </h2>
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-mono text-sm uppercase tracking-widest bg-neutral-200 dark:bg-white/5 px-3 py-1 rounded-full border border-neutral-300 dark:border-white/10">
                <Lightbulb size={14} className="text-amber-400" />
                <span>DUSK LIGHT</span>
              </div>
            </div>

            {/* Script Table */}
            <div className="w-full overflow-x-auto pb-8">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em] border-b border-neutral-200 dark:border-white/10">
                    <th className="py-4 px-4 w-16 text-center">Scene</th>
                    <th className="py-4 px-4 w-16 text-center">Shot</th>
                    <th className="py-4 px-4 w-[30%]">Description</th>
                    <th className="py-4 px-4 w-20 text-center">Dialogue</th>
                    <th className="py-4 px-4 w-20 text-center">ERT</th>
                    <th className="py-4 px-4 w-32">Size</th>
                    <th className="py-4 px-4 w-32">Perspective</th>
                    <th className="py-4 px-4 w-32">Movement</th>
                    <th className="py-4 px-4 w-32">Equipment</th>
                    <th className="py-4 px-4 w-24 text-center">Focal Length</th>
                    <th className="py-4 px-4 w-24 text-center">Aspect Ratio</th>
                    <th className="py-4 px-4 w-20 text-center">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-neutral-700 dark:text-neutral-300">
                  {scenes.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`border-b border-neutral-200 dark:border-white/5 transition-all duration-300 group relative ${row.isSelected ? 'bg-neutral-100 dark:bg-[#111] shadow-[inset_2px_0_0_rgba(34,211,238,1)]' : 'hover:bg-neutral-50 dark:hover:bg-[#0a0a0a]'}`}
                    >
                      <td className="py-6 px-4 text-center relative">
                        {row.isSelected && (
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-100 transition-opacity">
                            <GripVertical size={14} className="text-neutral-500 hover:text-white cursor-grab" />
                            <div className="w-3 h-3 border border-cyan-500/50 rounded-sm flex items-center justify-center shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-sm"></div>
                            </div>
                            <div className="w-1.5 h-0.5 bg-rose-500 mt-1 shadow-[0_0_5px_rgba(244,63,94,0.5)]"></div>
                          </div>
                        )}
                        <span className="font-mono text-neutral-400">{row.scene}</span>
                      </td>
                      <td className="py-6 px-4 text-center font-mono text-neutral-400">
                        <div className="flex flex-col items-center gap-2">
                          <span>{row.shot}</span>
                          {row.type === 'ai' && <div className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20" title="AI Storyboard">AI</div>}
                          {row.type === 'live-video' && <div className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1" title="Live Action Video"><Video size={10} /></div>}
                          {row.type === 'live-image' && <div className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1" title="Live Action Image"><ImageIcon size={10} /></div>}
                        </div>
                      </td>
                      <td className="py-6 px-4 leading-relaxed pr-8">
                        <EditableCell value={row.description} isDescription highlightNames={row.highlightNames} />
                      </td>
                      <td className="py-6 px-4 text-center">
                        {row.hasDialogue && (
                          <button className={`p-2 rounded-full transition-colors ${row.dialogueActive ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/5'}`}>
                            <MessageCircle size={16} className={row.dialogueActive ? 'fill-cyan-400/20' : ''} />
                          </button>
                        )}
                      </td>
                      <td className="py-6 px-4 text-center font-mono text-neutral-400 whitespace-nowrap">
                        <EditableCell value={row.ert.replace('sec', '秒 sec')} className="text-center" />
                      </td>
                      <td className="py-6 px-4"><EditableCell value={row.size} /></td>
                      <td className="py-6 px-4"><EditableCell value={row.perspective} /></td>
                      <td className="py-6 px-4"><EditableCell value={row.movement} /></td>
                      <td className="py-6 px-4"><EditableCell value={row.equipment} /></td>
                      <td className="py-6 px-4 text-center font-mono"><EditableCell value={row.focalLength} className="text-center" /></td>
                      <td className="py-6 px-4 text-center font-mono"><EditableCell value={row.aspectRatio} className="text-center" /></td>
                      <td className="py-6 px-4 text-center">
                        <button className="text-neutral-500 hover:text-cyan-400 font-medium transition-colors text-xs uppercase tracking-wider">
                          Add +
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <button 
                onClick={handleAddShot}
                className="w-full py-4 border border-dashed border-neutral-300 dark:border-white/10 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all flex items-center justify-center gap-2 mt-6 group"
              >
                <Plus size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium tracking-wide">ADD SHOT</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent flex justify-center pointer-events-none z-20">
          <motion.button 
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(34,211,238,0.6)" }}
            whileTap={{ scale: 0.98 }}
            onClick={onNext}
            className="pointer-events-auto flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-12 py-4 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)] border border-white/20"
          >
            <span className="tracking-widest uppercase text-sm">Choose Style</span>
            <Settings2 size={18} />
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
          className="h-24 w-8 flex items-center justify-center group relative -ml-8 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-neutral-200 dark:border-white/10 border-r-0 rounded-l-2xl shadow-[-8px_0_20px_rgba(0,0,0,0.05)] dark:shadow-[-8px_0_20px_rgba(0,0,0,0.5)] hover:bg-neutral-50 dark:hover:bg-black/80 transition-colors"
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
        className="border-l border-neutral-200 dark:border-white/10 bg-white/80 dark:bg-black/60 backdrop-blur-2xl flex flex-col shrink-0 overflow-hidden z-20 absolute right-0 top-0 bottom-0 shadow-[-20px_0_50px_rgba(0,0,0,0.05)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="w-[320px] flex flex-col h-full">
          <div className="p-5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/80 dark:bg-black/40">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)] dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="font-medium text-sm text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-500 tracking-wide uppercase">AI Co-writer</span>
            </div>
            <span className="text-[10px] font-mono bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded border border-neutral-200 dark:border-white/10">GLOBAL EDIT</span>
          </div>
          
          <div className="flex-1 p-5 overflow-y-auto space-y-6 scrollbar-hide">
            <div className="flex flex-wrap gap-2">
              <button className="text-xs px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 border border-neutral-200 dark:border-white/10 hover:border-cyan-200 dark:hover:border-cyan-500/30 rounded-full text-neutral-600 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-sm">Add an intro</button>
              <button className="text-xs px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 border border-neutral-200 dark:border-white/10 hover:border-cyan-200 dark:hover:border-cyan-500/30 rounded-full text-neutral-600 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-sm">Faster pacing</button>
              <button className="text-xs px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 border border-neutral-200 dark:border-white/10 hover:border-cyan-200 dark:hover:border-cyan-500/30 rounded-full text-neutral-600 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-sm">More action</button>
              <button className="text-xs px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 border border-neutral-200 dark:border-white/10 hover:border-cyan-200 dark:hover:border-cyan-500/30 rounded-full text-neutral-600 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-sm">Add plot twist</button>
            </div>

            <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-500/20 rounded-xl p-4 text-sm text-neutral-700 dark:text-cyan-100/80 leading-relaxed shadow-[inset_0_0_20px_rgba(34,211,238,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
              I&apos;ve generated a detailed shot list based on your prompt. You can edit the text directly in the table, or tell me how you&apos;d like to adjust the overall flow.
              <br/><br/>
              Try saying: <span className="text-cyan-600 dark:text-cyan-400">&quot;Make the 3rd shot a close-up&quot;</span> or <span className="text-cyan-600 dark:text-cyan-400">&quot;Add a transition shot between 1 and 2&quot;</span>.
            </div>
          </div>

          <div className="p-5 border-t border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-[#111]/50">
            <div className="relative group">
              <textarea 
                placeholder="Tell AI how to adjust..." 
                className="w-full bg-white dark:bg-black/50 border border-neutral-200 dark:border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder-neutral-400 dark:placeholder-neutral-600 resize-none min-h-[80px] shadow-sm dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-hover:border-neutral-300 dark:group-hover:border-white/20"
              />
              <button className="absolute right-3 bottom-3 p-2 bg-neutral-100 dark:bg-white/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all border border-transparent hover:border-cyan-200 dark:hover:border-cyan-500/30">
                <Send size={14} />
              </button>
            </div>
            <button className="w-full mt-3 flex items-center justify-center gap-2 py-3 bg-white dark:bg-white/5 hover:bg-neutral-50 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10 rounded-xl text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all uppercase tracking-wider text-[11px] font-medium shadow-sm dark:shadow-none">
              <RefreshCw size={14} />
              Regenerate Script
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
