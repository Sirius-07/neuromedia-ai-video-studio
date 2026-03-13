// app/api/assistant/_lib/parseResponse.ts
// LLM 输出解析与校验层
// 职责：JSON 提取 → Zod 校验 → 失败时生成 fallback 响应

import { ZodError } from "zod";
import { AssistantResponseSchema, type AssistantResponse } from "./schemas";

// ─────────────────────────────────────────────────────────────
// 解析结果类型
// ─────────────────────────────────────────────────────────────

export type ParseSuccess = { ok: true;  response: AssistantResponse };
export type ParseFailure = { ok: false; reason: string; raw: string };
export type ParseResult  = ParseSuccess | ParseFailure;

// ─────────────────────────────────────────────────────────────
// 步骤 1：从文本中提取 JSON
// ─────────────────────────────────────────────────────────────

/**
 * 从 LLM 输出文本中提取 JSON 对象字符串。
 *
 * 兼容以下模型输出格式：
 * 1. 纯 JSON：`{ ... }`
 * 2. Markdown 代码块：` ```json\n{ ... }\n``` `
 * 3. 前后有多余说明文字：`这是结果：{ ... } 以上是 JSON`
 */
export function extractJSON(raw: string): string | null {
  const trimmed = raw.trim();

  // 格式 1：纯 JSON 对象或数组
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  // 格式 2：markdown 代码块（```json ... ``` 或 ``` ... ```）
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // 格式 3：文本中嵌入的 JSON（提取第一个 { 到对应 } 之间的内容）
  const braceStart = trimmed.indexOf("{");
  if (braceStart !== -1) {
    const extracted = extractBalancedBraces(trimmed, braceStart);
    if (extracted) return extracted;
  }

  return null;
}

/** 从 start 位置开始，提取平衡大括号之间的字符串 */
function extractBalancedBraces(text: string, start: number): string | null {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 步骤 2：解析 + Zod 校验
// ─────────────────────────────────────────────────────────────

/**
 * 解析 LLM 原始输出，返回类型安全的 AssistantResponse。
 *
 * 失败时返回 { ok: false }，不抛出异常，让调用方决定如何降级处理。
 */
export function parseLLMResponse(raw: string): ParseResult {
  // ── 步骤 1：提取 JSON 字符串 ──────────────────────────────
  const jsonStr = extractJSON(raw);
  if (!jsonStr) {
    return {
      ok:     false,
      reason: "LLM 输出中未找到有效 JSON 结构",
      raw,
    };
  }

  // ── 步骤 2：JSON.parse ─────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok:     false,
      reason: `JSON.parse 失败：${e instanceof Error ? e.message : String(e)}`,
      raw,
    };
  }

  // ── 步骤 3：Zod 校验 ───────────────────────────────────────
  const result = AssistantResponseSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok:     false,
      reason: formatZodError(result.error),
      raw,
    };
  }

  return { ok: true, response: result.data };
}

// ─────────────────────────────────────────────────────────────
// 步骤 3：解析失败时的 Fallback 响应
// ─────────────────────────────────────────────────────────────

/**
 * 当 LLM 输出无法解析时，返回一个安全的 fallback 响应。
 * 用户会看到一条友好提示，无任何 actions 被触发。
 */
export function buildFallbackResponse(reason: string): AssistantResponse {
  return {
    reply:       "抱歉，AI 返回的内容格式有误，请再试一次或换一种方式描述需求。",
    intent:      "parse_error",
    needConfirm: false,
    actions:     [],
    warnings:    [
      "AI 响应解析失败，未执行任何操作",
      ...(process.env.NODE_ENV === "development" ? [`[dev] ${reason}`] : []),
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 工具：格式化 Zod 错误为可读字符串
// ─────────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.errors
    .slice(0, 3) // 最多展示前 3 条，避免日志过长
    .map((e) => `[${e.path.join(".")}] ${e.message}`)
    .join("；");
}

// ─────────────────────────────────────────────────────────────
// 组合：解析，失败则降级
// ─────────────────────────────────────────────────────────────

/**
 * 解析 LLM 输出，失败时自动返回 fallback 响应，永不抛出异常。
 * 这是 route handler 中应该调用的主入口。
 */
export function parseLLMResponseSafe(raw: string): {
  response:  AssistantResponse;
  parseOk:   boolean;
  parseError?: string;
} {
  const result = parseLLMResponse(raw);

  if (result.ok) {
    return { response: result.response, parseOk: true };
  }

  console.error("[Assistant] LLM 响应解析失败:", result.reason);
  console.error("[Assistant] 原始输出:", result.raw.slice(0, 500));

  return {
    response:   buildFallbackResponse(result.reason),
    parseOk:    false,
    parseError: result.reason,
  };
}
