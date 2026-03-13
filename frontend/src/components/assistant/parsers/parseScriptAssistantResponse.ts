// assistant/parsers/parseScriptAssistantResponse.ts
// 前端专用解析器：将大模型返回的原始文本转换为类型安全的 AssistantResponse
//
// 解析流程（按顺序尝试，首个成功即返回）：
//   阶段 1 — JSON 提取    直接 parse → 代码块提取 → 平衡括号扫描 → 宽容清洗
//   阶段 2 — Schema 校验  Zod 严格校验 → 失败则进入修复
//   阶段 3 — 局部修复     尝试修复可容忍的格式缺陷（actions 为空、缺失可选字段等）
//   阶段 4 — Fallback     无法修复时返回安全的占位响应，附带结构化日志

import { z, ZodError } from "zod";

// ─────────────────────────────────────────────────────────────
// 内联 schema（与后端 schemas.ts 保持结构一致，避免前端引入服务端依赖）
// ─────────────────────────────────────────────────────────────

const ShotId         = z.string().min(1);
const NonEmptyString = z.string().min(1);
const Duration       = z.number().int().min(1).max(300);

const ShotScriptPatchSchema = z.object({
  narration:         NonEmptyString.optional(),
  visualDescription: NonEmptyString.optional(),
  musicNote:         NonEmptyString.optional(),
}).refine(
  (v) => v.narration !== undefined || v.visualDescription !== undefined || v.musicNote !== undefined,
  { message: "patch 至少需要一个字段" }
);

const AssistantActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("update_shot_script"),  shotId: ShotId, patch: ShotScriptPatchSchema, reason: z.string().optional() }),
  z.object({ type: z.literal("add_shot"),             afterShotId: ShotId.optional(), shot: z.object({ narration: NonEmptyString.optional(), visualDescription: NonEmptyString.optional(), duration: Duration, musicNote: NonEmptyString.optional() }) }).refine((v) => v.shot.narration !== undefined || v.shot.visualDescription !== undefined),
  z.object({ type: z.literal("remove_shot"),          shotId: ShotId, reason: z.string().optional() }),
  z.object({ type: z.literal("reorder_shots"),        orderedShotIds: z.array(ShotId).min(2) }),
  z.object({ type: z.literal("update_shot_duration"), shotId: ShotId, duration: Duration, reason: z.string().optional() }),
  z.object({ type: z.literal("bulk_rewrite_shots"),   items: z.array(z.object({ shotId: ShotId, patch: ShotScriptPatchSchema })).min(1), reason: z.string().optional() }),
  z.object({ type: z.literal("update_project_style_note"), patch: z.object({ styleNote: NonEmptyString.optional(), soundtrackNote: NonEmptyString.optional() }) }).refine((v) => v.patch.styleNote !== undefined || v.patch.soundtrackNote !== undefined),
  z.object({ type: z.literal("ask_user"),             question: NonEmptyString, options: z.array(NonEmptyString).optional(), hypothesis: z.string().optional() }),
]);

export const AssistantResponseSchema = z.object({
  reply:       NonEmptyString,
  intent:      NonEmptyString,
  needConfirm: z.boolean(),
  actions:     z.array(AssistantActionSchema),
  suggestions: z.array(NonEmptyString).optional(),
  warnings:    z.array(NonEmptyString).optional(),
});

export type AssistantAction   = z.infer<typeof AssistantActionSchema>;
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

// ─────────────────────────────────────────────────────────────
// 结构化日志类型
// ─────────────────────────────────────────────────────────────

/** 解析每个阶段的执行记录 */
export type ParseStage =
  | "direct_parse"        // 直接 JSON.parse 成功
  | "fence_extract"       // 从代码块中提取
  | "brace_scan"          // 平衡括号扫描
  | "lenient_clean"       // 宽容清洗后解析
  | "schema_valid"        // Zod 校验通过
  | "partial_repair"      // 部分字段修复后通过
  | "fallback";           // 完全降级

