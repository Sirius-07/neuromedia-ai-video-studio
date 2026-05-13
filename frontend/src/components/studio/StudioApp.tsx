import React, { useState, useEffect, useRef, createContext, useContext, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronDown,
  Sun,
  Moon,
  Plus,
  Film,
  Trash2,
  FolderOpen,
  Settings2,
  SlidersHorizontal,
  Check,
  Cloud,
  UserRound,
  UserPlus,
  LogOut,
  Bell,
} from 'lucide-react';
import { StartPage } from '../StartPage';
import { ScriptEditorPage } from '../ScriptEditorPage';
import { StyleSelectionPage } from '../StyleSelectionPage';
import { VisualStoryboardPage } from '../storyboard/VisualStoryboardPage';
import { VideoHandoffPage } from '../handoff/VideoHandoffPage';
import { type WorkbenchHeaderIntent } from '../storyboard/workbenchHeaderMeta';
import { EditorPage } from '../EditorPage';
import { getRecentProjects, deleteProject, ProjectListItem } from '../../api/projectApi';
import { getProject } from '../../api/projectApi';
import { mergeCreationIntentFromProject } from '../../types/creationIntent';
import { getStudioHeaderSummary } from './studioHeaderMeta';

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
  '/handoff': 'handoff',
};

function hasExplicitWorkbenchIntent(settings?: Record<string, any> | null) {
  return Boolean(settings?.creationIntent || settings?.inputMode || settings?.publishGoal);
}

type AspectRatioOption = '16:9' | '9:16' | '1:1';
type RenderModeOption = 'quick' | 'cinematic';
type PresenceOption = '创作中' | '审片中' | '离线';

const aspectRatioOptions: Array<{ id: AspectRatioOption; label: string; detail: string }> = [
  { id: '16:9', label: '16:9', detail: '横屏' },
  { id: '9:16', label: '9:16', detail: '竖屏' },
  { id: '1:1', label: '1:1', detail: '方形' },
];

const renderModeOptions: Array<{ id: RenderModeOption; label: string; detail: string }> = [
  { id: 'quick', label: '快速成片', detail: '轻量生成' },
  { id: 'cinematic', label: '精细分镜', detail: '逐镜优化' },
];

const presenceOptions: PresenceOption[] = ['创作中', '审片中', '离线'];

interface HeaderActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const HeaderActionButton: React.FC<HeaderActionButtonProps> = ({
  active = false,
  className = '',
  children,
  ...props
}) => (
  <button
    {...props}
    data-active={active}
    className={`group relative inline-flex h-8 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-lg border px-2.5 text-[11px] font-medium tracking-[0.08em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080a] ${
      active
        ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-700 shadow-[0_0_20px_rgba(34,211,238,0.10)] dark:text-cyan-200'
        : 'border-transparent text-neutral-500 hover:border-cyan-500/20 hover:bg-cyan-500/[0.06] hover:text-neutral-900 dark:hover:border-white/[0.1] dark:hover:bg-white/[0.06] dark:hover:text-neutral-100'
    } ${className}`}
  >
    <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[linear-gradient(110deg,transparent,rgba(129,242,248,0.12),transparent)]" />
    <span className="relative z-10 flex items-center gap-2">{children}</span>
  </button>
);

