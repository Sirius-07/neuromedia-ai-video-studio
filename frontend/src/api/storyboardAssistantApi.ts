// api/storyboardAssistantApi.ts
// 封装对后端 /api/storyboard-assistant/chat 的调用
//
// 风格与 components/assistant/api/callAssistantChat.ts 保持一致：
//   - AbortController 30 秒超时
//   - HTTP 非 2xx 抛出 AssistantApiError（直接复用）
//   - 超时 / 网络失败 / JSON 解析失败 分别给出可区分的错误语义
//   - 成功后通过 parseStoryboardResponse 得到类型安全的结构化结果

import { AssistantApiError } from "../components/assistant/api/callAssistantChat";
import {
  parseStoryboardResponse,
  type StoryboardParseResult,
} from "../components/storyboard/assistant/parseStoryboardResponse";
import type { StoryboardContextPayload } from "../components/storyboard/assistant/buildStoryboardContext";

// ─────────────────────────────────────────────────────────────
// 公开类型别名
// ─────────────────────────────────────────────────────────────

/** 发送给后端的 context 类型（按模式区分 image / video 字段） */
export type StoryboardContext = StoryboardContextPayload;

/** 后端请求 body */
export interface StoryboardChatRequest {
  message: string;
  context: StoryboardContext;
}

/**
 * callStoryboardAssistantChat 的返回类型。
 *
 * - `rawText`   后端返回的原始文本（供调试 / 日志）
 * - `parsed`    parseStoryboardResponse 的完整结果（含 response 和 log）
 * - `parseOk`   解析是否完全正常（false 表示降级或修复）
 * - `latencyMs` 整个 HTTP 往返耗时（ms）
 */
export interface StoryboardChatCallResult {
  rawText:   string;
  parsed:    StoryboardParseResult;
  parseOk:   boolean;
  latencyMs: number;
}

// ─────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────

const API_ENDPOINT = "/api/storyboard-assistant/chat";
const TIMEOUT_MS   = 30_000;

// ─────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────

/**
 * 调用 Storyboard AI Director 后端接口。
 *
 * - 超时自动通过 AbortController 取消，抛出含"请求超时"语义的 AssistantApiError
 * - HTTP 非 2xx 抛出含状态码的 AssistantApiError
 * - 网络底层错误（断网等）包装为统一 AssistantApiError
 * - 解析失败时返回 fallback 结构（不抛出），通过 parseOk=false 标识
 *
 * @param message  用户输入的消息
 * @param context  当前分镜板状态上下文（由 buildStoryboardContext 生成）
 */
export async function callStoryboardAssistantChat(
  message: string,
  context: StoryboardContext
): Promise<StoryboardChatCallResult> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startMs    = Date.now();

  let rawText: string;

  try {
    const res = await fetch(API_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message, context } satisfies StoryboardChatRequest),
      signal:  controller.signal,
    });

    if (!res.ok) {
      // 尝试读取后端返回的错误体（JSON 或纯文本），提供更具体的错误提示
      const errBody = await res.json().catch(() => null);
      const hint    = errBody?.message ?? errBody?.error ?? null;
      throw new AssistantApiError(
        hint
          ? `分镜 AI 接口返回错误（HTTP ${res.status}）：${hint}`
          : `分镜 AI 接口请求失败（HTTP ${res.status}）`,
        res.status,
        errBody
      );
    }

    rawText = await res.text();
  } catch (err) {
    // 已是 AssistantApiError（含 HTTP 非 2xx），直接向上抛
    if (err instanceof AssistantApiError) throw err;

    // AbortError：超时触发
    const isAbort =
      err instanceof DOMException && err.name === "AbortError";

    throw new AssistantApiError(
      isAbort
        ? `分镜 AI 请求超时（>${TIMEOUT_MS / 1000}s），请稍后再试`
        : `分镜 AI 网络错误，请检查网络连接：${String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }

  // 从 context.mode 中取出当前分镜板模式，供解析器注入缺失的 patch.mode
  const parsed = parseStoryboardResponse(rawText, context.mode);

  if (!parsed.log.ok) {
    console.warn("[StoryboardAssistantApi] 响应解析降级", parsed.log);
  }

  return {
    rawText,
    parsed,
    parseOk:   parsed.log.ok,
    latencyMs: Date.now() - startMs,
  };
}
