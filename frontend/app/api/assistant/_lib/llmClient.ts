// app/api/assistant/_lib/llmClient.ts
// LLM 调用封装层：与具体模型提供商解耦
// 默认实现使用 OpenAI SDK；替换 callLLM 即可切换到其他模型

import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────
// 客户端单例
// ─────────────────────────────────────────────────────────────

// 使用函数懒初始化，避免在未配置环境变量时启动报错
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("环境变量 OPENAI_API_KEY 未配置");

    _client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,         // 可选：自定义代理
      timeout: Number(process.env.LLM_TIMEOUT_MS ?? 30_000),
    });
  }
  return _client;
}

// ─────────────────────────────────────────────────────────────
// 调用参数与返回类型
// ─────────────────────────────────────────────────────────────

export interface LLMMessage {
  role:    "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  messages:    LLMMessage[];
  /** 默认读取 env.OPENAI_MODEL，兜底 "gpt-4o-mini" */
  model?:      string;
  /** 0~2，越低越确定性；JSON 输出建议 0 */
  temperature?: number;
  /** 最大输出 token 数 */
  maxTokens?:  number;
}

export interface LLMCallResult {
  /** 模型原始输出文本 */
  content:      string;
  /** 模型名（用于日志） */
  model:        string;
  /** 输入 token 数（用于监控成本） */
  inputTokens:  number;
  /** 输出 token 数 */
  outputTokens: number;
  /** 总耗时 ms */
  latencyMs:    number;
}

// ─────────────────────────────────────────────────────────────
// 核心调用函数
// ─────────────────────────────────────────────────────────────

/**
 * 调用 LLM，返回原始文本内容。
 * 所有模型提供商的差异在此函数内部处理，外部只关心 LLMCallResult。
 *
 * 替换模型提供商只需修改此函数内部实现。
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMCallResult> {
  const {
    messages,
    model      = process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature = 0,
    maxTokens   = 2048,
  } = options;

  const client = getClient();
  const startMs = Date.now();

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens:      maxTokens,
    // 要求模型直接输出合法 JSON，减少解析失败率
    response_format: { type: "json_object" },
  });

  const choice  = completion.choices[0];
  const content = choice?.message?.content ?? "";

  return {
    content,
    model:        completion.model,
    inputTokens:  completion.usage?.prompt_tokens     ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
    latencyMs:    Date.now() - startMs,
  };
}

// ─────────────────────────────────────────────────────────────
// 可选：带重试的调用包装器
// ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

/**
 * 带指数退避重试的 LLM 调用。
 * 仅在网络错误或 5xx 时重试；4xx（如 400 Bad Request）不重试。
 */
export async function callLLMWithRetry(
  options: LLMCallOptions
): Promise<LLMCallResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLM(options);
    } catch (err) {
      lastError = err;

      const isRetryable = isRetryableError(err);
      if (!isRetryable || attempt === MAX_RETRIES) break;

      const delayMs = RETRY_DELAY_MS * 2 ** attempt;
      console.warn(`[LLM] 第 ${attempt + 1} 次调用失败，${delayMs}ms 后重试`, err);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status >= 500 || err.status === 429;
  }
  return true; // 网络错误等默认重试
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
