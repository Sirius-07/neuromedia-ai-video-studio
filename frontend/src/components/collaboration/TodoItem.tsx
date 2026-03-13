import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, AlertCircle, Tag, ArrowRight } from 'lucide-react';
import { MEMBERS } from './mockData';
import type { TodoItem as TodoItemType, TodoStatus, TodoPriority } from './types';

// ── Status cycle ──────────────────────────────────────────────────────────────

const STATUS_CYCLE: Record<TodoStatus, TodoStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

const STATUS_LABEL: Record<TodoStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
};

const STATUS_NEXT_TITLE: Record<TodoStatus, string> = {
  todo: '点击开始',
  in_progress: '点击完成',
  done: '点击重置',
};

// ── Priority style ────────────────────────────────────────────────────────────

interface PriorityCfg {
  borderColor: string;
  cardBg: string;
  titleColor: string;
  badgeColor: string;
  badgeBg: string;
  label: string;
}

const PRIORITY_CFG: Record<TodoPriority, PriorityCfg> = {
  high: {
    borderColor: '#f97316',
    cardBg: 'rgba(249,115,22,0.04)',
    titleColor: '#f1f5f9',
    badgeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.14)',
    label: '高优先',
  },
  medium: {
    borderColor: '#06b6d4',
    cardBg: 'rgba(255,255,255,0.025)',
    titleColor: '#e2e8f0',
    badgeColor: '#22d3ee',
    badgeBg: 'rgba(34,211,238,0.12)',
    label: '中优先',
  },
  low: {
    borderColor: 'rgba(255,255,255,0.08)',
    cardBg: 'rgba(255,255,255,0.015)',
    titleColor: '#94a3b8',
    badgeColor: '#64748b',
    badgeBg: 'rgba(100,116,139,0.12)',
    label: '低优先',
  },
};

// ── Status circle ─────────────────────────────────────────────────────────────

const StatusCircle: React.FC<{ status: TodoStatus }> = ({ status }) => (
  <AnimatePresence mode="wait">
    {status === 'todo' && (
      <motion.div
        key="todo"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-[18px] h-[18px] rounded-full border-2 border-neutral-700 group-hover/circle:border-cyan-500/60 transition-colors"
      />
    )}

    {status === 'in_progress' && (
      <motion.div
        key="in_progress"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-[18px] h-[18px] rounded-full border-2 border-cyan-500 flex items-center justify-center relative"
      >
        <div className="w-[7px] h-[7px] rounded-full bg-cyan-400" />
        <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-30" />
      </motion.div>
    )}

    {status === 'done' && (
      <motion.div
        key="done"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-[18px] h-[18px] rounded-full bg-emerald-500/80 border border-emerald-400/40 flex items-center justify-center"
      >
        <Check size={10} strokeWidth={2.5} className="text-white" />
      </motion.div>
    )}
  </AnimatePresence>
);

// ── TodoItem ──────────────────────────────────────────────────────────────────

export interface TodoItemProps {
  todo: TodoItemType;
  onStatusChange: (id: string, next: TodoStatus) => void;
  onFocusShot?: (shotId: string) => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({ todo, onStatusChange, onFocusShot }) => {
  const [hovered, setHovered] = useState(false);
  const priorityCfg = PRIORITY_CFG[todo.priority];
  const assignee = MEMBERS.find(m => m.id === todo.assigneeId);
  const isDone = todo.status === 'done';
  const isOverdue = todo.dueTime.includes('已超期');
  const hasShotLink = !!todo.relatedShotId;

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(todo.id, STATUS_CYCLE[todo.status]);
  };

  const handleCardClick = () => {
    if (hasShotLink) onFocusShot?.(todo.relatedShotId!);
  };

