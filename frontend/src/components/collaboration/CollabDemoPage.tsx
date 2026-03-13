import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelLeft,
  ChevronLeft,
  LayoutGrid,
  List,
  Sparkles,
  Film,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Wand2,
  Maximize2,
  SlidersHorizontal,
  Radio,
  ChevronRight,
  MessageSquare,
  Eye,
  EyeOff,
  PenLine,
  Users,
  Zap,
} from 'lucide-react';
import { CollaborationPanel } from './CollaborationPanel';
import type { CollaborationPanelHandle } from './CollaborationPanel';
import { MEMBERS, SHOT_ANNOTATIONS, MOCK_SYSTEM_EVENTS } from './mockData';
import type { Annotation, AnnotationStatus, ProjectActivity, SystemChatMessage } from './types';
import { AnnotationBubble } from './AnnotationBubble';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShotStatus = 'approved' | 'review' | 'in_progress' | 'todo';

interface MockShot {
  id: string;
  num: string;
  title: string;
  desc: string;
  status: ShotStatus;
  assigneeId: string;
  duration: string;
  scene: string;
  gradient: [string, string];
  hasVoiceover: boolean;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SHOTS: MockShot[] = [
  { id: 's1', num: '01', title: '城市夜景', desc: '开场远景俯瞰，霓虹闪烁，基调建立', status: 'approved', assigneeId: 'm3', duration: '3.2', scene: 'EXT · 城市 · 夜', gradient: ['#050b14', '#0f2444'], hasVoiceover: false },
  { id: 's2', num: '02', title: '主角登场', desc: '主角剪影逆光出现，身份神秘', status: 'approved', assigneeId: 'm1', duration: '2.8', scene: 'EXT · 街道 · 夜', gradient: ['#130520', '#2d0d4e'], hasVoiceover: true },
  { id: 's3', num: '03', title: '对话近景', desc: '双人正反打，情绪拉锯，节奏紧张', status: 'approved', assigneeId: 'm2', duration: '5.1', scene: 'INT · 咖啡厅 · 夜', gradient: ['#0c1a2e', '#163c6e'], hasVoiceover: true },
  { id: 's4', num: '04', title: '动作序列', desc: '快速剪辑强化节奏，视觉冲击，贴合音乐', status: 'review', assigneeId: 'm2', duration: '8.4', scene: 'EXT · 屋顶 · 夜', gradient: ['#1a1400', '#3a2c00'], hasVoiceover: false },
  { id: 's5', num: '05', title: '情绪过渡', desc: '空景留白，只有城市环境音，沉默蓄力', status: 'in_progress', assigneeId: 'm1', duration: '3.0', scene: 'EXT · 天台 · 夜', gradient: ['#080d08', '#0f2214'], hasVoiceover: false },
  { id: 's6', num: '06', title: '情绪高点', desc: '角色爆发，曝光骤升，音乐强推，戏剧顶点', status: 'in_progress', assigneeId: 'm3', duration: '6.7', scene: 'INT · 大厅 · 夜', gradient: ['#1a0408', '#400e14'], hasVoiceover: true },
  { id: 's7', num: '07', title: '反转揭示', desc: '视角翻转，隐藏信息显现，叙事高潮', status: 'todo', assigneeId: 'm4', duration: '4.2', scene: 'INT · 密室 · 夜', gradient: ['#06060e', '#12123c'], hasVoiceover: true },
  { id: 's8', num: '08', title: '结局远景', desc: '角色远去，城市渐暗，余韵绵长', status: 'todo', assigneeId: 'm3', duration: '5.5', scene: 'EXT · 城市 · 黎明', gradient: ['#0c0800', '#201400'], hasVoiceover: false },
];

const STATUS_CFG: Record<ShotStatus, { label: string; color: string; bg: string; icon: React.FC<{ size?: number; className?: string }> }> = {
  approved: { label: '已批准', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: CheckCircle2 },
  review: { label: '审核中', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: AlertCircle },
  in_progress: { label: '进行中', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)', icon: Loader2 },
  todo: { label: '待处理', color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: Circle },
};

// ── ShotCard ──────────────────────────────────────────────────────────────────

interface ShotCardProps {
  shot: MockShot;
  isSelected: boolean;
  isFocused: boolean;
  /** 每次 focus 时递增，即使 shotId 相同也能触发 useEffect 重新 scrollIntoView */
  focusSeq: number;
  onClick: () => void;
  annotations: Annotation[];
  showAnnotations: boolean;
  onAnnotationStatusChange: (id: string, status: AnnotationStatus) => void;
}

const ShotCard: React.FC<ShotCardProps> = ({
  shot, isSelected, isFocused, focusSeq, onClick,
  annotations, showAnnotations, onAnnotationStatusChange,
}) => {
  const cfg = STATUS_CFG[shot.status];
  const assignee = MEMBERS.find(m => m.id === shot.assigneeId);
  const openCount = annotations.filter(a => a.status === 'open').length;
  const hasAnnotations = annotations.length > 0;
  const cardRef = useRef<HTMLDivElement>(null);

  /**
   * 当 isFocused 变为 true，或同一 shot 被再次 focus（seq 变化）时，
   * 将卡片滚动至可视区域。依赖 focusSeq 而非仅依赖 isFocused，
   * 确保连续点击同一动态也能正确重置滚动。
   */
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, focusSeq]);

  return (
    /*
     * Outer wrapper: NO overflow-hidden so annotation popovers can escape.
     * The inner card div carries the ring + bg + overflow-hidden for the thumbnail.
     * The focus glow ring is an absolute overlay outside overflow-hidden.
     */
    <motion.div
      ref={cardRef}
      layout
      whileHover={isFocused ? undefined : { y: -2 }}
      onClick={onClick}
      className="relative cursor-pointer select-none"
      style={{ isolation: 'isolate' }}
    >
      {/* ── Focus glow ring (outside overflow-hidden so border is fully visible) ── */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              zIndex: 6,
              boxShadow: [
                '0 0 0 2px rgba(34,211,238,0.85)',       // crisp border
                '0 0 12px 2px rgba(34,211,238,0.45)',    // inner glow
                '0 0 32px 6px rgba(34,211,238,0.2)',     // outer halo
              ].join(', '),
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Inner card (clipped visuals) ── */}
      <div
        className={`rounded-xl overflow-hidden transition-shadow duration-300 ${
          isFocused
            ? 'ring-0'
            : isSelected
              ? 'ring-2 ring-cyan-500/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]'
              : 'ring-1 ring-white/[0.06] hover:ring-white/[0.14]'
        }`}
        style={{ background: '#0d0d12' }}
      >
        {/* Thumbnail */}
        <div
          className="aspect-video relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${shot.gradient[0]}, ${shot.gradient[1]})` }}
        >
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '33.33% 33.33%',
            }}
          />

          {/* Shot number watermark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/[0.08] font-mono font-black text-5xl select-none">
              {shot.num}
            </span>
          </div>

          {/* Film icon */}
          <div className="absolute bottom-2 left-2">
            <Film size={12} className="text-white/20" />
          </div>

          {/* Voiceover dot */}
          {shot.hasVoiceover && (
            <div className="absolute bottom-2 right-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60" title="含画外音" />
            </div>
          )}

          {/* Status dot */}
          <div
            className="absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-[#0d0d12]"
            style={{ background: cfg.color }}
          />

          {/* Focus fill — thumbnail内的高亮背景，缓慢淡出 */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.5, ease: 'easeOut' }}
                className="absolute inset-0"
                style={{ background: 'rgba(34,211,238,0.2)' }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Card body */}
        <div className="px-3 py-2.5">
          <div className="flex items-start justify-between gap-1 mb-1">
            <span className="text-[12px] font-semibold text-neutral-200 leading-tight truncate">
              {shot.title}
            </span>
            <span
              className="shrink-0 text-[9px] font-mono px-1.5 py-px rounded-full"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
          </div>

          <p className="text-[11px] text-neutral-600 leading-relaxed line-clamp-1 mb-2">
            {shot.desc}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-neutral-700 truncate flex-1">{shot.scene}</span>

            <div className="flex items-center gap-1 shrink-0">
              <Clock size={9} className="text-neutral-700" />
              <span className="text-[10px] font-mono text-neutral-600 tabular-nums">{shot.duration}s</span>
            </div>

            {/* Annotation count badge */}
            {hasAnnotations && (
              <div
                className="flex items-center gap-0.5 shrink-0"
                title={`${annotations.length} 条批注，${openCount} 条未处理`}
              >
                <MessageSquare size={9} style={{ color: openCount > 0 ? '#fbbf24' : '#4ade80' }} />
                <span
                  className="text-[9px] font-mono tabular-nums"
                  style={{ color: openCount > 0 ? '#fbbf24' : '#4ade80' }}
                >
                  {annotations.length}
                </span>
              </div>
            )}

            {assignee && (
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${assignee.color1}, ${assignee.color2})` }}
                title={assignee.name}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Annotation overlay ────────────────────────────────────────────────────
          Positioned to exactly cover the thumbnail area (top-0 + aspect-video).
          pointer-events:none on the container, auto only on individual bubbles.
          Lives OUTSIDE the overflow-hidden inner card so popovers escape freely.
      ── */}
      <AnimatePresence>
        {showAnnotations && annotations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0"
            style={{ pointerEvents: 'none' }}
          >
            {/* aspect-video div mirrors the thumbnail dimensions */}
            <div className="aspect-video relative w-full">
              {annotations.map(ann => (
                <div
                  key={ann.id}
                  className="absolute"
                  style={{
                    left: `${ann.position.x}%`,
                    top: `${ann.position.y}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                  }}
                >
                  <AnnotationBubble
                    annotation={ann}
                    onStatusChange={onAnnotationStatusChange}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Timeline bar ──────────────────────────────────────────────────────────────

