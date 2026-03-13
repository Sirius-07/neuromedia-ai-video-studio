// assistant/actions/buildScriptAssistantContext.ts
// 纯函数：将 Script 页面当前状态整理成发送给后端 AI assistant 的上下文对象
// 设计目标：对大模型友好、紧凑、无冗余 UI 字段

import type { Shot, Project } from "./applyScriptAssistantActions";

// ─────────────────────────────────────────────────────────────
// 输入类型
// ─────────────────────────────────────────────────────────────

export type Language       = "zh-CN" | "en-US" | "zh-TW";
export type TargetPlatform = "douyin" | "wechat" | "youtube" | "bilibili" | "general";

/** Script 页面 Project，补充 AI 需要的 meta 字段 */
export interface ScriptProject extends Project {
  language:       Language;
  targetPlatform: TargetPlatform;
}

/** Script 页面当前 UI 状态（纯数据，不含 React refs / DOM） */
export interface ScriptUIState {
  /** 当前单选的 shot id（精准修改模式） */
  selectedShotId:    string | null;
  /** 多选的 shot id 列表（批量操作模式） */
  selectedShotIds:   string[];
  /** 最近一次用户操作的简短描述，可选 */
  lastActionSummary?: string;
}

// ─────────────────────────────────────────────────────────────
// 输出类型
// ─────────────────────────────────────────────────────────────

/**
 * 发送给 AI 的 shot 精简视图。
 * 仅保留推理所需字段；空字段用 null 表示，方便大模型识别缺失。
 */
export interface ShotSummary {
  id:                string;
  order:             number;
  duration:          number;
  /** null 表示尚未填写 */
  narration:         string | null;
  /** null 表示尚未填写 */
  visualDescription: string | null;
  musicNote?:        string;
}

/**
 * 当前选中 shot 的详细摘要（仅在 selectedShotId 有效时存在）。
 * 让大模型无需从 shots 列表中自行查找，减少推理步骤。
 */
export interface SelectedShotSummary {
  id:                string;
  order:             number;
  duration:          number;
  narration:         string | null;
  visualDescription: string | null;
  musicNote?:        string;
}

/**
 * 脚本整体概况。
 * 用一段自然语言 + 结构化数字描述当前脚本状态，
 * 帮助大模型快速建立全局认知，无需逐条解析 shots。
 */
export interface ScriptSummary {
  /** 自然语言描述，如："5 个 shot，总时长 50s，风格：古风+现代，目标平台：抖音" */
  overview:        string;
  avgDuration:     number;   // 平均每 shot 时长（秒）
  shortestShotId:  string;   // 最短 shot id（有助于 AI 识别节奏弱点）
  longestShotId:   string;   // 最长 shot id
  completionRate:  number;   // 内容填写完整率 0~1，例如 0.8 = 80% 的 shot 已完整
}

/**
 * 缺失信息统计。
 * 使用 order 编号（而非 id）描述，更利于大模型在自然语言中引用。
 */
export interface MissingInfo {
  /** 缺少 narration 的 shot order 列表，例如 [1, 3] */
  narration:         number[];
  /** 缺少 visualDescription 的 shot order 列表 */
  visualDescription: number[];
  /** 缺少有效 duration（≤0）的 shot order 列表 */
  duration:          number[];
  /** true 表示所有 shot 均已填写完整 */
  isComplete:        boolean;
}

/**
 * 完整的 Script 助手上下文。
 * 适用于 POST /api/assistant/chat 的 request body 中的 context 字段。
 */
export interface ScriptAssistantContext {
  // ── 页面标识（供后端路由到对应 prompt 模板）────────────────
  page:            "script";

  // ── Project 基本信息 ────────────────────────────────────────
  projectId:       string;
  projectTitle:    string;
  language:        Language;
  targetPlatform:  TargetPlatform;
  totalDuration:   number;
  shotCount:       number;

  // ── 创作风格（AI 保持风格一致的依据）──────────────────────
  styleNote:       string;
  soundtrackNote:  string;

  // ── 脚本整体概况（大模型快速定向）──────────────────────────
  scriptSummary:   ScriptSummary;

  // ── 缺失信息（AI 主动提示用户补全的依据）───────────────────
  missingInfo:     MissingInfo;

  // ── 当前选中状态 ────────────────────────────────────────────
  selectedShotId:      string | null;
  selectedShotIds:     string[];
  /** 仅当 selectedShotId 有效时存在，省去大模型从列表中查找 */
  selectedShotSummary: SelectedShotSummary | null;

  // ── 所有 shot 的精简列表 ────────────────────────────────────
  shots:           ShotSummary[];

  // ── 可选：最近操作摘要（供 AI 感知连续性）───────────────────
  lastActionSummary?: string;
}

// ─────────────────────────────────────────────────────────────
// 内部工具函数
// ─────────────────────────────────────────────────────────────

/** 空字符串视为缺失，返回 null；否则返回原值 */
const nullIfEmpty = (s: string): string | null =>
  s.trim() === "" ? null : s;

/** 将完整 Shot 转为 ShotSummary，空文本字段转为 null */
function toShotSummary(shot: Shot): ShotSummary {
  const summary: ShotSummary = {
    id:                shot.id,
    order:             shot.order,
    duration:          shot.duration,
    narration:         nullIfEmpty(shot.narration),
    visualDescription: nullIfEmpty(shot.visualDescription),
  };
  if (shot.musicNote !== undefined) summary.musicNote = shot.musicNote;
  return summary;
}

