// storyboard/assistant/parseStoryboardResponse.ts
// 前端专用解析器：将 LLM 返回的原始文本转换为类型安全的 StoryboardAssistantResponse
//
// 解析流程（按顺序尝试，首个成功即返回）：
//   阶段 1 — JSON 提取    直接 parse → 代码块提取 → 平衡括号扫描 → 宽容清洗
//   阶段 2 — Schema 校验  Zod 严格校验 → 失败则进入修复
//   阶段 3 — 局部修复     注入缺失的 patch.mode、补全缺失字段、剔除非法 action
//   阶段 4 — Fallback     无法修复时返回安全的占位响应，附带结构化日志

import { z, ZodError } from "zod";
import type { StoryboardAssistantResponse, StoryboardMode } from "./types";

// ─────────────────────────────────────────────────────────────
// Zod Schema 定义
// 与 types.ts 的 TypeScript 类型保持结构对齐，避免引入服务端依赖
// ─────────────────────────────────────────────────────────────

const NonEmptyString = z.string().min(1);

// Shot ID 为整数（对应 Scene.id: number）
const ShotIdSchema = z.number().int();

// ── Patch schemas ─────────────────────────────────────────────

const CameraMovementSchema = z.enum([
  "none",
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "zoom_in",
  "zoom_out",
  "roll",
  "drone",
] as const);

/**
 * Image 模式 patch schema。
 * mode 为 discriminant；除 mode 外至少提供一个字段。
 */
const ImageShotFieldPatchSchema = z
  .object({
    mode:         z.literal("image"),
    visualPrompt: NonEmptyString.optional(),
    size:         NonEmptyString.optional(),
    perspective:  NonEmptyString.optional(),
    equipment:    NonEmptyString.optional(),
    focalLength:  NonEmptyString.optional(),
    notes:        NonEmptyString.optional(),
    narration:    NonEmptyString.optional(),
    dialogue:     NonEmptyString.optional(),
  })
  .refine(
    (v) =>
      v.visualPrompt !== undefined ||
      v.size         !== undefined ||
      v.perspective  !== undefined ||
      v.equipment    !== undefined ||
      v.focalLength  !== undefined ||
      v.notes        !== undefined ||
      v.narration    !== undefined ||
      v.dialogue     !== undefined,
    { message: "image patch 至少需要一个字段（除 mode 外）" }
  );

/**
 * Video 模式 patch schema。
 * mode 为 discriminant；除 mode 外至少提供一个字段。
 */
const VideoShotFieldPatchSchema = z
  .object({
    mode:           z.literal("video"),
    motionPrompt:   NonEmptyString.optional(),
    cameraMovement: CameraMovementSchema.optional(),
    cameraStrength: z.number().int().min(0).max(100).optional(),
    duration:       z.number().int().min(1).max(600).optional(),
    narration:      NonEmptyString.optional(),
  })
  .refine(
    (v) =>
      v.motionPrompt   !== undefined ||
      v.cameraMovement !== undefined ||
      v.cameraStrength !== undefined ||
      v.duration       !== undefined ||
      v.narration      !== undefined,
    { message: "video patch 至少需要一个字段（除 mode 外）" }
  );

/** patch 联合类型 schema，通过 mode 字段做 discriminated union 校验 */
const ShotFieldPatchSchema = z.discriminatedUnion("mode", [
  ImageShotFieldPatchSchema,
  VideoShotFieldPatchSchema,
]);

// ── Action schemas ────────────────────────────────────────────

const UpdateShotFieldActionSchema = z.object({
  type:   z.literal("update_shot_field"),
  shotId: ShotIdSchema,
  patch:  ShotFieldPatchSchema,
  reason: z.string().optional(),
});

const BulkUpdateShotsActionSchema = z.object({
  type:   z.literal("bulk_update_shots"),
  items:  z
    .array(z.object({ shotId: ShotIdSchema, patch: ShotFieldPatchSchema }))
    .min(1),
  reason: z.string().optional(),
});

const RegenerateShotActionSchema = z.object({
  type:   z.literal("regenerate_shot"),
  shotId: ShotIdSchema,
  target: z.enum(["image", "video"]),
  reason: z.string().optional(),
});

const RegenerateStoryboardActionSchema = z.object({
  type:      z.literal("regenerate_storyboard"),
  mode:      z.enum(["image", "video"]),
  styleNote: z.string().optional(),
  reason:    z.string().optional(),
});

const AskUserDirectorActionSchema = z.object({
  type:       z.literal("ask_user"),
  question:   NonEmptyString,
  options:    z.array(NonEmptyString).optional(),
  hypothesis: z.string().optional(),
});