export interface ParseLog {
  /** 最终使用的解析阶段 */
  finalStage:    ParseStage;
  /** 解析是否完全成功（无修复、无降级） */
  ok:            boolean;
  /** 失败原因（ok=false 时存在） */
  failReason?:   string;
  /** Zod 校验错误详情（schema 校验失败时存在） */
  zodErrors?:    string[];
  /** 修复了哪些字段（partial_repair 时存在） */
  repairedFields?: string[];
  /** 原始文本前 300 字（调试用） */
  rawPreview:    string;
}

export interface ParseResult {
  response: AssistantResponse;
  log:      ParseLog;
}

// ─────────────────────────────────────────────────────────────
// 阶段 1：JSON 提取策略（4 种，按置信度排序）
// ─────────────────────────────────────────────────────────────

interface ExtractResult {
  jsonStr: string;
  stage:   Exclude<ParseStage, "schema_valid" | "partial_repair" | "fallback">;
}

/**
 * 策略 A：直接 parse（最高优先级，模型按规范输出时命中）
 */
function tryDirectParse(raw: string): ExtractResult | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  return { jsonStr: trimmed, stage: "direct_parse" };
}

/**
 * 策略 B：Markdown 代码块提取（```json ... ``` 或 ``` ... ```）
 * 兼容模型忽视"不要用代码块"指令的情况
 */
function tryFenceExtract(raw: string): ExtractResult | null {
  const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = match?.[1]?.trim();
  if (!jsonStr?.startsWith("{")) return null;
  return { jsonStr, stage: "fence_extract" };
}

/**
 * 策略 C：平衡括号扫描（文本中嵌入 JSON 的情况）
 * 例如：`根据你的要求，我生成了以下结果：{ "reply": ... }`
 */
function tryBraceScan(raw: string): ExtractResult | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  const jsonStr = extractBalancedBraces(raw, start);
  if (!jsonStr) return null;
  return { jsonStr, stage: "brace_scan" };
}

/**
 * 策略 D：宽容清洗（最后手段）
 * 移除行尾注释、非标准空白、UTF-8 BOM 等，再尝试 parse
 */
function tryLenientClean(raw: string): ExtractResult | null {
  const cleaned = raw
    .replace(/^\uFEFF/, "")                          // 移除 BOM
    .replace(/\/\/[^\n]*/g, "")                      // 移除行注释
    .replace(/,\s*([}\]])/g, "$1")                   // 移除尾随逗号
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  const jsonStr = extractBalancedBraces(cleaned, start);
  if (!jsonStr) return null;
  return { jsonStr, stage: "lenient_clean" };
}

/** 提取平衡大括号内的子字符串 */
function extractBalancedBraces(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape)            { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true;  continue; }
    if (ch === '"')        { inString = !inString; continue; }
    if (inString)          { continue; }

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** 按优先级依次尝试 4 种提取策略 */
function extractJSON(raw: string): ExtractResult | null {
  return (
    tryDirectParse(raw)   ??
    tryFenceExtract(raw)  ??
    tryBraceScan(raw)     ??
    tryLenientClean(raw)
  );
}

// ─────────────────────────────────────────────────────────────
// 阶段 2：Zod schema 校验
// ─────────────────────────────────────────────────────────────

function formatZodErrors(error: ZodError): string[] {
  return error.errors.map(
    (e) => `[${e.path.join(".") || "root"}] ${e.message}`
  );
}

// ─────────────────────────────────────────────────────────────
// 阶段 3：局部修复（容忍可恢复的格式缺陷）
// ─────────────────────────────────────────────────────────────

/**
 * 尝试对 Zod 校验失败的对象进行最小修复，修复后重新校验。
 * 修复策略（仅处理高频问题，不做深度猜测）：
 * - actions 字段缺失或为 null → 补为 []
 * - actions 中非法 action 被剔除，保留合法的
 * - suggestions / warnings 为 null → 删除该字段
 * - needConfirm 缺失 → 补 false
 * - reply / intent 为空 → 补占位文本
 */
