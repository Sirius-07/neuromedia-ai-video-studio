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
  AskUserDirectorAction,
  StoryboardAssistantResponse,
  ShotFieldPatch,
}                                    from "./types";
import {
  buildStoryboardContext,
  type StoryboardConversationTurn,
}                                    from "./buildStoryboardContext";
import {
  callStoryboardAssistantChat,
  type StoryboardContext,
}                                    from "../../../api/storyboardAssistantApi";
import { AssistantApiError }         from "../../assistant/api/callAssistantChat";
import {
  createLocalStoryboardAssistantResponse,
}                                    from "./agentIntelligence";
import {
  applyStoryboardActions,
  extractRegenerateTargets,
}                                    from "./applyStoryboardActions";

export interface StoryboardAssistantActionPreview {
  actionIntent:     string;
  actions:          StoryboardAction[];
  affectedShotIds:  number[];
  fields:           string[];
  warnings?:        string[];
}

export interface StoryboardAssistantActionsAppliedEvent {
  type:             "applied";
  actionIntent:     string;
  actions:          StoryboardAction[];
  appliedActions:   StoryboardAction[];
  affectedShotIds:  number[];
  fields:           string[];
  snapshotBefore:   Scene[];
  nextScenes:       Scene[];
  warnings?:        string[];
}

export interface StoryboardAssistantActionsUndoneEvent {
  type:             "undone";
  actionIntent:     string;
  actions:          StoryboardAction[];
  appliedActions:   StoryboardAction[];
  affectedShotIds:  number[];
  fields:           string[];
  snapshotBefore:   Scene[];
  nextScenes:       Scene[];
  restoredScenes:   Scene[];
  warnings?:        string[];
}

export type StoryboardAssistantActionsEvent =
  | StoryboardAssistantActionsAppliedEvent
  | StoryboardAssistantActionsUndoneEvent;

export type StoryboardAssistantUndoState = Omit<
  StoryboardAssistantActionsAppliedEvent,
  "type"
>;

export const UNDO_LAST_STORYBOARD_ACTION_LABEL = "撤销刚才修改";

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
  onPreviewActionsChange?: (preview: StoryboardAssistantActionPreview | null) => void;
  onActionsApplied?:    (event: StoryboardAssistantActionsEvent) => void;
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
  undoLastApplied: () => void;
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

function getAskUserActions(
  response: StoryboardAssistantResponse
): AskUserDirectorAction[] {
  return response.actions.filter(
    (action): action is AskUserDirectorAction => action.type === "ask_user"
  );
}

function uniqStrings(items: Array<string | undefined>): string[] {
  return Array.from(new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]));
}

function uniqueNumbers(items: Array<number | undefined>): number[] {
  return Array.from(new Set(items.filter((item): item is number => typeof item === "number")));
}

function getPatchFields(patch: ShotFieldPatch): string[] {
  return Object.keys(patch).filter((field) => field !== "mode");
}

function collectActionFields(actions: StoryboardAction[]): string[] {
  const fields = actions.flatMap((action) => {
    switch (action.type) {
      case "update_shot_field":
        return getPatchFields(action.patch);
      case "bulk_update_shots":
        return action.items.flatMap((item) => getPatchFields(item.patch));
      case "regenerate_shot":
        return action.target === "image"
          ? ["generationStatus", "selectedImageIndex"]
          : ["generationStatus", "videoUrl"];
      case "regenerate_storyboard":
        return ["generationStatus", "selectedImageIndex", "videoUrl"];
      case "ask_user":
        return [];
    }
  });
  return uniqStrings(fields);
}

function collectPreviewAffectedShotIds(actions: StoryboardAction[], scenes: Scene[]): number[] {
  return uniqueNumbers(
    actions.flatMap((action) => {
      switch (action.type) {
        case "update_shot_field":
          return [action.shotId];
        case "bulk_update_shots":
          return action.items.map((item) => item.shotId);
        case "regenerate_shot":
          return [action.shotId];
        case "regenerate_storyboard":
          return scenes.map((scene) => scene.id);
        case "ask_user":
          return [];
      }
    })
  );
}

