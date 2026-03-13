// assistant/ScriptAssistantPanel.tsx
// Script 页面 AI Co-Writer 侧边栏组件（已接入真实 API）

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Sparkles,
  Globe,
  Crosshair,
  RotateCcw,
  ChevronDown,
  AlertCircle,
} from "lucide-react";

import type { AssistantMessage, AssistantPanelMode } from "./types";
import { GLOBAL_SUGGESTIONS, SHOT_SUGGESTIONS }      from "./mockData";
import type { ScriptProject }                         from "./actions/buildScriptAssistantContext";
import type { Shot }                                  from "./actions/applyScriptAssistantActions";
import ScriptAssistantActionPreview                   from "./ScriptAssistantActionPreview";
import { useScriptAssistant }                         from "./hooks/useScriptAssistant";
import UndoButton                                     from "./components/UndoButton";

// ─────────────────────────────────────────────────────────────
// Sub-component: TypingIndicator
// ─────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
        <Sparkles size={11} className="text-cyan-400" />
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400/60"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
          />
        ))}
        <span className="text-xs text-neutral-500 ml-1">AI 正在思考...</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: EmptyState
// ─────────────────────────────────────────────────────────────

function EmptyState({ onSuggest }: { onSuggest: (t: string) => void }) {
  const starters = ["帮我优化全局旁白", "调整节奏让视频更紧凑", "增加一个情感收尾镜头"];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10 border border-cyan-500/20 flex items-center justify-center">
        <Sparkles size={22} className="text-cyan-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-neutral-300">AI 助手已就绪</p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          选中某个 shot 进行精准修改，<br />或直接发起全局对话
        </p>
      </div>
      <div className="w-full space-y-1.5">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="w-full text-left text-xs px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-cyan-500/10 border border-white/[0.06] hover:border-cyan-500/25 text-neutral-400 hover:text-cyan-300 transition-all duration-200"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: SuggestionChips
// ─────────────────────────────────────────────────────────────

function SuggestionChips({
  suggestions, disabled, onSelect,
}: { suggestions: string[]; disabled?: boolean; onSelect: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-cyan-500/10 border border-white/[0.08] hover:border-cyan-500/30 text-neutral-400 hover:text-cyan-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: MessageBubble
// ─────────────────────────────────────────────────────────────

function MessageBubble({
  message, onSuggest, disabled,
}: { message: AssistantMessage; onSuggest: (t: string) => void; disabled?: boolean }) {
  const isAssistant = message.role === "assistant";
  const isError     = message.status === "error";

  const renderContent = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-semibold text-neutral-100">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );

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
              : "bg-cyan-500/20 border border-cyan-500/30"
          }`}>
            {isError
              ? <AlertCircle size={11} className="text-red-400" />
              : <Sparkles   size={11} className="text-cyan-400" />}
          </div>
        )}
        <div className={`px-3 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
          isError
            ? "bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm"
            : isAssistant
            ? "bg-white/[0.05] border border-white/[0.07] text-neutral-300 rounded-tl-sm"
            : "bg-cyan-500/15 border border-cyan-500/25 text-cyan-100 rounded-tr-sm"
        }`}>
          {renderContent(message.content)}
        </div>
      </div>

      {isAssistant && !isError && message.suggestions && message.suggestions.length > 0 && (
        <div className="pl-8">
          <SuggestionChips suggestions={message.suggestions} disabled={disabled} onSelect={onSuggest} />
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: ModeToggle
// ─────────────────────────────────────────────────────────────

function ModeToggle({
  mode, selectedShotId, onClearShot,
}: { mode: AssistantPanelMode; selectedShotId: string | null; onClearShot: () => void }) {
  return (
    <AnimatePresence mode="wait">
      {mode === "shot" && selectedShotId ? (
        <motion.div key="shot" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5 text-[11px]">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-cyan-400">修改 Shot {selectedShotId}</span>
          <button onClick={onClearShot} className="ml-1 text-neutral-500 hover:text-neutral-300 transition-colors">✕</button>
        </motion.div>
      ) : (
        <motion.div key="global" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <Globe size={11} /><span>全局模式</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// Main: ScriptAssistantPanel
// ─────────────────────────────────────────────────────────────

export interface ScriptAssistantPanelProps {
  project:              ScriptProject;
  selectedShotId?:      string | null;
  onClearSelectedShot?: () => void;
  onShotsChange:        (shots: Shot[]) => void;
  lastActionSummary?:   string;
  className?:           string;
}

export default function ScriptAssistantPanel({
  project,
  selectedShotId      = null,
  onClearSelectedShot,
  onShotsChange,
  lastActionSummary,
  className = "",
}: ScriptAssistantPanelProps) {

  // ── Hook：核心状态机 ────────────────────────────────────────
  const {
    messages,
    clearMessages,
    inputDraft,
    setInputDraft,
    actionStatus,
    errorMessage,
    retryLastMessage,
    pendingPreview,
    confirmActions,
    cancelActions,
    canUndo,
    undoTop,
    undoStack,
    undo,
    sendMessage,
  } = useScriptAssistant({
    project,
    selectedShotId,
    onShotsChange,
    lastActionSummary,
  });

  // ── 局部 UI 状态 ────────────────────────────────────────────
  const [mode,          setMode]          = useState<AssistantPanelMode>("global");
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = actionStatus === "thinking" || actionStatus === "applying";

  // sync mode
  useEffect(() => { setMode(selectedShotId ? "shot" : "global"); }, [selectedShotId]);

  // auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, actionStatus]);

  // scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

  const handleSuggest = useCallback((text: string) => {
    setInputDraft(text);
    inputRef.current?.focus();
  }, [setInputDraft]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const activeSuggestions = selectedShotId ? SHOT_SUGGESTIONS : GLOBAL_SUGGESTIONS;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-full bg-[#0d0f14] border-l border-white/[0.06] ${className}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/25 to-violet-500/15 border border-cyan-500/20 flex items-center justify-center">
            <Sparkles size={13} className="text-cyan-400" />
          </div>
          <span className="text-[11px] font-semibold tracking-[0.15em] text-neutral-300 uppercase">
            AI Co-Writer
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode badge */}
          <button
            onClick={() => setMode((m) => m === "global" ? "shot" : "global")}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all ${
              mode === "global"
                ? "bg-white/[0.04] border-white/[0.08] text-neutral-500 hover:text-neutral-300"
                : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
            }`}
          >
            {mode === "global" ? <Globe size={9} /> : <Crosshair size={9} />}
            {mode === "global" ? "GLOBAL" : "SHOT"}
          </button>

          {/* Undo */}
          <UndoButton
            canUndo={canUndo}
            undoTop={undoTop}
            undoStack={undoStack}
            onUndo={undo}
          />

          {/* Clear */}
          {messages.length > 0 && (
            <button onClick={clearMessages} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="清空对话">
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Mode indicator ── */}
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0 min-h-[32px] flex items-center">
        <ModeToggle mode={mode} selectedShotId={selectedShotId} onClearShot={() => onClearSelectedShot?.()} />
      </div>

      {/* ── Suggestion chips ── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-white/[0.04] shrink-0">
        <SuggestionChips suggestions={activeSuggestions} disabled={isLoading} onSelect={handleSuggest} />
      </div>

      {/* ── Message list ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0
          [&::-webkit-scrollbar]:w-[3px]
          [&::-webkit-scrollbar-thumb]:bg-white/10
          [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {messages.length === 0 && actionStatus === "idle" ? (
          <EmptyState onSuggest={handleSuggest} />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSuggest={handleSuggest}
                disabled={isLoading}
              />
            ))}
          </AnimatePresence>
        )}

        {/* AI 思考中 */}
        {actionStatus === "thinking" && <TypingIndicator />}

        {/* Action Preview（等待确认）*/}
        <AnimatePresence>
          {pendingPreview && actionStatus === "awaiting-confirm" && (
            <motion.div
              key={pendingPreview.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <ScriptAssistantActionPreview
                intent={pendingPreview.intent}
                actions={pendingPreview.actions}
                warnings={pendingPreview.warnings}
                isApplying={actionStatus === "applying" as unknown as boolean}
                onConfirm={confirmActions}
                onCancel={cancelActions}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* applying 状态 */}
        {actionStatus === "applying" && (
          <div className="flex items-center gap-2 text-xs text-cyan-400/80 px-1">
            <Loader2 size={13} className="animate-spin" />
            正在应用修改...
          </div>
        )}

        {/* 错误 + 重试 */}
        {actionStatus === "error" && errorMessage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/15">
            <div className="flex items-center gap-1.5 text-xs text-red-400/80">
              <AlertCircle size={12} />
              {errorMessage}
            </div>
            <button onClick={retryLastMessage} className="text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2 shrink-0">
              重试
            </button>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Scroll-to-bottom button ── */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="absolute bottom-20 right-5 w-7 h-7 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white shadow-lg transition-colors"
          >
            <ChevronDown size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Input area ── */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 space-y-2.5">
        <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 focus-within:border-cyan-500/40 focus-within:bg-cyan-500/[0.03] transition-all duration-200">
          <textarea
            ref={inputRef}
            value={inputDraft}
            onChange={(e) => setInputDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || actionStatus === "awaiting-confirm"}
            placeholder={
              isLoading                          ? "AI 正在处理..."
              : actionStatus === "awaiting-confirm" ? "请先确认或取消上方建议"
              : selectedShotId                   ? `修改 Shot ${selectedShotId}...`
              : "告诉 AI 你想怎么改..."
            }
            rows={1}
            className="flex-1 bg-transparent text-xs text-neutral-300 placeholder:text-neutral-600 resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputDraft.trim() || isLoading || actionStatus === "awaiting-confirm"}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-0.5 transition-all duration-150
              disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
              bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 hover:border-cyan-500/50
              text-cyan-400 hover:text-cyan-300"
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        <p className="text-[10px] text-neutral-700 text-center">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
