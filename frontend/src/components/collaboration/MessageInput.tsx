import React, { useState, useRef, useEffect } from 'react';
import { Send, AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MEMBERS, CURRENT_USER_ID } from './mockData';
import type { Member } from './types';

// ── @mention detection helpers ────────────────────────────────────────────────

interface MentionState {
  query: string;
  startIndex: number;
}

function detectMention(text: string, cursor: number): MentionState | null {
  const before = text.slice(0, cursor);
  const match = before.match(/@([^\s@]*)$/);
  if (!match) return null;
  return {
    query: match[1],
    startIndex: cursor - match[0].length,
  };
}

function filterMembers(query: string): Member[] {
  if (!query) return MEMBERS;
  const q = query.toLowerCase();
  return MEMBERS.filter(
    m =>
      m.name.toLowerCase().includes(q) ||
      m.roleLabel.includes(q) ||
      m.initials.toLowerCase().includes(q)
  );
}

// ── MentionPicker ─────────────────────────────────────────────────────────────

interface MentionPickerProps {
  members: Member[];
  query: string;
  onSelect: (member: Member) => void;
}

const MentionPicker: React.FC<MentionPickerProps> = ({ members, query, onSelect }) => {
  if (!members.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border overflow-hidden shadow-2xl shadow-black/50 z-50"
      style={{
        background: 'rgba(18,18,26,0.98)',
        borderColor: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Picker header */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 border-b border-white/[0.06]">
        <AtSign size={10} className="text-cyan-500" />
        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
          提及成员
        </span>
        {query && (
          <span className="ml-1 text-[10px] font-mono text-cyan-500 bg-cyan-500/10 px-1.5 py-px rounded">
            {query}
          </span>
        )}
      </div>

      {/* Member list */}
      <div className="py-1">
        {members.map(m => (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.06] transition-colors text-left group"
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${m.color1}, ${m.color2})` }}
            >
              {m.initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-neutral-200 font-medium group-hover:text-white transition-colors">
                  {m.name}
                </span>
                {m.isOnline && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                )}
              </div>
              <span className="text-[10px] font-mono" style={{ color: m.color1 }}>
                @{m.roleLabel}
              </span>
            </div>

            {/* Insert hint */}
            <span className="text-[10px] font-mono text-neutral-700 group-hover:text-neutral-500 transition-colors shrink-0">
              Tab
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// ── MessageInput ──────────────────────────────────────────────────────────────

interface MessageInputProps {
  onSend: (content: string) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend }) => {
  const [value, setValue] = useState('');
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUser = MEMBERS.find(m => m.id === CURRENT_USER_ID)!;

  const filteredMembers = mentionState ? filterMembers(mentionState.query) : [];

  // Auto-resize textarea
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMentionState(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);
    const cursor = e.target.selectionStart ?? val.length;
    const state = detectMention(val, cursor);
    setMentionState(state);
  };

  const insertMention = (member: Member) => {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    if (!mentionState) return;
    const before = value.slice(0, mentionState.startIndex);
    const after = value.slice(cursor);
    const inserted = `@${member.roleLabel} `;
    setValue(before + inserted + after);
    setMentionState(null);

    // Re-focus and position cursor
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const pos = before.length + inserted.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
    });
  };

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value.trim());
    setValue('');
    setMentionState(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setMentionState(null);
      return;
    }
    // Tab to insert first mention suggestion
    if (e.key === 'Tab' && mentionState && filteredMembers.length > 0) {
      e.preventDefault();
      insertMention(filteredMembers[0]);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (mentionState && filteredMembers.length > 0) {
        e.preventDefault();
        insertMention(filteredMembers[0]);
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = value.trim().length > 0;

  return (
    <div
      ref={containerRef}
      className="shrink-0 border-t border-white/[0.08] px-3 py-3 bg-[#0d0d12]"
    >
      <div className="relative flex items-end gap-2">
        {/* @mention picker */}
        <AnimatePresence>
          {mentionState && filteredMembers.length > 0 && (
            <MentionPicker
              members={filteredMembers}
              query={mentionState.query}
              onSelect={insertMention}
            />
          )}
        </AnimatePresence>

        {/* Current user avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-px ring-2 ring-[#0d0d12]"
          style={{
            background: `linear-gradient(135deg, ${currentUser.color1}, ${currentUser.color2})`,
          }}
          title={`${currentUser.name} · ${currentUser.roleLabel}`}
        >
          {currentUser.initials}
        </div>

        {/* Input wrapper */}
        <div
          className={`flex-1 flex items-end gap-2 rounded-xl px-3 py-2 transition-all border ${
            mentionState
              ? 'bg-cyan-500/[0.04] border-cyan-500/30'
              : hasContent
              ? 'bg-white/[0.06] border-white/[0.12]'
              : 'bg-white/[0.04] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.1]'
          } focus-within:border-cyan-500/30 focus-within:bg-cyan-500/[0.03]`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="发送消息，输入 @ 提及成员…"
            rows={1}
            className="flex-1 bg-transparent text-[13px] text-neutral-200 placeholder:text-neutral-700 resize-none outline-none leading-relaxed min-h-[20px]"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!hasContent}
            className={`mb-px shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              hasContent
                ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white hover:opacity-85 shadow-[0_0_14px_rgba(34,211,238,0.25)]'
                : 'bg-white/[0.04] text-neutral-700 cursor-not-allowed'
            }`}
          >
            <Send size={12} />
          </button>
        </div>
      </div>

      {/* Hint bar */}
      <div className="mt-1.5 ml-9 flex items-center gap-3">
        <p className="text-[10px] text-neutral-800 font-mono">
          Enter 发送 · Shift+Enter 换行 · @ 提及
        </p>
        {mentionState && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-mono text-cyan-600"
          >
            ↑↓ 选择 · Tab/Enter 插入 · Esc 关闭
          </motion.span>
        )}
      </div>
    </div>
  );
};