function tryPartialRepair(
  raw: unknown
): { repaired: AssistantResponse; fields: string[] } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const obj = { ...(raw as Record<string, unknown>) };
  const repairedFields: string[] = [];

  // reply
  if (typeof obj.reply !== "string" || obj.reply.trim() === "") {
    obj.reply = "AI 已处理你的请求。";
    repairedFields.push("reply");
  }

  // intent
  if (typeof obj.intent !== "string" || obj.intent.trim() === "") {
    obj.intent = "处理请求";
    repairedFields.push("intent");
  }

  // needConfirm
  if (typeof obj.needConfirm !== "boolean") {
    obj.needConfirm = false;
    repairedFields.push("needConfirm");
  }

  // actions：过滤掉非法条目，保留合法的
  if (!Array.isArray(obj.actions)) {
    obj.actions = [];
    repairedFields.push("actions");
  } else {
    const before = (obj.actions as unknown[]).length;
    obj.actions = (obj.actions as unknown[]).filter(
      (a) => AssistantActionSchema.safeParse(a).success
    );
    const after = (obj.actions as unknown[]).length;
    if (after < before) {
      repairedFields.push(`actions（过滤 ${before - after} 条非法 action）`);
    }
  }

  // suggestions / warnings：null → 删除
  if (obj.suggestions === null)  { delete obj.suggestions; repairedFields.push("suggestions"); }
  if (obj.warnings    === null)  { delete obj.warnings;    repairedFields.push("warnings"); }

  const result = AssistantResponseSchema.safeParse(obj);
  if (!result.success) return null;

  return { repaired: result.data, fields: repairedFields };
}

// ─────────────────────────────────────────────────────────────
// 阶段 4：Fallback 响应
// ─────────────────────────────────────────────────────────────

export const FALLBACK_RESPONSE: AssistantResponse = {
  reply:       "我暂时没能正确理解这次修改请求，请换一种说法试试。",
  intent:      "fallback",
  needConfirm: false,
  actions:     [],
  warnings:    ["AI 响应解析失败，未执行任何操作"],
};

// ─────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────

/**
 * 解析大模型返回的原始文本，转换为类型安全的 AssistantResponse。
 *
 * 永不抛出异常，始终返回 ParseResult。
 * 通过 `log` 字段获取完整的解析过程记录，方便接入监控或日志系统。
 *
 * @example
 * const { response, log } = parseScriptAssistantResponse(rawText);
 * if (!log.ok) {
 *   console.warn("[Assistant] 解析降级", log);
 * }
 * return response;
 */
export function parseScriptAssistantResponse(rawText: string): ParseResult {
  const rawPreview = rawText.slice(0, 300);

  // ── 阶段 1：提取 JSON 字符串 ────────────────────────────────
  const extracted = extractJSON(rawText);
  if (!extracted) {
    return {
      response: FALLBACK_RESPONSE,
      log: {
        finalStage: "fallback",
        ok:         false,
        failReason: "输出中未找到任何 JSON 结构",
        rawPreview,
      },
    };
  }

  // ── 阶段 2：JSON.parse ──────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.jsonStr);
  } catch (e) {
    return {
      response: FALLBACK_RESPONSE,
      log: {
        finalStage: "fallback",
        ok:         false,
        failReason: `JSON.parse 失败（${extracted.stage}）：${e instanceof Error ? e.message : String(e)}`,
        rawPreview,
      },
    };
  }

  // ── 阶段 3：Zod schema 严格校验 ─────────────────────────────
  const zodResult = AssistantResponseSchema.safeParse(parsed);
  if (zodResult.success) {
    return {
      response: zodResult.data,
      log: {
        finalStage: extracted.stage === "direct_parse" ? "direct_parse" : extracted.stage,
        ok:         true,
        rawPreview,
      },
    };
  }

  const zodErrors = formatZodErrors(zodResult.error);

  // ── 阶段 4：局部修复 ────────────────────────────────────────
  const repairResult = tryPartialRepair(parsed);
  if (repairResult) {
    return {
      response: repairResult.repaired,
      log: {
        finalStage:    "partial_repair",
        ok:            true,
        zodErrors,
        repairedFields: repairResult.fields,
        rawPreview,
      },
    };
  }

  // ── 阶段 5：完全降级 ────────────────────────────────────────
  return {
    response: FALLBACK_RESPONSE,
    log: {
      finalStage: "fallback",
      ok:         false,
      failReason: "schema 校验失败，局部修复亦无效",
      zodErrors,
      rawPreview,
    },
  };
}