/** 计算缺失信息，以 order 编号表示便于自然语言引用 */
function calcMissingInfo(shots: Shot[]): MissingInfo {
  const narration:         number[] = [];
  const visualDescription: number[] = [];
  const duration:          number[] = [];

  for (const s of shots) {
    if (!s.narration.trim())         narration.push(s.order);
    if (!s.visualDescription.trim()) visualDescription.push(s.order);
    if (s.duration <= 0)             duration.push(s.order);
  }

  return {
    narration,
    visualDescription,
    duration,
    isComplete:
      narration.length === 0 &&
      visualDescription.length === 0 &&
      duration.length === 0,
  };
}

/** 生成脚本整体概况 */
function buildScriptSummary(project: ScriptProject): ScriptSummary {
  const { shots, totalDuration, language, targetPlatform, styleNote } = project;
  const count = shots.length;

  if (count === 0) {
    return {
      overview:       "当前脚本无任何 shot",
      avgDuration:    0,
      shortestShotId: "",
      longestShotId:  "",
      completionRate: 0,
    };
  }

  const avgDuration = Math.round((totalDuration / count) * 10) / 10;

  // 最长 / 最短 shot
  let shortest = shots[0];
  let longest  = shots[0];
  for (const s of shots) {
    if (s.duration < shortest.duration) shortest = s;
    if (s.duration > longest.duration)  longest  = s;
  }

  // 内容填写完整率：narration + visualDescription 均非空算一个完整 shot
  const completeCount = shots.filter(
    (s) => s.narration.trim() !== "" && s.visualDescription.trim() !== ""
  ).length;
  const completionRate = Math.round((completeCount / count) * 100) / 100;

  // 自然语言概况（供大模型快速理解，控制在 ~80 字以内）
  const stylePart = styleNote ? `风格：${styleNote.slice(0, 20)}` : "风格未设定";
  const overview = [
    `共 ${count} 个 shot，总时长 ${totalDuration}s，均长 ${avgDuration}s`,
    `语言：${language}，平台：${targetPlatform}`,
    stylePart,
    completionRate < 1
      ? `内容完整率 ${Math.round(completionRate * 100)}%`
      : "内容已全部填写",
  ].join("；");

  return {
    overview,
    avgDuration,
    shortestShotId: shortest.id,
    longestShotId:  longest.id,
    completionRate,
  };
}

/** 校验 selectedShotId 是否仍存在（防止 shot 被删后 id 失效） */
function resolveSelectedShotId(id: string | null, shots: Shot[]): string | null {
  if (!id) return null;
  return shots.some((s) => s.id === id) ? id : null;
}

/** 过滤 selectedShotIds 中已失效的 id */
function resolveSelectedShotIds(ids: string[], shots: Shot[]): string[] {
  const idSet = new Set(shots.map((s) => s.id));
  return ids.filter((id) => idSet.has(id));
}

/** 构建选中 shot 的详细摘要，找不到时返回 null */
function buildSelectedShotSummary(
  selectedShotId: string | null,
  shots: Shot[]
): SelectedShotSummary | null {
  if (!selectedShotId) return null;
  const shot = shots.find((s) => s.id === selectedShotId);
  if (!shot) return null;
  return {
    id:                shot.id,
    order:             shot.order,
    duration:          shot.duration,
    narration:         nullIfEmpty(shot.narration),
    visualDescription: nullIfEmpty(shot.visualDescription),
    ...(shot.musicNote !== undefined && { musicNote: shot.musicNote }),
  };
}

// ─────────────────────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────────────────────

/**
 * 将 Script 页面当前状态整理成发送给后端 AI assistant 的上下文对象。
 *
 * Token 控制策略：
 * - scriptSummary.overview 自然语言概况 ≤ 80 字
 * - shot 文案字段空值转 null，JSON 序列化后更短
 * - selectedShotSummary 避免大模型在 shots 列表中二次查找
 * - missingInfo 用 order 编号而非 id，自然语言表达更紧凑
 *
 * @example
 * const ctx = buildScriptAssistantContext(project, uiState);
 * await fetch("/api/assistant/chat", {
 *   method: "POST",
 *   body: JSON.stringify({ context: ctx, message: userInput }),
 * });
 */
export function buildScriptAssistantContext(
  project: ScriptProject,
  uiState: ScriptUIState
): ScriptAssistantContext {
  const { shots } = project;

  const resolvedShotId  = resolveSelectedShotId(uiState.selectedShotId, shots);
  const resolvedShotIds = resolveSelectedShotIds(uiState.selectedShotIds, shots);

  return {
    page:           "script",

    projectId:      project.id,
    projectTitle:   project.title,
    language:       project.language,
    targetPlatform: project.targetPlatform,
    totalDuration:  project.totalDuration,
    shotCount:      shots.length,

    styleNote:      project.styleNote,
    soundtrackNote: project.soundtrackNote,

    scriptSummary:  buildScriptSummary(project),
    missingInfo:    calcMissingInfo(shots),

    selectedShotId:      resolvedShotId,
    selectedShotIds:     resolvedShotIds,
    selectedShotSummary: buildSelectedShotSummary(resolvedShotId, shots),

    shots: shots.map(toShotSummary),

    ...(uiState.lastActionSummary !== undefined && {
      lastActionSummary: uiState.lastActionSummary,
    }),
  };
}
