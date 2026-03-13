// assistant/actions/applyScriptAssistantActions.ts
// 纯函数：将 AI assistant 返回的 actions 应用到 project state
// 无副作用，全程 immutable，返回新 project 对象

// ─────────────────────────────────────────────────────────────
// 领域类型
// ─────────────────────────────────────────────────────────────

export interface Shot {
  id: string;
  order: number;
  narration: string;
  visualDescription: string;
  duration: number;
  musicNote?: string;
  status: "draft" | "ai-generated" | "approved" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  styleNote: string;
  soundtrackNote: string;
  totalDuration: number;
  shots: Shot[];
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Action 类型（与 schema/script.ts 对齐）
// ─────────────────────────────────────────────────────────────

interface ShotScriptPatch {
  narration?: string;
  visualDescription?: string;
  musicNote?: string;
}

export interface UpdateShotScriptAction {
  type: "update_shot_script";
  shotId: string;
  patch: ShotScriptPatch;
  reason?: string;
}

export interface AddShotAction {
  type: "add_shot";
  afterShotId?: string;
  shot: {
    narration?: string;
    visualDescription?: string;
    duration: number;
    musicNote?: string;
  };
}

export interface RemoveShotAction {
  type: "remove_shot";
  shotId: string;
  reason?: string;
}

export interface ReorderShotsAction {
  type: "reorder_shots";
  orderedShotIds: string[];
}

export interface UpdateShotDurationAction {
  type: "update_shot_duration";
  shotId: string;
  duration: number;
  reason?: string;
}

export interface BulkRewriteShotsAction {
  type: "bulk_rewrite_shots";
  items: { shotId: string; patch: ShotScriptPatch }[];
  reason?: string;
}

export interface UpdateProjectStyleNoteAction {
  type: "update_project_style_note";
  patch: { styleNote?: string; soundtrackNote?: string };
}

export interface AskUserAction {
  type: "ask_user";
  question: string;
  options?: string[];
  hypothesis?: string;
}

export type AssistantAction =
  | UpdateShotScriptAction
  | AddShotAction
  | RemoveShotAction
  | ReorderShotsAction
  | UpdateShotDurationAction
  | BulkRewriteShotsAction
  | UpdateProjectStyleNoteAction
  | AskUserAction;

// ─────────────────────────────────────────────────────────────
// 返回值类型
// ─────────────────────────────────────────────────────────────

export interface SkippedAction {
  action: AssistantAction;
  reason: string;
}

export interface ApplyActionsResult {
  /** 应用所有合法 actions 后的新 project（原对象不变） */
  nextProject: Project;
  /** 成功执行的 actions */
  appliedActions: AssistantAction[];
  /** 被跳过的 actions */
  skippedActions: SkippedAction[];
  /** 人类可读的警告信息 */
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// 内部约束常量
// ─────────────────────────────────────────────────────────────

/** project 中允许的最少 shot 数量，低于此数量时拒绝删除 */
const MIN_SHOT_COUNT = 1;

// ─────────────────────────────────────────────────────────────
// ❶ 工具：唯一 Shot ID 生成器
// ─────────────────────────────────────────────────────────────

/**
 * 生成格式为 `shot_<base36时间戳>_<随机4位>` 的唯一 ID。
 * 不依赖 crypto，兼容所有环境。
 * 示例：shot_lf2k8z_a3x1
 */
export function generateShotId(): string {
  const ts = Date.now().toString(36);               // e.g. "lf2k8z"
  const rand = Math.random().toString(36).slice(2, 6); // 4 位随机
  return `shot_${ts}_${rand}`;
}

// ─────────────────────────────────────────────────────────────
// ❷ 工具：时间戳 / 数组操作
// ─────────────────────────────────────────────────────────────

const utcNow = (): string => new Date().toISOString();

/**
 * 根据 shots 数组重新整理 order 字段，使其从 1 开始连续递增。
 * 只在 order 与预期不一致时创建新对象，其余直接复用。
 */
const reindexOrder = (shots: Shot[]): Shot[] =>
  shots.map((s, i) => (s.order === i + 1 ? s : { ...s, order: i + 1 }));

/** 汇总所有 shot 的 duration */
const calcTotalDuration = (shots: Shot[]): number =>
  shots.reduce((sum, s) => sum + s.duration, 0);

/** 构建 id → shot 的 Map，用于 O(1) 查找 */
const buildShotMap = (shots: Shot[]): Map<string, Shot> =>
  new Map(shots.map((s) => [s.id, s]));

/** 构建 shot id 的 Set，用于 O(1) 存在性校验 */
const buildShotIdSet = (shots: Shot[]): Set<string> =>
  new Set(shots.map((s) => s.id));

/** 查找 shot 下标，不存在返回 -1 */
const findShotIndex = (shots: Shot[], id: string): number =>
  shots.findIndex((s) => s.id === id);

// ─────────────────────────────────────────────────────────────
// ❸ 工具：ShotScriptPatch 应用器
// ─────────────────────────────────────────────────────────────

/**
 * 将 ShotScriptPatch 应用到 shot，返回新对象。
 * undefined 字段不覆盖原值（只更新明确传入的字段）。
 */
function applyShotScriptPatch(shot: Shot, patch: ShotScriptPatch): Shot {
  const { narration, visualDescription, musicNote } = patch;
  return {
    ...shot,
    ...(narration !== undefined && { narration }),
    ...(visualDescription !== undefined && { visualDescription }),
    ...(musicNote !== undefined && { musicNote }),
    updatedAt: utcNow(),
  };
}

// ─────────────────────────────────────────────────────────────
// ❹ 内部结果类型 & 派发工具
// ─────────────────────────────────────────────────────────────

type MutationOk = { ok: true; shots: Shot[]; warnings?: string[] };
type MutationFail = { ok: false; reason: string };
type MutationResult = MutationOk | MutationFail;

/**
 * 将 MutationResult 统一派发到 accumulator 中，
 * 避免每个 case 重复 if/else 逻辑。
 */
function dispatchResult(
  result: MutationResult,
  action: AssistantAction,
  acc: {
    shots: Shot[];
    applied: AssistantAction[];
    skipped: SkippedAction[];
    warnings: string[];
  }
): void {
  if (!result.ok) {
    acc.skipped.push({ action, reason: result.reason });
    acc.warnings.push(result.reason);
    return;
  }
  acc.shots = result.shots;
  if (result.warnings) acc.warnings.push(...result.warnings);
  acc.applied.push(action);
}

// ─────────────────────────────────────────────────────────────
// ❺ 单 action 处理器
// ─────────────────────────────────────────────────────────────

function applyUpdateShotScript(
  shots: Shot[],
  action: UpdateShotScriptAction
): MutationResult {
  const idx = findShotIndex(shots, action.shotId);
  if (idx === -1) {
    return {
      ok: false,
      reason: `update_shot_script: shotId "${action.shotId}" 不存在，跳过此操作`,
    };
  }
  const updated = applyShotScriptPatch(shots[idx], action.patch);
  return {
    ok: true,
    shots: shots.map((s, i) => (i === idx ? updated : s)),
  };
}

function applyAddShot(shots: Shot[], action: AddShotAction): MutationResult {
  const createdAt = utcNow();
  const newShot: Shot = {
    id: generateShotId(),
    order: 0,                                    // reindexOrder 统一修正
    narration: action.shot.narration ?? "",
    visualDescription: action.shot.visualDescription ?? "",
    duration: action.shot.duration,
    ...(action.shot.musicNote !== undefined && { musicNote: action.shot.musicNote }),
    status: "ai-generated",
    createdAt,
    updatedAt: createdAt,
  };

  // 无指定位置 → 追加末尾
  if (!action.afterShotId) {
    return { ok: true, shots: [...shots, newShot] };
  }

  const afterIdx = findShotIndex(shots, action.afterShotId);
  if (afterIdx === -1) {
    // afterShotId 不存在 → 降级追加末尾，保留 warning
    return {
      ok: true,
      shots: [...shots, newShot],
      warnings: [
        `add_shot: afterShotId "${action.afterShotId}" 不存在，新 shot 已降级追加到末尾`,
      ],
    };
  }

  return {
    ok: true,
    shots: [
      ...shots.slice(0, afterIdx + 1),
      newShot,
      ...shots.slice(afterIdx + 1),
    ],
  };
}

/**
 * remove_shot 包含最少 shot 数量保护：
 * 若删除后 shots 数量将低于 MIN_SHOT_COUNT，拒绝执行并给出清晰提示。
 */
function applyRemoveShot(
  shots: Shot[],
  action: RemoveShotAction
): MutationResult {
  const idx = findShotIndex(shots, action.shotId);
  if (idx === -1) {
    return {
      ok: false,
      reason: `remove_shot: shotId "${action.shotId}" 不存在，跳过此操作`,
    };
  }

  const afterRemoveCount = shots.length - 1;
  if (afterRemoveCount < MIN_SHOT_COUNT) {
    return {
      ok: false,
      reason:
        `remove_shot: 删除 "${action.shotId}" 后 project 将只剩 ${afterRemoveCount} 个 shot，` +
        `低于最少保留数量（${MIN_SHOT_COUNT}），已拒绝此操作`,
    };
  }

  return {
    ok: true,
    shots: shots.filter((s) => s.id !== action.shotId),
  };
}

/**
 * reorder_shots 容错策略：
 * 1. orderedShotIds 中不存在的 id → 从排列中剔除 + warning
 * 2. shots 中未出现在 orderedShotIds 的 shot → 追加到末尾 + warning
 *    （保证 shots 完整性，不会丢失任何 shot）
 */
function applyReorderShots(
  shots: Shot[],
  action: ReorderShotsAction
): MutationResult {
  const existingIdSet = buildShotIdSet(shots);
  const shotMap = buildShotMap(shots);
  const warnings: string[] = [];

  // ── 步骤 1：过滤掉 orderedShotIds 中幽灵 id ──
  const validIds: string[] = [];
  const ghostIds: string[] = [];

  for (const id of action.orderedShotIds) {
    if (existingIdSet.has(id)) {
      validIds.push(id);
    } else {
      ghostIds.push(id);
    }
  }
  if (ghostIds.length > 0) {
    warnings.push(
      `reorder_shots: [${ghostIds.join(", ")}] 在当前 project 中不存在，已从排序中移除`
    );
  }

  // ── 步骤 2：找出未被覆盖的 shots，追加末尾 ──
  const reorderedSet = new Set(validIds);
  const tail = shots.filter((s) => !reorderedSet.has(s.id));
  if (tail.length > 0) {
    const tailIds = tail.map((s) => s.id).join(", ");
    warnings.push(
      `reorder_shots: [${tailIds}] 未出现在 orderedShotIds 中，已追加到末尾以保持完整性`
    );
  }

  return {
    ok: true,
    shots: [...validIds.map((id) => shotMap.get(id)!), ...tail],
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * update_shot_duration：修改时长后，totalDuration 将在主函数末尾
 * 通过 calcTotalDuration(finalShots) 统一重算，此处只负责更新单个 shot。
 */
function applyUpdateShotDuration(
  shots: Shot[],
  action: UpdateShotDurationAction
): MutationResult {
  const idx = findShotIndex(shots, action.shotId);
  if (idx === -1) {
    return {
      ok: false,
      reason: `update_shot_duration: shotId "${action.shotId}" 不存在，跳过此操作`,
    };
  }
  const updated: Shot = {
    ...shots[idx],
    duration: action.duration,
    updatedAt: utcNow(),
  };
  return {
    ok: true,
    shots: shots.map((s, i) => (i === idx ? updated : s)),
  };
}

/**
 * bulk_rewrite_shots 容错策略：
 * - 部分 shotId 不存在 → 仅跳过无效条目，其余正常执行 + warning
 * - 全部 shotId 不存在 → 整条 action 失败
 */
function applyBulkRewriteShots(
  shots: Shot[],
  action: BulkRewriteShotsAction
): MutationResult {
  const existingIdSet = buildShotIdSet(shots);
  const warnings: string[] = [];

  const validItems = action.items.filter((item) => {
    if (existingIdSet.has(item.shotId)) return true;
    warnings.push(
      `bulk_rewrite_shots: shotId "${item.shotId}" 不存在，该条目已跳过`
    );
    return false;
  });

  if (validItems.length === 0) {
    return {
      ok: false,
      reason: "bulk_rewrite_shots: 所有 items 的 shotId 均不存在，整条 action 已跳过",
    };
  }

  const patchMap = new Map(validItems.map((item) => [item.shotId, item.patch]));
  const nextShots = shots.map((s) => {
    const patch = patchMap.get(s.id);
    return patch ? applyShotScriptPatch(s, patch) : s;
  });

  return {
    ok: true,
    shots: nextShots,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// ❻ 主函数
// ─────────────────────────────────────────────────────────────

export function applyScriptAssistantActions(
  project: Project,
  actions: AssistantAction[]
): ApplyActionsResult {
  // 累积器：贯穿整个 actions 循环
  const acc = {
    shots:    [...project.shots] as Shot[],
    applied:  [] as AssistantAction[],
    skipped:  [] as SkippedAction[],
    warnings: [] as string[],
  };

  // project 级别的字段变更（styleNote / soundtrackNote）独立收集
  let projectPatch: Partial<Pick<Project, "styleNote" | "soundtrackNote">> = {};

  for (const action of actions) {
    switch (action.type) {

      // ── ask_user：不修改数据，静默跳过 ──────────────────────
      case "ask_user":
        acc.skipped.push({ action, reason: "ask_user 不触发数据变更，等待用户回复" });
        break;

      // ── shot 级别的变更 ──────────────────────────────────────
      case "update_shot_script":
        dispatchResult(applyUpdateShotScript(acc.shots, action), action, acc);
        break;

      case "add_shot":
        dispatchResult(applyAddShot(acc.shots, action), action, acc);
        break;

      case "remove_shot":
        dispatchResult(applyRemoveShot(acc.shots, action), action, acc);
        break;

      case "reorder_shots":
        dispatchResult(applyReorderShots(acc.shots, action), action, acc);
        break;

      case "update_shot_duration":
        dispatchResult(applyUpdateShotDuration(acc.shots, action), action, acc);
        // totalDuration 在循环结束后统一重算，无需在此单独处理
        break;

      case "bulk_rewrite_shots":
        dispatchResult(applyBulkRewriteShots(acc.shots, action), action, acc);
        break;

      // ── project 级别的变更 ───────────────────────────────────
      case "update_project_style_note": {
        const { styleNote, soundtrackNote } = action.patch;
        projectPatch = {
          ...projectPatch,
          ...(styleNote      !== undefined && { styleNote }),
          ...(soundtrackNote !== undefined && { soundtrackNote }),
        };
        acc.applied.push(action);
        break;
      }

      default: {
        // TypeScript exhaustive check：新增 action type 未处理时编译期报错
        const _exhaustive: never = action;
        acc.warnings.push(
          `未知 action type: "${(_exhaustive as AssistantAction).type}"，已忽略`
        );
      }
    }
  }

  // ── 收尾：reindex order + 重算 totalDuration ─────────────────
  // update_shot_duration / add_shot / remove_shot 均可能改变 totalDuration，
  // 统一在此一次性重算，保证结果正确且只触发一次。
  const finalShots     = reindexOrder(acc.shots);
  const totalDuration  = calcTotalDuration(finalShots);

  const nextProject: Project = {
    ...project,
    ...projectPatch,
    shots: finalShots,
    totalDuration,
  };

  return {
    nextProject,
    appliedActions: acc.applied,
    skippedActions: acc.skipped,
    warnings:       acc.warnings,
  };
}
