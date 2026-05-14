// storyboard/assistant/StoryboardDirectorPanel.tsx
// Storyboard AI 分镜助手右侧面板完整 UI
// 风格与 ScriptAssistantPanel 保持一致，适配分镜板专属逻辑

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Sparkles,
  Film,
  Crosshair,
  Globe,
  RotateCcw,
  ChevronDown,
  AlertCircle,
  Image as ImageIcon,
  Video,
  Gauge,
  Target,
  WandSparkles,
  MessagesSquare,
} from "lucide-react";

import type { Scene }               from "../types";
import type { StoryboardMode, DirectorMessage } from "./types";
import { useStoryboardAssistant }    from "./useStoryboardAssistant";
import StoryboardActionPreview       from "./StoryboardActionPreview";
import {
  deriveStoryboardAgentState,
  type StoryboardAgentInsight,
  type StoryboardAgentMetric,
}                                    from "./agentIntelligence";

// ─────────────────────────────────────────────────────────────
// 快捷建议内容（按模式 × 是否选中 shot 分类）
// ─────────────────────────────────────────────────────────────

const SUGGESTIONS = {
  image: {
    global: [
      "帮我统一所有分镜的画面风格",
      "优化画面提示词使图像更具电影感",
      "为空白分镜补全视觉描述",
    ],
    shot: [
      "优化这个分镜的画面提示词",
      "调整景别和视角设置",
      "修改设备和焦距参数",
    ],
  },
  video: {
    global: [
      "为所有分镜设计流畅的镜头运动",
      "统一视频时长让节奏更紧凑",
      "优化全局运动提示词",
    ],
    shot: [
      "为这个分镜设置合适的镜头运动",
      "调整视频时长",
      "优化这个分镜的运动描述",
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Sub-component：TypingIndicator
// ─────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
        <Film size={11} className="text-violet-400" />
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-violet-400/60"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
          />
        ))}
        <span className="text-xs text-neutral-500 ml-1">助手正在思考...</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component：EmptyState
// ─────────────────────────────────────────────────────────────

