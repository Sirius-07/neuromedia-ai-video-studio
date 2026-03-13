// assistant/api/callAssistantChat.ts
// 调用后端 /api/assistant/chat 的前端封装

import type { ScriptAssistantContext } from "../actions/buildScriptAssistantContext";
import type { AssistantResponse }       from "../parsers/parseScriptAssistantResponse";
import { parseScriptAssistantResponse } from "../parsers/parseScriptAssistantResponse";

// ─────────────────────────────────────────────────────────────
// 请求/响应类型
// ─────────────────────────────────────────────────────────────

export interface ChatRequest {
  page:    "script";
  message: string;
  context: ScriptAssistantContext;
}

export interface ChatCallResult {
  response:   AssistantResponse;
  /** 解析是否完全正常（false 表示降级/修复） */
  parseOk:    boolean;
  /** HTTP 耗时 ms */
  latencyMs:  number;
}

// ─────────────────────────────────────────────────────────────
// 错误类型
// ─────────────────────────────────────────────────────────────

export class AssistantApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?:   unknown
  ) {
    super(message);
    this.name = "AssistantApiError";
  }
}

// ─────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────

const API_ENDPOINT = "/api/assistant/chat";
const TIMEOUT_MS   = 30_000;

/**
 * 调用 Script AI 助手接口。
 *
 * - 超时自动 AbortController 取消
 * - HTTP 非 2xx 时抛出 AssistantApiError
 * - 解析失败时返回 fallback response（不抛出）
 */
export async function callAssistantChat(
  message: string,
  context: ScriptAssistantContext
): Promise<ChatCallResult> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startMs    = Date.now();

  let rawText: string;

  try {
    const res = await fetch(API_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ page: "script", message, context } satisfies ChatRequest),
      signal:  controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new AssistantApiError(
        `接口请求失败（HTTP ${res.status}）`,
        res.status,
        body
      );
    }

    rawText = await res.text();
  } catch (err) {
    if (err instanceof AssistantApiError) throw err;

    const isAbort = err instanceof DOMException && err.name === "AbortError";
    throw new AssistantApiError(
      isAbort ? `请求超时（>${TIMEOUT_MS / 1000}s）` : `网络错误：${String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }

  const { response, log } = parseScriptAssistantResponse(rawText);

  if (!log.ok) {
    console.warn("[AssistantChat] 响应解析降级", log);
  }

  return {
    response,
    parseOk:   log.ok,
    latencyMs: Date.now() - startMs,
  };
}
