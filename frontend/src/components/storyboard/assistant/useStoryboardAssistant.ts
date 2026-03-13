// storyboard/assistant/useStoryboardAssistant.ts
// Storyboard AI Director 面板的核心状态 hook
//
// 状态流转：
//   idle ──[sendMessage]──► thinking
//   thinking ──[API 成功, 有 actions]──► awaiting-confirm
//   thinking ──[API 成功, 无 actions]──► idle
//   thinking ──[API 失败]──► error
//   awaiting-confirm ──[confirmActions]──► applying → idle
//   awaiting-confirm ──[rejectActions]──► idle
//   error ──[sendMessage]──► thinking（自动重试或新消息均可恢复）
//
// 闭包安全策略：
//   - scenes 写入 scenesRef，buildContext / confirmActions 通过 ref 读取最新值
//   - pendingState 写入 pendingStateRef，confirmActions 不依赖 useState 快照
//   - 以上两点避免了 async 回调中读到旧 state 的问题

import { useState, useCallback, useRef, useEffect } from "react";

import type { Scene }                from "../types";
import type {
  StoryboardMode,
  StoryboardAction,
  DirectorMessage,
  DirectorPanelActionStatus,
}                                    from "./types";
import { buildStoryboardContext }    from "./buildStoryboardContext";
import {
  callStoryboardAssistantChat,
  type StoryboardContext,
}                                    from "../../../api/storyboardAssistantApi";
import { AssistantApiError }         from "../../assistant/api/callAssistantChat";
import {
  applyStoryboardActions,
  extractRegenerateTargets,
}                                    from "./applyStoryboardActions";

// ─────────────────────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────────────────────

/** 等待用户确认的操作快照 */
export interface PendingDirectorState {
  /** 唯一 id，用于 key 绑定 */
  id:             string;
  /** AI 返回的意图标签，供 ActionPreview 标题展示 */
  intent:         string;
  /** 待执行的 action 列表 */
  actions:        StoryboardAction[];
  /** AI 返回的警告信息（可选） */
  warnings?:      string[];
  /** 执行前的 scenes 快照（预留给撤销功能）*/
  snapshotBefore: Scene[];
}

// ─────────────────────────────────────────────────────────────
// Hook 入参 / 返参
// ─────────────────────────────────────────────────────────────

export interface UseStoryboardAssistantOptions {
  scenes:               Scene[];
  mode:                 StoryboardMode;
  selectedShotId:       number | null;
  projectTitle:         string;
  /** 有新 scenes 时回传给父组件 */
  onScenesChange:       (newScenes: Scene[]) => void;
  /** 触发单个分镜重新生成（由父组件桥接现有生成逻辑） */
  onRegenerateShot?:    (shotId: number) => void;
  /** 触发全局分镜板重新生成 */
  onRegenerateAll?:     () => void;
  /** 项目 ID（注入 context，用于后端日志追踪） */
  projectId?:           string;
  /** 最近一次操作摘要（注入 context，供 AI 感知对话连续性） */
  lastActionSummary?:   string;
}

export interface UseStoryboardAssistantReturn {
  // ── 消息流 ──────────────────────────────────────────────────
  messages:        DirectorMessage[];

  // ── 状态机 ──────────────────────────────────────────────────
  actionStatus:    DirectorPanelActionStatus;
  errorMessage:    string | null;

  // ── 待确认操作 ───────────────────────────────────────────────
  /** 当前待确认的操作及快照；awaiting-confirm 阶段非 null */
  pendingResponse: PendingDirectorState | null;
  /** 快捷访问：待确认 action 列表（等同于 pendingResponse?.actions ?? []） */
  pendingActions:  StoryboardAction[];

  // ── 输入框 ───────────────────────────────────────────────────
  inputDraft:      string;
  setInputDraft:   (v: string) => void;

  // ── 暴露方法 ─────────────────────────────────────────────────
  sendMessage:     (text: string) => void;
  confirmActions:  () => void;
  rejectActions:   () => void;
  reset:           () => void;
}

// ─────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────

