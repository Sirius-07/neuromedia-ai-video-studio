import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Radio, Layers } from 'lucide-react';
import { ActivityItem } from './ActivityItem';
import type { ProjectActivity, ProjectActivityType, ActivityPriority, ProjectStage } from './types';

// ── Filter definition ─────────────────────────────────────────────────────────

type FilterId = 'all' | 'current' | 'high' | 'script' | 'shot' | 'music' | 'visual';

interface FilterDef {
  id: FilterId;
  label: string;
  match: (a: ProjectActivity) => boolean;
}

const SCRIPT_TYPES: ProjectActivityType[] = ['script_update', 'member_comment'];
const SHOT_TYPES: ProjectActivityType[] = ['shot_added', 'shot_deleted', 'storyboard_approved'];
const MUSIC_TYPES: ProjectActivityType[] = ['soundtrack_replaced'];
const VISUAL_TYPES: ProjectActivityType[] = ['style_changed', 'asset_uploaded'];

const STAGE_LABELS: Record<ProjectStage, string> = {
  script: '剧本',
  style: '风格',
  storyboard: '分镜',
  editor: '剪辑',
};

const buildFilters = (currentStage?: ProjectStage): FilterDef[] => [
  { id: 'all', label: '全部', match: () => true },
  ...(currentStage ? [{ id: 'current' as FilterId, label: `当前·${STAGE_LABELS[currentStage]}`, match: (a: ProjectActivity) => a.stage === currentStage }] : []),
  { id: 'high', label: '高优先', match: a => a.priority === 'high' },
  { id: 'script', label: '剧本', match: a => SCRIPT_TYPES.includes(a.actionType) },
  { id: 'shot', label: '分镜', match: a => SHOT_TYPES.includes(a.actionType) },
  { id: 'music', label: '配乐', match: a => MUSIC_TYPES.includes(a.actionType) },
  { id: 'visual', label: '视觉', match: a => VISUAL_TYPES.includes(a.actionType) },
];

// ── ActivityList ──────────────────────────────────────────────────────────────

export interface ActivityListProps {
  activities: ProjectActivity[];
  latestActivityId?: string | null;
  onFocusShot?: (shotId: string) => void;
  currentStage?: ProjectStage;
}

export const ActivityList: React.FC<ActivityListProps> = ({ activities, latestActivityId, onFocusShot, currentStage }) => {
  const [activeFilter, setActiveFilter] = useState<FilterId>(() => currentStage ? 'current' : 'all');

  // When stage changes, auto-switch to the "current stage" filter
  useEffect(() => {
    if (currentStage) {
      setActiveFilter('current');
    }
  }, [currentStage]);

  const highCount = activities.filter(a => a.priority === 'high').length;
  const latestTimeAgo = activities[0]?.timeAgo ?? '—';

  const FILTERS = buildFilters(currentStage);
  const filterDef = FILTERS.find(f => f.id === activeFilter) ?? FILTERS[0];
  const filtered = activities.filter(filterDef.match);

  // For non-current-stage items in "all" view, dim them slightly
  const isCurrentStageItem = (a: ProjectActivity) =>
    currentStage ? a.stage === currentStage : true;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-white/[0.05]">
        {/* Title row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400">
              活动流
            </span>
            <span className="text-[10px] text-neutral-700 font-mono tabular-nums">
              {activities.length} 条
            </span>
            {highCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-orange-400">
                <Zap size={9} />
                {highCount} 条高优
              </span>
            )}
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <Radio size={9} className="text-emerald-400" />
            <span className="text-[9px] font-mono text-emerald-500 tracking-wider">实时同步</span>
          </div>
        </div>

        {/* Latest update hint */}
        <p className="text-[10px] text-neutral-700 font-mono mb-2.5">
          最新更新：{latestTimeAgo}
        </p>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 collab-scrollbar-x">
          {FILTERS.map(f => {
            const count = activities.filter(f.match).length;
            const isActive = activeFilter === f.id;
            const isCurrent = f.id === 'current';
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono transition-all whitespace-nowrap ${
                  isCurrent
                    ? isActive
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'bg-violet-500/[0.08] text-violet-500 border border-violet-500/20 hover:bg-violet-500/15'
                    : isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/[0.04] text-neutral-600 border border-transparent hover:text-neutral-300 hover:bg-white/[0.07]'
                }`}
              >
                {isCurrent && <Layers size={8} className={isActive ? 'text-violet-300' : 'text-violet-500'} />}
                {f.id === 'high' && <Zap size={8} className={isActive ? 'text-orange-400' : 'text-neutral-700'} />}
                {f.label}
                <span
                  className={`tabular-nums ${
                    isCurrent
                      ? isActive ? 'text-violet-400' : 'text-violet-600'
                      : isActive ? 'text-cyan-500' : 'text-neutral-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Activity list ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 collab-scrollbar px-3 py-3">
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <motion.div className="flex flex-col gap-2">
              {filtered.map((activity, i) => (
                <motion.div
                  key={activity.id}
                  layout
                  initial={{ opacity: 0, y: activity.id === latestActivityId ? -12 : 8 }}
                  animate={{
                    opacity: activeFilter === 'all' && !isCurrentStageItem(activity) ? 0.45 : 1,
                    y: 0,
                  }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.22, delay: activity.id === latestActivityId ? 0 : i * 0.04 }}
                >
                  <ActivityItem
                    activity={activity}
                    isLatest={activity.id === latestActivityId}
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
              <span className="text-2xl mb-2 opacity-40">◎</span>
              <p className="text-[12px] font-mono">该分类暂无动态</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Priority legend */}
        {activeFilter === 'all' && filtered.length > 0 && (
          <div className="mt-4 flex items-center gap-4 px-1">
            <span className="text-[9px] font-mono text-neutral-800 uppercase tracking-widest">优先级</span>
            {(
              [
                { priority: 'high' as ActivityPriority, color: '#f97316', label: '高' },
                { priority: 'medium' as ActivityPriority, color: '#06b6d4', label: '中' },
                { priority: 'low' as ActivityPriority, color: 'rgba(255,255,255,0.12)', label: '低' },
              ] as const
            ).map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-[10px] text-neutral-700 font-mono">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
