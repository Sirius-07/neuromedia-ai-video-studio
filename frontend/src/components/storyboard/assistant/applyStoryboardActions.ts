// storyboard/assistant/applyStoryboardActions.ts
// 纯函数：将 AI Director 返回的 StoryboardAction[] 应用到 Scene[] 上
//
// 设计原则：
// - immutable 更新，返回新 scenes 数组，原数组不变
// - 无副作用，不调用网络请求，不触发任何生成逻辑
// - shot（即 Scene）不存在时写入 warnings 并跳过，不抛出异常
// - generationStatus 只使用 Scene.generationStatus 的合法值：
//   'idle' | 'generating_image' | 'image_selected' | 'generating_video' | 'completed'

import type { Scene, CameraControl } from "../types";
import type {
  StoryboardAction,
  UpdateShotFieldAction,
  BulkUpdateShotsAction,
  RegenerateShotAction,
  RegenerateStoryboardAction,
  ImageShotFieldPatch,
  VideoShotFieldPatch,
  ShotFieldPatch,
} from "./types";

// Scene.generationStatus 的合法取值（直接从 Scene 类型派生，避免重复定义）
type GenerationStatus = Scene["generationStatus"];

// ─────────────────────────────────────────────────────────────
// 公开返回值类型
// ─────────────────────────────────────────────────────────────

/** 被跳过的 action 及其原因（供调用方展示 / 日志） */
export interface SkippedAction {
  action: StoryboardAction;
  reason: string;
}

/** applyStoryboardActions 的完整输出 */
export interface ApplyStoryboardActionsResult {
  /** 应用所有合法 actions 后的新 scenes 数组（原数组不变） */
  nextScenes:      Scene[];
  /** 成功执行的 actions */
  appliedActions:  StoryboardAction[];
  /** 被跳过的 actions 及跳过原因 */
  skippedActions:  SkippedAction[];
  /** 人类可读的警告信息（包含跳过原因、降级处理等） */
  warnings:        string[];
  /** 被实际修改的 scene id 列表（已去重，顺序不保证） */
  affectedShotIds: number[];
}

// ─────────────────────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────────────────────

/** 单条 action 处理的内部结果 */
type MutationOk   = { ok: true;  scenes: Scene[];  affectedIds: number[];  warnings?: string[] };
type MutationFail = { ok: false; reason: string };
type MutationResult = MutationOk | MutationFail;

/** action 循环中的累积器 */
interface Accumulator {
  scenes:      Scene[];
  applied:     StoryboardAction[];
  skipped:     SkippedAction[];
  warnings:    string[];
  affectedSet: Set<number>;
}

// ─────────────────────────────────────────────────────────────
// 私有工具函数
// ─────────────────────────────────────────────────────────────

/** 将单条 mutation 结果派发到 accumulator */
function dispatch(
  result: MutationResult,
  action: StoryboardAction,
  acc: Accumulator
): void {
  if (!result.ok) {
    acc.skipped.push({ action, reason: result.reason });
    acc.warnings.push(result.reason);
    return;
  }
  acc.scenes = result.scenes;
  result.affectedIds.forEach((id) => acc.affectedSet.add(id));
  if (result.warnings) acc.warnings.push(...result.warnings);
  acc.applied.push(action);
}

/**
 * 将 ImageShotFieldPatch 应用到 scene（immutable）。
 * 只更新 patch 中 !== undefined 的字段，不覆盖未提及的字段。
 *
 * patch 字段 → Scene 字段映射：
 * - visualPrompt → Scene.visualPrompt
 * - size         → Scene.size
 * - perspective  → Scene.perspective
 * - equipment    → Scene.equipment
 * - focalLength  → Scene.focalLength
 * - notes        → Scene.notes
 * - narration    → Scene.narration
 * - dialogue     → Scene.dialogue
 */
function applyImagePatch(scene: Scene, patch: ImageShotFieldPatch): Scene {
  const update: Partial<Scene> = {};
  if (patch.visualPrompt !== undefined) update.visualPrompt = patch.visualPrompt;
  if (patch.size         !== undefined) update.size         = patch.size;
  if (patch.perspective  !== undefined) update.perspective  = patch.perspective;
  if (patch.equipment    !== undefined) update.equipment    = patch.equipment;
  if (patch.focalLength  !== undefined) update.focalLength  = patch.focalLength;
  if (patch.notes        !== undefined) update.notes        = patch.notes;
  if (patch.narration    !== undefined) update.narration    = patch.narration;
  if (patch.dialogue     !== undefined) update.dialogue     = patch.dialogue;
  return { ...scene, ...update };
}