function EmptyState({
  insight,
  onSuggest,
}: {
  insight:         StoryboardAgentInsight;
  onSuggest:       (text: string) => void;
}) {
  const starters = insight.quickPrompts.slice(0, 3);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/20 flex items-center justify-center">
        <Film size={22} className="text-violet-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-neutral-300">{insight.emptyTitle}</p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          {insight.emptyDescription}
        </p>
      </div>
      <div className="w-full space-y-1.5">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="w-full text-left text-xs px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-violet-500/10 border border-white/[0.06] hover:border-violet-500/25 text-neutral-400 hover:text-violet-300 transition-all duration-200"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component：SuggestionChips
// ─────────────────────────────────────────────────────────────

function SuggestionChips({
  suggestions,
  disabled,
  onSelect,
  variant = "soft",
}: {
  suggestions: string[];
  disabled?:   boolean;
  onSelect:    (text: string) => void;
  variant?:     "soft" | "choice";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
            variant === "choice"
              ? "bg-cyan-500/10 hover:bg-cyan-500/[0.18] border-cyan-500/25 hover:border-cyan-500/[0.45] text-cyan-200 hover:text-cyan-100"
              : "bg-white/[0.04] hover:bg-violet-500/10 border-white/[0.08] hover:border-violet-500/30 text-neutral-400 hover:text-violet-300"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function AgentMetricPill({ metric }: { metric: StoryboardAgentMetric }) {
  const toneClass =
    metric.tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
      : metric.tone === "warn"
        ? "border-amber-500/20 bg-amber-500/[0.08] text-amber-300"
        : "border-white/[0.08] bg-white/[0.04] text-neutral-400";

  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${toneClass}`}>
      <span className="text-[10px]">{metric.label}</span>
      <span className="font-mono text-[10px] font-semibold">{metric.value}</span>
    </div>
  );
}

function AgentContextBrief({
  insight,
  disabled,
  onSuggest,
}: {
  insight: StoryboardAgentInsight;
  disabled?: boolean;
  onSuggest: (text: string) => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-white/[0.04] shrink-0 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            <Target size={11} />
            <span>{insight.focusLabel}</span>
            <span className="text-neutral-700">/</span>
            <span>{insight.modeLabel}</span>
          </div>
          <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-400">
            {insight.primaryNeed}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          <Gauge size={15} />
          <span className="ml-0.5 text-[10px] font-semibold">{insight.completionPercent}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {insight.metrics.map((metric) => (
          <AgentMetricPill key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSuggest(insight.recommendedPrompt)}
          className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1.5 text-[11px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <WandSparkles size={12} />
          推荐下一步
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSuggest(insight.optionPrompt)}
          className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[11px] font-medium text-neutral-400 transition-colors hover:border-violet-500/25 hover:bg-violet-500/10 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MessagesSquare size={12} />
          先给选项
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component：MessageBubble（适配 DirectorMessage 类型）
// ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onChoice,
  disabled,
}: {
  message:   DirectorMessage;
  onChoice:  (text: string) => void;
  disabled?: boolean;
}) {
  const isAssistant = message.role === "assistant";
  const isSystem    = message.role === "system";
  const isError     = message.status === "error";

  /** 支持 **粗体** 渲染 */
  const renderContent = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-semibold text-neutral-100">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );

  // 系统消息（居中小字）
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-[10px] text-neutral-600 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col gap-2 ${isAssistant ? "items-start" : "items-end"}`}
    >
      <div className={`flex items-start gap-2 max-w-[92%] ${isAssistant ? "" : "flex-row-reverse"}`}>
        {isAssistant && (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isError
              ? "bg-red-500/20 border border-red-500/30"
              : "bg-violet-500/20 border border-violet-500/30"
          }`}>
            {isError
              ? <AlertCircle size={11} className="text-red-400" />
              : <Film       size={11} className="text-violet-400" />}
          </div>
        )}

        <div className={`px-3 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
          isError
            ? "bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm"
            : isAssistant
            ? "bg-white/[0.05] border border-white/[0.07] text-neutral-300 rounded-tl-sm"
            : "bg-violet-500/15 border border-violet-500/25 text-violet-100 rounded-tr-sm"
        }`}>
          {renderContent(message.content)}
        </div>
      </div>

      {/* AI 建议跟进操作 */}
      {isAssistant && !isError && message.suggestions && message.suggestions.length > 0 && (
        <div className="pl-8">
          <SuggestionChips
            suggestions={message.suggestions}
            disabled={disabled}
            onSelect={onChoice}
            variant="choice"
          />
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component：ShotIndicator（选中 shot 状态条）
// ─────────────────────────────────────────────────────────────

function ShotIndicator({
  scenes,
  selectedShotId,
}: {
  scenes:         Scene[];
  selectedShotId: number | null;
}) {
  if (!selectedShotId) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
        <Globe size={11} />
        <span>全局模式</span>
      </div>
    );
  }

  const idx = scenes.findIndex((s) => s.id === selectedShotId);
  const label = idx === -1 ? `分镜 ${selectedShotId}` : `分镜 ${idx + 1}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selectedShotId}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-1.5 text-[11px]"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <Crosshair size={10} className="text-violet-400" />
        <span className="text-violet-400">{label} 已选中</span>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

export interface StoryboardDirectorPanelProps {
  scenes:           Scene[];
  mode:             StoryboardMode;
  selectedShotId:   number | null;
  projectTitle:     string;
  onScenesChange:   (newScenes: Scene[]) => void;
  onRegenerateShot: (shotId: number) => void;
  onRegenerateAll:  () => void;
  /** 注入 AI context，供感知最近操作（可选） */
  lastActionSummary?: string;
  /** 项目 ID（用于后端日志追踪，可选） */
  projectId?:         string;
  className?:         string;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function StoryboardDirectorPanel({
  scenes,
  mode,
  selectedShotId,
  projectTitle,
  onScenesChange,
  onRegenerateShot,
  onRegenerateAll,
  lastActionSummary,
  projectId,
  className = "",
}: StoryboardDirectorPanelProps) {

  // ── Hook：核心状态机 ──────────────────────────────────────
  const {
    messages,
    actionStatus,
    errorMessage,
    pendingResponse,
    inputDraft,
    setInputDraft,
    sendMessage,
    confirmActions,
    rejectActions,
    reset,
  } = useStoryboardAssistant({
    scenes,
    mode,
    selectedShotId,
    projectTitle,
    onScenesChange,
    onRegenerateShot,
    onRegenerateAll,
    projectId,
    lastActionSummary,
  });

  // ── 局部 UI 状态 ──────────────────────────────────────────
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading     = actionStatus === "thinking" || actionStatus === "applying";
  const isAwaitingConfirm = actionStatus === "awaiting-confirm";
  const hasSelectedShot   = selectedShotId !== null;
  const isChoiceDisabled   = isLoading || isAwaitingConfirm;

  const agentInsight = useMemo(
    () => deriveStoryboardAgentState(scenes, mode, selectedShotId),
    [scenes, mode, selectedShotId]
  );

  // 当前活跃建议列表
  const activeSuggestions = hasSelectedShot
    ? agentInsight.quickPrompts
    : agentInsight.quickPrompts.length > 0
      ? agentInsight.quickPrompts
      : SUGGESTIONS[mode].global;

  // ── 自动滚动至底部 ────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, actionStatus]);

  // ── 滚动到底部按钮显隐 ───────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

  // ── 快捷建议：填入输入框并聚焦，允许用户编辑后再发送 ────
  const handleSuggest = useCallback(
    (text: string) => {
      setInputDraft(text);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [setInputDraft]
  );

  const handleChoice = useCallback(
    (text: string) => {
      if (isChoiceDisabled) return;
      sendMessage(text);
    },
    [isChoiceDisabled, sendMessage]
  );

  // ── 发送逻辑 ─────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputDraft.trim();
    if (!text || isLoading || isAwaitingConfirm) return;
    sendMessage(text);
  }, [inputDraft, isLoading, isAwaitingConfirm, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── 输入框自动撑高 ───────────────────────────────────────
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={`relative flex flex-col h-full bg-[#0d0f14] border-l border-white/[0.06] ${className}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 border border-violet-500/20 flex items-center justify-center">
            <Film size={13} className="text-violet-400" />
          </div>
          <span className="text-[11px] font-semibold tracking-[0.15em] text-neutral-300 uppercase">
            AI 分镜助手
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 模式徽章（image / video） */}
          <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
            mode === "image"
              ? "bg-sky-500/10 border-sky-500/20 text-sky-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
          }`}>
            {mode === "image"
              ? <><ImageIcon size={9} /><span className="ml-0.5">图片</span></>
              : <><Video     size={9} /><span className="ml-0.5">视频</span></>
            }
          </div>

          {/* 清空对话 */}
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="text-neutral-600 hover:text-neutral-400 transition-colors"
              title="清空对话"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Shot / Global 指示条 ── */}
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 min-h-[32px] flex items-center">
        <ShotIndicator scenes={scenes} selectedShotId={selectedShotId} />
      </div>

      <AgentContextBrief
        insight={agentInsight}
        disabled={isChoiceDisabled}
        onSuggest={handleSuggest}
      />

      {/* ── 快捷建议 chips ── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-white/[0.04] shrink-0">
        <SuggestionChips
          suggestions={activeSuggestions.slice(0, 4)}
          disabled={isChoiceDisabled}
          onSelect={handleSuggest}
        />
      </div>

      {/* ── 消息列表 ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0
          [&::-webkit-scrollbar]:w-[3px]
          [&::-webkit-scrollbar-thumb]:bg-white/10
          [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {/* 空状态 */}
        {messages.length === 0 && actionStatus === "idle" ? (
          <EmptyState
            insight={agentInsight}
            onSuggest={handleSuggest}
          />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onChoice={handleChoice}
                disabled={isChoiceDisabled}
              />
            ))}
          </AnimatePresence>
        )}

        {/* AI 思考中 */}
        {actionStatus === "thinking" && <TypingIndicator />}

        {/* Action Preview（等待确认）*/}
        <AnimatePresence>
          {pendingResponse && isAwaitingConfirm && (
            <motion.div
              key={pendingResponse.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <StoryboardActionPreview
                scenes={scenes}
                actions={pendingResponse.actions}
                intent={pendingResponse.intent}
                warnings={pendingResponse.warnings}
                onConfirm={confirmActions}
                onCancel={rejectActions}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 应用中状态 */}
        {actionStatus === "applying" && (
          <div className="flex items-center gap-2 text-xs text-violet-400/80 px-1">
            <Loader2 size={13} className="animate-spin" />
            正在应用修改...
          </div>
        )}

        {/* 错误 + 重试 */}
        {actionStatus === "error" && errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-500/[0.08] border border-red-500/15"
          >
            <div className="flex items-center gap-1.5 text-xs text-red-400/80">
              <AlertCircle size={12} />
              {errorMessage}
            </div>
            <button
              onClick={() => {
                // 重新发送上一条输入（inputDraft 已被 hook 清空，通过 ErrorMsg 触发 reset）
                // 用户可直接再次发送，此处提示重置错误态
                reset();
              }}
              className="text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2 shrink-0"
            >
              重置
            </button>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── 滚动到底部按钮 ── */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="absolute bottom-20 right-5 w-7 h-7 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white shadow-lg transition-colors"
          >
            <ChevronDown size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── 输入区 ── */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 space-y-2.5">
        {/* 等待确认时提示 */}
        <AnimatePresence>
          {isAwaitingConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80 px-1 pb-1">
                <Sparkles size={11} />
                请先确认或取消上方 AI 建议
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 focus-within:border-violet-500/40 focus-within:bg-violet-500/[0.03] transition-all duration-200">
          <textarea
            ref={inputRef}
            value={inputDraft}
            onChange={(e) => setInputDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={isLoading || isAwaitingConfirm}
            placeholder={
              isLoading
                ? "AI 正在处理..."
                : isAwaitingConfirm
                ? "请先确认或取消上方建议"
                : hasSelectedShot
                ? `描述选中分镜要怎么改...`
                : `告诉 AI 分镜助手你的想法...`
            }
            rows={1}
            className="flex-1 bg-transparent text-xs text-neutral-300 placeholder:text-neutral-600 resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!inputDraft.trim() || isLoading || isAwaitingConfirm}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-0.5 transition-all duration-150
              disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
              bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 hover:border-violet-500/50
              text-violet-400 hover:text-violet-300"
          >
            {isLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <Send    size={13} />
            }
          </button>
        </div>

        <p className="text-[10px] text-neutral-700 text-center">
          回车发送 · Shift+回车换行
        </p>
      </div>
    </div>
  );
}
