import React from 'react';
import { X, Users } from 'lucide-react';
import { MEMBERS } from './mockData';

interface PanelHeaderProps {
  onClose: () => void;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ onClose }) => {
  const onlineCount = MEMBERS.filter(m => m.isOnline).length;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] shrink-0">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Users size={13} className="text-cyan-400" />
        <span className="text-[11px] font-mono tracking-[0.18em] uppercase text-neutral-300">
          协作面板
        </span>
      </div>

      {/* Right side: member avatars + online count + close */}
      <div className="flex items-center gap-3">
        {/* Stacked avatars */}
        <div className="flex items-center">
          {MEMBERS.map((m, i) => (
            <div
              key={m.id}
              className="relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white select-none"
              style={{
                background: `linear-gradient(135deg, ${m.color1}, ${m.color2})`,
                marginLeft: i > 0 ? '-6px' : 0,
                border: '1.5px solid #0d0d12',
                zIndex: MEMBERS.length - i,
              }}
              title={`${m.name} · ${m.roleLabel}`}
            >
              {m.initials}
              {m.isOnline && (
                <span className="absolute -bottom-px -right-px w-2 h-2 bg-emerald-400 rounded-full border-[1.5px] border-[#0d0d12]" />
              )}
            </div>
          ))}
        </div>

        {/* Online indicator */}
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-mono tabular-nums">{onlineCount}</span>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/[0.08] text-neutral-600 hover:text-neutral-300 transition-colors"
          title="收起面板"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