const TimelineBar: React.FC<{ selectedId: string | null }> = ({ selectedId }) => {
  const total = MOCK_SHOTS.reduce((sum, s) => sum + parseFloat(s.duration), 0);
  const totalMin = Math.floor(total / 60);
  const totalSec = Math.round(total % 60).toString().padStart(2, '0');

  return (
    <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#08080c] flex items-center gap-3">
      <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest shrink-0">
        Timeline
      </span>
      <div className="flex-1 flex items-center gap-px h-5">
        {MOCK_SHOTS.map(shot => {
          const cfg = STATUS_CFG[shot.status];
          const widthPct = (parseFloat(shot.duration) / total) * 100;
          return (
            <div
              key={shot.id}
              className="h-full rounded-sm transition-all relative group"
              style={{
                width: `${widthPct}%`,
                background: selectedId === shot.id ? cfg.color : `${cfg.color}44`,
                minWidth: '12px',
              }}
              title={`${shot.num} · ${shot.title} · ${shot.duration}s`}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {shot.num}
              </span>
            </div>
          );
        })}
      </div>
      <span className="text-[10px] font-mono text-neutral-600 tabular-nums shrink-0">
        {totalMin}:{totalSec}
      </span>
    </div>
  );
};

// ── Inspector Panel ───────────────────────────────────────────────────────────

