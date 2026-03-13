// assistant/components/UndoButton.tsx
// 撤销按钮组件：展示撤销栈顶信息、支持 hover 展开历史记录

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, Clock, ChevronDown } from "lucide-react";
import type { UndoRecord } from "../hooks/useScriptAssistant";

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

export interface UndoButtonProps {
  canUndo:    boolean;
  undoTop:    UndoRecord | null;
  undoStack:  UndoRecord[];
  onUndo:     () => void;
}

// ─────────────────────────────────────────────────────────────
// 工具：格式化应用时间
// ─────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────
// UndoButton
// ─────────────────────────────────────────────────────────────

export default function UndoButton({
  canUndo,
  undoTop,
  undoStack,
  onUndo,
}: UndoButtonProps) {
  const [isOpen,  setIsOpen]  = useState(false);
  const panelRef              = useRef<HTMLDivElement>(null);

  // 点击外部关闭面板
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // 无可撤销内容：置灰按钮
  if (!canUndo || !undoTop) {
    return (
      <button
        disabled
        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md
          bg-white/[0.02] border border-white/[0.05] text-neutral-700
          cursor-not-allowed select-none"
        title="暂无可撤销操作"
      >
        <Undo2 size={11} />
        <span>撤销</span>
      </button>
    );
  }

  return (
    <div ref={panelRef} className="relative">

      {/* ── 主按钮 ── */}
      <div className="flex items-stretch rounded-md overflow-hidden border border-amber-500/20 bg-amber-500/8">

        {/* 撤销动作按钮 */}
        <button
          onClick={() => { onUndo(); setIsOpen(false); }}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-amber-400
            hover:bg-amber-500/15 transition-colors"
          title={`撤销「${undoTop.label}」（${formatTime(undoTop.appliedAt)}）`}
        >
          <Undo2 size={11} />
          <span className="max-w-[80px] truncate">{undoTop.label}</span>
        </button>

        {/* 分隔线 */}
        {undoStack.length > 1 && (
          <div className="w-px bg-amber-500/15 self-stretch" />
        )}

        {/* 展开历史按钮 */}
        {undoStack.length > 1 && (
          <button
            onClick={() => setIsOpen((v) => !v)}
            className="px-1.5 text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/15 transition-colors"
            title="查看撤销历史"
          >
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronDown size={11} />
            </motion.div>
          </button>
        )}
      </div>

      {/* ── 撤销历史面板 ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-64 z-50
              bg-[#0d0f14] border border-white/[0.1] rounded-xl
              shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* 面板标题 */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
              <Clock size={11} className="text-neutral-500" />
              <span className="text-[10px] text-neutral-500 tracking-wide uppercase">
                撤销历史（{undoStack.length} 条）
              </span>
            </div>

            {/* 记录列表 */}
            <div className="max-h-48 overflow-y-auto
              [&::-webkit-scrollbar]:w-[3px]
              [&::-webkit-scrollbar-thumb]:bg-white/10
              [&::-webkit-scrollbar-thumb]:rounded-full">
              {undoStack.map((record, index) => (
                <button
                  key={record.id}
                  onClick={() => {
                    // 撤销到选中的历史点（连续调用 undo index+1 次）
                    // 简化实现：每次点击只撤销一步，用户多次点击逐步回退
                    onUndo();
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors
                    ${index === 0
                      ? "hover:bg-amber-500/10 border-b border-white/[0.04]"
                      : "hover:bg-white/[0.04] border-b border-white/[0.03] opacity-60 hover:opacity-100"
                    }`}
                >
                  {/* 序号标记 */}
                  <div className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-mono shrink-0 mt-0.5
                    ${index === 0
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-white/[0.05] text-neutral-600"
                    }`}>
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] truncate ${index === 0 ? "text-amber-300" : "text-neutral-400"}`}>
                      {record.label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-neutral-600">
                        {formatTime(record.appliedAt)}
                      </span>
                      <span className="text-[9px] text-neutral-700">
                        {record.actionCount} 项操作
                      </span>
                    </div>
                  </div>

                  {index === 0 && (
                    <Undo2 size={11} className="text-amber-500/60 mt-1 shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* 底部提示 */}
            <div className="px-3 py-2 border-t border-white/[0.06] bg-white/[0.01]">
              <p className="text-[9px] text-neutral-700 text-center">
                每次点击撤销最近一步 · Cmd+Z 快捷键
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
