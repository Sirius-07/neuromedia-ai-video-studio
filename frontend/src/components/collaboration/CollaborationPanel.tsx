import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { PanelHeader } from './PanelHeader';
import { PanelTabs } from './PanelTabs';
import { DiscussionTab } from './DiscussionTab';
import { ActivityTab } from './ActivityTab';
import { TasksTab } from './TasksTab';
import { MessageInput } from './MessageInput';
import { MEMBERS, CHAT_MESSAGES, CURRENT_USER_ID, PROJECT_ACTIVITIES } from './mockData';
import type { TabId, ChatMessage, UserChatMessage, Reaction, ProjectActivity, SystemChatMessage, ProjectStage } from './types';

// ── Collaboration Context ─────────────────────────────────────────────────────
// Allows any page component to inject collaboration events without prop drilling.

interface CollaborationContextType {
  injectEvent: (activity: ProjectActivity, systemMsg: SystemChatMessage) => void;
  currentStage: ProjectStage | undefined;
}

export const CollaborationContext = createContext<CollaborationContextType>({
  injectEvent: () => {},
  currentStage: undefined,
});

export const useCollaboration = () => useContext(CollaborationContext);

// ── Props ─────────────────────────────────────────────────────────────────────

interface CollaborationPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  /** 当前工作阶段，用于活动流按阶段高亮/过滤 */
  currentStage?: ProjectStage;
  /** 点击动态中的"查看镜头"时触发，传入 shotId。父组件可在此处实现实际跳转逻辑。 */
  onFocusShot?: (shotId: string) => void;
}

/** 父组件通过 ref 调用的命令接口 */
export interface CollaborationPanelHandle {
  /** 向"动态"tab 首部和"讨论"tab 末尾同时注入一条系统事件 */
  injectEvent: (activity: ProjectActivity, systemMsg: SystemChatMessage) => void;
}

export const CollaborationPanel = forwardRef<CollaborationPanelHandle, CollaborationPanelProps>(
  ({ isOpen, onToggle, onFocusShot, currentStage }, ref) => {
  const [activeTab, setActiveTab] = useState<TabId>('discussion');
  const [messages, setMessages] = useState<ChatMessage[]>(CHAT_MESSAGES);
  const [activities, setActivities] = useState<ProjectActivity[]>(PROJECT_ACTIVITIES);
  const [latestActivityId, setLatestActivityId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 暴露给父组件的命令接口 */
  useImperativeHandle(ref, () => ({
    injectEvent: (activity: ProjectActivity, systemMsg: SystemChatMessage) => {
      setActivities(prev => [activity, ...prev]);
      setMessages(prev => [...prev, systemMsg]);
      // 标记最新条目，3 秒后清除高亮
      setLatestActivityId(activity.id);
      if (latestTimerRef.current) clearTimeout(latestTimerRef.current);
      latestTimerRef.current = setTimeout(() => setLatestActivityId(null), 3000);
    },
  }));

  useEffect(() => () => {
    if (latestTimerRef.current) clearTimeout(latestTimerRef.current);
  }, []);

  const onlineMembers = MEMBERS.filter(m => m.isOnline);

  // ── Send a new message ───────────────────────────────────────────────────────
  const handleSend = (content: string) => {
    const newMsg: UserChatMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      senderId: CURRENT_USER_ID,
      content,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      date: 'today',
    };
    setMessages(prev => [...prev, newMsg]);
  };

  // ── Toggle emoji reaction ────────────────────────────────────────────────────
  const handleReaction = (messageId: string, emoji: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id !== messageId || msg.type !== 'user') return msg;

        const reactions: Reaction[] = msg.reactions ? [...msg.reactions] : [];
        const idx = reactions.findIndex(r => r.emoji === emoji);

        if (idx === -1) {
          // New emoji — add with count 1 and mark as reacted
          reactions.push({ emoji, count: 1, reacted: true });
        } else {
          const r = reactions[idx];
          if (r.reacted) {
            // Un-react: decrement, remove if 0
            const updated = { ...r, count: r.count - 1, reacted: false };
            if (updated.count <= 0) {
              reactions.splice(idx, 1);
            } else {
              reactions[idx] = updated;
            }
          } else {
            // React: increment
            reactions[idx] = { ...r, count: r.count + 1, reacted: true };
          }
        }

        return { ...msg, reactions };
      })
    );
  };

  // ── Auto-scroll to bottom on new message ─────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'discussion' && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  return (
    <div
      className="shrink-0 h-full overflow-hidden relative transition-all duration-300 ease-in-out"
      style={{ width: isOpen ? '360px' : '40px' }}
    >
      {/* ── Collapsed strip ─────────────────────────────── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 w-10 flex flex-col items-center border-r border-white/[0.08] bg-[#0d0d12]"
          >
            <button
              onClick={onToggle}
              className="mt-3 w-8 h-8 flex items-center justify-center hover:bg-white/[0.08] rounded-lg text-neutral-600 hover:text-cyan-400 transition-colors"
              title="展开协作面板"
            >
              <ChevronRight size={14} />
            </button>

            <div className="mt-3 flex flex-col items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-neutral-600 font-mono tabular-nums">
                {onlineMembers.length}
              </span>
            </div>

            <div className="mt-3 flex flex-col items-center gap-2">
              {onlineMembers.map(m => (
                <div
                  key={m.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${m.color1}, ${m.color2})` }}
                  title={`${m.name} · ${m.roleLabel}`}
                />
              ))}
            </div>

            <div className="absolute bottom-16 select-none">
              <span
                className="text-[9px] font-mono tracking-[0.35em] text-neutral-700 uppercase"
                style={{ writingMode: 'vertical-rl' }}
              >
                协作
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full panel ──────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 w-[360px] flex flex-col border-r border-white/[0.08] bg-[#0d0d12]/95 backdrop-blur-xl"
          >
            {/* Top gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />

            <PanelHeader onClose={onToggle} />

            {/* Stage context indicator */}
            {currentStage && (
              <motion.div
                key={currentStage}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="mx-3 mb-1 mt-0.5 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/[0.08] border border-violet-500/20"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
                <span className="text-[10px] font-mono text-violet-400 tracking-wider">
                  当前阶段：{
                    { script: '剧本编写', style: '风格选择', storyboard: '分镜制作', editor: '后期剪辑' }[currentStage]
                  }
                </span>
              </motion.div>
            )}

            <PanelTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 collab-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="h-full"
                >
                  {activeTab === 'discussion' && (
                    <DiscussionTab
                      messages={messages}
                      currentUserId={CURRENT_USER_ID}
                      onReaction={handleReaction}
                      scrollRef={scrollRef}
                    />
                  )}
                  {activeTab === 'activity' && (
                    <ActivityTab
                      activities={activities}
                      latestActivityId={latestActivityId}
                      onFocusShot={onFocusShot}
                      currentStage={currentStage}
                    />
                  )}
                  {activeTab === 'tasks' && <TasksTab onFocusShot={onFocusShot} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Message input — only on discussion tab */}
            <AnimatePresence>
              {activeTab === 'discussion' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  <MessageInput onSend={handleSend} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

CollaborationPanel.displayName = 'CollaborationPanel';
