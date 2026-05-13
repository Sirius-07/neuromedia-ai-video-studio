// storyboard/assistant/StoryboardActionPreview.tsx
// AI 分镜助手建议操作的 diff 预览组件
// 在用户确认前展示结构化的"旧值 → 新值"对比，风格与 ScriptAssistantActionPreview 保持一致

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  ChevronRight,
  FilePen,
  Layers,
  RefreshCw,
  RotateCcw,
  MessageCircleQuestion,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import type { Scene }             from "../types";
import type {
  StoryboardAction,
  ShotFieldPatch,
}                                  from "./types";

// ─────────────────────────────────────────────────────────────
// 字段名映射：内部 key → 中文展示名
// ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  visualPrompt:   "画面提示词",
  motionPrompt:   "运动提示词",
  size:           "景别",
  perspective:    "视角",
  equipment:      "拍摄设备",
  focalLength:    "焦距",
  notes:          "备注",
  narration:      "旁白/字幕",
  dialogue:       "对白",
  cameraMovement: "镜头运动",
  cameraStrength: "运动强度",
  duration:       "时长",
};

/** cameraMovement 枚举值 → 中文 */
const CAMERA_MOVEMENT_LABELS: Record<string, string> = {
  none:       "静止",
  pan_left:   "向左平移",
  pan_right:  "向右平移",
  tilt_up:    "向上倾斜",
  tilt_down:  "向下俯拍",
  zoom_in:    "推近",
  zoom_out:   "拉远",
  roll:       "旋转",
  drone:      "无人机",
};

// ─────────────────────────────────────────────────────────────
// action type → 展示配置
// ─────────────────────────────────────────────────────────────

type ActionMeta = {
  label:       string;
  icon:        React.ComponentType<{ size?: number; className?: string }>;
  color:       string;
  border:      string;
  bg:          string;
  destructive?: boolean;
};

const ACTION_META: Record<StoryboardAction["type"], ActionMeta> = {
  update_shot_field: {
    label:  "修改分镜字段",
    icon:   FilePen,
    color:  "text-cyan-400",
    border: "border-cyan-500/20",
    bg:     "bg-cyan-500/5",
  },
  bulk_update_shots: {
    label:  "批量修改分镜",
    icon:   Layers,
    color:  "text-sky-400",
    border: "border-sky-500/20",
    bg:     "bg-sky-500/5",
  },
  regenerate_shot: {
    label:  "重新生成分镜",
    icon:   RefreshCw,
    color:  "text-amber-400",
    border: "border-amber-500/20",
    bg:     "bg-amber-500/5",
  },
  regenerate_storyboard: {
    label:       "重新生成全部分镜",
    icon:        RotateCcw,
    color:       "text-red-400",
    border:      "border-red-500/20",
    bg:          "bg-red-500/5",
    destructive: true,
  },
  ask_user: {
    label:  "AI 提问",
    icon:   MessageCircleQuestion,
    color:  "text-neutral-400",
    border: "border-neutral-500/20",
    bg:     "bg-neutral-500/5",
  },
};

// ─────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────

/** 根据 shotId 在 scenes 中查找，返回"分镜 N"标签；找不到时降级显示 id */
function getShotLabel(scenes: Scene[], shotId: number): string {
  const idx = scenes.findIndex((s) => s.id === shotId);
  return idx === -1 ? `分镜 ${shotId}` : `分镜 ${idx + 1}`;
}

function getModeLabel(mode: "image" | "video"): string {
  return mode === "image" ? "图片" : "视频";
}

/** 从 scene 中读取某字段的当前值（对特殊嵌套字段做兼容处理） */
function getSceneOldValue(scene: Scene | undefined, field: string): string {
  if (!scene) return "—";

  if (field === "cameraMovement") {
    const mv = scene.smartGeneration?.cameraControl?.movement;
    return mv ? (CAMERA_MOVEMENT_LABELS[mv] ?? mv) : "未设定";
  }
  if (field === "cameraStrength") {
    const st = scene.smartGeneration?.cameraControl?.strength;
    return st !== undefined ? `${st}/100` : "未设定";
  }
  if (field === "duration") {
    // Scene.duration 可能已含 's' 后缀（如 "5s"）或不含（如 "5"），统一规范化后加 s
    const raw = scene.duration?.replace(/s$/i, "").trim() ?? "";
    return raw ? `${raw}s` : "未设定";
  }

  const val = (scene as Record<string, unknown>)[field];
  if (val === undefined || val === null || String(val).trim() === "") {
    return "未填写";
  }
  return String(val);
}

