// assistant/ScriptAssistantActionPreview.tsx
// 结构化 Action 预览组件 —— 展示 AI 建议的修改，供用户确认后应用

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FilePen,
  PlusCircle,
  Trash2,
  ArrowUpDown,
  Timer,
  Layers,
  Palette,
  MessageCircleQuestion,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Action 类型定义（与 schema/script.ts 对齐）
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
// 元数据：每种 action type 的展示配置
// ─────────────────────────────────────────────────────────────

const ACTION_META: Record<
  AssistantAction["type"],
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;       // Tailwind text color
    border: string;      // Tailwind border color
    bg: string;          // Tailwind bg color
    destructive?: boolean;
  }
> = {
  update_shot_script: {
    label: "修改脚本文案",
    icon: FilePen,
    color: "text-cyan-400",
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/5",
  },
  add_shot: {
    label: "新增 Shot",
    icon: PlusCircle,
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
  },
  remove_shot: {
    label: "删除 Shot",
    icon: Trash2,
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    destructive: true,
  },
  reorder_shots: {
    label: "重新排序",
    icon: ArrowUpDown,
    color: "text-violet-400",
    border: "border-violet-500/20",
    bg: "bg-violet-500/5",
  },
  update_shot_duration: {
    label: "修改时长",
    icon: Timer,
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
  },
  bulk_rewrite_shots: {
    label: "批量改写",
    icon: Layers,
    color: "text-sky-400",
    border: "border-sky-500/20",
    bg: "bg-sky-500/5",
  },
  update_project_style_note: {
    label: "更新全局风格",
    icon: Palette,
    color: "text-fuchsia-400",
    border: "border-fuchsia-500/20",
    bg: "bg-fuchsia-500/5",
  },
  ask_user: {
    label: "AI 提问",
    icon: MessageCircleQuestion,
    color: "text-neutral-400",
    border: "border-neutral-500/20",
    bg: "bg-neutral-500/5",
  },
};

// ─────────────────────────────────────────────────────────────
// Sub-component: ActionSummaryRow
// 单条 action 的折叠行
// ─────────────────────────────────────────────────────────────