interface ToggleRowProps {
  checked: boolean;
  description: string;
  label: string;
  onChange: (next: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  checked,
  description,
  label,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white/50 px-3 py-2.5 text-left transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-cyan-400/20 dark:hover:bg-cyan-400/[0.05]"
  >
    <span className="min-w-0">
      <span className="block text-[12px] font-medium tracking-normal text-neutral-800 dark:text-neutral-200">{label}</span>
      <span className="mt-0.5 block text-[10px] tracking-normal text-neutral-500">{description}</span>
    </span>
    <span
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
        checked
          ? 'border-cyan-500/50 bg-cyan-500/20 dark:border-cyan-400/50 dark:bg-cyan-400/25'
          : 'border-neutral-300 bg-neutral-100 dark:border-white/[0.12] dark:bg-neutral-900'
      }`}
    >
      <span
        className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-transform ${
          checked
            ? 'translate-x-[19px] bg-cyan-500 shadow-[0_0_10px_rgba(5,143,195,0.35)] dark:bg-cyan-300 dark:shadow-[0_0_10px_rgba(34,211,238,0.55)]'
            : 'translate-x-0.5 bg-neutral-400 dark:bg-neutral-500'
        }`}
      />
    </span>
  </button>
);

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

  // Close on outside click / Escape
  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', clickHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <HeaderActionButton
        onClick={() => setIsOpen(prev => !prev)}
        active={isOpen}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="打开项目菜单"
      >
        <FolderOpen size={14} className="shrink-0" />
        <span className="hidden whitespace-nowrap sm:inline">项目</span>
        {recentProjects.length > 0 && (
          <span className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] leading-none text-cyan-300 sm:inline-flex">
            {recentProjects.length}
          </span>
        )}
        <motion.div className="hidden shrink-0 sm:block" animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={12} />
        </motion.div>
      </HeaderActionButton>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="nm-popover absolute top-full left-0 mt-2 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white/95 text-neutral-800 shadow-2xl backdrop-blur-xl z-[100] normal-case dark:border-white/[0.1] dark:bg-[#111114] dark:text-neutral-200"
            style={{ boxShadow: '0 20px 60px rgba(48,39,26,0.18), 0 0 0 0.5px rgba(255,255,255,0.5)' }}
          >
            {/* New project button */}
            <div className="p-2 border-b border-neutral-200 dark:border-white/[0.06]">
              <button
                onClick={() => { onNewProject(); setIsOpen(false); }}
                className="nm-popover-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-neutral-600 hover:bg-cyan-500/[0.08] hover:text-neutral-900 transition-colors font-medium dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
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
                  <div className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase px-2 py-1.5 dark:text-neutral-700">
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
                          ? 'bg-cyan-500/[0.08] text-cyan-700 dark:text-cyan-300'
                          : 'text-neutral-500 hover:bg-cyan-500/[0.07] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <Film
                          size={12}
                          className={i === 0 ? 'text-cyan-500 shrink-0' : 'text-neutral-400 shrink-0 dark:text-neutral-600'}
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
            <div className="border-t border-neutral-200 p-2 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-cyan-500/[0.07] cursor-pointer transition-colors dark:hover:bg-white/[0.05]">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 shrink-0" />
                <span className="text-[12px] text-neutral-400">创作者账户</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ProjectSettingsPopoverProps {
  aspectRatio: AspectRatioOption;
  autoSave: boolean;
  collaborationCursors: boolean;
  onSave: () => void;
  renderMode: RenderModeOption;
  setAspectRatio: (value: AspectRatioOption) => void;
  setAutoSave: (value: boolean) => void;
  setCollaborationCursors: (value: boolean) => void;
  setRenderMode: (value: RenderModeOption) => void;
}

