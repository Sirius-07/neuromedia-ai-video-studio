// assistant/hooks/useScriptAssistant.ts
// Script 页面 AI 助手的核心状态机
//
// 状态流转：
//   idle ──[sendMessage]──► thinking
//   thinking ──[API 成功]──► awaiting-confirm  （有 actions）
//   thinking ──[API 成功]──► idle              （无 actions）
//   thinking ──[API 失败]──► error
//   awaiting-confirm ──[confirm]──► applying
//   applying ──[完成]──► idle
//   awaiting-confirm ──[cancel]──► idle
//   error ──[retry/新消息]──► thinking
//
// 撤销设计：
//   - undoStack 最多保留 MAX_UNDO 条记录（先进先出）
//   - 每条记录存储操作前的完整 shots 快照（空间换时间，shots 通常 <20 条）
//   - undo() 不在 setState 回调里触发副作用（修复 React 反模式）

import { useState, useCallback, useRef, useEffect } from "react";

import type { ScriptProject, ScriptUIState } from "../actions/buildScriptAssistantContext";
import { buildScriptAssistantContext }         from "../actions/buildScriptAssistantContext";
import type { Shot }                            from "../actions/applyScriptAssistantActions";
import { applyScriptAssistantActions }          from "../actions/applyScriptAssistantActions";
import type { AssistantAction }                 from "../parsers/parseScriptAssistantResponse";
import { callAssistantChat, AssistantApiError } from "../api/callAssistantChat";
import type { AssistantMessage, ActionStatus }  from "../types";

// ─────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────

/** 待用户确认的 action 预览快照 */
export interface PendingPreview {
  id:             string;
  intent:         string;
  actions:        AssistantAction[];
  warnings?:      string[];
  /** 执行前的 shots 快照，用于撤销 */
  snapshotBefore: Shot[];
}

/** 撤销记录 */
export interface UndoRecord {
  /** 唯一 id */
  id:             string;
  /** 操作意图描述，显示在撤销按钮 tooltip 中 */
  label:          string;
  /** 执行前的 shots 完整快照 */
  snapshotBefore: Shot[];
  /** 操作发生时间 */
  appliedAt:      string;
  /** 涉及的 action 数量，供 UI 展示 */
  actionCount:    number;
}

// ─────────────────────────────────────────────────────────────
// Hook 入参 / 返参
// ─────────────────────────────────────────────────────────────

export interface UseScriptAssistantOptions {
  project:          ScriptProject;
  selectedShotId:   string | null;
  selectedShotIds?: string[];
  /** project.shots 变更时的回调，由父组件更新 state */
  onShotsChange:    (shots: Shot[]) => void;
  /** 可选：最近一次操作摘要，注入 context 供 AI 感知 */
  lastActionSummary?: string;
}

export interface UseScriptAssistantReturn {
  // ── 消息列表 ──────────────────────────────────────────────
  messages:       AssistantMessage[];
  clearMessages:  () => void;

  // ── 输入框 ────────────────────────────────────────────────
  inputDraft:     string;
  setInputDraft:  (v: string) => void;

  // ── 状态机 ────────────────────────────────────────────────
  actionStatus:   ActionStatus;
  errorMessage:   string | null;
  retryLastMessage: () => void;

  // ── Action 预览（等待确认）────────────────────────────────
  pendingPreview: PendingPreview | null;
  confirmActions: () => void;
  cancelActions:  () => void;

  // ── 撤销 ──────────────────────────────────────────────────
  canUndo:        boolean;
  /** 撤销栈顶记录（用于 UI 展示 tooltip），无可撤销内容时为 null */
  undoTop:        UndoRecord | null;
  /** 完整撤销历史（最多 MAX_UNDO 条，最新在前） */
  undoStack:      UndoRecord[];
  undo:           () => void;

  // ── 发送 ──────────────────────────────────────────────────
  sendMessage:    (text?: string) => void;
}

// ─────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────

const MAX_UNDO = 10;

function makeId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeUserMessage(content: string): AssistantMessage {
  return { id: makeId(), role: "user", content, timestamp: new Date().toISOString(), status: "done" };
}

function makeAssistantMessage(
  content: string,
  suggestions?: string[]
): AssistantMessage {
  return {
    id: makeId(), role: "assistant", content,
    timestamp: new Date().toISOString(), status: "done",
    ...(suggestions?.length ? { suggestions } : {}),
  };
}