interface InspectorProps {
  selectedShot: MockShot | null;
}

const AiAssistSection: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setTimeout(() => setGenerating(false), 1800);
    setPrompt('');
  };

  const QUICK_PROMPTS = ['增强戏剧张力', '添加运动感', '调整光影对比', '氛围更深沉'];

  return (
    <div className="p-3 border-t border-white/[0.06]">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={11} className="text-violet-400" />
        <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-500">
          AI 助手
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Radio size={8} className="text-violet-400" />
          <span className="text-[9px] text-violet-500 font-mono">在线</span>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1 mb-2">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => setPrompt(p)}
            className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-neutral-600 hover:text-violet-400 hover:border-violet-500/30 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          placeholder="描述想要的调整方向…"
          className="flex-1 bg-white/[0.04] border border-white/[0.07] focus:border-violet-500/40 rounded-lg px-2.5 py-1.5 text-[12px] text-neutral-300 placeholder:text-neutral-700 outline-none transition-colors"
        />
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            prompt.trim() && !generating
              ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white hover:opacity-85 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
              : 'bg-white/[0.04] text-neutral-700 cursor-not-allowed'
          }`}
        >
          {generating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Wand2 size={13} />
          )}
        </button>
      </div>

      {/* Recent generations */}
      <div className="mt-3">
        <p className="text-[9px] font-mono text-neutral-800 uppercase tracking-widest mb-1.5">
          最近生成
        </p>
        {['城市夜景 · 情绪渲染 v3', '对话特写 · 冷色调强化'].map(item => (
          <div
            key={item}
            className="flex items-center gap-2 py-1 text-[11px] text-neutral-700 hover:text-neutral-400 cursor-pointer transition-colors group"
          >
            <Film size={9} className="shrink-0" />
            <span className="truncate">{item}</span>
            <ChevronRight size={9} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

const InspectorPanel: React.FC<InspectorProps> = ({ selectedShot }) => {
  const onlineMembers = MEMBERS.filter(m => m.isOnline);
  const approvedCount = MOCK_SHOTS.filter(s => s.status === 'approved').length;
  const total = MOCK_SHOTS.length;
  const totalDuration = MOCK_SHOTS.reduce((s, shot) => s + parseFloat(shot.duration), 0).toFixed(1);

  return (
    <div className="w-72 shrink-0 h-full flex flex-col border-l border-white/[0.08] bg-[#0a0a10]/90 backdrop-blur-xl overflow-y-auto collab-scrollbar">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <SlidersHorizontal size={12} className="text-cyan-500" />
        <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400">
          {selectedShot ? '镜头详情' : '项目概览'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {selectedShot ? (
            /* ── Shot Inspector ── */
            <motion.div
              key={selectedShot.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="p-4"
            >
              {/* Shot thumbnail preview */}
              <div
                className="aspect-video rounded-xl mb-4 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${selectedShot.gradient[0]}, ${selectedShot.gradient[1]})` }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/[0.08] font-mono font-black text-6xl select-none">
                    {selectedShot.num}
                  </span>
                </div>
                <div
                  className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-mono"
                  style={{ background: STATUS_CFG[selectedShot.status].bg, color: STATUS_CFG[selectedShot.status].color }}
                >
                  {STATUS_CFG[selectedShot.status].label}
                </div>
              </div>

              {/* Title & number */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono text-neutral-700 bg-white/[0.05] px-2 py-0.5 rounded">
                  #{selectedShot.num}
                </span>
                <h3 className="text-[14px] font-semibold text-neutral-200">{selectedShot.title}</h3>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: '场景', value: selectedShot.scene },
                  { label: '时长', value: `${selectedShot.duration}s` },
                  { label: '画外音', value: selectedShot.hasVoiceover ? '有' : '无' },
                  { label: '状态', value: STATUS_CFG[selectedShot.status].label },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.05]">
                    <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-[12px] text-neutral-300 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="mb-4">
                <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider mb-1.5">描述</p>
                <p className="text-[12px] text-neutral-400 leading-relaxed">{selectedShot.desc}</p>
              </div>

              {/* Assignee */}
              <div>
                <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider mb-1.5">负责人</p>
                {(() => {
                  const assignee = MEMBERS.find(m => m.id === selectedShot.assigneeId);
                  return assignee ? (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${assignee.color1}, ${assignee.color2})` }}
                      >
                        {assignee.initials}
                      </div>
                      <div>
                        <p className="text-[12px] text-neutral-300 font-medium">{assignee.name}</p>
                        <p className="text-[10px] font-mono" style={{ color: assignee.color1 }}>
                          {assignee.roleLabel}
                        </p>
                      </div>
                      {assignee.isOnline && (
                        <span className="ml-auto text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          在线
                        </span>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            </motion.div>
          ) : (
            /* ── Project Overview ── */
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="p-4"
            >
              {/* Project info */}
              <div className="mb-4">
                <h3 className="text-[15px] font-semibold text-neutral-200 mb-0.5">城市黎明</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">v2.4</span>
                  <span className="text-[10px] text-neutral-600 font-mono">故事板阶段</span>
                </div>
              </div>

              {/* Team members */}
              <div className="mb-4">
                <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider mb-2">协作团队</p>
                <div className="flex flex-col gap-2">
                  {MEMBERS.map(m => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ background: `linear-gradient(135deg, ${m.color1}, ${m.color2})` }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-neutral-400">{m.name}</span>
                      </div>
                      <span className="text-[9px] font-mono" style={{ color: m.color1 }}>{m.roleLabel}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.isOnline ? 'bg-emerald-400' : 'bg-neutral-700'}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="mb-4">
                <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider mb-2">项目进度</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '总镜头', value: total, color: 'text-neutral-300' },
                    { label: '总时长', value: `${totalDuration}s`, color: 'text-neutral-300' },
                    { label: '已批准', value: approvedCount, color: 'text-emerald-400' },
                    { label: '待处理', value: total - approvedCount, color: 'text-amber-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.05]">
                      <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider mb-0.5">{label}</p>
                      <p className={`text-[16px] font-bold font-mono tabular-nums ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono text-neutral-700">批准进度</span>
                  <span className="text-[10px] font-mono text-neutral-500">{Math.round((approvedCount / total) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(approvedCount / total) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Hint */}
              <p className="mt-4 text-[10px] text-neutral-700 font-mono text-center">
                点击镜头卡片查看详情
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Assist — always visible */}
      <AiAssistSection />
    </div>
  );
};

// ── CollabModeToggle ──────────────────────────────────────────────────────────

interface CollabModeToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
}

