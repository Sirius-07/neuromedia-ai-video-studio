// app/api/assistant/_lib/schemas.ts
// 所有 Zod schema 定义：请求体、响应体、Action 联合类型
// 与前端 assistant/schema/script.ts 保持结构对齐

import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// 基础原语
// ─────────────────────────────────────────────────────────────

const ShotId         = z.string().min(1);
const NonEmptyString = z.string().min(1);
const Duration       = z.number().int().min(1).max(300);

// ─────────────────────────────────────────────────────────────
// 请求体：ScriptAssistantContext（宽松验证，不做深度 shot 校验）
// ─────────────────────────────────────────────────────────────

const ShotSummarySchema = z.object({
  id:                z.string(),
  order:             z.number(),
  duration:          z.number(),
  narration:         z.string().nullable(),
  visualDescription: z.string().nullable(),
  musicNote:         z.string().optional(),
});

const MissingInfoSchema = z.object({
  narration:         z.array(z.number()),
  visualDescription: z.array(z.number()),
  duration:          z.array(z.number()),
  isComplete:        z.boolean(),
});

const ScriptSummarySchema = z.object({
  overview:       z.string(),
  avgDuration:    z.number(),
  shortestShotId: z.string(),
  longestShotId:  z.string(),
  completionRate: z.number(),
});

const SelectedShotSummarySchema = z.object({
  id:                z.string(),
  order:             z.number(),
  duration:          z.number(),
  narration:         z.string().nullable(),
  visualDescription: z.string().nullable(),
  musicNote:         z.string().optional(),
});

export const ScriptAssistantContextSchema = z.object({
  page:                z.literal("script"),
  projectId:           z.string(),
  projectTitle:        z.string(),
  language:            z.enum(["zh-CN", "en-US", "zh-TW"]),
  targetPlatform:      z.enum(["douyin", "wechat", "youtube", "bilibili", "general"]),
  totalDuration:       z.number(),
  shotCount:           z.number(),
  styleNote:           z.string(),
  soundtrackNote:      z.string(),
  scriptSummary:       ScriptSummarySchema,
  missingInfo:         MissingInfoSchema,
  selectedShotId:      z.string().nullable(),
  selectedShotIds:     z.array(z.string()),
  selectedShotSummary: SelectedShotSummarySchema.nullable(),
  shots:               z.array(ShotSummarySchema),
  lastActionSummary:   z.string().optional(),
});

export type ScriptAssistantContext = z.infer<typeof ScriptAssistantContextSchema>;

// ─────────────────────────────────────────────────────────────
// 请求体 schema
// ─────────────────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  /** 页面标识，用于路由到对应 prompt 模板 */
  page:    z.literal("script"),
  message: NonEmptyString,
  context: ScriptAssistantContextSchema,
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ─────────────────────────────────────────────────────────────
// Action schemas（模型输出，需严格校验）
// ─────────────────────────────────────────────────────────────

const ShotScriptPatchSchema = z
  .object({
    narration:          NonEmptyString.optional(),
    visualDescription:  NonEmptyString.optional(),
    musicNote:          NonEmptyString.optional(),
  })
  .refine(
    (v) => v.narration !== undefined || v.visualDescription !== undefined || v.musicNote !== undefined,
    { message: "patch 至少需要一个字段" }
  );

export const UpdateShotScriptSchema = z.object({
  type:   z.literal("update_shot_script"),
  shotId: ShotId,
  patch:  ShotScriptPatchSchema,
  reason: z.string().optional(),
});

export const AddShotSchema = z
  .object({
    type:        z.literal("add_shot"),
    afterShotId: ShotId.optional(),
    shot: z.object({
      narration:         NonEmptyString.optional(),
      visualDescription: NonEmptyString.optional(),
      duration:          Duration,
      musicNote:         NonEmptyString.optional(),
    }),
  })
  .refine(
    (v) => v.shot.narration !== undefined || v.shot.visualDescription !== undefined,
    { message: "新增 shot 至少需要 narration 或 visualDescription" }
  );

export const RemoveShotSchema = z.object({
  type:   z.literal("remove_shot"),
  shotId: ShotId,
  reason: z.string().optional(),
});

export const ReorderShotsSchema = z.object({
  type:           z.literal("reorder_shots"),
  orderedShotIds: z.array(ShotId).nonempty().min(2),
});

export const UpdateShotDurationSchema = z.object({
  type:     z.literal("update_shot_duration"),
  shotId:   ShotId,
  duration: Duration,
  reason:   z.string().optional(),
});

export const BulkRewriteShotsSchema = z.object({
  type:   z.literal("bulk_rewrite_shots"),
  items:  z.array(z.object({ shotId: ShotId, patch: ShotScriptPatchSchema })).nonempty(),
  reason: z.string().optional(),
});

export const UpdateProjectStyleNoteSchema = z
  .object({
    type:  z.literal("update_project_style_note"),
    patch: z.object({
      styleNote:      NonEmptyString.optional(),
      soundtrackNote: NonEmptyString.optional(),
    }),
  })
  .refine(
    (v) => v.patch.styleNote !== undefined || v.patch.soundtrackNote !== undefined,
    { message: "至少需要更新 styleNote 或 soundtrackNote" }
  );

export const AskUserSchema = z.object({
  type:       z.literal("ask_user"),
  question:   NonEmptyString,
  options:    z.array(NonEmptyString).optional(),
  hypothesis: z.string().optional(),
});

export const AssistantActionSchema = z.discriminatedUnion("type", [
  UpdateShotScriptSchema,
  AddShotSchema,
  RemoveShotSchema,
  ReorderShotsSchema,
  UpdateShotDurationSchema,
  BulkRewriteShotsSchema,
  UpdateProjectStyleNoteSchema,
  AskUserSchema,
]);

export type AssistantAction = z.infer<typeof AssistantActionSchema>;

// ─────────────────────────────────────────────────────────────
// 响应体 schema（模型输出 + API 返回统一用此）
// ─────────────────────────────────────────────────────────────

export const AssistantResponseSchema = z.object({
  reply:       NonEmptyString,
  intent:      NonEmptyString,
  needConfirm: z.boolean(),
  actions:     z.array(AssistantActionSchema),
  suggestions: z.array(NonEmptyString).optional(),
  warnings:    z.array(NonEmptyString).optional(),
});

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

// ─────────────────────────────────────────────────────────────
// API 错误响应
// ─────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error:   string;
  details?: unknown;
}
