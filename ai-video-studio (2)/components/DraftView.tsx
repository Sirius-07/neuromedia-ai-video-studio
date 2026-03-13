import { Sparkles, Image as ImageIcon, Bot, BotMessageSquare, User, Paperclip, X, CheckSquare, Square as SquareIcon, RefreshCw, Check, Maximize2, Lightbulb } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';

type UploadedFile = {
  id: string;
  url: string;
  type: 'image' | 'video';
  isScene: boolean;
};

const CREATIVE_CONCEPTS = [
  {
    id: 'concept-1',
    title: 'Neon Nights: The Cyberpunk Awakening',
    tags: ['Fast-paced', 'High Contrast', 'Action'],
    description: 'A high-energy sequence focusing on the vibrant nightlife and underground tech scene, using rapid cuts and neon color grading to create a visceral experience.',
    shots: [
      { type: 'AI Video', desc: 'Rapid zoom + motion blur effect, quick cuts of crowds under neon signs, high contrast lighting (2s)' },
      { type: 'Live Action', desc: 'Fast-forward treatment, cutting every 2 seconds, capturing the chaotic movement of hover-traffic with heavy synth bass (3s)' },
      { type: 'AI Video', desc: 'Low angle tracking shot of a protagonist walking through a crowded alley, rain slicked streets reflecting neon (4s)' }
    ]
  },
  {
    id: 'concept-2',
    title: 'Echoes of the Old World',
    tags: ['Cinematic', 'Slow Burn', 'Atmospheric'],
    description: 'A moody, slow-paced exploration of the abandoned sectors of the city, emphasizing environmental storytelling and atmospheric lighting to build tension.',
    shots: [
      { type: 'Live Action', desc: 'Static shot capturing the sunset over ruined skyscrapers, dust motes drifting in the fading light, complete silence (8s)' },
      { type: 'Live Action', desc: 'Slow pan across a deserted plaza, focusing on overgrown vegetation reclaiming the concrete, ambient wind sounds (7s)' },
      { type: 'AI Video', desc: 'Extreme close-up of a rusted artifact, shallow depth of field, slow rack focus to reveal a looming structure in the background (5s)' }
    ]
  },
  {
    id: 'concept-3',
    title: 'The Corporate Ascent',
    tags: ['Clean', 'Corporate', 'Thriller'],
    description: 'A sleek, sterile look at the upper echelons of the megacorporations, using symmetrical framing and cold, clinical lighting to convey power and control.',
    shots: [
      { type: 'AI Video', desc: 'Symmetrical wide shot of a pristine, white boardroom, slow push-in towards the empty CEO chair at the head of the table (6s)' },
      { type: 'Live Action', desc: 'Tracking shot following a sharply dressed executive walking down a glass corridor, cold blue lighting, rhythmic footsteps (5s)' },
      { type: 'AI Video', desc: 'High angle shot looking down a massive elevator shaft, geometric patterns of light and shadow, sense of vertigo (4s)' }
    ]
  }
];