const MODES = [
  {
    value: false,
    label: '创作',
    Icon: PenLine,
    activeText: '#e5e5e5',
    activeBg: 'rgba(255,255,255,0.07)',
    activeBorder: 'rgba(255,255,255,0.1)',
    activeGlow: 'none',
  },
  {
    value: true,
    label: '协作',
    Icon: Users,
    activeText: '#67e8f9',
    activeBg: 'linear-gradient(135deg, rgba(6,182,212,0.22), rgba(99,102,241,0.18))',
    activeBorder: 'rgba(34,211,238,0.28)',
    activeGlow: '0 0 0 1px rgba(34,211,238,0.18) inset, 0 0 18px rgba(6,182,212,0.2)',
  },
] as const;

const CollabModeToggle: React.FC<CollabModeToggleProps> = ({ enabled, onChange }) => (
  <motion.div
    className="flex items-center rounded-xl p-0.5 gap-px relative"
    animate={{
      boxShadow: enabled
        ? '0 0 0 1px rgba(34,211,238,0.15), 0 0 20px rgba(6,182,212,0.1)'
        : '0 0 0 1px rgba(255,255,255,0.07)',
    }}
    transition={{ duration: 0.4 }}
    style={{ background: 'rgba(8,8,14,0.85)', backdropFilter: 'blur(12px)' }}
  >
    {MODES.map(mode => {
      const isActive = enabled === mode.value;
      return (
        <button
          key={String(mode.value)}
          onClick={() => onChange(mode.value)}
          className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-[9px] text-[11px] font-mono tracking-wider transition-colors duration-200 outline-none"
          style={{ color: isActive ? mode.activeText : '#52525b' }}
        >
          {/* Sliding background — layoutId causes it to animate between buttons */}
          {isActive && (
            <motion.span
              layoutId="collab-mode-pill"
              className="absolute inset-0 rounded-[9px] pointer-events-none"
              style={{
                background: mode.activeBg,
                border: `1px solid ${mode.activeBorder}`,
                boxShadow: mode.activeGlow,
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 400 }}
            />
          )}
          <mode.Icon size={11} className="relative z-10 shrink-0" />
          <span className="relative z-10">{mode.label}</span>
        </button>
      );
    })}
  </motion.div>
);

