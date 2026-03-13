import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, AlertCircle, User } from 'lucide-react';
import { TodoItem } from './TodoItem';
import { TODO_ITEMS, CURRENT_USER_ID } from './mockData';
import type { TodoItem as TodoItemType, TodoStatus } from './types';

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterId = 'all' | 'todo' | 'in_progress' | 'done' | 'mine';

interface FilterDef {
  id: FilterId;
  label: string;
  icon?: React.ReactNode;
  match: (t: TodoItemType) => boolean;
}

const FILTERS: FilterDef[] = [
  { id: 'all', label: '全部', match: () => true },
  { id: 'in_progress', label: '进行中', match: t => t.status === 'in_progress' },
  { id: 'todo', label: '待办', match: t => t.status === 'todo' },
  { id: 'done', label: '已完成', match: t => t.status === 'done' },
  {
    id: 'mine',
    label: '我的',
    icon: <User size={9} />,
    match: t => t.assigneeId === CURRENT_USER_ID,
  },
];

// ── Sort order ────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<TodoStatus, number> = {
  in_progress: 0,
  todo: 1,
  done: 2,
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function sortTodos(todos: TodoItemType[]): TodoItemType[] {
  return [...todos].sort((a, b) => {
    const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (so !== 0) return so;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}

// ── TodoList ──────────────────────────────────────────────────────────────────

export interface TodoListProps {
  onFocusShot?: (shotId: string) => void;
}

export const TodoList: React.FC<TodoListProps> = ({ onFocusShot }) => {
  const [todos, setTodos] = useState<TodoItemType[]>(TODO_ITEMS);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  // ── Derived stats ───────────────────────────────────────────────────────────
  const total = todos.length;
  const doneCount = todos.filter(t => t.status === 'done').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const overdueCount = todos.filter(t => t.dueTime.includes('已超期')).length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // ── Status change handler ───────────────────────────────────────────────────
  const handleStatusChange = (id: string, next: TodoStatus) => {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, status: next } : t)));
  };

  // ── Filter + sort ───────────────────────────────────────────────────────────
  const filterDef = FILTERS.find(f => f.id === activeFilter)!;
  const filtered = sortTodos(todos.filter(filterDef.match));

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-white/[0.05]">
        {/* Title row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={12} className="text-cyan-500" />
            <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400">
              待处理任务
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[10px] font-mono">
            <span className="text-neutral-700 tabular-nums">{total} 总计</span>
            {inProgressCount > 0 && (
              <span className="text-cyan-500 tabular-nums">{inProgressCount} 进行中</span>
            )}
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-red-400 tabular-nums">
                <AlertCircle size={9} />
                {overdueCount} 超期
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-neutral-700 font-mono">完成进度</span>
            <span className="text-[10px] font-mono tabular-nums">
              <span className="text-emerald-400">{doneCount}</span>
              <span className="text-neutral-700"> / {total}</span>
              <span className="text-neutral-600 ml-1">({progressPct}%)</span>
            </span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #06b6d4, #22c55e)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 collab-scrollbar-x">
          {FILTERS.map(f => {
            const count = todos.filter(f.match).length;
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/[0.04] text-neutral-600 border border-transparent hover:text-neutral-300 hover:bg-white/[0.07]'
                }`}
              >
                {f.icon}
                {f.label}
                <span className={`tabular-nums ${isActive ? 'text-cyan-500' : 'text-neutral-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Todo list ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 collab-scrollbar px-3 py-3">
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <motion.div className="flex flex-col gap-2">
              {filtered.map((todo, i) => (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, delay: i * 0.03 }}
                >
                  <TodoItem
                    todo={todo}
                    onStatusChange={handleStatusChange}
                    onFocusShot={onFocusShot}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-neutral-700"
            >
              <CheckSquare size={24} className="mb-2 opacity-30" />
              <p className="text-[12px] font-mono">该分类暂无任务</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status legend */}
        {filtered.length > 0 && (
          <div className="mt-4 flex items-center gap-4 px-1">
            <span className="text-[9px] font-mono text-neutral-800 uppercase tracking-widest">
              状态
            </span>
            {(
              [
                { label: '待办', element: <div className="w-[10px] h-[10px] rounded-full border-2 border-neutral-700" /> },
                { label: '进行中', element: <div className="w-[10px] h-[10px] rounded-full border-2 border-cyan-500 bg-cyan-500/20" /> },
                { label: '已完成', element: <div className="w-[10px] h-[10px] rounded-full bg-emerald-500/80" /> },
              ] as const
            ).map(({ label, element }) => (
              <div key={label} className="flex items-center gap-1.5">
                {element}
                <span className="text-[10px] text-neutral-700 font-mono">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
