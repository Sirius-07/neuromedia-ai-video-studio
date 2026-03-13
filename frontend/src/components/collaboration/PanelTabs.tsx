import React from 'react';
import { MessageSquare, Activity, CheckSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import type { TabId } from './types';

interface Tab {
  id: TabId;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  badge?: number;
}

const TABS: Tab[] = [
  { id: 'discussion', label: '讨论', icon: MessageSquare, badge: 2 },
  { id: 'activity', label: '动态', icon: Activity },
  { id: 'tasks', label: '待处理', icon: CheckSquare, badge: 3 },
];

interface PanelTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const PanelTabs: React.FC<PanelTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex items-center border-b border-white/[0.08] shrink-0 px-1">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono tracking-wider transition-colors ${
              isActive
                ? 'text-cyan-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Icon size={12} />
            <span>{tab.label}</span>

            {tab.badge !== undefined && (
              <span
                className={`ml-0.5 px-1 py-px rounded text-[9px] font-bold tabular-nums ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-white/[0.06] text-neutral-500'
                }`}
              >
                {tab.badge}
              </span>
            )}

            {isActive && (
              <motion.div
                layoutId="collab-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
