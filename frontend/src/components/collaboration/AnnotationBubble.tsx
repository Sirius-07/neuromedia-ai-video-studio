import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import type { Annotation, AnnotationStatus } from './types';
import { MEMBERS } from './mockData';

// ── Status config ──────────────────────────────────────────────────────────────

interface StatusDef {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.FC<{ size?: number }>;
  next: AnnotationStatus;
  nextLabel: string;
}

const STATUS_CFG: Record<AnnotationStatus, StatusDef> = {
  open: {
    label: '未处理',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.25)',
    icon: AlertCircle,
    next: 'in_progress',
    nextLabel: '标记处理中',
  },
  in_progress: {
    label: '处理中',
    color: '#22d3ee',
    bg: 'rgba(34,211,238,0.12)',
    border: 'rgba(34,211,238,0.25)',
    icon: Clock,
    next: 'resolved',
    nextLabel: '标记已解决',
  },
  resolved: {
    label: '已解决',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.1)',
    border: 'rgba(74,222,128,0.2)',
    icon: CheckCircle2,
    next: 'open',
    nextLabel: '重新打开',
  },
};

// ── Props ──────────────────────────────────────────────────────────────────────

export interface AnnotationBubbleProps {
  annotation: Annotation;
  onStatusChange: (id: string, status: AnnotationStatus) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AnnotationBubble: React.FC<AnnotationBubbleProps> = ({
  annotation,
  onStatusChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const author = MEMBERS.find(m => m.id === annotation.authorId);
  const cfg = STATUS_CFG[annotation.status];
  const StatusIcon = cfg.icon;

  // Popover direction: above if bubble is in lower half of thumbnail
  const popoverAbove = annotation.position.y > 52;

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  const toggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(annotation.id, cfg.next);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: open ? 9999 : 20 }}>
      {/* Pulsing ring — only for unresolved annotations */}
      {annotation.status !== 'resolved' && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: cfg.color,
            opacity: 0.18,
            animationDuration: annotation.status === 'open' ? '1.8s' : '3s',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Bubble button */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(p => !p); }}
        className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white
          shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-all hover:scale-110 active:scale-95
          ${open ? 'scale-110' : ''}`}
        style={{
          background: author
            ? `linear-gradient(135deg, ${author.color1}, ${author.color2})`
            : cfg.color,
          outline: open ? `2px solid ${cfg.color}` : 'none',
          outlineOffset: '1px',
        }}
        title={`${author?.name ?? '?'} · ${cfg.label}`}
      >
        {author?.initials ?? '?'}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: popoverAbove ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: popoverAbove ? 6 : -6 }}
            transition={{ type: 'spring', damping: 24, stiffness: 420, duration: 0.16 }}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              ...(popoverAbove ? { bottom: '2.25rem' } : { top: '2.25rem' }),
              width: '224px',
              zIndex: 9999,
              background: 'rgba(11,11,18,0.97)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04) inset',
            }}
          >
            {/* Arrow */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '10px',
                height: '10px',
                background: 'rgba(11,11,18,0.97)',
                ...(popoverAbove
                  ? {
                      bottom: '-5px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      borderRight: '1px solid rgba(255,255,255,0.1)',
                    }
                  : {
                      top: '-5px',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      borderLeft: '1px solid rgba(255,255,255,0.1)',
                    }),
              }}
            />

            {/* ── Header ── */}
            <div
              className="flex items-center gap-2 px-3 pt-3 pb-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Author avatar */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{
                  background: author
                    ? `linear-gradient(135deg, ${author.color1}, ${author.color2})`
                    : '#555',
                }}
              >
                {author?.initials ?? '?'}
              </div>

              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-neutral-200 leading-none truncate">
                  {author?.name ?? '未知用户'}
                </p>
                <p
                  className="text-[10px] font-mono mt-0.5"
                  style={{ color: author?.color1 ?? '#888' }}
                >
                  {author?.roleLabel ?? ''}
                </p>
              </div>

              {/* Close */}
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); }}
                className="w-5 h-5 rounded-md flex items-center justify-center text-neutral-600 hover:text-white hover:bg-white/[0.1] transition-colors shrink-0"
              >
                <X size={11} />
              </button>
            </div>

            {/* ── Content ── */}
            <div className="px-3 py-2.5">
              <p className="text-[12px] text-neutral-300 leading-relaxed">{annotation.content}</p>
            </div>

            {/* ── Footer ── */}
            <div
              className="flex items-center justify-between px-3 pb-3"
            >
              <span className="text-[10px] text-neutral-600 font-mono">{annotation.time}</span>

              {/* Status cycle button */}
              <button
                onClick={toggleStatus}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: cfg.bg,
                  color: cfg.color,
                  border: `1px solid ${cfg.border}`,
                }}
                title={cfg.nextLabel}
              >
                <StatusIcon size={9} />
                {cfg.label}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
