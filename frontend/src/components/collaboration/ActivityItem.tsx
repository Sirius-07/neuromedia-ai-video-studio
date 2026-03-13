import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Film,
  FileMinus,
  Palette,
  Music,
  CheckCircle2,
  Upload,
  MessageSquare,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { MEMBERS } from './mockData';
import type { ProjectActivity, ProjectActivityType, MemberRole, ActivityPriority } from './types';

// ── Action type config ────────────────────────────────────────────────────────

interface ActionConfig {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  bg: string;
  label: string;
}

const ACTION_CONFIG: Record<ProjectActivityType, ActionConfig> = {
  script_update: {
    icon: FileText,
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.14)',
    label: '剧本更新',
  },
  shot_added: {
    icon: Film,
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.14)',
    label: '镜头新增',
  },
  shot_deleted: {
    icon: FileMinus,
    color: '#f87171',
    bg: 'rgba(248,113,113,0.14)',
    label: '镜头删除',
  },
  style_changed: {
    icon: Palette,
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.14)',
    label: '视觉变更',
  },
  soundtrack_replaced: {
    icon: Music,
    color: '#34d399',
    bg: 'rgba(52,211,153,0.14)',
    label: '配乐替换',
  },
  storyboard_approved: {
    icon: CheckCircle2,
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.14)',
    label: '分镜批准',
  },
  asset_uploaded: {
    icon: Upload,
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.14)',
    label: '素材上传',
  },
  member_comment: {
    icon: MessageSquare,
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.14)',
    label: '成员批注',
  },
};

// ── Priority config ───────────────────────────────────────────────────────────

interface PriorityStyle {
  borderColor: string;
  cardBg: string;
  titleColor: string;
  glow: string;
}

const PRIORITY_STYLE: Record<ActivityPriority, PriorityStyle> = {
  high: {
    borderColor: '#f97316',
    cardBg: 'rgba(249,115,22,0.04)',
    titleColor: '#f1f5f9',
    glow: '0 0 24px rgba(249,115,22,0.07)',
  },
  medium: {
    borderColor: '#06b6d4',
    cardBg: 'rgba(255,255,255,0.025)',
    titleColor: '#e2e8f0',
    glow: 'none',
  },
  low: {
    borderColor: 'rgba(255,255,255,0.08)',
    cardBg: 'rgba(255,255,255,0.015)',
    titleColor: '#94a3b8',
    glow: 'none',
  },
};

// ── Role tag config ───────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<MemberRole, { label: string; color: string; bg: string }> = {
  director: { label: '导演', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  editor: { label: '剪辑', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  designer: { label: '视觉', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  writer: { label: '编剧', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

// ── ActivityItem ──────────────────────────────────────────────────────────────

export interface ActivityItemProps {
  activity: ProjectActivity;
  isLatest?: boolean;
  onFocusShot?: (shotId: string) => void;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ activity, isLatest = false, onFocusShot }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const actionCfg = ACTION_CONFIG[activity.actionType];
  const priorityCfg = PRIORITY_STYLE[activity.priority];
  const ActionIcon = actionCfg.icon;
  const operator = MEMBERS.find(m => m.id === activity.operatorId);
  const isHigh = activity.priority === 'high';
  const isLow = activity.priority === 'low';
  const hasShotLink = !!activity.relatedShotId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setIsExpanded(p => !p)}
      className="relative rounded-xl cursor-pointer overflow-hidden transition-all"
      style={{
        background: priorityCfg.cardBg,
        borderLeft: `2px solid ${priorityCfg.borderColor}`,
        boxShadow: hovered
          ? `0 0 0 1px rgba(255,255,255,0.07), ${priorityCfg.glow}`
          : `0 0 0 1px rgba(255,255,255,0.04)`,
      }}
    >
      {/* High priority top pulse bar */}
      {isHigh && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${priorityCfg.borderColor}60, transparent)`,
          }}
        />
      )}

      {/* "NEW" shimmer overlay — fades out over 2.5 s when isLatest */}
      <AnimatePresence>
        {isLatest && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(99,102,241,0.07))',
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      <div className="px-3 py-3">
        {/* ── Top row: icon + title + time + priority ── */}
        <div className="flex items-start gap-2.5">
          {/* Action icon */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: actionCfg.bg }}
          >
            <ActionIcon size={13} style={{ color: actionCfg.color }} />
          </div>

          {/* Title + action type */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[12px] font-semibold leading-tight ${isLow ? 'text-neutral-500' : ''}`}
                style={{ color: isLow ? undefined : priorityCfg.titleColor }}
              >
                {activity.title}
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-px rounded-full shrink-0"
                style={{ background: actionCfg.bg, color: actionCfg.color }}
              >
                {actionCfg.label}
              </span>
              {/* NEW badge — auto-fades */}
              <AnimatePresence>
                {isLatest && (
                  <motion.span
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{ opacity: 0, scale: 0.85 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, delay: 2.2 }}
                    className="text-[9px] font-mono font-bold tracking-widest px-1.5 py-px rounded-full shrink-0"
                    style={{
                      background: 'rgba(34,211,238,0.18)',
                      color: '#22d3ee',
                      border: '1px solid rgba(34,211,238,0.35)',
                    }}
                  >
                    NEW
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: time + high indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isHigh && (
              <div className="relative">
                <Zap
                  size={10}
                  className="text-orange-400"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.7))' }}
                />
                <span className="absolute -top-px -right-px w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping opacity-75" />
              </div>
            )}
            <span className="text-[10px] text-neutral-700 font-mono tabular-nums">
              {activity.timeAgo}
            </span>
          </div>
        </div>

        {/* ── Summary (collapsed: 1 line, expanded: full) ── */}
        <div className="mt-1.5 ml-9">
          <p
            className={`text-[12px] leading-relaxed transition-all ${
              isLow ? 'text-neutral-600' : 'text-neutral-500'
            } ${isExpanded ? '' : 'line-clamp-1'}`}
          >
            {activity.summary}
          </p>
        </div>

        {/* ── Bottom row: operator + role tags + shot button ── */}
        <div className="mt-2 ml-9 flex items-center gap-2 flex-wrap">
          {/* Operator */}
          {operator && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${operator.color1}, ${operator.color2})`,
                }}
              />
              <span
                className={`text-[11px] font-medium ${isLow ? 'text-neutral-600' : 'text-neutral-400'}`}
              >
                {operator.name}
              </span>
            </div>
          )}

          {/* Dot separator */}
          {operator && activity.impactRoles.length > 0 && (
            <span className="text-neutral-800 text-[10px]">·</span>
          )}

          {/* Impact role tags */}
          <div className="flex items-center gap-1 flex-wrap">
            {activity.impactRoles.map(role => {
              const cfg = ROLE_CONFIG[role];
              return (
                <span
                  key={role}
                  className="text-[9px] font-mono px-1.5 py-px rounded-full"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Focus shot button */}
          <AnimatePresence>
            {hasShotLink && (hovered || isExpanded) && (
              <motion.button
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.15 }}
                onClick={e => {
                  e.stopPropagation();
                  if (activity.relatedShotId) onFocusShot?.(activity.relatedShotId);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono transition-all border"
                style={{
                  background: `${actionCfg.color}14`,
                  borderColor: `${actionCfg.color}30`,
                  color: actionCfg.color,
                }}
              >
                查看镜头
                <ArrowRight size={9} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
