'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { DraftView } from '@/components/DraftView';
import { ScriptView } from '@/components/ScriptView';
import { StyleSelectionView } from '@/components/StyleSelectionView';
import { StoryboardView } from '@/components/StoryboardView';
import { EditorView } from '@/components/EditorView';
import { ChevronRight, ChevronLeft, AlignLeft, FileText, Palette, LayoutGrid, SlidersHorizontal, Sun, Moon, PanelLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Stage = 'draft' | 'script' | 'style' | 'storyboard' | 'editor';

export default function App() {
  const [stage, setStage] = useState<Stage>('draft');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const stepperStages = [
    { id: 'script', label: 'SCRIPT', icon: FileText },
    { id: 'style', label: 'STYLE', icon: Palette },
    { id: 'storyboard', label: 'STORYBOARD', icon: LayoutGrid },
    { id: 'editor', label: 'EDITOR', icon: SlidersHorizontal },
  ];

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen w-full`}>
      <div className="flex h-full bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 font-sans overflow-hidden selection:bg-cyan-500/30 transition-colors duration-500">
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Global Header */}
        <header className="h-16 border-b border-neutral-200 dark:border-white/10 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors duration-500">
          {/* Left: Logo & Back */}
          <div className="flex items-center gap-4 w-64">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 -ml-2 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              title="Toggle Sidebar"
            >
              <PanelLeft size={16} />
            </button>
            {stage !== 'draft' && (
              <button 
                onClick={() => setStage('draft')}
                className="p-1.5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                title="Back to Projects"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white dark:bg-[#111] border border-neutral-200 dark:border-white/20 rounded flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-violet-500 opacity-20" />
                <div className="w-1.5 h-1.5 bg-gradient-to-tr from-cyan-400 to-violet-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              </div>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500 font-bold tracking-[0.2em] text-xs">SYNTHESIS</span>
            </div>
          </div>
          
          {/* Center: Stepper */}
          <div className="flex-1 flex items-center justify-center gap-3">
            {stage !== 'draft' && stepperStages.map((s, i) => {
              const Icon = s.icon;
              const isActive = stage === s.id;
              const isPast = stepperStages.findIndex(x => x.id === stage) > i;
              
              return (
                <React.Fragment key={s.id}>
                  <button 
                    onClick={() => setStage(s.id as Stage)}
                    className={`flex items-center gap-2 px-2 py-1 transition-all whitespace-nowrap relative ${
                      isActive 
                        ? 'text-cyan-400 font-medium' 
                        : isPast
                          ? 'text-neutral-400 hover:text-neutral-200'
                          : 'text-neutral-600 hover:text-neutral-400'
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="activeStage" 
                        className="absolute -bottom-5 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-violet-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
                      />
                    )}
                    <Icon size={14} className={isActive ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : ''} />
                    <span className={isActive ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400' : ''}>{s.label}</span>
                  </button>
                  {i < stepperStages.length - 1 && (
                    <ChevronRight size={12} className="text-neutral-800 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          
          {/* Right: Settings */}
          <div className="w-64 flex justify-end items-center gap-6 text-neutral-500">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="hover:text-neutral-900 dark:hover:text-white transition-colors">PROJECT SETTINGS</button>
            <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center text-neutral-700 dark:text-white font-sans tracking-normal text-xs">JS</div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <AnimatePresence initial={false}>
            {isSidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 256, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="shrink-0 overflow-hidden border-r border-neutral-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] z-40 relative"
              >
                <div className="w-64 h-full">
                  <Sidebar />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area with Transitions */}
          <div className="flex-1 relative overflow-hidden bg-neutral-50/50 dark:bg-transparent transition-colors duration-500">
          
          {/* Ambient Background Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 dark:from-[#020202] dark:via-[#0a0a0f] dark:to-[#050510] z-[-1]" />
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/20 dark:bg-cyan-500/15 blur-[120px] mix-blend-normal dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/20 dark:bg-violet-500/15 blur-[120px] mix-blend-normal dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
            <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-fuchsia-500/20 dark:bg-fuchsia-500/10 blur-[120px] mix-blend-normal dark:mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
            {/* Subtle Grid */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTUwLCAxNTAsIDE1MCwgMC4xKSIvPjwvc3ZnPg==')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wMykiLz48L3N2Zz4=')] opacity-100" />
          </div>

          <AnimatePresence mode="wait">
            {stage === 'draft' && (
              <motion.div 
                key="draft"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex z-10"
              >
                <DraftView onNext={() => setStage('script')} />
              </motion.div>
            )}
            {stage === 'script' && (
              <motion.div 
                key="script"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex z-10"
              >
                <ScriptView onNext={() => setStage('style')} />
              </motion.div>
            )}
            {stage === 'style' && (
              <motion.div 
                key="style"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex z-10"
              >
                <StyleSelectionView onNext={() => setStage('storyboard')} />
              </motion.div>
            )}
            {stage === 'storyboard' && (
              <motion.div 
                key="storyboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex z-10"
              >
                <StoryboardView onNext={() => setStage('editor')} />
              </motion.div>
            )}
            {stage === 'editor' && (
              <motion.div 
                key="editor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex z-10"
              >
                <EditorView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
