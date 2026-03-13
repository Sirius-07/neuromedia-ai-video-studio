// assistant/types.ts
// Script 页面 AI 助手前端类型定义

export type AssistantRole = "user" | "assistant" | "system";

export type MessageStatus = "pending" | "streaming" | "done" | "error";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  timestamp: string;
  status: MessageStatus;
  suggestions?: string[];
}

export type AssistantPanelMode = "global" | "shot";

export type ActionStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "awaiting-confirm"
  | "error";

export interface AssistantPanelState {
  isOpen: boolean;
  mode: AssistantPanelMode;
  messages: AssistantMessage[];
  inputDraft: string;
  selectedShotId: string | null;
  actionStatus: ActionStatus;
  errorMessage: string | null;
}
