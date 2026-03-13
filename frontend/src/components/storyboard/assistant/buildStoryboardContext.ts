// storyboard/assistant/buildStoryboardContext.ts
// 纯函数：将当前 storyboard UI 状态序列化为发送给 AI Director 的精简 context 对象
//
// 设计原则（与 buildScriptAssistantContext.ts 保持风格一致）：
// - 纯函数，无副作用，输入相同则输出相同
// - token 控制：按模式只保留当前模式相关的 shot 字段（image/video 字段互斥）
// - 容错：字段缺失或格式异常时给合理默认值，永不抛出异常

import type { Scene } from "../types";
import type { StoryboardMode, CameraMovement } from "./types";

// ─────────────────────────────────────────────────────────────
// 内部 shot 摘要类型（按模式精简，仅保留 AI 推理所需字段）
// ─────────────────────────────────────────────────────────────

/**
 * Image 模式下发送给 AI 的分镜摘要。
 * 省略 video 专属字段（motionPrompt / cameraMovement 等），节省 token。
 */
export interface ImageContextShot {
  id: number;
  order: number;
  /** null 表示尚未填写 */
  visualPrompt: string | null;
  size: string | null;
  perspective: string | null;
  equipment: string | null;
  focalLength: string | null;
  narration: string | null;
  notes: string | null;
}

/**
 * Video 模式下发送给 AI 的分镜摘要。
 * 省略 image 专属字段（visualPrompt / size / perspective 等），节省 token。
 */
export interface VideoContextShot {
  id: number;
  order: number;
  /** 片段时长（秒）；null 表示未设定 */
  duration: number | null;
  /** null 表示尚未填写 */
  motionPrompt: string | null;
  /** null 表示未设定 */
  cameraMovement: CameraMovement | null;
  /** 0~100；null 表示未设定 */
  cameraStrength: number | null;
  narration: string | null;
}

// ─────────────────────────────────────────────────────────────
// Context Payload 类型（发送给 AI API 的最终 context 对象）
// ─────────────────────────────────────────────────────────────

/** Image 模式 context payload */
export interface ImageStoryboardContextPayload {
  page: "storyboard";
  mode: "image";
  projectId: string;
  projectTitle: string;
  /** 总分镜数 */
  totalShots: number;
  /**
   * 总时长格式化字符串，精确到小数点后一位，如 "50.0s"。
   * 由各分镜 duration 累加后格式化得到。
   */
  totalDuration: string;
  /**
   * 分镜完成率（0~1）：已有非空 visualPrompt 的分镜占比。
   * 例：0.8 = 80% 的分镜已有画面提示词。
   */
  completionRate: number;
  /**
   * 当前选中分镜的排列序号（从 1 开始）；
   * null 表示全局模式或找不到对应分镜。
   */
  selectedShotOrder: number | null;
  /** 当前选中分镜的原始 id（Scene.id）；null 表示全局模式 */
  selectedShotId: number | null;
  /**
   * Image 模式可编辑字段的说明文字，适合直接注入到 AI system prompt。
   * 描述所有可通过 update_shot_field / bulk_update_shots 修改的字段及取值范围。
   */
  modeSchema: string;
  shots: ImageContextShot[];
  /** 最近一次操作摘要（可选，供 AI 感知对话连续性） */
  lastActionSummary?: string;
}

/** Video 模式 context payload */
export interface VideoStoryboardContextPayload {
  page: "storyboard";
  mode: "video";
  projectId: string;
  projectTitle: string;
  totalShots: number;
  totalDuration: string;
  /**
   * 分镜完成率（0~1）：已有非空 motionPrompt 的分镜占比。
   */
  completionRate: number;
  selectedShotOrder: number | null;
  selectedShotId: number | null;
  /**
   * Video 模式可编辑字段的说明文字，适合直接注入到 AI system prompt。
   */
  modeSchema: string;
  shots: VideoContextShot[];
  lastActionSummary?: string;
}

/**
 * Storyboard AI Director context payload 联合类型。
 * 通过 `payload.mode` 做穷举收窄：
 * - `"image"` → shots 为 ImageContextShot[]
 * - `"video"` → shots 为 VideoContextShot[]
 */
export type StoryboardContextPayload =
  | ImageStoryboardContextPayload
  | VideoStoryboardContextPayload;

// ─────────────────────────────────────────────────────────────
// 函数选项（可选扩展参数，不影响主要签名）
// ─────────────────────────────────────────────────────────────

export interface BuildStoryboardContextOptions {
  /**
   * 项目 ID，用于后端日志和请求追踪。
   * 默认为空字符串（调用方可按需注入）。
   */
  projectId?: string;
  /**
   * 最近一次操作的简短摘要，供 AI 感知连续性。
   * 例："刚刚批量更新了 shot 2、3、4 的 visualPrompt"。
   */
  lastActionSummary?: string;
}

