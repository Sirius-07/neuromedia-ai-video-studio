import React, { RefObject } from 'react';
import {
  GitBranch,
  UserPlus,
  Paperclip,
  CheckCircle2,
  Flag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { MessageItem } from './MessageItem';
import { MEMBERS } from './mockData';
import type {
  ChatMessage,
  UserChatMessage,
  SystemChatMessage,
  SystemEventType,
} from './types';

// ── Render item types ─────────────────────────────────────────────────────────

type RenderItem =
  | { kind: 'date'; label: string; key: string }
  | { kind: 'user-group'; senderId: string; messages: UserChatMessage[]; key: string }
  | { kind: 'system'; message: SystemChatMessage; key: string };

function buildRenderItems(messages: ChatMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  let currentDate: string | undefined;
  let currentGroup: UserChatMessage[] | null = null;
  let currentSenderId: string | null = null;

  const flushGroup = () => {
    if (currentGroup && currentGroup.length > 0 && currentSenderId) {
      items.push({
        kind: 'user-group',
        senderId: currentSenderId,
        messages: [...currentGroup],
        key: `group-${currentGroup[0].id}`,
      });
      currentGroup = null;
      currentSenderId = null;
    }
  };

  for (const msg of messages) {
    if (msg.date !== currentDate) {
      flushGroup();
      const label =
        msg.date === 'today' ? '今天' : msg.date === 'yesterday' ? '昨天' : msg.date ?? '';
      items.push({ kind: 'date', label, key: `date-${msg.date ?? msg.id}` });
      currentDate = msg.date;
    }

    if (msg.type === 'system') {
      flushGroup();
      items.push({ kind: 'system', message: msg, key: msg.id });
    } else {
      if (msg.senderId !== currentSenderId) {
        flushGroup();
        currentGroup = [msg];
        currentSenderId = msg.senderId;
      } else {
        currentGroup!.push(msg);
      }
    }
  }

  flushGroup();
  return items;
}

// ── Date separator ────────────────────────────────────────────────────────────

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 my-3 px-1">
    <div className="flex-1 h-px bg-white/[0.06]" />
    <span className="text-[10px] font-mono text-neutral-700 px-2.5 py-1 rounded-full border border-white/[0.06] uppercase tracking-widest select-none">
      {label}
    </span>
    <div className="flex-1 h-px bg-white/[0.06]" />
  </div>
);

// ── System message item ───────────────────────────────────────────────────────

interface SystemConfig {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  bg: string;
}

const SYSTEM_CONFIG: Record<SystemEventType, SystemConfig> = {
  version_saved: { icon: GitBranch, color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' },
  member_joined: { icon: UserPlus, color: '#10b981', bg: 'rgba(16,185,129,0.14)' },
  asset_uploaded: { icon: Paperclip, color: '#06b6d4', bg: 'rgba(6,182,212,0.14)' },
  task_completed: { icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  milestone: { icon: Flag, color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
};

const SystemMessageItem: React.FC<{ message: SystemChatMessage }> = ({ message }) => {
  const config = SYSTEM_CONFIG[message.systemType];
  const Icon = config.icon;
  const author = message.authorId ? MEMBERS.find(m => m.id === message.authorId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2.5 mx-1 px-3 py-2 rounded-xl border"
      style={{
        background: 'rgba(255,255,255,0.025)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Icon */}
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: config.bg }}
      >
        <Icon size={12} style={{ color: config.color }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-neutral-500 leading-relaxed truncate">
          {author && (
            <span className="text-neutral-400 font-medium mr-1">{author.name}</span>
          )}
          {message.description}
          {message.target && (
            <span
              className="ml-1.5 text-[11px] font-mono px-1.5 py-px rounded"
              style={{ background: `${config.color}18`, color: config.color }}
            >
              {message.target}
            </span>
          )}
        </p>
      </div>

      {/* Time */}
      <span className="text-[10px] text-neutral-700 font-mono tabular-nums shrink-0">
        {message.time}
      </span>
    </motion.div>
  );
};

// ── MessageList ───────────────────────────────────────────────────────────────

export interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  onReaction: (messageId: string, emoji: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  onReaction,
  scrollRef,
}) => {
  const items = buildRenderItems(messages);

  return (
    <div className="flex flex-col px-3 py-4 gap-3">
      {items.map(item => {
        if (item.kind === 'date') {
          return <DateSeparator key={item.key} label={item.label} />;
        }
        if (item.kind === 'system') {
          return <SystemMessageItem key={item.key} message={item.message} />;
        }
        return (
          <MessageItem
            key={item.key}
            senderId={item.senderId}
            messages={item.messages}
            currentUserId={currentUserId}
            onReaction={onReaction}
          />
        );
      })}

      {/* Scroll anchor */}
      <div ref={scrollRef} />
    </div>
  );
};