export function buildStoryboardActionsPreview({
  actionIntent,
  actions,
  scenes,
  warnings,
}: {
  actionIntent: string;
  actions: StoryboardAction[];
  scenes: Scene[];
  warnings?: string[];
}): StoryboardAssistantActionPreview {
  return {
    actionIntent,
    actions,
    affectedShotIds: collectPreviewAffectedShotIds(actions, scenes),
    fields: collectActionFields(actions),
    ...(warnings?.length ? { warnings } : {}),
  };
}

export function buildStoryboardActionsAppliedEvent({
  actionIntent,
  actions,
  appliedActions,
  affectedShotIds,
  fields,
  snapshotBefore,
  nextScenes,
  warnings,
}: StoryboardAssistantUndoState): StoryboardAssistantActionsAppliedEvent {
  return {
    type: "applied",
    actionIntent,
    actions,
    appliedActions,
    affectedShotIds,
    fields,
    snapshotBefore,
    nextScenes,
    ...(warnings?.length ? { warnings } : {}),
  };
}

export function consumeUndoSnapshot(
  undoState: StoryboardAssistantUndoState | null
): {
  event: StoryboardAssistantActionsUndoneEvent | null;
  nextUndoState: StoryboardAssistantUndoState | null;
} {
  if (!undoState) {
    return { event: null, nextUndoState: null };
  }

  return {
    event: {
      type: "undone",
      ...undoState,
      restoredScenes: undoState.snapshotBefore,
    },
    nextUndoState: null,
  };
}

function isUndoLastAppliedRequest(text: string): boolean {
  const normalized = text.replace(/\s+/g, "");
  return normalized === UNDO_LAST_STORYBOARD_ACTION_LABEL || normalized === "撤销";
}

function buildAssistantReply(response: StoryboardAssistantResponse): string {
  const questions = getAskUserActions(response);
  if (questions.length === 0) return response.reply;

  const lines = [response.reply.trim()];
  for (const question of questions) {
    if (!response.reply.includes(question.question)) {
      lines.push(question.question);
    }
    if (question.hypothesis) {
      lines.push(`当前判断：${question.hypothesis}`);
    }
  }
  return lines.filter(Boolean).join("\n\n");
}

function buildAssistantSuggestions(response: StoryboardAssistantResponse): string[] {
  const questionOptions = getAskUserActions(response).flatMap(
    (question) => question.options ?? []
  );
  return uniqStrings([...questionOptions, ...(response.suggestions ?? [])]).slice(0, 5);
}

function summarizeAppliedActions(
  appliedActions: StoryboardAction[],
  affectedShotIds: number[]
): string {
  if (appliedActions.length === 0) {
    return "这次没有可应用的修改，当前分镜保持不变。";
  }
  const affectedText =
    affectedShotIds.length > 0 ? `，影响 ${affectedShotIds.length} 个分镜` : "";
  return `已应用 ${appliedActions.length} 项修改${affectedText}。`;
}

function buildPostApplySuggestions(mode: StoryboardMode): string[] {
  return mode === "image"
    ? [UNDO_LAST_STORYBOARD_ACTION_LABEL, "继续检查下一镜", "统一全片视觉风格", "现在生成图片"]
    : [UNDO_LAST_STORYBOARD_ACTION_LABEL, "继续检查下一镜", "统一全片运动节奏", "现在生成视频"];
}

function isConversationRole(
  message: DirectorMessage
): message is DirectorMessage & { role: "user" | "assistant" } {
  return message.role === "user" || message.role === "assistant";
}