// ─────────────────────────────────────────────────────────────
// 私有工具函数
// ─────────────────────────────────────────────────────────────

/**
 * 将 null / undefined / 纯空格字符串 统一转为 null。
 * 空占位让 AI 明确知道"该字段尚未填写"，区别于空字符串。
 */
const nullIfEmpty = (s: string | null | undefined): string | null =>
  !s || s.trim() === "" ? null : s;

/**
 * 解析 Scene.duration（string 类型）为秒数（number）。
 *
 * 支持格式：
 * - 纯数字字符串："5"、"5.0"、"10.5"
 * - 带 "s" 单位："5s"、"10.5s"（大小写均可）
 *
 * 容错：空值、NaN、负数均返回 0。
 */
function parseDurationToSeconds(raw: string | undefined): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = raw.trim().replace(/s$/i, "");
  const val = parseFloat(cleaned);
  return isNaN(val) || val < 0 ? 0 : val;
}

/**
 * 将总秒数格式化为带单位字符串，保留一位小数。
 * 例：50 → "50.0s"；3.14159 → "3.1s"
 */
function formatTotalDuration(totalSeconds: number): string {
  return `${totalSeconds.toFixed(1)}s`;
}

/**
 * 按模式计算分镜完成率（0~1）。
 * - image 模式：已有非空 visualPrompt 的分镜比例
 * - video 模式：已有非空 motionPrompt 的分镜比例
 * - scenes 为空时返回 0
 */
function calcCompletionRate(scenes: Scene[], mode: StoryboardMode): number {
  if (scenes.length === 0) return 0;
  const count = scenes.filter((s) =>
    mode === "image"
      ? s.visualPrompt.trim() !== ""
      : s.motionPrompt.trim() !== ""
  ).length;
  return Math.round((count / scenes.length) * 100) / 100;
}

/**
 * 将单个 Scene 转为 image 模式的精简摘要。
 * order 由调用方传入（1-based 的数组索引），不依赖 Scene 自身是否有 order 字段。
 */
function toImageContextShot(scene: Scene, order: number): ImageContextShot {
  return {
    id:           scene.id,
    order,
    visualPrompt: nullIfEmpty(scene.visualPrompt),
    size:         nullIfEmpty(scene.size),
    perspective:  nullIfEmpty(scene.perspective),
    equipment:    nullIfEmpty(scene.equipment),
    focalLength:  nullIfEmpty(scene.focalLength),
    narration:    nullIfEmpty(scene.narration),
    notes:        nullIfEmpty(scene.notes),
  };
}

/**
 * 将单个 Scene 转为 video 模式的精简摘要。
 * cameraMovement / cameraStrength 来自 scene.smartGeneration?.cameraControl，
 * 若该嵌套字段不存在，则填 null。
 */
function toVideoContextShot(scene: Scene, order: number): VideoContextShot {
  const cam = scene.smartGeneration?.cameraControl;
  const durationSec = parseDurationToSeconds(scene.duration);
  return {
    id:             scene.id,
    order,
    // duration 为 0 时视为"未设定"，返回 null 更利于 AI 识别
    duration:       durationSec > 0 ? durationSec : null,
    motionPrompt:   nullIfEmpty(scene.motionPrompt),
    cameraMovement: cam?.movement ?? null,
    cameraStrength: cam?.strength ?? null,
    narration:      nullIfEmpty(scene.narration),
  };
}

// ─────────────────────────────────────────────────────────────
// modeSchema 常量（注入 AI prompt 的字段说明文字）
// ─────────────────────────────────────────────────────────────

/**
 * Image 模式的字段说明。
 * 描述 update_shot_field / bulk_update_shots 中 patch.mode="image" 时
 * 所有可修改字段的名称、含义及示例值。
 */
const IMAGE_MODE_SCHEMA =
  '当前模式：image（分镜静帧生成）。' +
  'patch.mode 必须为 "image"，可编辑字段（均为可选，至少提供一个）：' +
  'visualPrompt（画面生成提示词，输入图像生成模型）、' +
  'size（景别：Extreme Long Shot / Long Shot / Medium / Close-up / Extreme Close-up 等）、' +
  'perspective（视角：Eye-level / Low angle / High angle / Bird\'s eye / Dutch angle 等）、' +
  'equipment（设备：Steady cam / Tripod / Handheld / Dolly / Drone 等）、' +
  'focalLength（焦距：14mm / 24mm / 35mm / 50mm / 85mm / 135mm 等）、' +
  'narration（旁白 / 字幕文案）、' +
  'notes（导演备注 / 创意说明）、' +
  'dialogue（角色对白）。';