  return (
    <motion.div
      layout
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
      className={`relative rounded-xl overflow-hidden transition-all ${
        isDone ? 'opacity-55' : ''
      } ${hasShotLink ? 'cursor-pointer' : 'cursor-default'}`}
      style={{
        background: priorityCfg.cardBg,
        borderLeft: `2px solid ${priorityCfg.borderColor}`,
        boxShadow: hovered
          ? `0 0 0 1px rgba(255,255,255,0.07)`
          : `0 0 0 1px rgba(255,255,255,0.04)`,
      }}
    >
      {/* High priority shimmer bar */}
      {todo.priority === 'high' && !isDone && (
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${priorityCfg.borderColor}55, transparent)`,
          }}
        />
      )}

      <div className="px-3 py-3">
        {/* ── Row 1: status circle + title + due time ── */}
        <div className="flex items-start gap-2.5">
          {/* Status toggle button */}
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={handleStatusToggle}
            className="shrink-0 mt-0.5 group/circle"
            title={STATUS_NEXT_TITLE[todo.status]}
          >
            <StatusCircle status={todo.status} />
          </motion.button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <span
              className={`text-[12px] font-semibold leading-snug break-words ${
                isDone ? 'line-through text-neutral-600' : ''
              }`}
              style={{ color: isDone ? undefined : priorityCfg.titleColor }}
            >
              {todo.title}
            </span>
          </div>

          {/* Due time */}
          <div className="shrink-0 flex items-center gap-1 mt-px">
            {isOverdue ? (
              <AlertCircle size={9} className="text-red-400" />
            ) : (
              <Clock size={9} className="text-neutral-700" />
            )}
            <span
              className={`text-[10px] font-mono tabular-nums ${
                isOverdue ? 'text-red-400 font-semibold' : 'text-neutral-700'
              }`}
            >
              {todo.dueTime}
            </span>
          </div>
        </div>

        {/* ── Row 2: description ── */}
        <div className="mt-1.5 ml-[26px]">
          <p
            className={`text-[11px] leading-relaxed line-clamp-1 ${
              isDone ? 'text-neutral-700' : 'text-neutral-600'
            }`}
          >
            {todo.description}
          </p>
        </div>

        {/* ── Row 3: meta ── */}
        <div className="mt-2 ml-[26px] flex items-center gap-2 flex-wrap">
          {/* Assignee */}
          {assignee && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${assignee.color1}, ${assignee.color2})`,
                }}
              />
              <span
                className={`text-[11px] font-medium ${
                  isDone ? 'text-neutral-700' : 'text-neutral-500'
                }`}
              >
                {assignee.name}
              </span>
            </div>
          )}

          {/* Separator */}
          <span className="text-neutral-800 text-[10px]">·</span>

          {/* Priority badge */}
          <span
            className="text-[9px] font-mono px-1.5 py-px rounded-full"
            style={{ background: priorityCfg.badgeBg, color: priorityCfg.badgeColor }}
          >
            {priorityCfg.label}
          </span>

          {/* Status badge */}
          <span
            className={`text-[9px] font-mono px-1.5 py-px rounded-full ${
              todo.status === 'in_progress'
                ? 'bg-cyan-500/12 text-cyan-500'
                : todo.status === 'done'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-white/[0.05] text-neutral-600'
            }`}
          >
            {STATUS_LABEL[todo.status]}
          </span>

          {/* Tags */}
          {todo.tags?.map(tag => (
            <span key={tag} className="flex items-center gap-0.5 text-[10px] text-neutral-700 font-mono">
              <Tag size={8} />
              {tag}
            </span>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Focus shot button */}
          <AnimatePresence>
            {hasShotLink && hovered && (
              <motion.button
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.14 }}
                onClick={e => {
                  e.stopPropagation();
                  onFocusShot?.(todo.relatedShotId!);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono transition-all border"
                style={{
                  background: `${priorityCfg.borderColor}14`,
                  borderColor: `${priorityCfg.borderColor}30`,
                  color: priorityCfg.borderColor,
                }}
              >
                查看镜头
                <ArrowRight size={8} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