const ProjectSettingsPopover: React.FC<ProjectSettingsPopoverProps> = ({
  aspectRatio,
  autoSave,
  collaborationCursors,
  onSave,
  renderMode,
  setAspectRatio,
  setAutoSave,
  setCollaborationCursors,
  setRenderMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', clickHandler);
      document.removeEventListener('keydown', keyHandler);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleSave = () => {
    onSave();
    setSaved(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div ref={ref} className="relative">
      <HeaderActionButton
        active={isOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(prev => !prev)}
        title="项目设置"
      >
        <Settings2 size={14} />
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
      </HeaderActionButton>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="nm-popover absolute right-0 top-full z-[100] mt-2 w-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-white/95 text-neutral-800 shadow-2xl backdrop-blur-xl normal-case dark:border-white/[0.1] dark:bg-[#101014]/95 dark:text-neutral-200"
            style={{ boxShadow: '0 24px 70px rgba(48,39,26,0.2), 0 0 0 0.5px rgba(255,255,255,0.55)' }}
          >
            <div className="nm-popover-section border-b border-neutral-200 bg-white/40 px-4 py-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.12em] text-neutral-100">项目偏好</p>
                  <p className="mt-1 text-[10px] tracking-normal text-neutral-500">控制新项目的默认工作方式</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                  <SlidersHorizontal size={15} />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500">画幅</p>
                  <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] tracking-normal text-neutral-500">
                    默认 {aspectRatio}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-neutral-200 bg-neutral-900/[0.04] p-1 dark:border-white/[0.06] dark:bg-black/20">
                  {aspectRatioOptions.map(option => {
                    const selected = aspectRatio === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAspectRatio(option.id)}
                        className={`rounded-md px-2 py-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                          selected
                            ? 'bg-cyan-500/12 text-cyan-700 shadow-[inset_0_0_0_1px_rgba(5,143,195,0.24)] dark:bg-cyan-400/15 dark:text-cyan-200 dark:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.24)]'
                            : 'text-neutral-500 hover:bg-cyan-500/[0.06] hover:text-neutral-800 dark:hover:bg-white/[0.05] dark:hover:text-neutral-200'
                        }`}
                      >
                        <span className="block text-[12px] font-semibold tracking-normal">{option.label}</span>
                        <span className="mt-0.5 block text-[9px] tracking-normal opacity-70">{option.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-neutral-500">生成方式</p>
                <div className="grid grid-cols-2 gap-2">
                  {renderModeOptions.map(option => {
                    const selected = renderMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setRenderMode(option.id)}
                        className={`rounded-lg border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                          selected
                            ? 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-100'
                            : 'border-neutral-200 bg-white/45 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/[0.12] dark:hover:text-neutral-200'
                        }`}
                      >
                        <span className="block text-[12px] font-medium tracking-normal">{option.label}</span>
                        <span className="mt-1 block text-[9px] tracking-normal opacity-70">{option.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-2">
                <ToggleRow
                  checked={autoSave}
                  description="在脚本、风格、分镜之间保留草稿"
                  label="自动保存"
                  onChange={setAutoSave}
                />
                <ToggleRow
                  checked={collaborationCursors}
                  description="显示团队成员的在线标记和操作提示"
                  label="协作光标"
                  onChange={setCollaborationCursors}
                />
              </div>
            </div>

            <div className="nm-popover-section flex items-center justify-between border-t border-neutral-200 bg-white/40 px-4 py-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
              <span className={`text-[10px] tracking-normal transition-colors ${saved ? 'text-cyan-300' : 'text-neutral-500'}`}>
                {saved ? '偏好已保存' : '本地偏好'}
              </span>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium tracking-normal text-cyan-700 transition-colors hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/18"
              >
                {saved ? <Check size={13} /> : <Cloud size={13} />}
                {saved ? '已保存' : '保存偏好'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ProfileMenuProps {
  onOpenWorkspace: () => void;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({ onOpenWorkspace }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [presence, setPresence] = useState<PresenceOption>('创作中');
  const [inviteReady, setInviteReady] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inviteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', clickHandler);
      document.removeEventListener('keydown', keyHandler);
      if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
    };
  }, []);

  const handleInvite = () => {
    setInviteReady(true);
    if (inviteTimerRef.current) window.clearTimeout(inviteTimerRef.current);
    inviteTimerRef.current = window.setTimeout(() => setInviteReady(false), 1800);
  };

  return (
    <div ref={ref} className="relative">
      <HeaderActionButton
        active={isOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="h-8 w-8 rounded-full border-cyan-400/20 p-0"
        onClick={() => setIsOpen(prev => !prev)}
        title="打开账户菜单"
      >
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 text-[11px] font-bold tracking-normal text-white shadow-[0_0_18px_rgba(34,211,238,0.22)]">
          AC
          <span className="absolute -right-0.5 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-[#101014] bg-emerald-400" />
        </span>
      </HeaderActionButton>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="nm-popover absolute right-0 top-full z-[100] mt-2 w-[280px] overflow-hidden rounded-xl border border-neutral-200 bg-white/95 text-neutral-800 shadow-2xl backdrop-blur-xl normal-case dark:border-white/[0.1] dark:bg-[#101014]/95 dark:text-neutral-200"
            style={{ boxShadow: '0 24px 70px rgba(48,39,26,0.2), 0 0 0 0.5px rgba(255,255,255,0.55)' }}
          >
            <div className="nm-popover-section border-b border-neutral-200 bg-white/40 p-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 text-[13px] font-bold tracking-normal text-white">
                  AC
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold tracking-normal text-neutral-100">Ava Chen</p>
                  <p className="mt-0.5 text-[10px] tracking-normal text-neutral-500">创作总监 · NeuroMedia</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-neutral-900/[0.04] p-1 dark:bg-black/20">
                {presenceOptions.map(option => {
                  const selected = presence === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPresence(option)}
                      className={`rounded-md px-2 py-1.5 text-[10px] tracking-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                        selected
                          ? 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/14 dark:text-emerald-200'
                          : 'text-neutral-500 hover:bg-emerald-500/[0.06] hover:text-neutral-800 dark:hover:bg-white/[0.05] dark:hover:text-neutral-200'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 p-2">
              <button
                type="button"
                onClick={() => { onOpenWorkspace(); setIsOpen(false); }}
                className="nm-popover-item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12px] tracking-normal text-neutral-600 transition-colors hover:bg-cyan-500/[0.08] hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <UserRound size={14} className="text-cyan-300" />
                打开创作台
              </button>
              <button
                type="button"
                onClick={handleInvite}
                className="nm-popover-item flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12px] tracking-normal text-neutral-600 transition-colors hover:bg-cyan-500/[0.08] hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <UserPlus size={14} className="text-violet-300" />
                  邀请协作者
                </span>
                {inviteReady && <Check size={13} className="text-cyan-300" />}
              </button>
              <button
                type="button"
                onClick={() => setNotificationsEnabled(prev => !prev)}
                className="nm-popover-item flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12px] tracking-normal text-neutral-600 transition-colors hover:bg-cyan-500/[0.08] hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Bell size={14} className="text-amber-300" />
                  顶栏通知
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] ${notificationsEnabled ? 'bg-cyan-400/10 text-cyan-300' : 'bg-white/[0.05] text-neutral-500'}`}>
                  {notificationsEnabled ? '开' : '关'}
                </span>
              </button>
            </div>

            <div className="border-t border-neutral-200 p-2 dark:border-white/[0.07]">
              <button
                type="button"
                onClick={() => setPresence('离线')}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12px] tracking-normal text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
              >
                <LogOut size={14} />
                切换为离线
              </button>
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
  const [recentProjects, setRecentProjects] = useState<ProjectListItem[]>([]);
  const [loadedHeaderIntent, setLoadedHeaderIntent] = useState<WorkbenchHeaderIntent | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(() => {
    const saved = localStorage.getItem('neuromedia_project_aspect_ratio') as AspectRatioOption | null;
    return aspectRatioOptions.some(option => option.id === saved) ? saved : '16:9';
  });
  const [renderMode, setRenderMode] = useState<RenderModeOption>(() => {
    const saved = localStorage.getItem('neuromedia_render_mode') as RenderModeOption | null;
    return renderModeOptions.some(option => option.id === saved) ? saved : 'quick';
  });
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('neuromedia_auto_save') !== 'false');
  const [collaborationCursors, setCollaborationCursors] = useState(
    () => localStorage.getItem('neuromedia_collaboration_cursors') !== 'false',
  );

  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const currentStage = ROUTE_TO_STAGE[currentPath] || 'draft';
  const isDraft = currentStage === 'draft';
  const routeState = location.state as {
    creationIntent?: WorkbenchHeaderIntent;
    projectData?: { title?: string };
  } | null;
  const routeCreationIntent = routeState?.creationIntent;
  const currentProjectId = useMemo(() => new URLSearchParams(location.search).get('projectId'), [location.search]);
  const currentProject = currentProjectId
    ? recentProjects.find(project => project.id === currentProjectId)
    : undefined;
  const savedCreationIntent = useMemo(() => {
    if (!currentProject || !hasExplicitWorkbenchIntent(currentProject.settings)) return null;
    return mergeCreationIntentFromProject(currentProject);
  }, [currentProject]);
  const headerCreationIntent = routeCreationIntent || savedCreationIntent || loadedHeaderIntent;
  const headerProjectTitle = routeState?.projectData?.title || currentProject?.title || (currentProjectId ? '未命名项目' : '');
  const headerStageSummary = !isDraft ? getStudioHeaderSummary(currentStage, headerCreationIntent) : '';

  // Load dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem('synthesis_dark_mode');
    if (saved !== null) setIsDarkMode(saved === 'true');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Load project list
  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (currentStage !== 'storyboard' || !currentProjectId || routeCreationIntent || savedCreationIntent) {
      setLoadedHeaderIntent(null);
      return;
    }

    let cancelled = false;
    setLoadedHeaderIntent(null);

    getProject(currentProjectId).then(result => {
      if (cancelled) return;

      const intent = result.success && result.data && hasExplicitWorkbenchIntent(result.data.settings)
        ? mergeCreationIntentFromProject(result.data)
        : null;

      setLoadedHeaderIntent(intent);
    }).catch(() => {
      if (!cancelled) setLoadedHeaderIntent(null);
    });

    return () => {
      cancelled = true;
    };
  }, [currentStage, currentProjectId, routeCreationIntent, savedCreationIntent]);

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

  const saveProjectPreferences = () => {
    localStorage.setItem('neuromedia_project_aspect_ratio', aspectRatio);
    localStorage.setItem('neuromedia_render_mode', renderMode);
    localStorage.setItem('neuromedia_auto_save', String(autoSave));
    localStorage.setItem('neuromedia_collaboration_cursors', String(collaborationCursors));
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

        const uploadedAssets = settings.uploadedAssets || settings.creationIntent?.uploadedAssets || [];
        const handoffState = {
          projectId: project.id,
          projectData: project,
          creationIntent: settings.creationIntent,
          proposal: settings.inspirationProposal || settings.selectedProposal,
          scenes: settings.customScenes || settings.inspirationProposal?.roughScript?.scenes || project.storyboardData || [],
          assets: uploadedAssets,
          selectedAssetIds: settings.selectedAssetIds || uploadedAssets
            .filter((asset: any) => asset.selected !== false)
            .map((asset: any) => asset.file_path || asset.url || asset.name || ''),
          projectTitle: project.title,
          reportText: settings.newsArticle || project.userPrompt || project.description || '',
          previewVideoUrl: project.roughCutVideoUrl || project.finalVideoUrl,
        };

        const goToScriptEditor = () => navigate('/script-editor', { state: scriptEditorState });

        if (currentPage === 'handoff' || settings.handoffFlowVersion === 'handoff_sample_v1') {
          navigate(`/handoff?projectId=${project.id}`, { state: handoffState });
          return;
        }

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

        if (currentPage === 'storyboard' || settings.flowVersion === 'workbench_v1' || hasStoryboard) {
          navigate(`/storyboard?projectId=${project.id}`, {
            state: {
              projectId: project.id,
              projectData: project,
              creationIntent: settings.creationIntent,
              scriptData: project.storyboardData
                ? { scenes: project.storyboardData, title: project.title, project_id: project.id }
                : null,
            },
          });
          return;
        }

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

  return (
    <DarkModeContext.Provider value={darkModeContextValue}>
      <div className={`${isDarkMode ? 'dark theme-night' : 'theme-editorial-day'} h-screen w-full`}>
        <div className="nm-app-shell flex h-full bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 font-sans overflow-hidden selection:bg-cyan-500/30 transition-colors duration-500">
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">

            {/* ── Global Header ──────────────────────────────────── */}
            <header className="nm-studio-header h-14 border-b border-neutral-200 dark:border-white/[0.08] bg-white/80 dark:bg-[#0a0a0a]/90 backdrop-blur-md flex items-center gap-3 px-3 sm:px-4 shrink-0 z-50 font-mono text-[11px] sm:text-[12px] tracking-[0.08em] sm:tracking-[0.15em] uppercase transition-colors duration-500 overflow-visible">

              {/* Left: Logo + current project */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {!isDraft && (
                  <HeaderActionButton
                    onClick={() => navigate('/')}
                    className="h-8 w-8 px-0"
                    title="返回项目"
                  >
                    <ChevronLeft size={17} />
                  </HeaderActionButton>
                )}

                {/* Logo */}
                <motion.button
                  type="button"
                  onClick={() => navigate('/')}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex h-9 items-center gap-2 rounded-lg border border-transparent px-1.5 pr-2 transition-all hover:border-cyan-400/20 hover:bg-cyan-400/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                  title="返回首页"
                >
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
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
                    <rect width="20" height="20" rx="4" fill="none" stroke="url(#nm-grad-a)" strokeWidth="0.6" strokeOpacity="0.5" className="transition-opacity group-hover:opacity-100" />
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
                  <span className="hidden text-transparent bg-clip-text font-bold tracking-[0.2em] text-[13px] whitespace-nowrap sm:inline-block" style={{ backgroundImage: 'linear-gradient(to right, #81F2F8, #4db8c4)' }}>
                    NeuroMedia
                  </span>
                </motion.button>

                {isDraft ? (
                  <>
                    <div className="w-px h-4 bg-neutral-200 dark:bg-white/[0.1] mx-1" />
                    <ProjectsDropdown
                      recentProjects={recentProjects}
                      onOpenProject={handleOpenProject}
                      onDeleteProject={handleDeleteProject}
                      onNewProject={() => navigate('/')}
                    />
                  </>
                ) : (
                  <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-300 normal-case tracking-normal sm:max-w-[34vw] lg:max-w-[42vw]" title={headerProjectTitle}>
                    {headerProjectTitle}
                  </span>
                )}
              </div>

              {!isDraft && (
                <div className="hidden shrink-0 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium tracking-normal text-cyan-700 dark:text-cyan-300 sm:block">
                  {headerStageSummary}
                </div>
              )}

              {/* Right: Dark mode + Settings + Avatar */}
              <div className="flex flex-none items-center justify-end gap-2 text-neutral-500 sm:gap-3">
                <HeaderActionButton
                  onClick={toggleDarkMode}
                  className="h-8 w-8 px-0"
                  title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
                >
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                </HeaderActionButton>
                <ProjectSettingsPopover
                  aspectRatio={aspectRatio}
                  autoSave={autoSave}
                  collaborationCursors={collaborationCursors}
                  onSave={saveProjectPreferences}
                  renderMode={renderMode}
                  setAspectRatio={setAspectRatio}
                  setAutoSave={setAutoSave}
                  setCollaborationCursors={setCollaborationCursors}
                  setRenderMode={setRenderMode}
                />
                <ProfileMenu onOpenWorkspace={() => navigate('/')} />
              </div>
            </header>

            {/* ── Content Area ────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden relative">

              {/* Main Content Area */}
              <div className="nm-workspace flex-1 relative overflow-hidden bg-neutral-50/50 dark:bg-transparent transition-colors duration-500">
                {/* Ambient background */}
                <div className="nm-ambient absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <div className="absolute inset-0 hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 dark:block dark:from-[#020202] dark:via-[#0a0a0f] dark:to-[#050510]" />
                  <div className="absolute top-[-10%] left-[-10%] hidden w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] animate-pulse dark:block dark:bg-cyan-500/15" style={{ animationDuration: '8s' }} />
                  <div className="absolute bottom-[-10%] right-[-10%] hidden w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[120px] animate-pulse dark:block dark:bg-violet-500/15" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                  <div className="absolute top-[30%] left-[40%] hidden w-[30%] h-[30%] rounded-full bg-fuchsia-500/10 blur-[120px] animate-pulse dark:block" style={{ animationDuration: '12s', animationDelay: '4s' }} />
                </div>

                {/* Page routes */}
                <div className="relative z-10 h-full">
                  <Routes>
                    <Route path="/" element={<StartPage onProjectsChange={loadProjects} />} />
                    <Route path="/script-editor" element={<ScriptEditorPage />} />
                    <Route path="/style-selection" element={<StyleSelectionPage />} />
                    <Route path="/storyboard" element={<VisualStoryboardPage />} />
                    <Route path="/handoff" element={<VideoHandoffPage />} />
                    <Route path="/editor" element={<EditorPage />} />
                    <Route path="*" element={<StartPage onProjectsChange={loadProjects} />} />
                  </Routes>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DarkModeContext.Provider>
  );
}