/** StoryboardAction discriminated union schema，通过 type 字段区分 */
export const StoryboardActionSchema = z.discriminatedUnion("type", [
  UpdateShotFieldActionSchema,
  BulkUpdateShotsActionSchema,
  RegenerateShotActionSchema,
  RegenerateStoryboardActionSchema,
  AskUserDirectorActionSchema,
]);

/** StoryboardAssistantResponse 完整 schema */
export const StoryboardAssistantResponseSchema = z.object({
  reply:       NonEmptyString,
  intent:      NonEmptyString,
  needConfirm: z.boolean(),
  actions:     z.array(StoryboardActionSchema),
  suggestions: z.array(NonEmptyString).optional(),
  warnings:    z.array(NonEmptyString).optional(),
});

// Zod 推断类型（与 types.ts 中的 TypeScript 接口结构兼容）
type ParsedResponse = z.infer<typeof StoryboardAssistantResponseSchema>;

// ─────────────────────────────────────────────────────────────
// 结构化日志类型
// ─────────────────────────────────────────────────────────────

/**
 * 解析阶段标识。
 * - direct_parse / fence_extract / brace_scan / lenient_clean：JSON 提取阶段
 * - partial_repair：Zod 校验失败后局部修复成功
 * - fallback：完全降级
 */
export type StoryboardParseStage =
  | "direct_parse"
  | "fence_extract"
  | "brace_scan"
  | "lenient_clean"
  | "partial_repair"
  | "fallback";

/** 解析结果的结构化日志，方便接入监控或调试 */
export interface StoryboardParseLog {
  /** 最终生效的解析阶段 */
  finalStage:      StoryboardParseStage;
  /** 是否完全成功（无修复、无降级） */
  ok:              boolean;
  /** 失败原因（ok=false 时存在） */
  failReason?:     string;
  /** Zod 校验错误详情（schema 校验失败时存在） */
  zodErrors?:      string[];
  /** 修复了哪些字段（partial_repair 阶段存在） */
  repairedFields?: string[];
  /** 原始文本前 300 字（调试用） */
  rawPreview:      string;
}

/** parseStoryboardResponse 的返回类型 */
export interface StoryboardParseResult {
  response: StoryboardAssistantResponse;
  log:      StoryboardParseLog;
}

// ─────────────────────────────────────────────────────────────
// 阶段 1：JSON 提取策略（4 种，按置信度排序）
// ─────────────────────────────────────────────────────────────

// "提取阶段"：不包含 partial_repair / fallback
type ExtractStage = Exclude<StoryboardParseStage, "partial_repair" | "fallback">;

interface ExtractResult {
  jsonStr: string;
  stage:   ExtractStage;
}

/**
 * 策略 A：直接 parse（模型按规范输出纯 JSON 时命中，最高优先级）
 */
function tryDirectParse(raw: string): ExtractResult | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  return { jsonStr: trimmed, stage: "direct_parse" };
}

/**
 * 策略 B：Markdown 代码块提取（兼容 ```json ... ``` 或 ``` ... ```）
 * 模型有时忽视"禁止代码块"指令，此策略作为兜底。
 */
function tryFenceExtract(raw: string): ExtractResult | null {
  const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = match?.[1]?.trim();
  if (!jsonStr?.startsWith("{")) return null;
  return { jsonStr, stage: "fence_extract" };
}

/**
 * 策略 C：平衡括号扫描
 * 处理"AI 在 JSON 前面加了文字说明"的情况，如：
 * "根据你的需求，我建议如下修改：{ \"reply\": ... }"
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
 * 移除 UTF-8 BOM、行尾注释、尾随逗号后再尝试括号扫描。
 */
function tryLenientClean(raw: string): ExtractResult | null {
  const cleaned = raw
    .replace(/^\uFEFF/, "")          // 移除 BOM
    .replace(/\/\/[^\n]*/g, "")      // 移除行注释
    .replace(/,\s*([}\]])/g, "$1")   // 移除尾随逗号
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  const jsonStr = extractBalancedBraces(cleaned, start);
  if (!jsonStr) return null;
  return { jsonStr, stage: "lenient_clean" };
}

/**
 * 字符级状态机：提取从 start 开始的平衡大括号子字符串。
 * 正确处理字符串内的括号（不计入深度）和反斜杠转义。
 */
function extractBalancedBraces(text: string, start: number): string | null {
  let depth    = 0;
  let inString = false;
  let escape   = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape)                  { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true;  continue; }
    if (ch === '"')              { inString = !inString; continue; }
    if (inString)                { continue; }
    if (ch === "{")        depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** 按优先级依次尝试 4 种提取策略，首个成功即返回 */
function extractJSON(raw: string): ExtractResult | null {
  return (
    tryDirectParse(raw)  ??
    tryFenceExtract(raw) ??
    tryBraceScan(raw)    ??
    tryLenientClean(raw)
  );
}