/**
 * 将 VideoShotFieldPatch 应用到 scene（immutable）。
 *
 * 特殊处理：
 * 1. cameraMovement / cameraStrength：写入 scene.smartGeneration.cameraControl（深层 immutable 更新）
 *    - 只修改其中一个时保留另一个的原值
 *    - smartGeneration 不存在时自动初始化
 * 2. duration（patch 中为 number 秒）→ Scene.duration（string）
 *
 * patch 字段 → Scene 字段映射：
 * - motionPrompt   → Scene.motionPrompt
 * - cameraMovement → Scene.smartGeneration.cameraControl.movement
 * - cameraStrength → Scene.smartGeneration.cameraControl.strength
 * - duration       → Scene.duration（number → String(n)）
 * - narration      → Scene.narration
 */
function applyVideoPatch(scene: Scene, patch: VideoShotFieldPatch): Scene {
  const update: Partial<Scene> = {};

  if (patch.motionPrompt !== undefined) update.motionPrompt = patch.motionPrompt;
  if (patch.narration    !== undefined) update.narration    = patch.narration;
  // duration：AI 给出的数字（秒）→ Scene.duration 字符串
  if (patch.duration     !== undefined) update.duration     = String(patch.duration);

  // cameraMovement / cameraStrength 需要嵌套更新 smartGeneration.cameraControl
  // 使用已有值作为默认值，避免覆盖未被修改的字段
  if (patch.cameraMovement !== undefined || patch.cameraStrength !== undefined) {
    const existingCam = scene.smartGeneration?.cameraControl;
    const newCam: CameraControl = {
      movement: patch.cameraMovement ?? existingCam?.movement ?? "none",
      strength: patch.cameraStrength ?? existingCam?.strength ?? 0,
    };
    update.smartGeneration = {
      ...scene.smartGeneration,
      cameraControl: newCam,
    };
  }

  return { ...scene, ...update };
}

/** 根据 patch.mode 分派到对应的 patch 应用函数 */
function applyPatch(scene: Scene, patch: ShotFieldPatch): Scene {
  if (patch.mode === "image") return applyImagePatch(scene, patch);
  return applyVideoPatch(scene, patch);
}

/**
 * 计算 regenerate 操作后的目标 generationStatus。
 *
 * - target = "image"：重置到 "idle"（从头生成分镜图）
 * - target = "video"：若图片阶段已完成（image_selected / generating_video / completed），
 *                     重置到 "image_selected"（保留图片，重新生成视频）；
 *                     否则降级到 "idle"（图片都还没有，无法只重置视频）
 */
function resolveRegenerateStatus(
  scene: Scene,
  target: "image" | "video"
): GenerationStatus {
  if (target === "image") return "idle";

  const hasSelectedImage =
    scene.generationStatus === "image_selected" ||
    scene.generationStatus === "generating_video" ||
    scene.generationStatus === "completed";

  return hasSelectedImage ? "image_selected" : "idle";
}

// ─────────────────────────────────────────────────────────────
// 单 action 处理器
// ─────────────────────────────────────────────────────────────

/**
 * 修改单个分镜字段。
 * shotId 不存在时返回失败，调用方负责写入 warning。
 */
function applyUpdateShotField(
  scenes: Scene[],
  action: UpdateShotFieldAction
): MutationResult {
  const idx = scenes.findIndex((s) => s.id === action.shotId);
  if (idx === -1) {
    return {
      ok:     false,
      reason: `update_shot_field: id=${action.shotId} 的分镜不存在，已跳过`,
    };
  }

  const updated = applyPatch(scenes[idx], action.patch);
  return {
    ok:          true,
    scenes:      scenes.map((s, i) => (i === idx ? updated : s)),
    affectedIds: [action.shotId],
  };
}

/**
 * 批量修改多个分镜字段。
 *
 * 容错策略：
 * - 部分 shotId 不存在 → 跳过该条目，其余正常执行 + warning
 * - 全部 shotId 不存在 → 整条 action 失败
 * - 使用 id → index Map 保证 O(1) 查找（bulk 场景性能更好）
 */
