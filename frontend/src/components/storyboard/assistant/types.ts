// storyboard/assistant/types.ts
// Storyboard AI Director 前端类型定义
//
// 设计原则：
// - 与 Script assistant (components/assistant/types.ts) 风格保持一致
// - action 使用 discriminated union，便于 TypeScript 穷举检查
// - patch 按模式分类（image / video），通过 mode 字段区分
// - 当前 MVP 仅实现 5 种 action；注释保留未来扩展方向
// - 不依赖完整 Scene 类型，只引入稳定的基础类型

import type { CameraControl } from "../types";

// ─────────────────────────────────────────────────────────────
// 基础枚举
// ─────────────────────────────────────────────────────────────

/** 分镜板当前工作模式：静帧生成 or 视频生成 */
export type StoryboardMode = "image" | "video";

/**
 * 镜头相机运动类型，来自 CameraControl.movement。
 * 集中在此导出，供 VideoShotFieldPatch 和 StoryboardShotSummary 引用。
 */
export type CameraMovement = CameraControl["movement"];

/** 分镜的生成状态（精简自 Scene.generationStatus，供 AI 感知进度） */
export type ShotGenerationStatus =
  | "idle"
  | "generating_image"
  | "image_selected"
  | "generating_video"
  | "completed";

// ─────────────────────────────────────────────────────────────
// Patch 类型（按模式分类）
// ─────────────────────────────────────────────────────────────

/**
 * Image 模式下可修改的分镜字段。
 * 所有字段均为可选；AI 只更新明确提到的字段，不"顺手"修改其他字段。
 *
 * 字段对应 Scene 类型中的同名字段：
 * - visualPrompt → Scene.visualPrompt
 * - size         → Scene.size（景别）
 * - perspective  → Scene.perspective（视角）
 * - equipment    → Scene.equipment（设备）
 * - focalLength  → Scene.focalLength（焦距）
 * - notes        → Scene.notes（备注）
 * - narration    → Scene.narration（旁白/字幕）
 * - dialogue     → Scene.dialogue（对白）
 */
export interface ImageShotFieldPatch {
  mode: "image";
  /** 画面生成提示词 */
  visualPrompt?: string;
  /** 景别（Extreme Long Shot / Long Shot / Medium / Close-up 等） */
  size?: string;
  /** 视角（Eye-level / Low angle / High angle / Bird's eye 等） */
  perspective?: string;
  /** 拍摄设备（Steady cam / Tripod / Handheld / Drone 等） */
  equipment?: string;
  /** 焦距（24mm / 35mm / 50mm / 85mm 等） */
  focalLength?: string;
  /** 导演备注 / 创意说明 */
  notes?: string;
  /** 字幕 / 旁白文案 */
  narration?: string;
  /** 对白 */
  dialogue?: string;
}

/**
 * Video 模式下可修改的分镜字段。
 * 所有字段均为可选；AI 只更新明确提到的字段。
 *
 * 字段对应 Scene 类型中的同名字段：
 * - motionPrompt    → Scene.motionPrompt
 * - cameraMovement  → Scene.smartGeneration.cameraControl.movement
 * - cameraStrength  → Scene.smartGeneration.cameraControl.strength（0~100）
 * - duration        → 视频片段时长（秒，整数）
 * - narration       → Scene.narration（旁白/字幕）
 */
export interface VideoShotFieldPatch {
  mode: "video";
  /** 视频运动提示词 */
  motionPrompt?: string;
  /** 相机运动类型 */
  cameraMovement?: CameraMovement;
  /** 相机运动强度（0~100） */
  cameraStrength?: number;
  /** 视频片段时长（秒，正整数） */
  duration?: number;
  /** 字幕 / 旁白文案 */
  narration?: string;
}

/**
 * 分镜字段 patch 联合类型。
 * 通过 `patch.mode === "image" | "video"` 做穷举类型收窄。
 */
export type ShotFieldPatch = ImageShotFieldPatch | VideoShotFieldPatch;

// ─────────────────────────────────────────────────────────────
// Action 类型（discriminated union）
// ─────────────────────────────────────────────────────────────
//
// 当前 MVP 支持 5 种 action：
//   update_shot_field      — 修改单个分镜的一个或多个字段
//   bulk_update_shots      — 批量修改多个分镜的字段
//   regenerate_shot        — 触发单个分镜的重新生成（图片 or 视频）
//   regenerate_storyboard  — 触发整体分镜板重新生成（高危，需 needConfirm）
//   ask_user               — AI 向用户提问，等待用户回复后再行动
//
// 预留扩展（后续版本实现，当前不添加）：
//   switch_mode            — 在 image/video 模式之间切换
//   add_shot               — 在指定位置新增一个分镜
//   remove_shot            — 删除指定分镜（需 needConfirm）
//   reorder_shots          — 重排分镜顺序
//   update_style_preset    — 更新全局风格预设 / styleNote
// ─────────────────────────────────────────────────────────────