// ─────────────────────────────────────────────────────────────
// 阶段 2：Zod 错误格式化
// ─────────────────────────────────────────────────────────────

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map(
    (e) => `[${e.path.join(".") || "root"}] ${e.message}`
  );
}

// ─────────────────────────────────────────────────────────────
// 阶段 3：局部修复辅助函数
// ─────────────────────────────────────────────────────────────

/**
 * 推断 needConfirm 的合理默认值。
 * - 含 regenerate_storyboard → true（影响全局，必须确认）
 * - bulk_update_shots 超过 3 个分镜 → true（较大范围修改）
 * - 其他情况 → false
 */
function inferNeedConfirm(actions: unknown[]): boolean {
  return actions.some((a) => {
    if (typeof a !== "object" || a === null) return false;
    const act = a as Record<string, unknown>;
    if (act.type === "regenerate_storyboard") return true;
    if (
      act.type === "bulk_update_shots" &&
      Array.isArray(act.items) &&
      act.items.length > 3
    ) return true;
    return false;
  });
}

/**
 * 尝试为缺少 mode 字段的 patch 注入当前分镜板工作模式。
 *
 * 高频问题：LLM 输出 update_shot_field / bulk_update_shots 时往往漏掉
 * patch.mode（因为 mode 不是业务字段，模型不总会记得填写）。
 * 注入后重新过 Zod，大幅提升合法率。
 *
 * @returns { action: 修复后的 action, injected: 是否发生了注入 }
 */
function tryInjectPatchMode(
  action: unknown,
  mode: StoryboardMode
): { action: unknown; injected: boolean } {
  if (typeof action !== "object" || action === null) {
    return { action, injected: false };
  }
  const a = action as Record<string, unknown>;

  // update_shot_field：修复单个 patch
  if (a.type === "update_shot_field") {
    if (typeof a.patch === "object" && a.patch !== null) {
      const patch = a.patch as Record<string, unknown>;
      if (!patch.mode) {
        return {
          action:   { ...a, patch: { mode, ...patch } },
          injected: true,
        };
      }
    }
    return { action, injected: false };
  }

  // bulk_update_shots：修复每个 item 内的 patch
  if (a.type === "bulk_update_shots" && Array.isArray(a.items)) {
    let injected = false;
    const newItems = (a.items as unknown[]).map((item) => {
      if (typeof item !== "object" || item === null) return item;
      const it = item as Record<string, unknown>;
      if (typeof it.patch === "object" && it.patch !== null) {
        const patch = it.patch as Record<string, unknown>;
        if (!patch.mode) {
          injected = true;
          return { ...it, patch: { mode, ...patch } };
        }
      }
      return item;
    });
    return injected
      ? { action: { ...a, items: newItems }, injected: true }
      : { action, injected: false };
  }

  return { action, injected: false };
}

/**
 * 对 Zod 校验失败的原始对象进行最小修复，修复后重新严格校验。
 *
 * 修复策略（仅处理高频问题，不做深度猜测）：
 * 1. reply / intent 为空 → 补占位文本
 * 2. actions 缺失或为 null → 补空数组
 * 3. actions 中每个条目先尝试注入 patch.mode，再过滤非法条目
 * 4. needConfirm 缺失 → 根据 actions 内容合理推断
 * 5. suggestions / warnings 为 null → 删除字段（Zod 不接受 null）
 */
function tryPartialRepair(
  raw: unknown,
  mode: StoryboardMode
): { repaired: ParsedResponse; fields: string[] } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const obj             = { ...(raw as Record<string, unknown>) };
  const repairedFields: string[] = [];

  // ── reply ────────────────────────────────────────────────
  if (typeof obj.reply !== "string" || obj.reply.trim() === "") {
    obj.reply = "AI 已处理你的请求。";
    repairedFields.push("reply");
  }

  // ── intent ───────────────────────────────────────────────
  if (typeof obj.intent !== "string" || obj.intent.trim() === "") {
    obj.intent = "处理请求";
    repairedFields.push("intent");
  }

  // ── actions ──────────────────────────────────────────────
  if (!Array.isArray(obj.actions)) {
    obj.actions = [];
    repairedFields.push("actions（补空数组）");
  } else {
    const rawActions = obj.actions as unknown[];
    const before     = rawActions.length;
    let   modeInjectedCount = 0;

    // 先注入缺失的 patch.mode，再过滤无法通过 schema 的条目
    const processed = rawActions.map((a) => {
      const { action, injected } = tryInjectPatchMode(a, mode);
      if (injected) modeInjectedCount++;
      return action;
    });

    obj.actions = processed.filter(
      (a) => StoryboardActionSchema.safeParse(a).success
    );
    const after = (obj.actions as unknown[]).length;

    if (modeInjectedCount > 0) {
      repairedFields.push(
        `patch.mode（为 ${modeInjectedCount} 个 action 注入 "${mode}"）`
      );
    }
    if (after < before) {
      repairedFields.push(
        `actions（过滤 ${before - after} 条非法 action）`
      );
    }
  }

  // ── needConfirm ──────────────────────────────────────────
  if (typeof obj.needConfirm !== "boolean") {
    obj.needConfirm = inferNeedConfirm(obj.actions as unknown[]);
    repairedFields.push("needConfirm");
  }

  // ── suggestions / warnings：null → 删除字段 ──────────────
  if (obj.suggestions === null) {
    delete obj.suggestions;
    repairedFields.push("suggestions（null→删除）");
  }
  if (obj.warnings === null) {
    delete obj.warnings;
    repairedFields.push("warnings（null→删除）");
  }

  const result = StoryboardAssistantResponseSchema.safeParse(obj);
  if (!result.success) return null;

  return { repaired: result.data, fields: repairedFields };
}

