// app/api/assistant/chat/route.ts
// Next.js App Router route handler
// POST /api/assistant/chat

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { ChatRequestSchema, type AssistantResponse, type ApiErrorResponse } from "../_lib/schemas";
import { callLLMWithRetry } from "../_lib/llmClient";
import { parseLLMResponseSafe } from "../_lib/parseResponse";
import { buildScriptAssistantMessages } from "../_lib/prompts/scriptPrompt";

// ─────────────────────────────────────────────────────────────
// 请求日志（轻量，不记录敏感内容）
// ─────────────────────────────────────────────────────────────

function logRequest(page: string, projectId: string, messageLen: number) {
  console.log(
    `[Assistant] POST /api/assistant/chat | page=${page} | project=${projectId} | msgLen=${messageLen}`
  );
}

function logResult(opts: {
  page:         string;
  parseOk:      boolean;
  actionCount:  number;
  latencyMs:    number;
  inputTokens:  number;
  outputTokens: number;
}) {
  console.log(
    `[Assistant] Done | page=${opts.page} | parseOk=${opts.parseOk}` +
    ` | actions=${opts.actionCount} | ${opts.latencyMs}ms` +
    ` | tokens=${opts.inputTokens}→${opts.outputTokens}`
  );
}

// ─────────────────────────────────────────────────────────────
// 辅助：统一返回 JSON
// ─────────────────────────────────────────────────────────────

function ok(body: AssistantResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function err(body: ApiErrorResponse, status: number) {
  return NextResponse.json(body, { status });
}

// ─────────────────────────────────────────────────────────────
// 路由分发：根据 page 字段路由到对应 prompt 构建器
// 后续新增 storyboard / editor 页面只需在此扩展
// ─────────────────────────────────────────────────────────────

type MessageBuilder = (
  context: unknown,
  message: string
) => import("../../../api/assistant/_lib/llmClient").LLMMessage[];

const PAGE_HANDLERS: Record<string, MessageBuilder> = {
  script: (context, message) =>
    buildScriptAssistantMessages(context as Parameters<typeof buildScriptAssistantMessages>[0], message),

  // storyboard: (context, message) => buildStoryboardMessages(context, message),
  // editor:     (context, message) => buildEditorMessages(context, message),
};

// ─────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  // ── 1. 解析 + 校验请求体 ────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err({ error: "请求体不是合法 JSON" }, 400);
  }

  const parseResult = ChatRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const details = parseResult.error.flatten();
    return err({ error: "请求体校验失败", details }, 400);
  }

  const { page, message, context } = parseResult.data;
  logRequest(page, context.projectId, message.length);

  // ── 2. 路由到对应 prompt 构建器 ─────────────────────────────
  const buildMessages = PAGE_HANDLERS[page];
  if (!buildMessages) {
    return err({ error: `不支持的 page 类型: "${page}"` }, 400);
  }

  const messages = buildMessages(context, message);

  // ── 3. 调用 LLM ─────────────────────────────────────────────
  let llmResult: Awaited<ReturnType<typeof callLLMWithRetry>>;
  try {
    llmResult = await callLLMWithRetry({
      messages,
      temperature: 0,
      maxTokens:   2048,
    });
  } catch (e) {
    console.error("[Assistant] LLM 调用失败:", e);
    return err(
      { error: "AI 服务暂时不可用，请稍后重试" },
      503
    );
  }

  // ── 4. 解析 + 校验模型输出 ──────────────────────────────────
  const { response, parseOk, parseError } = parseLLMResponseSafe(llmResult.content);

  logResult({
    page,
    parseOk,
    actionCount:  response.actions.length,
    latencyMs:    Date.now() - startMs,
    inputTokens:  llmResult.inputTokens,
    outputTokens: llmResult.outputTokens,
  });

  // 开发环境：在响应头中附带调试信息
  const headers: Record<string, string> = {};
  if (process.env.NODE_ENV === "development") {
    headers["X-LLM-Model"]        = llmResult.model;
    headers["X-LLM-Latency-Ms"]   = String(llmResult.latencyMs);
    headers["X-LLM-Input-Tokens"] = String(llmResult.inputTokens);
    headers["X-Parse-Ok"]         = String(parseOk);
    if (parseError) headers["X-Parse-Error"] = parseError.slice(0, 100);
  }

  return NextResponse.json(response, { status: 200, headers });
}

// ─────────────────────────────────────────────────────────────
// 拒绝 GET / 其他方法
// ─────────────────────────────────────────────────────────────

export async function GET() {
  return err({ error: "此端点只接受 POST 请求" }, 405);
}