interface ActionSummaryRowProps {
  action: AssistantAction;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function ActionSummaryRow({
  action,
  index,
  isExpanded,
  onToggle,
}: ActionSummaryRowProps) {
  const meta = ACTION_META[action.type];
  const Icon = meta.icon;

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-150 text-left
        ${isExpanded ? `${meta.bg} ${meta.border}` : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"}`}
    >
      {/* Index badge */}
      <span className="w-4 h-4 rounded-sm bg-white/[0.06] flex items-center justify-center text-[9px] text-neutral-500 font-mono shrink-0">
        {index + 1}
      </span>

      {/* Icon */}
      <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${meta.color}`}>
        <Icon size={13} />
      </div>

      {/* Label + summary */}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium ${meta.color}`}>{meta.label}</p>
        <p className="text-[10px] text-neutral-500 truncate mt-0.5">
          {getActionSummary(action)}
        </p>
      </div>

      {/* Expand chevron */}
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
// Sub-component: ActionDetail
// 展开后的详细内容区
// ─────────────────────────────────────────────────────────────

function ActionDetail({ action }: { action: AssistantAction }) {
  const meta = ACTION_META[action.type];

  switch (action.type) {
    case "update_shot_script":
      return (
        <DetailWrapper meta={meta}>
          <DetailRow label="Shot ID" value={action.shotId} mono />
          {action.patch.narration && (
            <DetailField label="旁白" value={action.patch.narration} highlight />
          )}
          {action.patch.visualDescription && (
            <DetailField label="画面描述" value={action.patch.visualDescription} highlight />
          )}
          {action.patch.musicNote && (
            <DetailField label="音乐备注" value={action.patch.musicNote} />
          )}
          {action.reason && <DetailField label="改动原因" value={action.reason} muted />}
        </DetailWrapper>
      );

    case "add_shot":
      return (
        <DetailWrapper meta={meta}>
          {action.afterShotId ? (
            <DetailRow label="插入位置" value={`Shot ${action.afterShotId} 之后`} />
          ) : (
            <DetailRow label="插入位置" value="追加到末尾" />
          )}
          {action.shot.narration && (
            <DetailField label="旁白" value={action.shot.narration} highlight />
          )}
          {action.shot.visualDescription && (
            <DetailField label="画面描述" value={action.shot.visualDescription} highlight />
          )}
          <DetailRow label="时长" value={`${action.shot.duration} 秒`} />
          {action.shot.musicNote && (
            <DetailField label="音乐备注" value={action.shot.musicNote} />
          )}
        </DetailWrapper>
      );

    case "remove_shot":
      return (
        <DetailWrapper meta={meta}>
          <DetailRow label="删除 Shot" value={action.shotId} mono />
          {action.reason && <DetailField label="原因" value={action.reason} muted />}
          <DestructiveWarning text="此操作不可直接撤销，请确认后执行" />
        </DetailWrapper>
      );

    case "reorder_shots":
      return (
        <DetailWrapper meta={meta}>
          <p className="text-[10px] text-neutral-500 mb-1.5">新排列顺序</p>
          <div className="flex flex-wrap gap-1">
            {action.orderedShotIds.map((id, i) => (
              <div key={id} className="flex items-center gap-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-neutral-400 font-mono">
                  {id}
                </span>
                {i < action.orderedShotIds.length - 1 && (
                  <ChevronRight size={10} className="text-neutral-700" />
                )}
              </div>
            ))}
          </div>
        </DetailWrapper>
      );

    case "update_shot_duration":
      return (
        <DetailWrapper meta={meta}>
          <DetailRow label="Shot ID" value={action.shotId} mono />
          <DetailRow label="新时长" value={`${action.duration} 秒`} accent />
          {action.reason && <DetailField label="原因" value={action.reason} muted />}
        </DetailWrapper>
      );

    case "bulk_rewrite_shots":
      return (
        <DetailWrapper meta={meta}>
          {action.reason && <DetailField label="改写方向" value={action.reason} muted />}
          <p className="text-[10px] text-neutral-500 mb-1.5 mt-1">
            涉及 {action.items.length} 个 Shot
          </p>
          <div className="space-y-2">
            {action.items.map((item) => (
              <div
                key={item.shotId}
                className="pl-2 border-l border-white/[0.08] space-y-1"
              >
                <p className="text-[10px] font-mono text-neutral-500">{item.shotId}</p>
                {item.patch.narration && (
                  <p className="text-[10px] text-neutral-300 leading-relaxed">
                    {item.patch.narration}
                  </p>
                )}
                {item.patch.visualDescription && (
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    {item.patch.visualDescription}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DetailWrapper>
      );

    case "update_project_style_note":
      return (
        <DetailWrapper meta={meta}>
          {action.patch.styleNote && (
            <DetailField label="风格说明" value={action.patch.styleNote} highlight />
          )}
          {action.patch.soundtrackNote && (
            <DetailField label="配乐备注" value={action.patch.soundtrackNote} highlight />
          )}
        </DetailWrapper>
      );

    case "ask_user":
      return (
        <DetailWrapper meta={meta}>
          <DetailField label="问题" value={action.question} highlight />
          {action.hypothesis && (
            <DetailField label="AI 推断" value={action.hypothesis} muted />
          )}
          {action.options && action.options.length > 0 && (
            <div>
              <p className="text-[10px] text-neutral-500 mb-1.5">可选项</p>
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

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Detail 子组件
// ─────────────────────────────────────────────────────────────

type MetaType = (typeof ACTION_META)[keyof typeof ACTION_META];

function DetailWrapper({
  meta,
  children,
}: {
  meta: MetaType;
  children: React.ReactNode;
}) {
  return (
    <div className={`px-3 py-2.5 rounded-b-lg border-x border-b space-y-2 ${meta.border} ${meta.bg}`}>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-neutral-600 shrink-0">{label}</span>
      <span
        className={`text-[10px] truncate ${
          mono
            ? "font-mono text-neutral-400"
            : accent
            ? "text-cyan-300 font-medium"
            : "text-neutral-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailField({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-neutral-600">{label}</p>
      <p
        className={`text-[11px] leading-relaxed ${
          highlight
            ? "text-neutral-200"
            : muted
            ? "text-neutral-500 italic"
            : "text-neutral-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DestructiveWarning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
      <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
      <p className="text-[10px] text-red-400/80">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 工具：生成 action 的一行摘要文本
// ─────────────────────────────────────────────────────────────

function getActionSummary(action: AssistantAction): string {
  switch (action.type) {
    case "update_shot_script": {
      const fields = [
        action.patch.narration && "旁白",
        action.patch.visualDescription && "画面描述",
        action.patch.musicNote && "音乐备注",
      ].filter(Boolean);
      return `Shot ${action.shotId} · 更新 ${fields.join("、")}`;
    }
    case "add_shot":
      return action.afterShotId
        ? `插入到 Shot ${action.afterShotId} 之后 · ${action.shot.duration}s`
        : `追加到末尾 · ${action.shot.duration}s`;
    case "remove_shot":
      return `删除 Shot ${action.shotId}`;
    case "reorder_shots":
      return `重排 ${action.orderedShotIds.length} 个 shot`;
    case "update_shot_duration":
      return `Shot ${action.shotId} → ${action.duration}s`;
    case "bulk_rewrite_shots":
      return `批量改写 ${action.items.length} 个 shot`;
    case "update_project_style_note": {
      const fields = [
        action.patch.styleNote && "风格说明",
        action.patch.soundtrackNote && "配乐备注",
      ].filter(Boolean);
      return `更新 ${fields.join("、")}`;
    }
    case "ask_user":
      return action.question.length > 32
        ? action.question.slice(0, 32) + "…"
        : action.question;
    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────
// Main: ScriptAssistantActionPreview
// ─────────────────────────────────────────────────────────────

export interface ScriptAssistantActionPreviewProps {
  intent: string;
  actions: AssistantAction[];
  warnings?: string[];
  /** 是否包含破坏性操作（remove_shot 等）会自动检测，也可手动覆盖 */
  isDestructive?: boolean;
  isApplying?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ScriptAssistantActionPreview({
  intent,
  actions,
  warnings = [],
  isDestructive,
  isApplying = false,
  onConfirm,
  onCancel,
}: ScriptAssistantActionPreviewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    actions.length === 1 ? 0 : null
  );

  const hasDestructive =
    isDestructive ??
    actions.some((a) => ACTION_META[a.type].destructive);

  const isAskUser =
    actions.length === 1 && actions[0].type === "ask_user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col bg-[#0d0f14] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl shadow-black/30"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <p className="text-xs font-medium text-neutral-300 flex-1 truncate">
          {intent}
        </p>
        <span className="text-[10px] text-neutral-600">
          {actions.length} 项操作
        </span>
      </div>

      {/* ── Action list ── */}
      <div className="px-3 py-3 space-y-1 max-h-[360px] overflow-y-auto
        [&::-webkit-scrollbar]:w-[3px]
        [&::-webkit-scrollbar-thumb]:bg-white/10
        [&::-webkit-scrollbar-thumb]:rounded-full">
        {actions.map((action, i) => (
          <div key={i}>
            <ActionSummaryRow
              action={action}
              index={i}
              isExpanded={expandedIndex === i}
              onToggle={() =>
                setExpandedIndex(expandedIndex === i ? null : i)
              }
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
                  <ActionDetail action={action} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* ── Warnings ── */}
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

      {/* ── Footer actions ── */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <button
          onClick={onCancel}
          disabled={isApplying}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-neutral-500 hover:text-neutral-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all duration-150 disabled:opacity-40"
        >
          <X size={12} />
          取消
        </button>

        <button
          onClick={onConfirm}
          disabled={isApplying || isAskUser}
          className={`flex-[2] flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]
            ${
              hasDestructive
                ? "bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 hover:border-red-500/40 text-red-400"
                : "bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/25 hover:border-cyan-500/40 text-cyan-300"
            }`}
        >
          {isApplying ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              应用中...
            </>
          ) : isAskUser ? (
            <>
              <MessageCircleQuestion size={12} />
              请先回复 AI
            </>
          ) : (
            <>
              <Check size={12} />
              {hasDestructive ? "确认执行" : "确认应用"}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mock actions 示例（开发调试用）
// ─────────────────────────────────────────────────────────────

export const MOCK_ACTIONS: AssistantAction[] = [
  {
    type: "update_shot_script",
    shotId: "shot_003",
    patch: {
      narration:
        "镜头从云端俯冲而下——珠江新城的玻璃森林拔地而起，广州塔在金色光海中傲然矗立，这座城市，正以最自信的姿态，向世界宣告它的时代。",
      visualDescription:
        "无人机俯冲镜头，珠江新城全景，广州塔夜景灯光秀",
    },
    reason: "增强现代活力感，突出广州城市精神",
  },
  {
    type: "update_shot_duration",
    shotId: "shot_003",
    duration: 12,
    reason: "新旁白文案较长，延长 2 秒确保旁白完整播放",
  },
  {
    type: "add_shot",
    afterShotId: "shot_005",
    shot: {
      narration: "千年商都，盛世广州——愿山河无恙，岁月如歌",
      visualDescription:
        "夜色中广州塔与珠江倒影，五星红旗在风中舒展，慢镜头",
      duration: 8,
      musicNote: "音乐渐强至高潮，最后两秒缓慢淡出",
    },
  },
];

export const MOCK_BULK_ACTIONS: AssistantAction[] = [
  {
    type: "bulk_rewrite_shots",
    reason: "统一国庆主题叙事风格，加强历史厚重感",
    items: [
      {
        shotId: "shot_001",
        patch: {
          narration:
            "晨光穿透陈家祠的雕花窗棂，千年匠心在金色光影中苏醒——这是广州，也是岭南文化的原点。",
        },
      },
      {
        shotId: "shot_002",
        patch: {
          narration:
            "南越王墓的青铜器在灯光下沉默而庄严，每一件文物，都是两千年历史的低语。",
        },
      },
    ],
  },
  {
    type: "reorder_shots",
    orderedShotIds: [
      "shot_001",
      "shot_002",
      "shot_004",
      "shot_003",
      "shot_005",
    ],
  },
  {
    type: "remove_shot",
    shotId: "shot_003",
    reason: "重排序后 shot_003 内容与 shot_004 高度重复，建议删除",
  },
];