/**
 * 修改单个分镜的一个或多个字段。
 * 约束：
 * - shotId 必须来自 context.shots 中的合法 id，禁止虚构
 * - patch 中至少提供一个字段
 * - patch.mode 须与当前分镜板工作模式一致
 */
export interface UpdateShotFieldAction {
  type: "update_shot_field";
  /** 目标分镜 id（对应 Scene.id） */
  shotId: number;
  patch: ShotFieldPatch;
  /** 改动理由（可选，供 ActionPreview 组件展示） */
  reason?: string;
}

/**
 * 批量修改多个分镜字段。
 * 使用场景：统一风格、整体调整构图参数、批量替换旁白等。
 * 比多个 update_shot_field 更高效，推荐在涉及 2 个以上分镜时使用。
 * 约束：items 不能为空；每个 item 的 patch 至少包含一个字段。
 */
export interface BulkUpdateShotsAction {
  type: "bulk_update_shots";
  items: Array<{
    shotId: number;
    patch: ShotFieldPatch;
  }>;
  /** 整体改写方向说明（可选，供 ActionPreview 展示） */
  reason?: string;
}

/**
 * 触发单个分镜重新生成图片或视频。
 * 仅发出"重新生成"指令，不修改 prompt 字段。
 * 若需同时修改 prompt 后再生成，请配合 update_shot_field 使用。
 * 约束：target 须与当前分镜板工作模式一致。
 */
export interface RegenerateShotAction {
  type: "regenerate_shot";
  /** 目标分镜 id */
  shotId: number;
  /** 重新生成目标：image（重新生成分镜图）or video（重新生成视频片段） */
  target: "image" | "video";
  /** 触发重新生成的原因（可选） */
  reason?: string;
}

/**
 * 触发整体分镜板重新生成。
 * 使用场景：用户要求"重新规划所有分镜"或"按新风格重新生成全部"。
 * ⚠️ 此操作影响范围大，needConfirm 必须设为 true。
 */
export interface RegenerateStoryboardAction {
  type: "regenerate_storyboard";
  /** 重新生成的目标模式（image 或 video） */
  mode: StoryboardMode;
  /**
   * 可选：传给生成服务的全局风格覆盖说明。
   * 若不提供，则沿用当前项目的 styleNote。
   */
  styleNote?: string;
  reason?: string;
}

/**
 * AI 向用户提问（不触发任何数据修改）。
 * 当指令模糊、缺少关键信息（如未指定修改哪个分镜）或存在多个合理方向时使用。
 * 优先 ask_user，而不是猜测后直接修改。
 */
export interface AskUserDirectorAction {
  type: "ask_user";
  /** 清晰的问题文本 */
  question: string;
  /** 可点击的预设选项（可选，引导用户快速回复） */
  options?: string[];
  /** AI 当前的推断（可选，展示给用户参考，提升透明度） */
  hypothesis?: string;
}

/**
 * Storyboard AI Director 支持的全部 action（discriminated union）。
 * 消费方可通过 `action.type` 做完整穷举，TypeScript 会在新增 action 时提示遗漏分支。
 */
export type StoryboardAction =
  | UpdateShotFieldAction
  | BulkUpdateShotsAction
  | RegenerateShotAction
  | RegenerateStoryboardAction
  | AskUserDirectorAction;

// ─────────────────────────────────────────────────────────────
// 响应类型
// ─────────────────────────────────────────────────────────────

/**
 * AI Director 的响应结构。
 * 与 Script assistant 的 AssistantResponse 保持对齐。
 * 后端 JSON 输出 & 前端解析器的目标类型均使用此接口。
 */
export interface StoryboardAssistantResponse {
  /** 向用户展示的自然语言回复（中文，100 字以内，自然友好） */
  reply: string;
  /** 本次操作意图的简短描述，供 ActionPreview 标题使用（不超过 20 字） */
  intent: string;
  /**
   * 是否需要用户二次确认。
   * 以下情况必须为 true：
   * - 包含 regenerate_storyboard
   * - bulk_update_shots 涉及超过 3 个分镜
   * - 任何批量不可逆操作
   */
  needConfirm: boolean;
  /** 结构化操作数组；无操作时为空数组 [] */
  actions: StoryboardAction[];
  /** 后续操作建议，最多 3 条（可选） */
  suggestions?: string[];
  /** 潜在风险或注意事项（可选） */
  warnings?: string[];
}

// ─────────────────────────────────────────────────────────────
// 消息类型
// ─────────────────────────────────────────────────────────────

/** 消息发送方角色 */
export type DirectorRole = "user" | "assistant" | "system";

/**
 * 消息流状态，用于 UI 反馈。
 * - pending：消息已发出，等待响应
 * - streaming：正在流式接收（预留，当前 API 为非流式）
 * - done：消息已完成
 * - error：消息发送 / 解析失败
 */