/** 格式化 patch 中的值用于展示 */
function formatNewValue(field: string, val: unknown): string {
  if (val === undefined || val === null) return "—";
  if (field === "cameraMovement") {
    return CAMERA_MOVEMENT_LABELS[String(val)] ?? String(val);
  }
  if (field === "cameraStrength") return `${val}/100`;
  if (field === "duration")       return `${val}s`;
  return String(val);
}

/**
 * 把 patch 中的可展示字段（排除 mode）提取为列表。
 * 返回 { field, newVal } 数组，已跳过 undefined 值。
 */
function getPatchFields(patch: ShotFieldPatch): { field: string; newVal: unknown }[] {
  const { mode: _mode, ...rest } = patch as Record<string, unknown>;
  return Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .map(([field, newVal]) => ({ field, newVal }));
}

/** action 一行摘要文本 */
function getActionSummary(action: StoryboardAction, scenes: Scene[]): string {
  switch (action.type) {
    case "update_shot_field": {
      const fields = getPatchFields(action.patch).map(
        (f) => FIELD_LABELS[f.field] ?? f.field
      );
      return `${getShotLabel(scenes, action.shotId)} · 更新 ${fields.join("、")}`;
    }
    case "bulk_update_shots":
      return `${action.items.length} 个分镜批量更新`;
    case "regenerate_shot": {
      const target = action.target === "image" ? "图片" : "视频";
      return `${getShotLabel(scenes, action.shotId)} · 重新生成${target}`;
    }
    case "regenerate_storyboard":
      return `全部 ${scenes.length} 个分镜 · 重新生成（${getModeLabel(action.mode)}模式）`;
    case "ask_user":
      return action.question.length > 36
        ? action.question.slice(0, 36) + "…"
        : action.question;
    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 子组件：单行 diff 展示
// ─────────────────────────────────────────────────────────────

function DiffRow({
  field,
  oldVal,
  newVal,
}: {
  field:  string;
  oldVal: string;
  newVal: string;
}) {
  const label   = FIELD_LABELS[field] ?? field;
  const isEmpty = oldVal === "未填写";
  // 长文本截断阈值
  const truncate = (s: string, max = 28) =>
    s.length > max ? s.slice(0, max) + "…" : s;

  return (
    <div className="flex items-start gap-2 text-[10px] leading-relaxed">
      {/* 字段名 */}
      <span className="w-16 shrink-0 text-neutral-600">{label}</span>

      {/* 旧值 */}
      <span
        className={`max-w-[80px] truncate shrink-0 ${
          isEmpty ? "text-neutral-700 italic" : "text-neutral-500 line-through"
        }`}
        title={oldVal}
      >
        {truncate(oldVal)}
      </span>

      {/* 箭头 */}
      <ArrowRight size={10} className="text-neutral-700 mt-0.5 shrink-0" />

      {/* 新值 */}
      <span className="text-neutral-200 break-all" title={newVal}>
        {truncate(newVal, 48)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 子组件：单个 shot 的 patch diff 列表
// ─────────────────────────────────────────────────────────────

function PatchDiffList({
  scene,
  patch,
}: {
  scene:  Scene | undefined;
  patch:  ShotFieldPatch;
}) {
  const fields = getPatchFields(patch);
  if (fields.length === 0) return <p className="text-[10px] text-neutral-600 italic">无字段变更</p>;

  return (
    <div className="space-y-1.5">
      {fields.map(({ field, newVal }) => (
        <DiffRow
          key={field}
          field={field}
          oldVal={getSceneOldValue(scene, field)}
          newVal={formatNewValue(field, newVal)}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 子组件：DetailWrapper（展开区外壳）
// ─────────────────────────────────────────────────────────────

function DetailWrapper({
  meta,
  children,
}: {
  meta:     ActionMeta;
  children: React.ReactNode;
}) {
  return (
    <div className={`px-3 py-2.5 rounded-b-lg border-x border-b space-y-2 ${meta.border} ${meta.bg}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 子组件：ActionDetail（每种 action 展开内容）
// ─────────────────────────────────────────────────────────────

function ActionDetail({
  action,
  scenes,
}: {
  action: StoryboardAction;
  scenes: Scene[];
}) {
  const meta = ACTION_META[action.type];

  switch (action.type) {
    case "update_shot_field": {
      const scene = scenes.find((s) => s.id === action.shotId);
      return (
        <DetailWrapper meta={meta}>
          <p className="text-[10px] text-neutral-600 mb-1">
            {getShotLabel(scenes, action.shotId)}
          </p>
          <PatchDiffList scene={scene} patch={action.patch} />
          {action.reason && (
            <p className="text-[10px] text-neutral-600 italic mt-1">理由：{action.reason}</p>
          )}
        </DetailWrapper>
      );
    }

    case "bulk_update_shots": {
      return (
        <DetailWrapper meta={meta}>
          {action.reason && (
            <p className="text-[10px] text-neutral-500 italic mb-2">
              方向：{action.reason}
            </p>
          )}
          <div className="space-y-3">
            {action.items.map((item) => {
              const scene = scenes.find((s) => s.id === item.shotId);
              return (
                <div
                  key={item.shotId}
                  className="pl-2.5 border-l border-white/[0.08]"
                >
                  <p className="text-[10px] text-neutral-500 font-medium mb-1.5">
                    {getShotLabel(scenes, item.shotId)}
                  </p>
                  <PatchDiffList scene={scene} patch={item.patch} />
                </div>
              );
            })}
          </div>
        </DetailWrapper>
      );
    }

    case "regenerate_shot": {
      const target  = action.target === "image" ? "图片" : "视频";
      const scene   = scenes.find((s) => s.id === action.shotId);
      const status  = scene?.generationStatus ?? "—";
      return (
        <DetailWrapper meta={meta}>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-600">目标分镜</span>
            <span className="text-neutral-300 font-medium">
              {getShotLabel(scenes, action.shotId)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-600">重新生成</span>
            <span className="text-amber-300 font-medium">{target}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-600">当前状态</span>
            <span className="text-neutral-500 font-mono">{status}</span>
          </div>
          {action.reason && (
            <p className="text-[10px] text-neutral-600 italic">理由：{action.reason}</p>
          )}
        </DetailWrapper>
      );
    }

    case "regenerate_storyboard": {
      return (
        <DetailWrapper meta={meta}>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-600">生成模式</span>
            <span className="text-red-300 font-medium">
              {action.mode === "image" ? "静帧图像" : "视频片段"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-600">影响范围</span>
            <span className="text-red-300 font-medium">全部 {scenes.length} 个分镜</span>
          </div>
          {action.styleNote && (
            <div className="text-[10px] space-y-0.5 mt-1">
              <p className="text-neutral-600">风格备注</p>
              <p className="text-neutral-300">{action.styleNote}</p>
            </div>
          )}
          {action.reason && (
            <p className="text-[10px] text-neutral-600 italic">理由：{action.reason}</p>
          )}
          <DestructiveWarning text="此操作将重置全部分镜生成状态，请确认后执行" />
        </DetailWrapper>
      );
    }

    case "ask_user": {
      return (
        <DetailWrapper meta={meta}>
          <div className="text-[10px] space-y-0.5">
            <p className="text-neutral-600">AI 的问题</p>
            <p className="text-neutral-200">{action.question}</p>
          </div>
          {action.hypothesis && (
            <p className="text-[10px] text-neutral-600 italic">
              AI 推断：{action.hypothesis}
            </p>
          )}
          {action.options && action.options.length > 0 && (
            <div>
              <p className="text-[10px] text-neutral-600 mb-1">可选项</p>
              <div className="flex flex-wrap gap-1">
                {action.options.map((opt) => (
                  <span
                    key={opt}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-400"
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DetailWrapper>
      );
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 子组件：ActionSummaryRow（折叠行）
// ─────────────────────────────────────────────────────────────

function ActionSummaryRow({
  action,
  index,
  isExpanded,
  scenes,
  onToggle,
}: {
  action:     StoryboardAction;
  index:      number;
  isExpanded: boolean;
  scenes:     Scene[];
  onToggle:   () => void;
}) {
  const meta = ACTION_META[action.type];
  const Icon = meta.icon;

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-150 text-left
        ${isExpanded
          ? `${meta.bg} ${meta.border}`
          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
        }`}
    >
      {/* 序号 badge */}
      <span className="w-4 h-4 rounded-sm bg-white/[0.06] flex items-center justify-center text-[9px] text-neutral-500 font-mono shrink-0">
        {index + 1}
      </span>

      {/* 图标 */}
      <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${meta.color}`}>
        <Icon size={13} />
      </div>

      {/* 文字 */}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium ${meta.color}`}>{meta.label}</p>
        <p className="text-[10px] text-neutral-500 truncate mt-0.5">
          {getActionSummary(action, scenes)}
        </p>
      </div>

      {/* 展开箭头 */}
      <motion.div
        animate={{ rotate: isExpanded ? 90 : 0 }}
        transition={{ duration: 0.15 }}
        className="text-neutral-600 shrink-0"
      >
        <ChevronRight size={13} />
      </motion.div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 子组件：DestructiveWarning
// ─────────────────────────────────────────────────────────────

function DestructiveWarning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
      <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
      <p className="text-[10px] text-red-400/80">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

export interface StoryboardActionPreviewProps {
  scenes:    Scene[];
  actions:   StoryboardAction[];
  /** 操作意图标签（来自 response.intent），展示在 header */
  intent?:   string;
  warnings?: string[];
  onConfirm: () => void;
  onCancel:  () => void;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function StoryboardActionPreview({
  scenes,
  actions,
  intent,
  warnings = [],
  onConfirm,
  onCancel,
}: StoryboardActionPreviewProps) {
  // ask_user actions 不展示在 preview 主体中（它们已体现在 AI 回复消息里）
  const previewActions = actions.filter((a) => a.type !== "ask_user");

  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    previewActions.length === 1 ? 0 : null
  );

  const hasDestructive = previewActions.some(
    (a) => ACTION_META[a.type].destructive
  );

  // 全是 ask_user 时，不应进入 preview；做防御展示
  const isAskUserOnly = previewActions.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col bg-[#0d0f14] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl shadow-black/30"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <p className="text-xs font-medium text-neutral-300 flex-1 truncate">
          {intent ?? "AI 建议操作"}
        </p>
        {previewActions.length > 0 && (
          <span className="text-[10px] text-neutral-600 shrink-0">
            {previewActions.length} 项操作
          </span>
        )}
      </div>

      {/* ── Action list ────────────────────────────────────── */}
      <div
        className="px-3 py-3 space-y-1 max-h-[380px] overflow-y-auto
          [&::-webkit-scrollbar]:w-[3px]
          [&::-webkit-scrollbar-thumb]:bg-white/10
          [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {isAskUserOnly ? (
          <p className="text-[11px] text-neutral-600 text-center py-4">
            AI 正在等待你的回复，无需确认操作。
          </p>
        ) : (
          previewActions.map((action, i) => (
            <div key={i}>
              <ActionSummaryRow
                action={action}
                index={i}
                isExpanded={expandedIndex === i}
                scenes={scenes}
                onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              />
              <AnimatePresence initial={false}>
                {expandedIndex === i && (
                  <motion.div
                    key="detail"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <ActionDetail action={action} scenes={scenes} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* ── Warnings ───────────────────────────────────────── */}
      {(hasDestructive || warnings.length > 0) && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 space-y-1">
          {hasDestructive && warnings.length === 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={11} className="text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-400/80">包含不可逆操作，请仔细确认</p>
            </div>
          )}
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-400/80">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-neutral-500 hover:text-neutral-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all duration-150"
        >
          <X size={12} />
          取消
        </button>

        <button
          onClick={onConfirm}
          disabled={isAskUserOnly}
          className={`flex-[2] flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]
            ${
              hasDestructive
                ? "bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 hover:border-red-500/40 text-red-400"
                : "bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/25 hover:border-cyan-500/40 text-cyan-300"
            }`}
        >
          <Check size={12} />
          {hasDestructive ? "确认执行" : "确认应用"}
        </button>
      </div>
    </motion.div>
  );
}