function toConversationHistory(messages: DirectorMessage[]): StoryboardConversationTurn[] {
  return messages
    .filter(isConversationRole)
    .filter((message) => message.status !== "error")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 420),
      ...(message.suggestions?.length
        ? { suggestions: message.suggestions.slice(0, 5) }
        : {}),
    }));
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
  onPreviewActionsChange,
  onActionsApplied,
}: UseStoryboardAssistantOptions): UseStoryboardAssistantReturn {

  const [messages,        setMessages]        = useState<DirectorMessage[]>([]);
  const [actionStatus,    setActionStatus]    = useState<DirectorPanelActionStatus>("idle");
  const [errorMessage,    setErrorMessage]    = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<PendingDirectorState | null>(null);
  const [inputDraft,      setInputDraft]      = useState("");
  const lastAppliedRef = useRef<StoryboardAssistantUndoState | null>(null);

  // ── refs（避免异步回调读到过期值）────────────────────────────

  /** 始终指向最新的 scenes prop，供 buildContext / confirmActions 读取 */
  const scenesRef = useRef<Scene[]>(scenes);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);

  /** 始终指向最新的 pendingResponse state */
  const pendingRef = useRef<PendingDirectorState | null>(null);
  useEffect(() => { pendingRef.current = pendingResponse; }, [pendingResponse]);

  /** 始终指向最新消息，供下一轮请求带上多轮上下文 */
  const messagesRef = useRef<DirectorMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── appendMessage ─────────────────────────────────────────

  const appendMessage = useCallback((msg: DirectorMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      messagesRef.current = next;
      return next;
    });
  }, []);

  // ── buildContext ──────────────────────────────────────────
  // 依赖除 scenes 外的所有字段；scenes 通过 ref 访问保证最新

  const buildContext = useCallback((conversationSeed: DirectorMessage[] = messagesRef.current): StoryboardContext => {
    return buildStoryboardContext(
      scenesRef.current,
      mode,
      selectedShotId,
      projectTitle,
      {
        projectId,
        lastActionSummary,
        conversation: toConversationHistory(conversationSeed),
      }
    );
  }, [mode, selectedShotId, projectTitle, projectId, lastActionSummary]);

  const handleAssistantResponse = useCallback((
    response: StoryboardAssistantResponse,
    parseOk: boolean,
    meta?: DirectorMessage["meta"]
  ) => {
    const assistantSuggestions = buildAssistantSuggestions(response);

    appendMessage(
      makeAssistantMsg(buildAssistantReply(response), assistantSuggestions, {
        actionCount: response.actions.length,
        parseOk,
        ...meta,
      })
    );

    // ask_user 类型不需要确认，过滤后只保留真正需要执行的 action
    const confirmableActions = response.actions.filter(
      (a) => a.type !== "ask_user"
    );

    if (confirmableActions.length > 0) {
      // 保守策略：有可执行 actions 一律走确认流程，避免静默修改用户数据。
      const pending: PendingDirectorState = {
        id:             makeId(),
        intent:         response.intent,
        actions:        confirmableActions,
        warnings:       response.warnings,
        snapshotBefore: [...scenesRef.current],
      };
      pendingRef.current = pending;
      setPendingResponse(pending);
      onPreviewActionsChange?.(
        buildStoryboardActionsPreview({
          actionIntent: response.intent,
          actions: confirmableActions,
          scenes: scenesRef.current,
          warnings: response.warnings,
        })
      );
      setActionStatus("awaiting-confirm");
      return;
    }

    // 无可执行 actions（纯 ask_user 或纯问答），直接回到 idle，让用户继续输入回复
    onPreviewActionsChange?.(null);
    setActionStatus("idle");
  }, [appendMessage, onPreviewActionsChange]);

  const undoLastApplied = useCallback(() => {
    const { event, nextUndoState } = consumeUndoSnapshot(lastAppliedRef.current);
    lastAppliedRef.current = nextUndoState;
    if (!event) {
      appendMessage(
        makeAssistantMsg(
          "当前没有可撤销的 Agent 修改。",
          mode === "image"
            ? ["继续检查下一镜", "统一全片视觉风格", "现在生成图片"]
            : ["继续检查下一镜", "统一全片运动节奏", "现在生成视频"]
        )
      );
      return;
    }

    onScenesChange(event.restoredScenes);
    onPreviewActionsChange?.(null);
    onActionsApplied?.(event);
    pendingRef.current = null;
    setPendingResponse(null);
    setActionStatus("idle");
    setErrorMessage(null);
    appendMessage(
      makeAssistantMsg("已撤销刚才修改，分镜已恢复到应用前的状态。")
    );
  }, [appendMessage, mode, onActionsApplied, onPreviewActionsChange, onScenesChange]);

  // ── sendMessage ───────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // 思考中/应用中不允许再发送
    if (actionStatus === "thinking" || actionStatus === "applying") return;

    if (isUndoLastAppliedRequest(trimmed)) {
      appendMessage(makeUserMsg(trimmed));
      setInputDraft("");
      undoLastApplied();
      return;
    }

    const userMessage = makeUserMsg(trimmed);
    const conversationSeed = [...messagesRef.current, userMessage];
    appendMessage(userMessage);
    setInputDraft("");
    setErrorMessage(null);
    onPreviewActionsChange?.(null);
    setPendingResponse(null);
    setActionStatus("thinking");

    const context = buildContext(conversationSeed);

    try {
      const { parsed, parseOk } = await callStoryboardAssistantChat(trimmed, context);
      handleAssistantResponse(parsed.response, parseOk);

    } catch (err) {
      const localResponse = createLocalStoryboardAssistantResponse(trimmed, context);
      if (localResponse) {
        handleAssistantResponse(localResponse, false, {
          localFallback: true,
        });
        return;
      }

      const msg =
        err instanceof AssistantApiError
          ? err.message
          : "AI 服务暂时不可用，请稍后重试。";
      setErrorMessage(msg);
      setActionStatus("error");
      appendMessage(makeErrorMsg(msg));
    }
  }, [actionStatus, appendMessage, buildContext, handleAssistantResponse, onPreviewActionsChange, undoLastApplied]);

  // ── confirmActions ────────────────────────────────────────

  const confirmActions = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;

    setActionStatus("applying");

    // 应用 actions，读取最新 scenes（通过 ref，不依赖 state 快照）
    const { nextScenes, warnings, appliedActions, affectedShotIds } =
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

    // 应用完成后继续给用户可选下一步，让对话自然进入下一轮。
    const allWarnings = [
      ...(pending.warnings ?? []),
      ...warnings,
    ];
    const undoState: StoryboardAssistantUndoState = {
      actionIntent: pending.intent,
      actions: pending.actions,
      appliedActions,
      affectedShotIds,
      fields: collectActionFields(appliedActions),
      snapshotBefore: pending.snapshotBefore,
      nextScenes,
      warnings: allWarnings,
    };
    lastAppliedRef.current = undoState;
    onPreviewActionsChange?.(null);
    onActionsApplied?.(buildStoryboardActionsAppliedEvent(undoState));

    const summary = summarizeAppliedActions(appliedActions, affectedShotIds);
    appendMessage(
      makeAssistantMsg(
        allWarnings.length > 0
          ? `${summary}\n\n注意：\n${allWarnings.join("\n")}`
          : summary,
        buildPostApplySuggestions(mode),
        {
          actionCount: appliedActions.length,
          affectedShotIds,
        }
      )
    );

    pendingRef.current = null;
    setPendingResponse(null);
    setActionStatus("idle");
    setErrorMessage(null);
  }, [onScenesChange, onRegenerateShot, onRegenerateAll, appendMessage, mode, onActionsApplied, onPreviewActionsChange]);

  // ── rejectActions ─────────────────────────────────────────

  const rejectActions = useCallback(() => {
    pendingRef.current = null;
    onPreviewActionsChange?.(null);
    setPendingResponse(null);
    setActionStatus("idle");
    setErrorMessage(null);
    appendMessage(
      makeAssistantMsg(
        "已取消这次建议，分镜没有被修改。",
        mode === "image"
          ? ["换一个视觉方向", "只优化选中分镜", "先做全局审片"]
          : ["换一个节奏方向", "只优化选中分镜", "先检查运动衔接"]
      )
    );
  }, [appendMessage, mode, onPreviewActionsChange]);

  // ── reset ─────────────────────────────────────────────────

  const reset = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    pendingRef.current = null;
    lastAppliedRef.current = null;
    onPreviewActionsChange?.(null);
    setPendingResponse(null);
    setActionStatus("idle");
    setErrorMessage(null);
    setInputDraft("");
  }, [onPreviewActionsChange]);

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
    undoLastApplied,
    reset,
  };
}