// ─────────────────────────────────────────────────────────────
// 阶段 4：Fallback 响应
// ─────────────────────────────────────────────────────────────

/** 完全降级时的安全占位响应（模块级常量，不可变） */
export const STORYBOARD_FALLBACK_RESPONSE: StoryboardAssistantResponse = {
  reply:       "我刚才的响应格式有些问题，请再试一次。",
  intent:      "parse_error",
  needConfirm: false,
  actions:     [],
  warnings:    ["AI 响应解析失败，未执行任何操作"],
};

/** 根据具体失败原因生成带有详情的 fallback 响应（不修改常量） */
function makeFallbackWithReason(reason: string): StoryboardAssistantResponse {
  return {
    ...STORYBOARD_FALLBACK_RESPONSE,
    warnings: [`解析失败：${reason}`],
  };
}

// ─────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────

/**
 * 解析 LLM 返回的原始文本，转换为类型安全的 StoryboardAssistantResponse。
 *
 * **永不抛出异常**，始终返回 StoryboardParseResult。
 * 通过 `log` 字段获取完整的解析过程记录，方便接入监控或日志系统。
 *
 * @param rawText  LLM 的原始输出文本（可能含前缀文字、代码块、BOM 等）
 * @param mode     当前分镜板工作模式（"image" | "video"）
 *                 修复阶段会将此值注入到缺少 `patch.mode` 的 action 中
 *
 * @example
 * const { response, log } = parseStoryboardResponse(rawText, "image");
 * if (!log.ok) {
 *   console.warn("[Director] 解析降级", log);
 * }
 * return response;
 */
export function parseStoryboardResponse(
  rawText: string,
  mode: StoryboardMode
): StoryboardParseResult {
  const rawPreview = rawText.slice(0, 300);

  // ── 阶段 1：JSON 提取（4 种策略依次尝试）─────────────────
  const extracted = extractJSON(rawText);
  if (!extracted) {
    const reason = "输出中未找到任何 JSON 结构";
    return {
      response: makeFallbackWithReason(reason),
      log: { finalStage: "fallback", ok: false, failReason: reason, rawPreview },
    };
  }

  // ── 阶段 2：JSON.parse ──────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.jsonStr);
  } catch (e) {
    const reason = `JSON.parse 失败（${extracted.stage}）：${
      e instanceof Error ? e.message : String(e)
    }`;
    return {
      response: makeFallbackWithReason(reason),
      log: { finalStage: "fallback", ok: false, failReason: reason, rawPreview },
    };
  }

  // ── 阶段 3：Zod schema 严格校验 ────────────────────────
  const zodResult = StoryboardAssistantResponseSchema.safeParse(parsed);
  if (zodResult.success) {
    return {
      response: zodResult.data as StoryboardAssistantResponse,
      log: { finalStage: extracted.stage, ok: true, rawPreview },
    };
  }

  const zodErrors = formatZodErrors(zodResult.error);

  // ── 阶段 4：局部修复（注入 patch.mode、补全缺失字段、过滤非法 action）
  const repairResult = tryPartialRepair(parsed, mode);
  if (repairResult) {
    return {
      response: repairResult.repaired as StoryboardAssistantResponse,
      log: {
        finalStage:     "partial_repair",
        ok:             true,
        zodErrors,
        repairedFields: repairResult.fields,
        rawPreview,
      },
    };
  }

  // ── 阶段 5：完全降级 ────────────────────────────────────
  const reason = "schema 校验失败，局部修复亦无效";
  return {
    response: makeFallbackWithReason(reason),
    log: { finalStage: "fallback", ok: false, failReason: reason, zodErrors, rawPreview },
  };
}
