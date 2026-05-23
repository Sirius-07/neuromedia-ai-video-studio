import React, { useState } from 'react';
import { Bot, Check, RotateCcw, Send } from 'lucide-react';
import type { AgentMessage, AgentPatch, HandoffShot } from '../../types/videoHandoff';

interface HandoffAgentPanelProps {
  selectedShot?: HandoffShot;
  messages: AgentMessage[];
  pendingPatch: AgentPatch | null;
  onCreatePatch: (intent: string) => void;
  onConfirmPatch: () => void;
  onCancelPatch: () => void;
}

const QUICK_INTENTS = [
  '开头更抓人',
  '更像正式新闻',
  '减少 AI 画面',
  '强化现场素材',
  '重写字幕',
];

export const HandoffAgentPanel: React.FC<HandoffAgentPanelProps> = ({
  selectedShot,
  messages,
  pendingPatch,
  onCreatePatch,
  onConfirmPatch,
  onCancelPatch,
}) => {
  const [draft, setDraft] = useState('');
  const contextLabel = selectedShot ? `正在查看镜头 ${selectedShot.index}` : '当前未选中镜头';

  const submitDraft = () => {
    const intent = draft.trim();
    if (!intent) return;
    onCreatePatch(intent);
    setDraft('');
  };

  return (
    <aside className="handoff-agent" aria-label="意图编辑 Agent">
      <div className="handoff-agent__header">
        <span>
          <Bot size={18} />
        </span>
        <div>
          <h2>意图编辑 Agent</h2>
          <p>{contextLabel}</p>
        </div>
      </div>

      <div className="handoff-agent__messages">
        {messages.map(message => (
          <div key={message.id} className={`handoff-agent__message is-${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      <div className="handoff-agent__quick">
        {QUICK_INTENTS.map(intent => (
          <button key={intent} type="button" onClick={() => onCreatePatch(intent)}>
            {intent}
          </button>
        ))}
      </div>

      {pendingPatch && (
        <div className="handoff-agent__preview">
          <strong>{pendingPatch.summary}</strong>
          <p>
            将影响 {pendingPatch.affectedShotIds.length || 1} 个镜头，确认后会同步更新样片和分镜表。
          </p>
          <div>
            <button type="button" onClick={onConfirmPatch}>
              <Check size={14} />
              确认建议
            </button>
            <button type="button" onClick={onCancelPatch}>
              <RotateCcw size={14} />
              取消
            </button>
          </div>
        </div>
      )}

      <div className="handoff-agent__composer">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') submitDraft();
          }}
          placeholder={selectedShot ? `针对镜头 ${selectedShot.index} 输入修改意见` : '输入对样片的修改意见'}
        />
        <button type="button" onClick={submitDraft} aria-label="发送修改意见">
          <Send size={16} />
        </button>
      </div>
    </aside>
  );
};