function applyBulkUpdateShots(
  scenes: Scene[],
  action: BulkUpdateShotsAction
): MutationResult {
  const idxMap  = new Map(scenes.map((s, i) => [s.id, i]));
  const warnings: string[] = [];
  const affectedIds: number[] = [];

  // 浅克隆以支持 immutable 更新
  const nextScenes = [...scenes];

  for (const item of action.items) {
    const idx = idxMap.get(item.shotId);
    if (idx === undefined) {
      warnings.push(
        `bulk_update_shots: id=${item.shotId} 的分镜不存在，该条目已跳过`
      );
      continue;
    }
    nextScenes[idx] = applyPatch(nextScenes[idx], item.patch);
    affectedIds.push(item.shotId);
  }

  if (affectedIds.length === 0) {
    return {
      ok:     false,
      reason: "bulk_update_shots: 所有 items 的 shotId 均不存在，整条 action 已跳过",
    };
  }

  return {
    ok:          true,
    scenes:      nextScenes,
    affectedIds,
    warnings:    warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 将单个分镜标记为"待重新生成"。
 * 不调用任何生成 API，只修改 generationStatus 和相关清理字段。
 *
 * target = "image"：
 *   - generationStatus → "idle"（从头生成分镜图）
 *   - 清除 selectedImageIndex（旧图已作废）
 *
 * target = "video"：
 *   - generationStatus → "image_selected"（图片保留，重新生成视频）
 *                        或 "idle"（若图片阶段尚未完成）
 *   - 清除 videoUrl（旧视频已作废）
 */
function applyRegenerateShot(
  scenes: Scene[],
  action: RegenerateShotAction
): MutationResult {
  const idx = scenes.findIndex((s) => s.id === action.shotId);
  if (idx === -1) {
    return {
      ok:     false,
      reason: `regenerate_shot: id=${action.shotId} 的分镜不存在，已跳过`,
    };
  }

  const scene     = scenes[idx];
  const newStatus = resolveRegenerateStatus(scene, action.target);

  const updated: Scene = {
    ...scene,
    generationStatus: newStatus,
    // 重新生成图片：清除已选图片索引
    ...(action.target === "image"
      ? { selectedImageIndex: undefined }
      : {}),
    // 重新生成视频：清除现有视频 URL
    ...(action.target === "video"
      ? { videoUrl: undefined }
      : {}),
  };

  return {
    ok:          true,
    scenes:      scenes.map((s, i) => (i === idx ? updated : s)),
    affectedIds: [action.shotId],
  };
}

/**
 * 将全部分镜标记为"待重新生成"。
 * 不调用任何生成 API，只修改各 scene 的状态字段。
 *
 * mode = "image"：
 *   - 所有 scene → generationStatus: "idle"
 *   - 清除 selectedImageIndex、videoUrl（全部从头生成）
 *
 * mode = "video"：
 *   - 已完成图片的 scene → generationStatus: "image_selected"（保留图片）
 *   - 尚未生成图片的 scene → generationStatus: "idle"（必须先生成图片）
 *   - 清除 videoUrl
 */
function applyRegenerateStoryboard(
  scenes: Scene[],
  action: RegenerateStoryboardAction
): MutationResult {
  const nextScenes = scenes.map((scene): Scene => {
    if (action.mode === "image") {
      return {
        ...scene,
        generationStatus:   "idle",
        selectedImageIndex: undefined,
        videoUrl:           undefined,
      };
    }

    // video 模式：按每个 scene 的当前状态决定目标 generationStatus
    const newStatus = resolveRegenerateStatus(scene, "video");
    return {
      ...scene,
      generationStatus: newStatus,
      videoUrl:         undefined,
    };
  });

  return {
    ok:          true,
    scenes:      nextScenes,
    affectedIds: scenes.map((s) => s.id),
  };
}

// ─────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────

/**
 * 将 AI Director 返回的 StoryboardAction[] 依次应用到 scenes 上。
 *
 * - immutable：输入的 scenes 数组及其元素不会被修改
 * - 无副作用：不调用网络、不触发生成逻辑，只做数据变换
 * - 容错：单条 action 失败（如 shotId 不存在）不影响其余 action 的执行
 * - exhaustive check：新增 action type 时 TypeScript 会在 default 分支报错
 *
 * @param scenes   当前分镜板的 Scene 数组
 * @param actions  AI Director 返回的操作列表
 */
export function applyStoryboardActions(
  scenes: Scene[],
  actions: StoryboardAction[]
): ApplyStoryboardActionsResult {
  const acc: Accumulator = {
    scenes:      [...scenes],
    applied:     [],
    skipped:     [],
    warnings:    [],
    affectedSet: new Set<number>(),
  };

  for (const action of actions) {
    switch (action.type) {

      case "update_shot_field":
        dispatch(applyUpdateShotField(acc.scenes, action), action, acc);
        break;

      case "bulk_update_shots":
        dispatch(applyBulkUpdateShots(acc.scenes, action), action, acc);
        break;

      case "regenerate_shot":
        dispatch(applyRegenerateShot(acc.scenes, action), action, acc);
        break;

      case "regenerate_storyboard":
        dispatch(applyRegenerateStoryboard(acc.scenes, action), action, acc);
        break;

      case "ask_user":
        // ask_user 不修改数据，静默记录并跳过
        acc.skipped.push({
          action,
          reason: "ask_user 不触发数据变更，等待用户回复",
        });
        break;

      default: {
        // TypeScript exhaustive check：新增 action type 未处理时编译期报错
        const _exhaustive: never = action;
        acc.warnings.push(
          `未知 action type: "${(_exhaustive as StoryboardAction).type}"，已忽略`
        );
      }
    }
  }

  return {
    nextScenes:      acc.scenes,
    appliedActions:  acc.applied,
    skippedActions:  acc.skipped,
    warnings:        acc.warnings,
    affectedShotIds: Array.from(acc.affectedSet),
  };
}

// ─────────────────────────────────────────────────────────────
// 辅助导出函数
// ─────────────────────────────────────────────────────────────

/**
 * 判断 actions 列表中是否包含任意重新生成类 action。
 * 可用于 Hook 层决定是否需要在应用后触发生成流程。
 *
 * @example
 * if (hasRegenerateActions(actions)) {
 *   triggerGenerationPipeline(nextScenes, affectedShotIds);
 * }
 */
export function hasRegenerateActions(actions: StoryboardAction[]): boolean {
  return actions.some(
    (a) => a.type === "regenerate_shot" || a.type === "regenerate_storyboard"
  );
}

/** extractRegenerateTargets 的返回类型 */
export interface RegenerateTargets {
  /**
   * 全局重新生成 action（regenerate_storyboard），若存在则取第一个。
   * null 表示本次 actions 中无全局重生成指令。
   */
  globalRegenerate:  RegenerateStoryboardAction | null;
  /** 所有单镜头重新生成 action 列表（regenerate_shot） */
  shotRegenerates:   RegenerateShotAction[];
  /** 被点名重新生成的 shot id 列表（仅来自 regenerate_shot，不含全局）*/
  targetShotIds:     number[];
  /** 是否有任何 image 目标的重新生成（单镜头 or 全局 image 模式） */
  includesImage:     boolean;
  /** 是否有任何 video 目标的重新生成（单镜头 or 全局 video 模式） */
  includesVideo:     boolean;
}

/**
 * 从 actions 列表中提取所有重新生成相关的信息，便于调用方决策。
 *
 * 使用场景示例：
 * - 决定本次操作后是否需要触发图片生成流程
 * - 计算需要重新生成的 shot 范围
 * - 在 ActionPreview 中展示重新生成的影响范围
 *
 * @example
 * const { globalRegenerate, shotRegenerates, includesVideo } =
 *   extractRegenerateTargets(response.actions);
 * if (globalRegenerate) {
 *   showGlobalRegenerateWarning(globalRegenerate.mode);
 * }
 */
export function extractRegenerateTargets(
  actions: StoryboardAction[]
): RegenerateTargets {
  const globalRegenerate =
    (actions.find(
      (a): a is RegenerateStoryboardAction => a.type === "regenerate_storyboard"
    ) ?? null);

  const shotRegenerates = actions.filter(
    (a): a is RegenerateShotAction => a.type === "regenerate_shot"
  );

  const targetShotIds = shotRegenerates.map((a) => a.shotId);

  const includesImage =
    shotRegenerates.some((a) => a.target === "image") ||
    globalRegenerate?.mode === "image";

  const includesVideo =
    shotRegenerates.some((a) => a.target === "video") ||
    globalRegenerate?.mode === "video";

  return {
    globalRegenerate,
    shotRegenerates,
    targetShotIds,
    includesImage,
    includesVideo,
  };
}
