import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { MEMBERS } from './mockData';
import type { UserChatMessage, Reaction } from './types';

// ── Quick reaction emojis ─────────────────────────────────────────────────────
const QUICK_REACTIONS = ['👍', '🔥', '✅', '🎨', '⏰', '💡'];

// ── @mention highlight renderer ───────────────────────────────────────────────
function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span
        key={i}
        className="text-cyan-400 font-medium px-0.5 rounded-sm"
        style={{ background: 'rgba(6,182,212,0.12)' }}
      >
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

// ── Reaction row ──────────────────────────────────────────────────────────────
interface ReactionRowProps {
  reactions: Reaction[];
  messageId: string;
  onReaction: (messageId: string, emoji: string) => void;
  isSelf: boolean;
}

const ReactionRow: React.FC<ReactionRowProps> = ({ reactions, messageId, onReaction, isSelf }) => {
  if (!reactions.length) return null;
  return (
    <div className={`flex items-center gap-1 mt-1 flex-wrap ${isSelf ? 'justify-end' : ''}`}>
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => onReaction(messageId, r.emoji)}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-all border ${
            r.reacted
              ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
              : 'bg-white/[0.05] border-white/[0.08] text-neutral-400 hover:bg-white/[0.1] hover:border-white/[0.14]'
          }`}
        >
          <span>{r.emoji}</span>
          <span className="text-[10px] font-mono tabular-nums ml-0.5">{r.count}</span>
        </button>
      ))}
    </div>
  );
};

// ── Single bubble ─────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: UserChatMessage;
  isSelf: boolean;
  pos: 'only' | 'first' | 'middle' | 'last';
  onReaction: (messageId: string, emoji: string) => void;
}

const Bubble: React.FC<BubbleProps> = ({ msg, isSelf, pos, onReaction }) => {
  const [showActions, setShowActions] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const radiusClass =
    pos === 'only'
      ? 'rounded-2xl'
      : pos === 'first'
      ? isSelf
        ? 'rounded-2xl rounded-tr-[5px]'
        : 'rounded-2xl rounded-tl-[5px]'
      : pos === 'last'
      ? isSelf
        ? 'rounded-2xl rounded-br-[5px]'
        : 'rounded-2xl rounded-bl-[5px]'
      : isSelf
      ? 'rounded-xl rounded-r-[5px]'
      : 'rounded-xl rounded-l-[5px]';

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowPicker(false);
      }}
    >
      <div className="relative">
        {/* Hover action bar */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
              className={`absolute top-1/2 -translate-y-1/2 z-20 ${
                isSelf ? 'right-full mr-2' : 'left-full ml-2'
              }`}
            >
              {showPicker ? (
                <div className="flex items-center gap-px bg-[#18181f] border border-white/[0.12] rounded-full px-2 py-1.5 shadow-2xl shadow-black/40">
                  {QUICK_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReaction(msg.id, emoji);
                        setShowPicker(false);
                        setShowActions(false);
                      }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-full text-sm transition-all hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowPicker(true)}
                  className="w-6 h-6 flex items-center justify-center bg-[#18181f] border border-white/[0.1] rounded-full text-neutral-500 hover:text-neutral-300 transition-colors shadow-lg shadow-black/30"
                >
                  <SmilePlus size={11} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bubble body */}
        <div
          className={`px-3 py-2 text-[13px] leading-relaxed break-words select-text ${radiusClass} ${
            isSelf
              ? 'bg-gradient-to-br from-cyan-500/[0.16] to-violet-600/[0.16] border border-cyan-500/[0.2] text-neutral-100 shadow-[inset_0_1px_0_rgba(34,211,238,0.1)]'
              : 'bg-white/[0.06] border border-white/[0.07] text-neutral-200'
          }`}
        >
          {renderContent(msg.content)}
        </div>
      </div>

      {/* Per-bubble reactions */}
      {msg.reactions && msg.reactions.length > 0 && (
        <ReactionRow
          reactions={msg.reactions}
          messageId={msg.id}
          onReaction={onReaction}
          isSelf={isSelf}
        />
      )}
    </div>
  );
};

// ── Message group (consecutive messages from same sender) ─────────────────────
export interface MessageItemProps {
  senderId: string;
  messages: UserChatMessage[];
  currentUserId: string;
  onReaction: (messageId: string, emoji: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  senderId,
  messages,
  currentUserId,
  onReaction,
}) => {
  const author = MEMBERS.find(m => m.id === senderId);
  if (!author) return null;

  const isSelf = senderId === currentUserId;
  const lastMsg = messages[messages.length - 1];

  const getBubblePos = (i: number): 'only' | 'first' | 'middle' | 'last' => {
    if (messages.length === 1) return 'only';
    if (i === 0) return 'first';
    if (i === messages.length - 1) return 'last';
    return 'middle';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`flex gap-2.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ring-2 ring-[#0d0d12]"
        style={{
          background: `linear-gradient(135deg, ${author.color1}, ${author.color2})`,
          boxShadow: `0 0 12px ${author.color1}40`,
        }}
        title={`${author.name} · ${author.roleLabel}`}
      >
        {author.initials}
      </div>

      {/* Content column */}
      <div
        className={`flex flex-col gap-1 min-w-0 max-w-[235px] ${
          isSelf ? 'items-end' : 'items-start'
        }`}
      >
        {/* Name + role header */}
        <div
          className={`flex items-center gap-1.5 px-0.5 ${isSelf ? 'flex-row-reverse' : ''}`}
        >
          <span className="text-[11px] font-medium text-neutral-300 truncate">
            {author.name}
          </span>
          <span
            className="text-[9px] font-mono px-1.5 py-px rounded-full shrink-0"
            style={{ background: `${author.color1}1e`, color: author.color1 }}
          >
            {author.roleLabel}
          </span>
        </div>

        {/* Bubbles */}
        <div className="flex flex-col gap-0.5 w-full">
          {messages.map((msg, i) => (
            <Bubble
              key={msg.id}
              msg={msg}
              isSelf={isSelf}
              pos={getBubblePos(i)}
              onReaction={onReaction}
            />
          ))}
        </div>

        {/* Time footer */}
        <span
          className={`text-[10px] text-neutral-700 font-mono tabular-nums px-0.5 ${
            isSelf ? 'self-end' : 'self-start'
          }`}
        >
          {lastMsg.time}
        </span>
      </div>
    </motion.div>
  );
};