function makeErrorMessage(content: string): AssistantMessage {
  return { id: makeId(), role: "assistant", content, timestamp: new Date().toISOString(), status: "error" };
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useScriptAssistant({
  project,
  selectedShotId,
  selectedShotIds = [],
  onShotsChange,
  lastActionSummary,
}: UseScriptAssistantOptions): UseScriptAssistantReturn {

  const [messages,       setMessages]       = useState<AssistantMessage[]>([]);
  const [inputDraft,     setInputDraft]      = useState("");
  const [actionStatus,   setActionStatus]    = useState<ActionStatus>("idle");
  const [errorMessage,   setErrorMessage]    = useState<string | null>(null);
  const [pendingPreview, setPendingPreview]  = useState<PendingPreview | null>(null);
  const [undoStack,      setUndoStack]       = useState<UndoRecord[]>([]);

  // 保存最后一条用户消息，用于 retry
  const lastUserTextRef = useRef<string>("");

  // ── appendMessage ─────────────────────────────────────────

  const appendMessage = useCallback((msg: AssistantMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingPreview(null);
    setActionStatus("idle");
    setErrorMessage(null);
  }, []);

  // ── 构建 context ──────────────────────────────────────────

  const buildContext = useCallback(() => {
    const uiState: ScriptUIState = {
      selectedShotId,
      selectedShotIds,
      ...(lastActionSummary ? { lastActionSummary } : {}),
    };
    return buildScriptAssistantContext(project, uiState);
  }, [project, selectedShotId, selectedShotIds, lastActionSummary]);

  // ── sendMessage ───────────────────────────────────────────

  const doSend = useCallback(async (text: string) => {
    if (!text.trim() || actionStatus === "thinking" || actionStatus === "applying") return;

    lastUserTextRef.current = text;

    appendMessage(makeUserMessage(text));
    setInputDraft("");
    setErrorMessage(null);
    setPendingPreview(null);
    setActionStatus("thinking");

    try {
      const context = buildContext();
      const { response } = await callAssistantChat(text, context);

      if (response.actions.length > 0) {
        const preview: PendingPreview = {
          id:             makeId(),
          intent:         response.intent,
          actions:        response.actions,
          warnings:       response.warnings,
          snapshotBefore: [...project.shots],
        };
        setPendingPreview(preview);
        setActionStatus("awaiting-confirm");
      } else {
        setActionStatus("idle");
      }

      appendMessage(makeAssistantMessage(response.reply, response.suggestions));

    } catch (err) {
      setActionStatus("error");
      const msg = err instanceof AssistantApiError
        ? err.message
        : "AI 服务暂时不可用，请稍后重试。";
      setErrorMessage(msg);
      appendMessage(makeErrorMessage(msg));
    }
  }, [actionStatus, appendMessage, buildContext, project.shots]);

  const sendMessage = useCallback((text?: string) => {
    const content = text ?? inputDraft;
    if (content.trim()) doSend(content);
  }, [inputDraft, doSend]);

  const retryLastMessage = useCallback(() => {
    if (lastUserTextRef.current) doSend(lastUserTextRef.current);
  }, [doSend]);

  // ── confirmActions ────────────────────────────────────────

  const confirmActions = useCallback(() => {
    if (!pendingPreview) return;

    setActionStatus("applying");

    const { nextProject, warnings } = applyScriptAssistantActions(
      project,
      pendingPreview.actions
    );

    // 先更新 shots
    onShotsChange(nextProject.shots);

    // 推入撤销栈（不在 setState 回调内触发其他副作用）
    const record: UndoRecord = {
      id:             makeId(),
      label:          pendingPreview.intent,
      snapshotBefore: pendingPreview.snapshotBefore,
      appliedAt:      new Date().toISOString(),
      actionCount:    pendingPreview.actions.length,
    };
    setUndoStack((prev) => [record, ...prev.slice(0, MAX_UNDO - 1)]);

    if (warnings.length > 0) {
      appendMessage(
        makeAssistantMessage(`操作已应用，注意事项：\n${warnings.join("\n")}`)
      );
    }

    setPendingPreview(null);
    setActionStatus("idle");
  }, [pendingPreview, project, onShotsChange, appendMessage]);

  // ── cancelActions ─────────────────────────────────────────

  const cancelActions = useCallback(() => {
    setPendingPreview(null);
    setActionStatus("idle");
  }, []);

  // ── undo ──────────────────────────────────────────────────
  // 关键设计：把副作用（onShotsChange / appendMessage）放在 useCallback 里，
  // 而非 setUndoStack 的函数式更新回调内，避免 React 严格模式下双调用问题。

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;

      const [latest, ...rest] = prev;

      // ⚠️ 副作用延迟到 microtask，确保 setState 已经提交
      Promise.resolve().then(() => {
        onShotsChange(latest.snapshotBefore);
        appendMessage(
          makeAssistantMessage(
            `已撤销「${latest.label}」（${latest.actionCount} 项操作，应用于 ${
              new Date(latest.appliedAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit", minute: "2-digit",
              })
            }）`
          )
        );
      });

      return rest;
    });
  }, [onShotsChange, appendMessage]);

  // ── 键盘快捷键：Cmd/Ctrl + Z ──────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "z" && !e.shiftKey) {
        // 只在输入框未聚焦时响应，避免与 textarea 原生撤销冲突
        const active = document.activeElement;
        const isEditing =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement;
        if (!isEditing && undoStack.length > 0) {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, undoStack.length]);

  // ── return ────────────────────────────────────────────────

  return {
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
    canUndo:   undoStack.length > 0,
    undoTop:   undoStack[0] ?? null,
    undoStack,
    undo,
    sendMessage,
  };
}