export type DirectorMessageStatus = "pending" | "streaming" | "done" | "error";

/**
 * 附加在消息上的元数据（可选）。
 * 用于调试、日志和未来功能扩展，不影响核心功能。
 */
export interface DirectorMessageMeta {
  /** 消息对应的 action 类型（供日志 / 分析使用） */
  actionType?: StoryboardAction["type"];
  /** 本条消息触发的操作数量 */
  actionCount?: number;
  /** 响应解析是否降级（parseOk=false 表示触发了 fallback） */
  parseOk?: boolean;
  /** 自定义扩展字段（避免 any，使用 unknown） */
  [key: string]: unknown;
}

/**
 * Storyboard AI Director 的对话消息。
 * 与 Script assistant 的 AssistantMessage 保持结构对齐，
 * 扩展了 meta 字段（携带 storyboard 专属调试信息）和 system 角色支持。
 */
export interface DirectorMessage {
  id: string;
  role: DirectorRole;
  content: string;
  /** ISO 8601 时间字符串 */
  timestamp: string;
  status: DirectorMessageStatus;
  /** 后续操作建议（assistant 消息专用，来自 response.suggestions） */
  suggestions?: string[];
  /** 附加元数据（可选，调试 / 日志 / 扩展用途） */
  meta?: DirectorMessageMeta;
}

// ─────────────────────────────────────────────────────────────
// 面板状态类型
// ─────────────────────────────────────────────────────────────

/**
 * AI Director 面板的操作状态机。
 *
 * 状态流转：
 *   idle ──[sendMessage]──► thinking
 *   thinking ──[API 成功, 有 actions]──► awaiting-confirm
 *   thinking ──[API 成功, 无 actions]──► idle
 *   thinking ──[API 失败]──► error
 *   awaiting-confirm ──[confirm]──► applying → idle
 *   awaiting-confirm ──[cancel]──► idle
 *   error ──[retry]──► thinking
 *
 * streaming：预留给未来 streaming API，当前不使用。
 */
export type DirectorPanelActionStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "awaiting-confirm"
  | "applying"
  | "error";

// ─────────────────────────────────────────────────────────────
// Context 类型（发送给后端 AI 的上下文）
// ─────────────────────────────────────────────────────────────
//
// ⚠️ 注意：实际 API 发送的 context 类型为 `StoryboardContextPayload`，
//    定义在 buildStoryboardContext.ts。以下 StoryboardShotSummary 仅供
//    构建函数内部使用，不直接作为 API body 发送。
//
// ─────────────────────────────────────────────────────────────

/**
 * 单个分镜的精简摘要，供 AI 推理使用。
 *
 * 设计目标：
 * - 比完整 Scene 类型更紧凑，减少 token 消耗
 * - null 表示字段尚未填写（区别于空字符串），便于 AI 识别待填写项
 * - 同时包含 image 和 video 模式专属字段，由 AI 按当前 mode 选择性读取
 */
export interface StoryboardShotSummary {
  /** 对应 Scene.id */
  id: number;
  /** 分镜在序列中的位置（从 1 开始） */
  order: number;
  /** 当前生成阶段（供 AI 判断是否建议重新生成） */
  generationStatus: ShotGenerationStatus;

  // ── 通用字段（image / video 均有效）────────────────────────
  /** 旁白 / 字幕文案；null 表示未填写 */
  narration: string | null;

  // ── Image 模式专属字段 ────────────────────────────────────
  /** 画面生成提示词；null 表示未填写 */
  visualPrompt: string | null;
  /** 景别；null 表示未设定 */
  size: string | null;
  /** 视角；null 表示未设定 */
  perspective: string | null;
  /** 拍摄设备；null 表示未设定 */
  equipment: string | null;
  /** 焦距；null 表示未设定 */
  focalLength: string | null;
  /** 备注；null 表示无备注 */
  notes: string | null;
  /** 对白；null 表示无对白 */
  dialogue: string | null;

  // ── Video 模式专属字段 ────────────────────────────────────
  /** 视频运动提示词；null 表示未填写 */
  motionPrompt: string | null;
  /** 相机运动类型；null 表示未设定 */
  cameraMovement: CameraMovement | null;
  /** 相机运动强度（0~100）；null 表示未设定 */
  cameraStrength: number | null;
  /** 视频片段时长（秒）；null 表示未设定 */
  duration: number | null;
}

// ⚠️ 注意：`StoryboardContext`（原设计稿中的接口）已废弃，勿在此处重新定义。
// 实际 API 使用的上下文类型请直接使用 buildStoryboardContext.ts 中的 StoryboardContextPayload。
// useStoryboardAssistant.ts 和 storyboardAssistantApi.ts 均使用 StoryboardContextPayload。