function makeId(): string {
  return `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeUserMsg(content: string): DirectorMessage {
  return { id: makeId(), role: "user",      content, timestamp: new Date().toISOString(), status: "done" };
}

function makeAssistantMsg(
  content: string,
  suggestions?: string[],
  meta?: DirectorMessage["meta"]
): DirectorMessage {
  return {
    id:          makeId(),
    role:        "assistant",
    content,
    timestamp:   new Date().toISOString(),
    status:      "done",
    ...(suggestions?.length ? { suggestions } : {}),
    ...(meta ? { meta } : {}),
  };
}

function makeErrorMsg(content: string): DirectorMessage {
  return { id: makeId(), role: "assistant", content, timestamp: new Date().toISOString(), status: "error" };
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useStoryboardAssistant({
  scenes,
  mode,
  selectedShotId,
  projectTitle,
  onScenesChange,
  onRegenerateShot,
  onRegenerateAll,
  projectId      = "",
  lastActionSummary,
}: UseStoryboardAssistantOptions): UseStoryboardAssistantReturn {

  const [messages,        setMessages]        = useState<DirectorMessage[]>([]);
  const [actionStatus,    setActionStatus]    = useState<DirectorPanelActionStatus>("idle");
  const [errorMessage,    setErrorMessage]    = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<PendingDirectorState | null>(null);
  const [inputDraft,      setInputDraft]      = useState("");

  // ── refs（避免异步回调读到过期值）────────────────────────────

  /** 始终指向最新的 scenes prop，供 buildContext / confirmActions 读取 */
  const scenesRef = useRef<Scene[]>(scenes);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);

  /** 始终指向最新的 pendingResponse state */
  const pendingRef = useRef<PendingDirectorState | null>(null);
  useEffect(() => { pendingRef.current = pendingResponse; }, [pendingResponse]);

  // ── appendMessage ─────────────────────────────────────────

  const appendMessage = useCallback((msg: DirectorMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // ── buildContext ──────────────────────────────────────────
  // 依赖除 scenes 外的所有字段；scenes 通过 ref 访问保证最新

  const buildContext = useCallback((): StoryboardContext => {
    return buildStoryboardContext(
      scenesRef.current,
      mode,
      selectedShotId,
      projectTitle,
      { projectId, lastActionSummary }
    );
  }, [mode, selectedShotId, projectTitle, projectId, lastActionSummary]);

  // ── sendMessage ───────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // 思考中/应用中不允许再发送
    if (actionStatus === "thinking" || actionStatus === "applying") return;

    appendMessage(makeUserMsg(trimmed));
    setInputDraft("");
    setErrorMessage(null);
    setPendingResponse(null);
    setActionStatus("thinking");

    try {
      const context = buildContext();
      const { parsed, parseOk } = await callStoryboardAssistantChat(trimmed, context);
      const response = parsed.response;

      // 将 assistant reply 加入消息流，附带 parseOk 元信息供调试
      appendMessage(
        makeAssistantMsg(response.reply, response.suggestions, {
          actionCount: response.actions.length,
          parseOk,
        })
      );

      // ask_user 类型不需要确认，过滤后只保留真正需要执行的 action
      const confirmableActions = response.actions.filter(
        (a) => a.type !== "ask_user"
      );

      if (confirmableActions.length > 0) {
        // MVP 保守策略：有可执行 actions 一律走确认流程，避免静默修改用户数据。
        const pending: PendingDirectorState = {
          id:             makeId(),
          intent:         response.intent,
          actions:        confirmableActions,
          warnings:       response.warnings,
          snapshotBefore: [...scenesRef.current],
        };
        setPendingResponse(pending);
        setActionStatus("awaiting-confirm");
      } else {
        // 无可执行 actions（纯 ask_user 或纯问答），直接回到 idle，让用户继续输入回复
        setActionStatus("idle");
      }

    } catch (err) {
      const msg =
        err instanceof AssistantApiError
          ? err.message
          : "AI 服务暂时不可用，请稍后重试。";
      setErrorMessage(msg);
      setActionStatus("error");
      appendMessage(makeErrorMsg(msg));
    }
  }, [actionStatus, appendMessage, buildContext]);

  // ── confirmActions ────────────────────────────────────────

  const confirmActions = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;

    setActionStatus("applying");

    // 应用 actions，读取最新 scenes（通过 ref，不依赖 state 快照）
    const { nextScenes, warnings, appliedActions } =
      applyStoryboardActions(scenesRef.current, pending.actions);

    // 回传给父组件
    onScenesChange(nextScenes);

    // 处理 regenerate 类 action：桥接现有生成逻辑
    const { globalRegenerate, shotRegenerates } =
      extractRegenerateTargets(appliedActions);

    if (globalRegenerate && onRegenerateAll) {
      onRegenerateAll();
    }
    if (shotRegenerates.length > 0 && onRegenerateShot) {
      shotRegenerates.forEach((a) => onRegenerateShot(a.shotId));
    }

    // 若有警告，以 assistant 消息形式告知用户
    const allWarnings = [
      ...(pending.warnings ?? []),
      ...warnings,
    ];
    if (allWarnings.length > 0) {
      appendMessage(
        makeAssistantMsg(`操作已应用。注意：\n${allWarnings.join("\n")}`)
      );
    }

    setPendingResponse(null);
    setActionStatus("idle");
    setErrorMessage(null);
  }, [onScenesChange, onRegenerateShot, onRegenerateAll, appendMessage]);

  // ── rejectActions ─────────────────────────────────────────

  const rejectActions = useCallback(() => {
    setPendingResponse(null);
    setActionStatus("idle");
    setErrorMessage(null);
    // 消息历史保留，不清空
  }, []);

  // ── reset ─────────────────────────────────────────────────

  const reset = useCallback(() => {
    setMessages([]);
    setPendingResponse(null);
    setActionStatus("idle");
    setErrorMessage(null);
    setInputDraft("");
  }, []);

  // ── return ────────────────────────────────────────────────

  return {
    messages,
    actionStatus,
    errorMessage,
    pendingResponse,
    pendingActions:  pendingResponse?.actions ?? [],
    inputDraft,
    setInputDraft,
    sendMessage,
    confirmActions,
    rejectActions,
    reset,
  };
}
