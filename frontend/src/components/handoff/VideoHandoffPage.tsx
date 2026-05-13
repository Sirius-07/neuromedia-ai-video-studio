import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Archive, FileText, Loader2 } from 'lucide-react';
import { exportHandoffPackage } from '../../api/handoffExportApi';
import type { AssetInfo } from '../../api/scriptApi';
import type { InspirationProposal } from '../InspirationModal';
import type { CreationIntent } from '../../types/creationIntent';
import type { AgentMessage, AgentPatch, HandoffShot, VideoHandoffSample } from '../../types/videoHandoff';
import { buildInitialHandoffSample, type BuildInitialHandoffSampleParams } from './handoffSampleBuilder';
import { HandoffAgentPanel } from './HandoffAgentPanel';
import { HandoffPlayer } from './HandoffPlayer';
import { HandoffShotTable } from './HandoffShotTable';
import './VideoHandoffPage.css';

interface VideoHandoffRouteState {
  creationIntent?: CreationIntent;
  proposal?: InspirationProposal;
  scenes?: BuildInitialHandoffSampleParams['scenes'];
  assets?: AssetInfo[];
  selectedAssetIds?: string[];
  projectTitle?: string;
  projectData?: { title?: string };
  reportText?: string;
  previewVideoUrl?: string;
}

function createPreviewPatch(intent: string, selectedShot: HandoffShot | undefined): AgentPatch {
  const affectedShotIds = selectedShot ? [selectedShot.id] : [];
  const patch: AgentPatch['patch'] = {};
  const trimmedIntent = intent.trim();

  if (/字幕|旁白|文案|解说/.test(trimmedIntent)) {
    patch.captionOrVoiceover = `建议改写：${trimmedIntent}`;
  }

  if (/开头|抓人|更强/.test(trimmedIntent)) {
    patch.visualIntent = selectedShot
      ? `更突出新闻开场冲突或人物情绪：${selectedShot.visualIntent}`
      : `更突出新闻开场冲突或人物情绪：${trimmedIntent}`;
  }

  if (/短|快|压缩|节奏/.test(trimmedIntent) && selectedShot) {
    patch.durationSeconds = Math.max(3, selectedShot.durationSeconds - 1);
  }

  if (/现场|素材|真实|减少 AI|减少AI/.test(trimmedIntent)) {
    patch.productionNote = '优先使用已上传现场素材承载画面；AI 画面只做补足和转场参考，避免让制作人员误解为最终事实画面。';
  } else if (/正式|新闻|专业/.test(trimmedIntent)) {
    patch.productionNote = '按新闻短片语气处理：少用夸张转场，镜头节奏克制，字幕信息清晰，保留事实重点。';
  } else if (!patch.productionNote) {
    patch.productionNote = `根据记者意图调整：${trimmedIntent}`;
  }

  return {
    id: `patch-${Date.now()}`,
    status: 'preview',
    summary: `准备修改：${trimmedIntent}`,
    affectedShotIds,
    affectedAssetIds: [],
    patch,
  };
}

function createUserMessage(content: string): AgentMessage {
  return {
    id: `user-message-${Date.now()}`,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  };
}

function applyPatchToSample(sample: VideoHandoffSample, patch: AgentPatch): VideoHandoffSample {
  const affectedShotIds = new Set(patch.affectedShotIds);
  const shouldApplyToAll = affectedShotIds.size === 0;

  return {
    ...sample,
    shots: sample.shots.map(shot => {
      if (!shouldApplyToAll && !affectedShotIds.has(shot.id)) return shot;
      return {
        ...shot,
        ...patch.patch,
      };
    }),
    exportPackage: {
      ...sample.exportPackage,
      status: 'not_started',
    },
  };
}

export const VideoHandoffPage: React.FC = () => {
  const location = useLocation();
  const initialSample = useMemo(() => {
    const routeState = (location.state || {}) as VideoHandoffRouteState;
    return (
      buildInitialHandoffSample({
        creationIntent: routeState.creationIntent,
        reportText: routeState.reportText,
        proposal: routeState.proposal,
        scenes: routeState.scenes,
        assets: routeState.assets,
        selectedAssetIds: routeState.selectedAssetIds,
        projectTitle: routeState.projectTitle || routeState.projectData?.title,
        previewVideoUrl: routeState.previewVideoUrl,
      })
    );
  }, [location.state]);
  const [sample, setSample] = useState<VideoHandoffSample>(initialSample);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(sample.shots[0]?.id || null);
  const [messages, setMessages] = useState<AgentMessage[]>(sample.agentMessages);
  const [pendingPatch, setPendingPatch] = useState<AgentPatch | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setSample(initialSample);
    setSelectedShotId(initialSample.shots[0]?.id || null);
    setMessages(initialSample.agentMessages);
    setPendingPatch(null);
    setExportError(null);
  }, [initialSample]);

  const selectedShot = sample.shots.find(shot => shot.id === selectedShotId);

  const handleCreatePatch = (intent: string) => {
    setMessages(previous => [...previous, createUserMessage(intent)]);
    setPendingPatch(createPreviewPatch(intent, selectedShot));
  };

  const handleConfirmPatch = () => {
    if (!pendingPatch) return;
    setSample(previous => applyPatchToSample(previous, pendingPatch));
    setMessages(previous => [
      ...previous,
      {
        id: `agent-message-${Date.now()}`,
        role: 'agent',
        content: '已更新样片和分镜表。你可以继续说“让开头更抓人”“减少 AI 画面”“把这一镜头改成字幕解释”等，我会先给修改预览再应用。',
        createdAt: new Date().toISOString(),
        patchId: pendingPatch.id,
      },
    ]);
    setPendingPatch(null);
  };

  const handleExportPackage = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportHandoffPackage({
        ...sample,
        agentMessages: messages,
      });
      setMessages(previous => [
        ...previous,
        {
          id: `agent-message-${Date.now()}`,
          role: 'agent',
          content: '交接包已导出：包含结构化分镜表和当前样片数据。若后续生成了真实 MP4，可重新导出并随包附带视频文件。',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '交接包导出失败，请稍后重试';
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="video-handoff-page">
      <div className="video-handoff-page__toolbar">
        <div>
          <span>新闻视频交接</span>
          <p>{sample.summary}</p>
        </div>
        <div className="video-handoff-page__actions">
          <button type="button" onClick={() => document.getElementById('handoff-shot-table')?.scrollIntoView({ behavior: 'smooth' })}>
            <FileText size={16} />
            分镜卡片
          </button>
          <button type="button" onClick={handleExportPackage} disabled={isExporting}>
            {isExporting ? <Loader2 size={16} className="handoff-spin" /> : <Archive size={16} />}
            {isExporting ? '导出中' : '导出交接包'}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="video-handoff-page__notice is-error">
          {exportError}
        </div>
      )}

      <div className="video-handoff-page__layout">
        <div className="video-handoff-page__primary">
          <HandoffPlayer sample={sample} selectedShotId={selectedShotId} onSelectShot={setSelectedShotId} />
        </div>
        <HandoffAgentPanel
          selectedShot={selectedShot}
          messages={messages}
          pendingPatch={pendingPatch}
          onCreatePatch={handleCreatePatch}
          onConfirmPatch={handleConfirmPatch}
          onCancelPatch={() => setPendingPatch(null)}
        />
      </div>

      <HandoffShotTable
        shots={sample.shots}
        selectedShotId={selectedShotId}
        pendingShotIds={pendingPatch?.affectedShotIds}
        onSelectShot={setSelectedShotId}
      />
    </main>
  );
};

export default VideoHandoffPage;
