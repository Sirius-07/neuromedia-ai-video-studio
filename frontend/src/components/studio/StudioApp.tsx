import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Palette,
  LayoutGrid,
  SlidersHorizontal,
  Sun,
  Moon,
  PanelLeft,
  Plus,
  Film,
  MoreHorizontal,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { StartPage } from '../StartPage';
import { ScriptEditorPage } from '../ScriptEditorPage';
import { StyleSelectionPage } from '../StyleSelectionPage';
import { VisualStoryboardPage } from '../storyboard/VisualStoryboardPage';
import { EditorPage } from '../EditorPage';
import { CollaborationPanel, CollaborationContext, useCollaboration } from '../collaboration/CollaborationPanel';
import type { CollaborationPanelHandle } from '../collaboration/CollaborationPanel';
import type { ProjectActivity, SystemChatMessage, ProjectStage } from '../collaboration/types';
import { getRecentProjects, deleteProject, ProjectListItem } from '../../api/projectApi';
import { getProject } from '../../api/projectApi';

// ── Dark Mode Context ─────────────────────────────────────────────────────────

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const DarkModeContext = createContext<DarkModeContextType>({
  isDarkMode: true,
  toggleDarkMode: () => {},
});

export const useDarkMode = () => useContext(DarkModeContext);

// ── Route → Stage Mapping ────────────────────────────────────────────────────

const ROUTE_TO_STAGE: Record<string, string> = {
  '/': 'draft',
  '/script-editor': 'script',
  '/style-selection': 'style',
  '/storyboard': 'storyboard',
  '/editor': 'editor',
};

const ROUTE_TO_COLLAB_STAGE: Record<string, ProjectStage | undefined> = {
  '/script-editor': 'script',
  '/style-selection': 'style',
  '/storyboard': 'storyboard',
  '/editor': 'editor',
};

const stepperStages = [
  { id: 'script', label: 'SCRIPT', icon: FileText },
  { id: 'style', label: 'STYLE', icon: Palette },
  { id: 'storyboard', label: 'STORYBOARD', icon: LayoutGrid },
  { id: 'editor', label: 'EDITOR', icon: SlidersHorizontal },
];

// ── Projects Dropdown ─────────────────────────────────────────────────────────

interface ProjectsDropdownProps {
  recentProjects: ProjectListItem[];
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onNewProject: () => void;
}