// ── Main: CollabDemoPage ──────────────────────────────────────────────────────

export const CollabDemoPage: React.FC = () => {
  const navigate = useNavigate();

  // ── 协作模式主开关 ─────────────────────────────────────────────────────────
  const [collabMode, setCollabMode] = useState(true);

  const [isCollabOpen, setIsCollabOpen] = useState(true);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  /**
   * focusToken — 每次调用 handleFocusShot 都生成一个新对象，即使 shotId 相同也能
   * 让 ShotCard 内的 useEffect 检测到"引用变化"并重新触发 scrollIntoView。
   */
  const [focusToken, setFocusToken] = useState<{ shotId: string; seq: number } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [annotations, setAnnotations] = useState<Annotation[]>(SHOT_ANNOTATIONS);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusSeqRef = useRef(0);
  const panelRef = useRef<CollaborationPanelHandle>(null);

  // ── 模拟事件注入 ────────────────────────────────────────────────────────────
  const [simCount, setSimCount] = useState(0);
  const [simToast, setSimToast] = useState<string | null>(null);
  const simToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSimIdxRef = useRef(-1);

  /**
   * 协作模式开关联动：
   * - 关闭时：折叠左侧面板、隐藏批注气泡
   * - 开启时：展开左侧面板、恢复批注气泡
   * 用户在模式内的手动微调（单独开关面板/批注）仍被允许。
   */
  useEffect(() => {
    setIsCollabOpen(collabMode);
    setShowAnnotations(collabMode);
  }, [collabMode]);

  const selectedShot = MOCK_SHOTS.find(s => s.id === selectedShotId) ?? null;
  const focusedShotId = focusToken?.shotId ?? null;

  const handleFocusShot = (shotId: string) => {
    focusSeqRef.current += 1;
    setFocusToken({ shotId, seq: focusSeqRef.current });
    setSelectedShotId(shotId);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => setFocusToken(null), 2500);
  };

  const handleAnnotationStatusChange = (id: string, status: AnnotationStatus) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const handleSimulateEvent = () => {
    // 避免连续两次选到同一个事件
    let idx: number;
    do {
      idx = Math.floor(Math.random() * MOCK_SYSTEM_EVENTS.length);
    } while (idx === lastSimIdxRef.current && MOCK_SYSTEM_EVENTS.length > 1);
    lastSimIdxRef.current = idx;

    const template = MOCK_SYSTEM_EVENTS[idx];
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const uid = `sim_${Date.now()}`;

    const activity: ProjectActivity = {
      ...template.activity,
      id: uid,
      timestamp: new Date().toISOString(),
      timeAgo: '刚刚',
    };
    const systemMsg: SystemChatMessage = {
      ...template.systemMsg,
      id: `sysmsg_${Date.now()}`,
      time: now,
      date: 'today',
    };

    panelRef.current?.injectEvent(activity, systemMsg);
    setSimCount(c => c + 1);

    // 弹出 toast 通知
    const operatorName = MEMBERS.find(m => m.id === template.activity.operatorId)?.name ?? 'AI Director';
    setSimToast(`${operatorName} · ${template.label}`);
    if (simToastTimerRef.current) clearTimeout(simToastTimerRef.current);
    simToastTimerRef.current = setTimeout(() => setSimToast(null), 3500);
  };

  useEffect(() => () => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    if (simToastTimerRef.current) clearTimeout(simToastTimerRef.current);
  }, []);

  const approvedCount = MOCK_SHOTS.filter(s => s.status === 'approved').length;
  const openAnnotationCount = annotations.filter(a => a.status === 'open').length;

  return (
    <div className="dark h-screen w-full flex flex-col overflow-hidden bg-[#050505] text-neutral-200 font-sans">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="h-14 shrink-0 border-b border-white/[0.08] bg-[#08080e]/90 backdrop-blur-md flex items-center px-4 gap-4 z-50">

        {/* Left: nav + logo + project info */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-neutral-600 hover:text-white transition-colors"
            title="返回"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center relative overflow-hidden border border-white/20 bg-[#111]">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-violet-500 opacity-25" />
              <div className="w-1.5 h-1.5 bg-gradient-to-tr from-cyan-400 to-violet-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">
              SYNTHESIS
            </span>
          </div>

          <div className="w-px h-4 bg-white/[0.08] mx-1" />

          {/* Project breadcrumb */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-neutral-600 tracking-widest uppercase">Storyboard</span>
            <span className="text-neutral-800">·</span>
            <span className="text-neutral-300 font-medium">城市黎明</span>
            <span
              className="px-1.5 py-px rounded-full text-[9px] tracking-wider"
              style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
            >
              v2.4
            </span>
          </div>
        </div>

        {/* ── Center: Mode toggle — visual hero of the header ── */}
        <div className="flex-1 flex items-center justify-center">
          <CollabModeToggle enabled={collabMode} onChange={setCollabMode} />
        </div>

        {/* Right: stats + panel toggle + view toggle + avatar */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Approved badge */}
          <span className="text-[11px] font-mono tabular-nums text-neutral-600">
            <span className="text-emerald-400">{approvedCount}</span>
            <span className="text-neutral-700">/{MOCK_SHOTS.length}</span>
            <span className="ml-1 text-neutral-700">批准</span>
          </span>

          <div className="w-px h-4 bg-white/[0.08]" />

          {/* Panel toggle — visually muted when collab mode is off */}
          <button
            onClick={() => setIsCollabOpen(p => !p)}
            className={`p-1.5 rounded-lg transition-colors ${
              collabMode
                ? 'hover:bg-white/[0.08] text-neutral-500 hover:text-cyan-400'
                : 'text-neutral-800 hover:text-neutral-600 hover:bg-white/[0.05]'
            }`}
            title={isCollabOpen ? '收起协作面板' : '展开协作面板'}
          >
            <PanelLeft size={15} />
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-white/[0.05] rounded-lg p-0.5 border border-white/[0.07]">
            {(['grid', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === mode ? 'bg-white/[0.1] text-cyan-400' : 'text-neutral-600 hover:text-neutral-400'
                }`}
              >
                {mode === 'grid' ? <LayoutGrid size={13} /> : <List size={13} />}
              </button>
            ))}
          </div>

          {/* User avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}
            title="Alex Chen · 导演"
          >
            AC
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Collaboration Panel */}
        <CollaborationPanel
          ref={panelRef}
          isOpen={isCollabOpen}
          onToggle={() => setIsCollabOpen(p => !p)}
          onFocusShot={handleFocusShot}
        />

        {/* Center: Shot Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
          {/* Ambient background — 协作模式：蓝紫冷调 / 创作模式：更深更暗 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-[#020202] via-[#060610] to-[#040408]" />
            <motion.div
              className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] animate-pulse"
              animate={{ opacity: collabMode ? 1 : 0.25, background: collabMode ? 'rgba(6,182,212,0.06)' : 'rgba(251,191,36,0.04)' }}
              transition={{ duration: 1.2 }}
              style={{ animationDuration: '8s' }}
            />
            <motion.div
              className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] animate-pulse"
              animate={{ opacity: collabMode ? 1 : 0.2, background: collabMode ? 'rgba(139,92,246,0.06)' : 'rgba(161,161,170,0.03)' }}
              transition={{ duration: 1.2 }}
              style={{ animationDuration: '11s', animationDelay: '3s' }}
            />
          </div>

          {/* ── Sim event toast ─────────────────────────────── */}
          <AnimatePresence>
            {simToast && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: 'spring', damping: 24, stiffness: 360 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-mono pointer-events-none"
                style={{
                  background: 'rgba(8,8,18,0.92)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(34,211,238,0.25)',
                  boxShadow: '0 0 0 1px rgba(34,211,238,0.1) inset, 0 8px 32px rgba(0,0,0,0.6)',
                  color: '#a5f3fc',
                }}
              >
                <Zap size={11} className="text-cyan-400 shrink-0" />
                <span className="text-neutral-400">系统同步</span>
                <span className="text-neutral-600 mx-0.5">·</span>
                <span className="text-neutral-200 truncate max-w-[280px]">{simToast}</span>
                <span className="ml-2 flex items-center gap-1 text-emerald-400 text-[10px] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  已同步
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Canvas toolbar */}
          <div className="relative z-10 h-10 shrink-0 border-b border-white/[0.06] bg-[#08080c]/80 backdrop-blur-sm flex items-center px-4 gap-3">
            <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest">
              镜头一览
            </span>
            <div className="w-px h-4 bg-white/[0.07]" />
            <span className="text-[10px] font-mono text-neutral-700 tabular-nums">
              {MOCK_SHOTS.length} 个镜头
            </span>

            {/* Annotation toggle — 仅协作模式下可见 */}
            <AnimatePresence>
              {collabMode && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <div className="w-px h-4 bg-white/[0.07] shrink-0" />
                  <button
                    onClick={() => setShowAnnotations(p => !p)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all border shrink-0 ${
                      showAnnotations
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/15'
                        : 'bg-white/[0.04] border-white/[0.07] text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.06]'
                    }`}
                    title={showAnnotations ? '隐藏批注气泡' : '显示批注气泡'}
                  >
                    {showAnnotations ? <Eye size={11} /> : <EyeOff size={11} />}
                    批注
                    <span
                      className="px-1 py-px rounded font-mono tabular-nums text-[9px]"
                      style={{
                        background: showAnnotations ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                        color: showAnnotations
                          ? openAnnotationCount > 0 ? '#fbbf24' : '#4ade80'
                          : '#64748b',
                      }}
                    >
                      {openAnnotationCount > 0 ? `${openAnnotationCount} 待处理` : `${annotations.length}`}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1" />
            {selectedShotId && (
              <motion.button
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedShotId(null)}
                className="text-[10px] font-mono text-neutral-600 hover:text-neutral-300 transition-colors flex items-center gap-1"
              >
                取消选择
                <span className="text-[9px]">✕</span>
              </motion.button>
            )}
            {focusedShotId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-500"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                聚焦至 #{MOCK_SHOTS.find(s => s.id === focusedShotId)?.num}
              </motion.div>
            )}
          </div>

          {/* Shot grid / list */}
          <div className="relative z-10 flex-1 overflow-y-auto collab-scrollbar px-4 py-4">
            <AnimatePresence mode="wait">
              {viewMode === 'grid' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
                >
                  {MOCK_SHOTS.map((shot, i) => (
                    <motion.div
                      key={shot.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                    >
                      <ShotCard
                        shot={shot}
                        isSelected={selectedShotId === shot.id}
                        isFocused={focusedShotId === shot.id}
                        focusSeq={focusToken?.shotId === shot.id ? (focusToken?.seq ?? 0) : 0}
                        onClick={() => setSelectedShotId(p => (p === shot.id ? null : shot.id))}
                        annotations={annotations.filter(a => a.shotId === shot.id)}
                        showAnnotations={showAnnotations}
                        onAnnotationStatusChange={handleAnnotationStatusChange}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-1.5"
                >
                  {MOCK_SHOTS.map((shot, i) => {
                    const cfg = STATUS_CFG[shot.status];
                    const assignee = MEMBERS.find(m => m.id === shot.assigneeId);
                    const isSelected = selectedShotId === shot.id;
                    const shotAnns = annotations.filter(a => a.shotId === shot.id);
                    const shotOpenCount = shotAnns.filter(a => a.status === 'open').length;

                    return (
                      <motion.div
                        key={shot.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18, delay: i * 0.03 }}
                        onClick={() => setSelectedShotId(p => (p === shot.id ? null : shot.id))}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-500/[0.08] ring-1 ring-cyan-500/30'
                            : 'bg-white/[0.025] hover:bg-white/[0.05] ring-1 ring-white/[0.04]'
                        }`}
                      >
                        {/* Gradient strip */}
                        <div
                          className="w-10 h-6 rounded-md shrink-0"
                          style={{ background: `linear-gradient(135deg, ${shot.gradient[0]}, ${shot.gradient[1]})` }}
                        />
                        <span className="text-[10px] font-mono text-neutral-700 w-6 shrink-0">#{shot.num}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-medium text-neutral-300 truncate block">{shot.title}</span>
                          <span className="text-[10px] text-neutral-600 truncate block">{shot.scene}</span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-600 tabular-nums shrink-0">{shot.duration}s</span>
                        {shotAnns.length > 0 && (
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            title={`${shotAnns.length} 条批注`}
                          >
                            <MessageSquare
                              size={9}
                              style={{ color: shotOpenCount > 0 ? '#fbbf24' : '#4ade80' }}
                            />
                            <span
                              className="text-[9px] font-mono tabular-nums"
                              style={{ color: shotOpenCount > 0 ? '#fbbf24' : '#4ade80' }}
                            >
                              {shotAnns.length}
                            </span>
                          </div>
                        )}
                        <span
                          className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                        {assignee && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                            style={{ background: `linear-gradient(135deg, ${assignee.color1}, ${assignee.color2})` }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Floating simulate button ─────────────────────── */}
          <div className="absolute bottom-14 right-4 z-20">
            <motion.button
              onClick={handleSimulateEvent}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              className="relative flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-xl text-[11px] font-mono overflow-hidden"
              style={{
                background: 'rgba(6,6,14,0.88)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(139,92,246,0.35)',
                boxShadow: '0 0 0 1px rgba(99,102,241,0.1) inset, 0 4px 20px rgba(0,0,0,0.6)',
                color: '#c4b5fd',
              }}
              title="随机注入一条系统动态到动态 tab 和讨论 tab"
            >
              {/* Ambient glow */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(139,92,246,0.2) 0%, transparent 65%)' }}
              />

              <Zap size={12} className="relative z-10 text-violet-400 shrink-0" />
              <span className="relative z-10 tracking-wider">模拟关键改动</span>

              {/* Event count badge */}
              {simCount > 0 && (
                <motion.span
                  key={simCount}
                  initial={{ scale: 1.4, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative z-10 ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold tabular-nums"
                  style={{ background: 'rgba(139,92,246,0.3)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }}
                >
                  {simCount}
                </motion.span>
              )}

              {/* DEMO label */}
              <span
                className="relative z-10 ml-1 text-[8px] font-mono tracking-widest px-1 py-px rounded opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#a78bfa' }}
              >
                DEMO
              </span>
            </motion.button>
          </div>

          {/* Timeline bar */}
          <div className="relative z-10">
            <TimelineBar selectedId={selectedShotId} />
          </div>
        </div>

        {/* Right: Inspector Panel */}
        <InspectorPanel selectedShot={selectedShot} />
      </div>
    </div>
  );
};