/**
 * Video 模式的字段说明。
 * 描述 update_shot_field / bulk_update_shots 中 patch.mode="video" 时
 * 所有可修改字段的名称、含义及合法取值范围。
 */
const VIDEO_MODE_SCHEMA =
  '当前模式：video（视频片段生成）。' +
  'patch.mode 必须为 "video"，可编辑字段（均为可选，至少提供一个）：' +
  'motionPrompt（视频运动提示词，输入视频生成模型）、' +
  'cameraMovement（相机运动类型，合法值：' +
  'none / pan_left / pan_right / tilt_up / tilt_down / zoom_in / zoom_out / roll / drone）、' +
  'cameraStrength（运动强度，0~100 整数，0=静止，100=最大运动幅度）、' +
  'duration（片段时长，正整数，单位秒）、' +
  'narration（旁白 / 字幕文案）。';

// ─────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────

/**
 * 将当前 storyboard UI 状态序列化为发送给 AI Director 的精简 context 对象。
 *
 * ## Token 控制策略
 * - 按模式只保留相关 shot 字段（image/video 字段互斥，避免冗余 null 占位）
 * - 空字段转 null，JSON 序列化后更紧凑
 * - modeSchema 说明文字可直接嵌入 system prompt，无需二次处理
 * - selectedShotOrder 让 AI 无需从 shots 列表中二次查找选中分镜
 *
 * ## 容错策略
 * - `scenes` 为空时正常返回（totalShots=0，shots=[]，completionRate=0）
 * - `duration` 字段无法解析时按 0 处理（video 摘要中转为 null）
 * - `smartGeneration.cameraControl` 不存在时 cameraMovement/cameraStrength 为 null
 * - `selectedShotId` 在 scenes 中不存在时，selectedShotOrder 返回 null
 *
 * @param scenes          当前所有分镜数据（顺序即为显示顺序，index+1 为 order）
 * @param mode            分镜板工作模式（"image" | "video"）
 * @param selectedShotId  当前单选的分镜 Scene.id；null 表示全局模式
 * @param projectTitle    项目名称（注入 prompt 的上下文描述）
 * @param options         可选扩展参数（projectId / lastActionSummary）
 */
export function buildStoryboardContext(
  scenes: Scene[],
  mode: StoryboardMode,
  selectedShotId: number | null,
  projectTitle: string,
  options: BuildStoryboardContextOptions = {}
): StoryboardContextPayload {
  const { projectId = "", lastActionSummary } = options;

  // ── 统计基础数据 ───────────────────────────────────────────

  const totalSeconds = scenes.reduce(
    (sum, s) => sum + parseDurationToSeconds(s.duration),
    0
  );
  const totalDuration  = formatTotalDuration(totalSeconds);
  const completionRate = calcCompletionRate(scenes, mode);

  // ── 查找选中分镜的 1-based order ─────────────────────────
  const selectedShotOrder: number | null = (() => {
    if (selectedShotId === null) return null;
    const idx = scenes.findIndex((s) => s.id === selectedShotId);
    return idx === -1 ? null : idx + 1;
  })();

  // ── 构建共用基础字段（两种模式共享）─────────────────────
  const base = {
    page:              "storyboard" as const,
    projectId,
    projectTitle,
    totalShots:        scenes.length,
    totalDuration,
    completionRate,
    selectedShotOrder,
    selectedShotId,
    // 只在存在时注入，避免给 AI 看到空的 lastActionSummary
    ...(lastActionSummary !== undefined ? { lastActionSummary } : {}),
  };

  // ── 按模式分支，构建模式专属字段 ─────────────────────────
  if (mode === "image") {
    return {
      ...base,
      mode:       "image",
      modeSchema: IMAGE_MODE_SCHEMA,
      shots:      scenes.map((s, i) => toImageContextShot(s, i + 1)),
    };
  }

  return {
    ...base,
    mode:       "video",
    modeSchema: VIDEO_MODE_SCHEMA,
    shots:      scenes.map((s, i) => toVideoContextShot(s, i + 1)),
  };
}

// ─────────────────────────────────────────────────────────────
// ⚠️ 注意：此 context 专为 Storyboard AI Director 设计。
//
// 与 Script assistant 的 ScriptAssistantContext 的主要差异：
// - shots 按模式（image/video）只保留相关字段，两种模式字段互斥
// - 新增 totalDuration（格式化字符串）、selectedShotOrder、modeSchema 字段
// - shotCount 在此命名为 totalShots，语义更直观
// - 不包含 selectedShotSummary（改用 selectedShotOrder 减少冗余）
//
// 请勿将此 context 用于 Script assistant 的 API 请求，
// 也不应将 ScriptAssistantContext 直接迁移复用于分镜板场景。
// ─────────────────────────────────────────────────────────────