export function DraftView({ onNext }: { onNext: () => void }) {
  const [genMode, setGenMode] = useState<'ai' | 'mixed' | 'live'>('ai');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConcepts, setGeneratedConcepts] = useState<any[]>(CREATIVE_CONCEPTS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'video' as 'image' | 'video',
        isScene: true,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const toggleFileRole = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isScene: !f.isScene } : f));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && files.length === 0) return;
    
    setIsModalOpen(true);
    setIsGenerating(true);
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.error('Gemini API Key is missing');
        setIsGenerating(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on the following prompt, generate 3 creative concepts for a short video or film.
        
        Prompt: ${prompt}
        
        Return the result as a JSON array of objects, where each object has the following structure:
        {
          "id": "unique-string-id",
          "title": "Concept Title",
          "tags": ["Tag1", "Tag2", "Tag3"],
          "description": "A short description of the concept.",
          "shots": [
            { "type": "AI Video" or "Live Action", "desc": "Description of the shot (duration)" }
          ]
        }
        Make sure to return ONLY the JSON array.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING },
                shots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      desc: { type: Type.STRING }
                    },
                    required: ["type", "desc"]
                  }
                }
              },
              required: ["id", "title", "tags", "description", "shots"]
            }
          }
        }
      });

      if (response.text) {
        try {
          const parsed = JSON.parse(response.text);
          setGeneratedConcepts(parsed);
        } catch (e) {
          console.error("Failed to parse JSON response:", e);
        }
      }
    } catch (error) {
      console.error("Error generating concepts:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full relative z-10">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 mb-6 shadow-xl dark:shadow-2xl">
          <Sparkles className="text-cyan-500 dark:text-white" size={32} />
        </div>
        <h1 className="text-4xl font-light tracking-tight text-neutral-900 dark:text-white mb-4">What will we create today?</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">Describe your vision, and AI will generate the script, storyboard, and soundtrack.</p>
      </div>

      <div className="w-full bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-2xl p-2 backdrop-blur-xl shadow-2xl focus-within:border-cyan-400/50 dark:focus-within:border-white/20 transition-colors">
        
        {files.length > 0 && (
          <div className="flex gap-4 p-4 overflow-x-auto border-b border-neutral-100 dark:border-white/5">
            {files.map(file => (
              <div key={file.id} className="relative group shrink-0 w-32 rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                {file.type === 'image' ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={file.url} alt="upload" className="w-full h-24 object-cover" />
                ) : (
                  <video src={file.url} className="w-full h-24 object-cover" />
                )}
                <button 
                  onClick={() => removeFile(file.id)}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <div 
                  onClick={() => toggleFileRole(file.id)}
                  className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1.5 flex items-center gap-1.5 cursor-pointer text-xs text-white hover:bg-black/80 transition-colors"
                >
                  {file.isScene ? <CheckSquare size={12} className="text-cyan-400" /> : <SquareIcon size={12} className="text-neutral-400" />}
                  <span className="truncate">{file.isScene ? 'Scene' : 'Reference'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <textarea 
          className="w-full bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 p-4 resize-none outline-none text-lg min-h-[140px]"
          placeholder="e.g., A cinematic trailer for a cyberpunk city, fast-paced editing, neon lights, with a heavy synthwave soundtrack..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        
        <div className="flex items-center justify-between p-2 border-t border-neutral-100 dark:border-white/5 mt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-black/50 rounded-lg p-1 border border-neutral-200 dark:border-white/5">
              <button 
                onClick={() => setGenMode('ai')}
                className={`p-2 rounded-md transition-colors ${genMode === 'ai' ? 'bg-white dark:bg-white/10 text-cyan-500 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'}`}
                title="Pure AI Generation"
              >
                <Bot size={16} />
              </button>
              <button 
                onClick={() => setGenMode('mixed')}
                className={`p-2 rounded-md transition-colors ${genMode === 'mixed' ? 'bg-white dark:bg-white/10 text-violet-500 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'}`}
                title="AI + Live Action"
              >
                <BotMessageSquare size={16} />
              </button>
              <button 
                onClick={() => setGenMode('live')}
                className={`p-2 rounded-md transition-colors ${genMode === 'live' ? 'bg-white dark:bg-white/10 text-fuchsia-500 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'}`}
                title="Pure Live Action"
              >
                <User size={16} />
              </button>
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-white/10"></div>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              title="Upload Image/Video"
            >
              <Paperclip size={18} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              multiple 
              accept="image/*,video/*" 
            />
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={!prompt.trim() && files.length === 0}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg ${
              !prompt.trim() && files.length === 0 
                ? 'bg-neutral-200 dark:bg-white/10 text-neutral-400 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white hover:opacity-90 shadow-cyan-500/20'
            }`}
          >
            <span>Generate Script</span>
            <Sparkles size={16} />
          </button>
        </div>
      </div>

      {/* Inspiration Lab Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Content */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative z-10"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-neutral-200 dark:border-white/5 bg-white dark:bg-neutral-900 relative">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="text-cyan-400" size={24} />
                  <h2 className="text-2xl font-medium text-neutral-900 dark:text-white tracking-wide">Inspiration Lab</h2>
                </div>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">AI is finding the best creative solutions for you...</p>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex-1 overflow-y-auto scrollbar-hide bg-neutral-50/50 dark:bg-neutral-950/50">
                {/* Status Bar */}
                <div className="bg-white dark:bg-neutral-800/50 rounded-xl p-4 flex items-center gap-3 mb-8 border border-neutral-200 dark:border-white/5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isGenerating ? 'bg-cyan-500/20' : 'bg-emerald-500/20'}`}>
                    {isGenerating ? (
                      <RefreshCw size={14} className="text-cyan-400 animate-spin" />
                    ) : (
                      <Check size={14} className="text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-neutral-900 dark:text-white font-medium text-sm flex items-center gap-2">
                      <Sparkles size={14} className="text-cyan-400" />
                      {isGenerating ? 'AI is generating creative solutions...' : 'AI has generated creative solutions'}
                    </div>
                    <div className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5">
                      {isGenerating ? 'This may take a few moments' : `Generated ${generatedConcepts.length} matching solutions`}
                    </div>
                  </div>
                </div>

                {/* Concepts Section */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-neutral-900 dark:text-white font-medium">Choose your favorite creative solution</h3>
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg transition-colors border border-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {isGenerating ? (
                    // Loading Skeletons
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800/30 h-[500px] p-5 flex flex-col gap-4 animate-pulse">
                        <div className="h-6 bg-neutral-200 dark:bg-white/10 rounded w-3/4"></div>
                        <div className="flex gap-2">
                          <div className="h-4 bg-neutral-200 dark:bg-white/10 rounded w-16"></div>
                          <div className="h-4 bg-neutral-200 dark:bg-white/10 rounded w-20"></div>
                        </div>
                        <div className="h-24 bg-neutral-200 dark:bg-white/10 rounded w-full mt-2"></div>
                        <div className="flex-1 mt-4 space-y-4">
                          <div className="h-12 bg-neutral-200 dark:bg-white/10 rounded w-full"></div>
                          <div className="h-12 bg-neutral-200 dark:bg-white/10 rounded w-full"></div>
                          <div className="h-12 bg-neutral-200 dark:bg-white/10 rounded w-full"></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    generatedConcepts.map((concept) => (
                      <div 
                        key={concept.id}
                        onClick={() => setSelectedConcept(concept.id)}
                        className={`relative rounded-2xl border transition-all cursor-pointer flex flex-col h-[500px] overflow-hidden ${
                          selectedConcept === concept.id 
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/10 shadow-[0_0_30px_rgba(6,182,212,0.15)]' 
                            : 'border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800/30 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 hover:border-neutral-300 dark:hover:border-white/20'
                        }`}
                      >
                        <button className="absolute top-4 right-4 p-1.5 rounded-md bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 transition-colors z-10">
                          <Maximize2 size={14} />
                        </button>
                        
                        <div className="p-5 border-b border-neutral-200 dark:border-white/5">
                          <h4 className="text-lg font-medium text-neutral-900 dark:text-white mb-3 pr-8 leading-tight">{concept.title}</h4>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {concept.tags?.map((tag: string) => (
                              <span key={tag} className="text-[11px] px-2 py-1 rounded-md bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></span>
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-neutral-300 leading-relaxed">
                            <Lightbulb size={14} className="inline mr-2 text-cyan-400 -mt-0.5" />
                            {concept.description}
                          </div>
                        </div>

                        <div className={`p-5 flex-1 overflow-y-auto scrollbar-hide relative ${selectedConcept === concept.id ? 'pb-14' : ''}`}>
                          <div className="text-xs text-neutral-500 mb-3">Shots preview ({concept.shots?.length || 0} shots):</div>
                          <div className="space-y-4 relative">
                            {/* Timeline line */}
                            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-neutral-200 dark:bg-white/10"></div>
                            
                            {concept.shots?.map((shot: any, idx: number) => (
                              <div key={idx} className="flex gap-3 relative z-10">
                                <div className="w-6 h-6 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 flex items-center justify-center text-[10px] text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5">
                                  {idx + 1}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded w-fit ${shot.type === 'AI Video' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300' : 'bg-neutral-100 dark:bg-neutral-500/20 text-neutral-600 dark:text-neutral-300'}`}>
                                    {shot.type}
                                  </span>
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{shot.desc}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {selectedConcept === concept.id && (
                          <div className="absolute bottom-0 left-0 right-0 bg-cyan-500 text-neutral-950 text-sm font-medium py-2.5 flex items-center justify-center gap-2 z-20">
                            <Check size={16} />
                            Selected
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-neutral-200 dark:border-white/5 bg-white dark:bg-neutral-900 flex justify-end gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (selectedConcept) {
                      setIsModalOpen(false);
                      onNext();
                    }
                  }}
                  disabled={!selectedConcept}
                  className={`px-8 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    selectedConcept 
                      ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/25 hover:opacity-90' 
                      : 'bg-white/5 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles size={16} />
                  Confirm & Generate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