const ProjectsDropdown: React.FC<ProjectsDropdownProps> = ({
  recentProjects,
  onOpenProject,
  onDeleteProject,
  onNewProject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono tracking-wider transition-colors ${
          isOpen
            ? 'bg-white/10 text-neutral-200'
            : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.06]'
        }`}
      >
        <FolderOpen size={12} />
        <span>PROJECTS</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={10} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-64 bg-[#111114] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden z-[100]"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.06)' }}
          >
            {/* New project button */}
            <div className="p-2 border-b border-white/[0.06]">
              <button
                onClick={() => { onNewProject(); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-colors font-medium"
              >
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-500/30 to-violet-500/30 flex items-center justify-center border border-white/[0.1]">
                  <Plus size={11} className="text-cyan-400" />
                </div>
                新建项目
              </button>
            </div>

            {/* Recent projects */}
            <div className="max-h-64 overflow-y-auto">
              {recentProjects.length === 0 ? (
                <div className="px-4 py-6 text-center text-[11px] text-neutral-600 font-mono">
                  暂无记录
                </div>
              ) : (
                <div className="p-2">
                  <div className="text-[9px] font-mono tracking-widest text-neutral-700 uppercase px-2 py-1.5">
                    最近项目
                  </div>
                  {recentProjects.map((project, i) => (
                    <div
                      key={project.id}
                      onClick={() => { onOpenProject(project.id); setIsOpen(false); }}
                      onMouseEnter={() => setHoveredId(project.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
                        i === 0
                          ? 'bg-cyan-500/[0.08] text-cyan-300'
                          : 'text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <Film
                          size={12}
                          className={i === 0 ? 'text-cyan-500 shrink-0' : 'text-neutral-600 shrink-0'}
                        />
                        <span className="text-[12px] truncate">{project.title || '未命名项目'}</span>
                      </div>
                      {hoveredId === project.id && (
                        <button
                          onClick={e => { onDeleteProject(project.id, e); }}
                          className="p-1 hover:bg-red-500/10 hover:text-red-400 text-neutral-600 rounded transition-colors shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Account footer */}
            <div className="border-t border-white/[0.06] p-2">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.05] cursor-pointer transition-colors">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 shrink-0" />
                <span className="text-[12px] text-neutral-400">Creator Account</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main Layout Component ─────────────────────────────────────────────────────

export function StudioApp() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isCollabOpen, setIsCollabOpen] = useState(true);
  const [recentProjects, setRecentProjects] = useState<ProjectListItem[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const currentStage = ROUTE_TO_STAGE[currentPath] || 'draft';
  const currentCollabStage = ROUTE_TO_COLLAB_STAGE[currentPath];
  const isDraft = currentStage === 'draft';

  /** Ref to CollaborationPanel — allows any page to inject events via context */
  const collabPanelRef = React.useRef<CollaborationPanelHandle>(null);

  const injectCollabEvent = React.useCallback(
    (activity: ProjectActivity, systemMsg: SystemChatMessage) => {
      collabPanelRef.current?.injectEvent(activity, systemMsg);
    },
    []
  );

  // Load dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem('synthesis_dark_mode');
    if (saved !== null) setIsDarkMode(saved === 'true');
  }, []);

  // Load project list
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const result = await getRecentProjects(20);
      if (result.success && result.data) {
        setRecentProjects(result.data);
      }
    } catch {
      // Silently fail - supplementary
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('synthesis_dark_mode', String(next));
      return next;
    });
  };

  const handleStageClick = (stageId: string) => {
    const targetIdx = stepperStages.findIndex(s => s.id === stageId);
    const currentIdx = stepperStages.findIndex(s => s.id === currentStage);
    if (targetIdx < currentIdx) { navigate(-(currentIdx - targetIdx)); return; }
    if (targetIdx > currentIdx) { navigate(targetIdx - currentIdx); return; }
  };

  const handleOpenProject = async (projectId: string) => {
    try {
      const result = await getProject(projectId);
      if (result.success && result.data) {
        const project = result.data;
        const settings = (project.settings || {}) as Record<string, any>;
        const currentPage: string = settings.currentPage || '';

        const hasStoryboard = Array.isArray(project.storyboardData) && project.storyboardData.length > 0;
        const hasProposal = !!settings.inspirationProposal;
        const hasScenes = Array.isArray(settings.customScenes) && settings.customScenes.length > 0;

        const scriptEditorState = {
          proposal: settings.inspirationProposal,
          uploadedAssets: settings.uploadedAssets || [],
          selectedAssetIds: settings.selectedAssetIds || [],
          userPrompt: project.userPrompt || '',
          generationMode: settings.generationMode || 'ai_generated',
          savedScenes: settings.customScenes || null,
          projectId: project.id,
          aspectRatio: settings.aspectRatio,
          artStyle: settings.artStyle,
        };

        const styleSelectionState = {
          projectId: project.id,
          scenes: settings.customScenes || [],
          userPrompt: project.userPrompt || '',
          uploadedAssets: settings.uploadedAssets || [],
          generationMode: settings.generationMode || 'ai_generated',
          proposal: settings.inspirationProposal,
          aspectRatio: settings.aspectRatio || '16:9',
          settingInput: settings.customVisualStyle || '',
        };

        const goToScriptEditor = () => navigate('/script-editor', { state: scriptEditorState });

        if (currentPage === 'script-editor') { goToScriptEditor(); return; }

        if (currentPage === 'style-selection') {
          navigate('/script-editor', { state: scriptEditorState });
          navigate('/style-selection', { state: styleSelectionState });
          return;
        }

        if (!currentPage && hasProposal && hasScenes && !hasStoryboard) {
          goToScriptEditor();
          return;
        }

        if (project.soundtrackTaskId || project.status === 'soundtrack' || project.status === 'completed') {
          navigate('/editor', { state: { projectId: project.id, projectData: project } });
          return;
        }

        sessionStorage.setItem('storyboard_navigation_flag', 'true');
        navigate('/script-editor', { state: scriptEditorState });
        navigate('/style-selection', { state: styleSelectionState });
        navigate(`/storyboard?projectId=${project.id}`, {
          state: {
            projectId: project.id,
            projectData: project,
            scriptData: project.storyboardData
              ? { scenes: project.storyboardData, title: project.title, project_id: project.id }
              : null,
          },
        });
      }
    } catch {
      alert('打开项目失败，请重试');
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除此项目吗？')) return;
    try {
      const result = await deleteProject(projectId);
      if (result.success) {
        setRecentProjects(prev => prev.filter(p => p.id !== projectId));
      }
    } catch {
      alert('删除失败，请重试');
    }
  };

  const darkModeContextValue: DarkModeContextType = { isDarkMode, toggleDarkMode };

  const collabContextValue = React.useMemo(
    () => ({ injectEvent: injectCollabEvent, currentStage: currentCollabStage }),
    [injectCollabEvent, currentCollabStage]
  );

  return (
    <DarkModeContext.Provider value={darkModeContextValue}>
    <CollaborationContext.Provider value={collabContextValue}>
      <div className={`${isDarkMode ? 'dark' : ''} h-screen w-full`}>
        <div className="flex h-full bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 font-sans overflow-hidden selection:bg-cyan-500/30 transition-colors duration-500">
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">

            {/* ── Global Header ──────────────────────────────────── */}
            <header className="h-14 border-b border-neutral-200 dark:border-white/[0.08] bg-white/80 dark:bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-50 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors duration-500">

              {/* Left: CollapsePanel + Logo + Projects dropdown */}
              <div className="flex items-center gap-2 w-72">
                <button
                  onClick={() => setIsCollabOpen(prev => !prev)}
                  className="p-1.5 hover:bg-neutral-200 dark:hover:bg-white/[0.08] rounded-lg text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-cyan-400 transition-colors"
                  title="Toggle Collaboration Panel"
                >
                  <PanelLeft size={15} />
                </button>

                {!isDraft && (
                  <button
                    onClick={() => navigate('/')}
                    className="p-1.5 hover:bg-neutral-200 dark:hover:bg-white/[0.08] rounded-lg text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    title="Back to Projects"
                  >
                    <ChevronLeft size={15} />
                  </button>
                )}

                {/* Logo */}
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                    <defs>
                      <linearGradient id="nm-grad-a" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#81F2F8" />
                        <stop offset="100%" stopColor="#4db8c4" />
                      </linearGradient>
                      <linearGradient id="nm-grad-b" x1="0" y1="20" x2="20" y2="0" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#81F2F8" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#4db8c4" stopOpacity="0.08" />
                      </linearGradient>
                      <filter id="nm-glow">
                        <feGaussianBlur stdDeviation="1.2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    {/* Background */}
                    <rect width="20" height="20" rx="4" fill="url(#nm-grad-b)" />
                    <rect width="20" height="20" rx="4" fill="none" stroke="url(#nm-grad-a)" strokeWidth="0.6" strokeOpacity="0.5" />
                    {/* Neural node ring */}
                    <circle cx="10" cy="10" r="3.5" fill="none" stroke="url(#nm-grad-a)" strokeWidth="1" strokeOpacity="0.6" />
                    {/* Center dot */}
                    <circle cx="10" cy="10" r="1.5" fill="url(#nm-grad-a)" filter="url(#nm-glow)" />
                    {/* Spoke lines */}
                    <line x1="10" y1="3" x2="10" y2="6.5" stroke="url(#nm-grad-a)" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.9" />
                    <line x1="10" y1="13.5" x2="10" y2="17" stroke="url(#nm-grad-a)" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.9" />
                    <line x1="3" y1="10" x2="6.5" y2="10" stroke="url(#nm-grad-a)" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.9" />
                    <line x1="13.5" y1="10" x2="17" y2="10" stroke="url(#nm-grad-a)" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.9" />
                    {/* Diagonal spokes */}
                    <line x1="4.9" y1="4.9" x2="7.4" y2="7.4" stroke="url(#nm-grad-a)" strokeWidth="0.75" strokeLinecap="round" strokeOpacity="0.5" />
                    <line x1="12.6" y1="12.6" x2="15.1" y2="15.1" stroke="url(#nm-grad-a)" strokeWidth="0.75" strokeLinecap="round" strokeOpacity="0.5" />
                    <line x1="15.1" y1="4.9" x2="12.6" y2="7.4" stroke="url(#nm-grad-a)" strokeWidth="0.75" strokeLinecap="round" strokeOpacity="0.5" />
                    <line x1="4.9" y1="15.1" x2="7.4" y2="12.6" stroke="url(#nm-grad-a)" strokeWidth="0.75" strokeLinecap="round" strokeOpacity="0.5" />
                  </svg>
                  <span className="text-transparent bg-clip-text font-bold tracking-[0.2em] text-xs whitespace-nowrap" style={{ backgroundImage: 'linear-gradient(to right, #81F2F8, #4db8c4)' }}>
                    NeuroMedia
                  </span>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-neutral-200 dark:bg-white/[0.1] mx-1" />

                {/* Projects dropdown */}
                <ProjectsDropdown
                  recentProjects={recentProjects}
                  onOpenProject={handleOpenProject}
                  onDeleteProject={handleDeleteProject}
                  onNewProject={() => navigate('/')}
                />
              </div>

              {/* Center: Stepper */}
              <div className="flex-1 flex items-center justify-center gap-3">
                {!isDraft && stepperStages.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = currentStage === s.id;
                  const currentIdx = stepperStages.findIndex(x => x.id === currentStage);
                  const isPast = currentIdx > i;

                  return (
                    <React.Fragment key={s.id}>
                      <button
                        onClick={() => handleStageClick(s.id)}
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
                            className="absolute -bottom-[18px] left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-violet-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                          />
                        )}
                        <Icon
                          size={13}
                          className={isActive ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : ''}
                        />
                        <span className={isActive ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400' : ''}>
                          {s.label}
                        </span>
                      </button>
                      {i < stepperStages.length - 1 && (
                        <ChevronRight size={11} className="text-neutral-800 dark:text-neutral-700 shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Right: Dark mode + Settings + Avatar */}
              <div className="w-72 flex justify-end items-center gap-3 text-neutral-500">
                <button
                  onClick={toggleDarkMode}
                  className="p-1.5 hover:bg-neutral-200 dark:hover:bg-white/[0.08] rounded-lg transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                >
                  {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button className="hover:text-neutral-900 dark:hover:text-white transition-colors text-[10px] hidden lg:block">
                  PROJECT SETTINGS
                </button>
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold text-[10px] font-sans tracking-normal shrink-0">
                  AC
                </div>
              </div>
            </header>

            {/* ── Content Area ────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden relative">

              {/* Collaboration Panel */}
              <CollaborationPanel
                ref={collabPanelRef}
                isOpen={isCollabOpen}
                onToggle={() => setIsCollabOpen(p => !p)}
                currentStage={currentCollabStage}
                onFocusShot={(shotId) => {
                  navigate(`/storyboard?focus=${shotId}`);
                }}
              />

              {/* Main Content Area */}
              <div className="flex-1 relative overflow-hidden bg-neutral-50/50 dark:bg-transparent transition-colors duration-500">
                {/* Ambient background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 dark:from-[#020202] dark:via-[#0a0a0f] dark:to-[#050510]" />
                  <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                  <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 dark:bg-violet-500/15 blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                  <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-fuchsia-500/10 dark:bg-fuchsia-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
                </div>

                {/* Page routes */}
                <div className="relative z-10 h-full">
                  <Routes>
                    <Route path="/" element={<StartPage onProjectsChange={loadProjects} />} />
                    <Route path="/script-editor" element={<ScriptEditorPage />} />
                    <Route path="/style-selection" element={<StyleSelectionPage />} />
                    <Route path="/storyboard" element={<VisualStoryboardPage />} />
                    <Route path="/editor" element={<EditorPage />} />
                    <Route path="*" element={<StartPage onProjectsChange={loadProjects} />} />
                  </Routes>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollaborationContext.Provider>
    </DarkModeContext.Provider>
  );
}
