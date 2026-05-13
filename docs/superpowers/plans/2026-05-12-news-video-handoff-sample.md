# News Video Handoff Sample Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reporter-facing “quick/draft mode” flow with a single news video handoff workflow that generates a playable sample video, a structured shot table, an intent-editing Agent panel, and a minimal handoff package.

**Architecture:** Add a new handoff domain layer and `/handoff` result page while keeping the existing storyboard workbench as an advanced route. The new page owns reporter-facing preview/edit/export behavior; existing storyboard generation, asset upload, image/video APIs, and rough-cut export are reused where practical. Backend export adds image-to-video normalization and a simple PDF handoff table generator.

**Tech Stack:** React 18, React Router, TypeScript, Vitest, Tailwind classes, Express, Node ESM, FFmpeg, `pdfkit` for PDF generation.

---

## File Structure

- Create `frontend/src/types/videoHandoff.ts` for the handoff intent, shots, agent proposals, and package types.
- Create `frontend/src/components/handoff/handoffSampleBuilder.ts` for deterministic mapping from text/assets/proposals/scenes into handoff sample state.
- Create `frontend/src/components/handoff/handoffSampleBuilder.test.ts` for unit coverage.
- Create `frontend/src/components/handoff/VideoHandoffPage.tsx` as the new reporter result surface.
- Create `frontend/src/components/handoff/HandoffPlayer.tsx` for playable sample preview and source labels.
- Create `frontend/src/components/handoff/HandoffShotTable.tsx` for the structured shot table.
- Create `frontend/src/components/handoff/HandoffAgentPanel.tsx` for the CUI Agent interaction surface.
- Create `frontend/src/components/handoff/useHandoffAgent.ts` and `useHandoffAgent.test.ts` for intent parsing, proposal preview, and confirm/cancel state.
- Modify `frontend/src/components/StartPage.tsx` to remove the dual-mode choice from the reporter path and navigate to `/handoff`.
- Modify `frontend/src/components/studio/StudioApp.tsx` and `frontend/src/components/studio/studioHeaderMeta.ts` to register `/handoff`.
- Create `frontend/src/api/handoffExportApi.ts` for MP4/PDF package export calls.
- Create `backend/src/services/HandoffSampleExportService.js` to normalize image/video scenes into an MP4 sample.
- Create `backend/src/services/HandoffPackageService.js` to generate the PDF shot table.
- Create `backend/src/controllers/handoffExportController.js` and `backend/src/routes/handoffExportRoutes.js`.
- Modify `backend/src/index.js` to mount `/api/v1/handoff-export`.
- Modify `backend/package.json` to add `pdfkit`.
- Create `backend/test-handoff-export-service.mjs` and `backend/test-handoff-package-service.mjs`.

## Task 1: Handoff Domain Types And Builder

**Files:**
- Create: `frontend/src/types/videoHandoff.ts`
- Create: `frontend/src/components/handoff/handoffSampleBuilder.ts`
- Test: `frontend/src/components/handoff/handoffSampleBuilder.test.ts`

- [ ] **Step 1: Write the failing builder tests**

Create `frontend/src/components/handoff/handoffSampleBuilder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildInitialHandoffSample } from './handoffSampleBuilder';

describe('buildInitialHandoffSample', () => {
  it('creates source-labeled handoff shots from generated scenes', () => {
    const sample = buildInitialHandoffSample({
      reportText: '广州老街区里，一家人用一碗热汤记录城市记忆。',
      assets: [
        { file_path: '/uploads/assets/kitchen.jpg', file_type: 'image', name: 'kitchen.jpg', selected: true },
      ] as any,
      proposal: {
        title: '广州记忆',
        summary: '以食物和家庭关系呈现城市温情',
        visualStyle: '真实纪实',
        bgmStyle: '温暖钢琴',
        reasoning: '突出家庭味道和代际记忆',
        roughScript: { scenes: [] },
      } as any,
      scenes: [
        {
          description: '奶奶把热汤端到桌前',
          narration: '一碗热汤，藏着广州记忆。',
          visualPrompt: '老厨房，热汤，孩子记录',
          duration: 5,
          assetUrl: '/uploads/assets/kitchen.jpg',
        },
        {
          description: '街角小店亮起灯',
          narration: '熟悉的街角，是城市的坐标。',
          visualPrompt: '广州街角，傍晚，小店灯光',
          duration: 4,
        },
      ],
    });

    expect(sample.title).toBe('广州记忆');
    expect(sample.positioningLabel).toBe('制作沟通样片，非发布成片');
    expect(sample.shots).toHaveLength(2);
    expect(sample.shots[0]).toMatchObject({
      id: 'shot-1',
      index: 1,
      durationSeconds: 5,
      source: { type: 'uploaded_asset', label: '现场素材' },
    });
    expect(sample.shots[1]).toMatchObject({
      id: 'shot-2',
      index: 2,
      durationSeconds: 4,
      source: { type: 'ai_reference', label: 'AI参考画面' },
    });
  });

  it('falls back to one planning shot when no scenes exist', () => {
    const sample = buildInitialHandoffSample({
      reportText: '一条需要转成短视频的新闻报道。',
      assets: [],
      proposal: undefined,
      scenes: [],
    });

    expect(sample.shots).toHaveLength(1);
    expect(sample.shots[0].visualIntent).toContain('提炼报道主线');
    expect(sample.shots[0].source.type).toBe('placeholder');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npx vitest run src/components/handoff/handoffSampleBuilder.test.ts
```

Expected: FAIL because `handoffSampleBuilder.ts` does not exist.

- [ ] **Step 3: Add the handoff types**

Create `frontend/src/types/videoHandoff.ts`:

```ts
import type { AssetInfo } from '../api/scriptApi';
import type { InspirationProposal } from '../components/InspirationModal';

export type HandoffSourceType = 'uploaded_asset' | 'ai_reference' | 'placeholder';

export interface HandoffSource {
  type: HandoffSourceType;
  label: '现场素材' | 'AI参考画面' | '待制作';
  assetUrl?: string;
  assetName?: string;
}

export interface HandoffShot {
  id: string;
  index: number;
  durationSeconds: number;
  visualIntent: string;
  captionOrVoiceover: string;
  source: HandoffSource;
  productionNote: string;
  visualPrompt: string;
}

export interface HandoffSample {
  title: string;
  reportText: string;
  summary: string;
  positioningLabel: '制作沟通样片，非发布成片';
  assets: AssetInfo[];
  proposal?: InspirationProposal;
  shots: HandoffShot[];
  previewVideoUrl?: string;
}

export type HandoffAgentChangeType =
  | 'rewrite_caption'
  | 'replace_source'
  | 'adjust_duration'
  | 'change_tone'
  | 'reduce_ai_reference';

export interface HandoffAgentProposedChange {
  id: string;
  type: HandoffAgentChangeType;
  title: string;
  explanation: string;
  affectedShotIds: string[];
  patch: Partial<HandoffShot> & { source?: HandoffSource };
}

export interface HandoffExportPackage {
  sampleVideoUrl: string;
  shotTablePdfUrl: string;
  filenameBase: string;
}
```

- [ ] **Step 4: Add the deterministic builder**

Create `frontend/src/components/handoff/handoffSampleBuilder.ts`:

```ts
import type { AssetInfo } from '../../api/scriptApi';
import type { InspirationProposal } from '../InspirationModal';
import type { HandoffSample, HandoffShot, HandoffSource } from '../../types/videoHandoff';

function assetNameFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const name = url.split('/').pop();
  return name ? decodeURIComponent(name) : undefined;
}

function sourceFromScene(scene: any): HandoffSource {
  const assetUrl = scene.assetUrl || scene.reference_asset_path || scene.assetPath;
  if (assetUrl) {
    return {
      type: 'uploaded_asset',
      label: '现场素材',
      assetUrl,
      assetName: scene.assetName || assetNameFromUrl(assetUrl),
    };
  }
  if (scene.visualPrompt || scene.description) {
    return { type: 'ai_reference', label: 'AI参考画面' };
  }
  return { type: 'placeholder', label: '待制作' };
}

function durationFromScene(scene: any): number {
  if (typeof scene.duration === 'number') return scene.duration;
  if (typeof scene.duration === 'string') {
    const parsed = parseInt(scene.duration, 10);
    return Number.isFinite(parsed) ? parsed : 5;
  }
  return 5;
}

function buildShot(scene: any, index: number): HandoffShot {
  const source = sourceFromScene(scene);
  return {
    id: `shot-${index + 1}`,
    index: index + 1,
    durationSeconds: durationFromScene(scene),
    visualIntent: scene.description || scene.script || scene.visualPrompt || '补充这一段报道的关键画面',
    captionOrVoiceover: scene.narration || scene.caption || scene.subtitle || scene.script || '',
    source,
    productionNote:
      source.type === 'uploaded_asset'
        ? '优先保留该现场素材，可由制作人员进一步精修运动和节奏。'
        : source.type === 'ai_reference'
          ? '该镜头可作为 AI 参考画面，制作时需避免误导为真实现场。'
          : '缺少可用素材，建议后续补充现场图或视频。',
    visualPrompt: scene.visualPrompt || scene.description || '',
  };
}

export function buildInitialHandoffSample(params: {
  reportText: string;
  assets: AssetInfo[];
  proposal?: InspirationProposal;
  scenes: any[];
}): HandoffSample {
  const shots = params.scenes.length > 0
    ? params.scenes.map(buildShot)
    : [{
        id: 'shot-1',
        index: 1,
        durationSeconds: 5,
        visualIntent: '提炼报道主线，形成第一版视频表达方向。',
        captionOrVoiceover: params.reportText.slice(0, 60),
        source: { type: 'placeholder', label: '待制作' } as const,
        productionNote: '报道已输入，但还没有生成具体镜头。',
        visualPrompt: params.reportText,
      }];

  return {
    title: params.proposal?.title || '新闻视频交接样片',
    reportText: params.reportText,
    summary: params.proposal?.summary || '根据报道和素材生成的视频制作沟通样片。',
    positioningLabel: '制作沟通样片，非发布成片',
    assets: params.assets,
    proposal: params.proposal,
    shots,
  };
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run:

```powershell
npx vitest run src/components/handoff/handoffSampleBuilder.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit Task 1**

```powershell
git add frontend/src/types/videoHandoff.ts frontend/src/components/handoff/handoffSampleBuilder.ts frontend/src/components/handoff/handoffSampleBuilder.test.ts
git commit -m "feat: add video handoff sample model"
```

## Task 2: Reporter Handoff Result Page

**Files:**
- Create: `frontend/src/components/handoff/VideoHandoffPage.tsx`
- Create: `frontend/src/components/handoff/HandoffPlayer.tsx`
- Create: `frontend/src/components/handoff/HandoffShotTable.tsx`
- Create: `frontend/src/components/handoff/HandoffAgentPanel.tsx`
- Modify: `frontend/src/components/studio/StudioApp.tsx`
- Modify: `frontend/src/components/studio/studioHeaderMeta.ts`

- [ ] **Step 1: Add the player component**

Create `frontend/src/components/handoff/HandoffPlayer.tsx`:

```tsx
import React from 'react';
import { PlayCircle } from 'lucide-react';
import type { HandoffSample } from '../../types/videoHandoff';

interface HandoffPlayerProps {
  sample: HandoffSample;
  selectedShotId: string | null;
  onSelectShot: (shotId: string) => void;
}

export const HandoffPlayer: React.FC<HandoffPlayerProps> = ({ sample, selectedShotId, onSelectShot }) => {
  const selectedShot = sample.shots.find(shot => shot.id === selectedShotId) || sample.shots[0];
  const imageUrl = selectedShot?.source.assetUrl;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-xl dark:border-white/10 dark:bg-[#0b0b0d]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">{sample.title}</h1>
          <p className="mt-1 text-xs text-cyan-600 dark:text-cyan-300">{sample.positioningLabel}</p>
        </div>
        <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-500 dark:border-white/10">
          {sample.shots.length} 个镜头
        </span>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-950">
        {sample.previewVideoUrl ? (
          <video src={sample.previewVideoUrl} controls className="h-full w-full object-cover" />
        ) : imageUrl ? (
          <img src={imageUrl} alt={selectedShot.visualIntent} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-400">
            <PlayCircle size={44} />
            <span className="text-sm">样片预览生成中</span>
          </div>
        )}

        {selectedShot && (
          <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            {selectedShot.source.label}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {sample.shots.map(shot => (
          <button
            key={shot.id}
            type="button"
            onClick={() => onSelectShot(shot.id)}
            className={`min-w-[96px] rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              selectedShotId === shot.id
                ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200'
                : 'border-neutral-200 text-neutral-500 hover:text-neutral-900 dark:border-white/10 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            镜头 {shot.index}
            <span className="mt-1 block text-[10px] opacity-70">{shot.durationSeconds}s · {shot.source.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 2: Add the shot table component**

Create `frontend/src/components/handoff/HandoffShotTable.tsx`:

```tsx
import React from 'react';
import type { HandoffShot } from '../../types/videoHandoff';

interface HandoffShotTableProps {
  shots: HandoffShot[];
  selectedShotId: string | null;
  onSelectShot: (shotId: string) => void;
}

export const HandoffShotTable: React.FC<HandoffShotTableProps> = ({ shots, selectedShotId, onSelectShot }) => (
  <section className="rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:border-white/10 dark:bg-[#0b0b0d]">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">结构化分镜表</h2>
      <span className="text-xs text-neutral-400">给制作人员看的交接依据</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
        <thead className="text-neutral-400">
          <tr>
            <th className="border-b border-neutral-200 py-2 pr-3 dark:border-white/10">镜头</th>
            <th className="border-b border-neutral-200 py-2 pr-3 dark:border-white/10">画面意图</th>
            <th className="border-b border-neutral-200 py-2 pr-3 dark:border-white/10">字幕/旁白</th>
            <th className="border-b border-neutral-200 py-2 pr-3 dark:border-white/10">素材来源</th>
            <th className="border-b border-neutral-200 py-2 dark:border-white/10">制作备注</th>
          </tr>
        </thead>
        <tbody>
          {shots.map(shot => (
            <tr
              key={shot.id}
              onClick={() => onSelectShot(shot.id)}
              className={`cursor-pointer align-top ${
                selectedShotId === shot.id ? 'bg-cyan-50/80 dark:bg-cyan-500/10' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <td className="border-b border-neutral-100 py-3 pr-3 font-medium text-neutral-900 dark:border-white/5 dark:text-white">
                {shot.index}<span className="ml-1 text-neutral-400">{shot.durationSeconds}s</span>
              </td>
              <td className="border-b border-neutral-100 py-3 pr-3 text-neutral-700 dark:border-white/5 dark:text-neutral-200">{shot.visualIntent}</td>
              <td className="border-b border-neutral-100 py-3 pr-3 text-neutral-500 dark:border-white/5 dark:text-neutral-400">{shot.captionOrVoiceover}</td>
              <td className="border-b border-neutral-100 py-3 pr-3 text-neutral-500 dark:border-white/5 dark:text-neutral-400">{shot.source.label}</td>
              <td className="border-b border-neutral-100 py-3 text-neutral-500 dark:border-white/5 dark:text-neutral-400">{shot.productionNote}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
```

- [ ] **Step 3: Add the Agent panel shell**

Create `frontend/src/components/handoff/HandoffAgentPanel.tsx`:

```tsx
import React from 'react';
import { Bot, Send } from 'lucide-react';

interface HandoffAgentPanelProps {
  selectedShotLabel: string;
  onQuickIntent: (intent: string) => void;
}

const quickIntents = ['更像正式新闻', '减少 AI 画面', '缩短 10 秒', '强化现场素材', '重写字幕'];

export const HandoffAgentPanel: React.FC<HandoffAgentPanelProps> = ({ selectedShotLabel, onQuickIntent }) => (
  <aside className="rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:border-white/10 dark:bg-[#0b0b0d]">
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
        <Bot size={17} />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">意图编辑 Agent</h2>
        <p className="text-xs text-neutral-400">{selectedShotLabel}</p>
      </div>
    </div>

    <div className="rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600 dark:bg-white/[0.04] dark:text-neutral-300">
      我会先说明理解和影响范围，确认后再修改视频样片和分镜表。
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {quickIntents.map(intent => (
        <button
          key={intent}
          type="button"
          onClick={() => onQuickIntent(intent)}
          className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:text-neutral-300 dark:hover:text-cyan-200"
        >
          {intent}
        </button>
      ))}
    </div>

    <div className="mt-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-black/30">
      <input
        className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
        placeholder="例如：第三个镜头换成厨房图"
      />
      <button type="button" className="text-cyan-600 dark:text-cyan-300">
        <Send size={16} />
      </button>
    </div>
  </aside>
);
```

- [ ] **Step 4: Add the handoff page**

Create `frontend/src/components/handoff/VideoHandoffPage.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HandoffAgentPanel } from './HandoffAgentPanel';
import { HandoffPlayer } from './HandoffPlayer';
import { HandoffShotTable } from './HandoffShotTable';
import { buildInitialHandoffSample } from './handoffSampleBuilder';

export const VideoHandoffPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as any;
  const sample = useMemo(() => buildInitialHandoffSample({
    reportText: state.creationIntent?.prompt || state.userPrompt || '',
    assets: state.creationIntent?.uploadedAssets || state.uploadedAssets || [],
    proposal: state.creationIntent?.selectedProposal || state.inspirationProposal || state.proposal,
    scenes: state.customScenes || state.scenes || state.scriptData?.scenes || [],
  }), [state]);
  const [selectedShotId, setSelectedShotId] = useState(sample.shots[0]?.id || null);
  const selectedShot = sample.shots.find(shot => shot.id === selectedShotId);

  return (
    <div className="nm-flow-page flex h-full min-h-0 flex-col overflow-hidden bg-neutral-50 p-4 text-neutral-900 dark:bg-[#050505] dark:text-neutral-100">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">handoff sample</p>
          <h1 className="text-2xl font-semibold">视频交接样片</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/storyboard', { state })}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-600 hover:text-neutral-900 dark:border-white/10 dark:text-neutral-300 dark:hover:text-white"
        >
          高级分镜工作台
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <HandoffPlayer sample={sample} selectedShotId={selectedShotId} onSelectShot={setSelectedShotId} />
          <HandoffShotTable shots={sample.shots} selectedShotId={selectedShotId} onSelectShot={setSelectedShotId} />
        </div>
        <HandoffAgentPanel
          selectedShotLabel={selectedShot ? `正在查看镜头 ${selectedShot.index}` : '当前未选中镜头'}
          onQuickIntent={(intent) => console.log('[HandoffAgent] quick intent:', intent)}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Register the route and header stage**

Modify `frontend/src/components/studio/StudioApp.tsx`:

```tsx
import { VideoHandoffPage } from '../handoff/VideoHandoffPage';
```

Add to `ROUTE_TO_STAGE`:

```ts
'/handoff': 'handoff',
```

Add to `<Routes>`:

```tsx
<Route path="/handoff" element={<VideoHandoffPage />} />
```

Modify `frontend/src/components/studio/studioHeaderMeta.ts`:

```ts
const stageLabels: Record<string, string> = {
  draft: '项目',
  script: '脚本',
  style: '风格',
  storyboard: '分镜',
  handoff: '交接样片',
};
```

- [ ] **Step 6: Build and visually check the route**

Run:

```powershell
npm run build
```

Expected: PASS.

Open:

```text
http://127.0.0.1:5173/handoff
```

Expected: the page renders an empty fallback sample, no framework overlay.

- [ ] **Step 7: Commit Task 2**

```powershell
git add frontend/src/components/handoff frontend/src/components/studio/StudioApp.tsx frontend/src/components/studio/studioHeaderMeta.ts
git commit -m "feat: add video handoff sample page"
```

## Task 3: Simplify Reporter Entry Flow

**Files:**
- Modify: `frontend/src/components/StartPage.tsx`
- Modify: `frontend/src/components/startPageFlowCopy.ts`
- Modify: `frontend/src/components/startPageFlowCopy.test.ts`

- [ ] **Step 1: Update copy helper tests**

Replace the publish-goal expectations in `frontend/src/components/startPageFlowCopy.test.ts` with a single-entry expectation:

```ts
import { describe, expect, it } from 'vitest';
import { getHandoffEntryCopy } from './startPageFlowCopy';

describe('startPageFlowCopy', () => {
  it('describes the reporter handoff entry in non-editing language', () => {
    expect(getHandoffEntryCopy()).toMatchObject({
      title: '生成视频交接样片',
      primaryAction: '生成交接样片',
      description: '上传报道和现场素材，生成给制作人员看的视频样片和分镜表。',
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npx vitest run src/components/startPageFlowCopy.test.ts
```

Expected: FAIL because `getHandoffEntryCopy` is missing.

- [ ] **Step 3: Add the entry copy helper**

Modify `frontend/src/components/startPageFlowCopy.ts`:

```ts
export function getHandoffEntryCopy() {
  return {
    title: '生成视频交接样片',
    eyebrow: 'NEWS VIDEO HANDOFF',
    description: '上传报道和现场素材，生成给制作人员看的视频样片和分镜表。',
    inputPlaceholder: '粘贴新闻报道、采访稿、通稿，或写一句想法。',
    optionalIntentPlaceholder: '可选：例如“更突出人物温情”或“做成严肃新闻短片”',
    uploadLabel: '上传现场图片 / 视频素材',
    primaryAction: '生成交接样片',
  };
}
```

Keep existing publish-goal helpers until all old references are removed; delete them only after TypeScript build proves they are unused.

- [ ] **Step 4: Modify StartPage navigation**

In `frontend/src/components/StartPage.tsx`, replace the publish-goal state with a fixed handoff intent. The `handleGenerate` call to `createCreationIntent` should use `publishGoal: 'refine_handoff'` only as a compatibility value for existing backend/settings, while the route goes to `/handoff`:

```ts
const entryCopy = getHandoffEntryCopy();
```

Update the successful navigation:

```ts
navigate('/handoff', {
  state: {
    projectId: project.id,
    creationIntent: intent,
    proposal,
    inspirationProposal: proposal,
    proposals,
    scenes: proposal.roughScript?.scenes || [],
    needExpandScript: true,
    isGenerating: true,
    uploadedAssets,
    userPrompt,
    generationMode,
    aspectRatio: intent.aspectRatio,
    artStyle: intent.artStyle,
    newsArticle: trimmedArticle || undefined,
  },
});
```

Remove the visible “生成方式” selector from the JSX. The bottom action row should contain only the primary button and the suggestion message.

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npx vitest run src/components/startPageFlowCopy.test.ts
npm run build
```

Expected: both PASS.

- [ ] **Step 6: Browser check the reporter entry**

Open `http://127.0.0.1:5173/`.

Expected:

- Title reads `生成视频交接样片`.
- No `快速成片` or `可编辑草稿` selector is visible.
- Primary button reads `生成交接样片`.

- [ ] **Step 7: Commit Task 3**

```powershell
git add frontend/src/components/StartPage.tsx frontend/src/components/startPageFlowCopy.ts frontend/src/components/startPageFlowCopy.test.ts
git commit -m "feat: simplify reporter handoff entry"
```

## Task 4: Agent Intent Editing And UI Linking

**Files:**
- Create: `frontend/src/components/handoff/useHandoffAgent.ts`
- Test: `frontend/src/components/handoff/useHandoffAgent.test.ts`
- Modify: `frontend/src/components/handoff/VideoHandoffPage.tsx`
- Modify: `frontend/src/components/handoff/HandoffAgentPanel.tsx`
- Modify: `frontend/src/components/handoff/HandoffShotTable.tsx`

- [ ] **Step 1: Write the Agent reducer tests**

Create `frontend/src/components/handoff/useHandoffAgent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAgentProposal, applyAgentProposal } from './useHandoffAgent';
import type { HandoffSample } from '../../types/videoHandoff';

const sample: HandoffSample = {
  title: '测试样片',
  reportText: '报道正文',
  summary: '摘要',
  positioningLabel: '制作沟通样片，非发布成片',
  assets: [{ file_path: '/uploads/assets/kitchen.jpg', file_type: 'image', name: 'kitchen.jpg' } as any],
  shots: [
    {
      id: 'shot-1',
      index: 1,
      durationSeconds: 5,
      visualIntent: 'AI 参考镜头',
      captionOrVoiceover: '原字幕',
      source: { type: 'ai_reference', label: 'AI参考画面' },
      productionNote: '原备注',
      visualPrompt: '原提示词',
    },
  ],
};

describe('handoff agent proposals', () => {
  it('creates a reduce-ai proposal scoped to the selected shot', () => {
    const proposal = createAgentProposal({
      input: '这个镜头少用 AI 画面',
      sample,
      selectedShotId: 'shot-1',
    });

    expect(proposal).toMatchObject({
      type: 'replace_source',
      affectedShotIds: ['shot-1'],
      patch: {
        source: { type: 'uploaded_asset', label: '现场素材', assetUrl: '/uploads/assets/kitchen.jpg' },
      },
    });
  });

  it('applies a confirmed proposal to the sample', () => {
    const proposal = createAgentProposal({
      input: '字幕更克制一点',
      sample,
      selectedShotId: 'shot-1',
    });
    const next = applyAgentProposal(sample, proposal);

    expect(next.shots[0].captionOrVoiceover).not.toBe('原字幕');
    expect(next.shots[0].productionNote).toContain('Agent 已修改');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npx vitest run src/components/handoff/useHandoffAgent.test.ts
```

Expected: FAIL because `useHandoffAgent.ts` does not exist.

- [ ] **Step 3: Implement deterministic Agent proposal helpers**

Create `frontend/src/components/handoff/useHandoffAgent.ts`:

```ts
import { useState } from 'react';
import type { HandoffAgentProposedChange, HandoffSample, HandoffShot } from '../../types/videoHandoff';

function selectedShot(sample: HandoffSample, selectedShotId: string | null): HandoffShot {
  return sample.shots.find(shot => shot.id === selectedShotId) || sample.shots[0];
}

export function createAgentProposal(params: {
  input: string;
  sample: HandoffSample;
  selectedShotId: string | null;
}): HandoffAgentProposedChange {
  const shot = selectedShot(params.sample, params.selectedShotId);
  const firstAsset = params.sample.assets.find(asset => asset.file_path);
  const lower = params.input.toLowerCase();

  if (params.input.includes('少用') || params.input.includes('减少') || lower.includes('ai')) {
    return {
      id: `proposal-${Date.now()}`,
      type: 'replace_source',
      title: `将镜头 ${shot.index} 改为现场素材优先`,
      explanation: firstAsset
        ? `把镜头 ${shot.index} 的画面来源从 AI 参考改为上传素材。`
        : `镜头 ${shot.index} 暂无可替换素材，将标记为待制作。`,
      affectedShotIds: [shot.id],
      patch: {
        source: firstAsset
          ? { type: 'uploaded_asset', label: '现场素材', assetUrl: firstAsset.file_path, assetName: firstAsset.name }
          : { type: 'placeholder', label: '待制作' },
        productionNote: 'Agent 已修改：减少 AI 参考画面，制作时优先补充或使用现场素材。',
      },
    };
  }

  return {
    id: `proposal-${Date.now()}`,
    type: 'rewrite_caption',
    title: `调整镜头 ${shot.index} 的字幕/旁白`,
    explanation: `让镜头 ${shot.index} 的文字更克制、更像新闻交接说明。`,
    affectedShotIds: [shot.id],
    patch: {
      captionOrVoiceover: shot.captionOrVoiceover
        ? `据现场报道，${shot.captionOrVoiceover.replace(/^据现场报道，/, '')}`
        : '据现场报道，这一镜头用于补充事件背景。',
      productionNote: `${shot.productionNote} Agent 已修改字幕表达。`,
    },
  };
}

export function applyAgentProposal(sample: HandoffSample, proposal: HandoffAgentProposedChange): HandoffSample {
  return {
    ...sample,
    shots: sample.shots.map(shot =>
      proposal.affectedShotIds.includes(shot.id)
        ? { ...shot, ...proposal.patch, source: proposal.patch.source || shot.source }
        : shot
    ),
  };
}

export function useHandoffAgent(initialSample: HandoffSample) {
  const [sample, setSample] = useState(initialSample);
  const [pendingProposal, setPendingProposal] = useState<HandoffAgentProposedChange | null>(null);

  return {
    sample,
    pendingProposal,
    proposeChange(input: string, selectedShotId: string | null) {
      setPendingProposal(createAgentProposal({ input, sample, selectedShotId }));
    },
    confirmProposal() {
      if (!pendingProposal) return;
      setSample(prev => applyAgentProposal(prev, pendingProposal));
      setPendingProposal(null);
    },
    cancelProposal() {
      setPendingProposal(null);
    },
  };
}
```

- [ ] **Step 4: Wire proposal preview into the page**

Modify `frontend/src/components/handoff/VideoHandoffPage.tsx` to use the hook:

```tsx
const initialSample = useMemo(() => buildInitialHandoffSample({ ... }), [state]);
const agent = useHandoffAgent(initialSample);
const selectedShot = agent.sample.shots.find(shot => shot.id === selectedShotId);
```

Pass `agent.sample` to `HandoffPlayer` and `HandoffShotTable`, and pass proposal handlers to `HandoffAgentPanel`:

```tsx
<HandoffAgentPanel
  selectedShotLabel={selectedShot ? `正在修改镜头 ${selectedShot.index}` : '当前未选中镜头'}
  pendingProposal={agent.pendingProposal}
  onQuickIntent={(intent) => agent.proposeChange(intent, selectedShotId)}
  onSubmitIntent={(intent) => agent.proposeChange(intent, selectedShotId)}
  onConfirm={agent.confirmProposal}
  onCancel={agent.cancelProposal}
/>
```

- [ ] **Step 5: Update Agent panel props and confirmation UI**

Modify `frontend/src/components/handoff/HandoffAgentPanel.tsx` so it accepts:

```ts
pendingProposal: HandoffAgentProposedChange | null;
onSubmitIntent: (intent: string) => void;
onConfirm: () => void;
onCancel: () => void;
```

Render the preview when present:

```tsx
{pendingProposal && (
  <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-50 p-3 text-xs dark:bg-cyan-500/10">
    <div className="font-semibold text-cyan-700 dark:text-cyan-200">{pendingProposal.title}</div>
    <p className="mt-1 text-neutral-600 dark:text-neutral-300">{pendingProposal.explanation}</p>
    <div className="mt-3 flex gap-2">
      <button type="button" onClick={onConfirm} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-white">确认修改</button>
      <button type="button" onClick={onCancel} className="rounded-lg border border-neutral-200 px-3 py-1.5 dark:border-white/10">取消</button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Highlight affected rows in the shot table**

Modify `HandoffShotTable` to accept `pendingAffectedShotIds?: string[]` and add an amber outline class when a row is about to be modified:

```tsx
const isPending = pendingAffectedShotIds?.includes(shot.id);
```

Use:

```tsx
isPending ? 'ring-1 ring-amber-400 bg-amber-50/70 dark:bg-amber-500/10' : ''
```

- [ ] **Step 7: Run tests and build**

Run:

```powershell
npx vitest run src/components/handoff/useHandoffAgent.test.ts src/components/handoff/handoffSampleBuilder.test.ts
npm run build
```

Expected: tests PASS and build PASS.

- [ ] **Step 8: Browser check Agent interaction**

Open `/handoff` with sample state or generated state.

Expected:

- Clicking a shot updates Agent context.
- Clicking `减少 AI 画面` shows a proposal preview.
- The affected shot row highlights.
- `确认修改` updates the table and clears preview.

- [ ] **Step 9: Commit Task 4**

```powershell
git add frontend/src/components/handoff frontend/src/types/videoHandoff.ts
git commit -m "feat: add handoff agent intent editing"
```

## Task 5: Handoff Sample MP4 And PDF Export API

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/services/HandoffSampleExportService.js`
- Create: `backend/src/services/HandoffPackageService.js`
- Create: `backend/src/controllers/handoffExportController.js`
- Create: `backend/src/routes/handoffExportRoutes.js`
- Modify: `backend/src/index.js`
- Test: `backend/test-handoff-export-service.mjs`
- Test: `backend/test-handoff-package-service.mjs`
- Create: `frontend/src/api/handoffExportApi.ts`

- [ ] **Step 1: Add backend dependency**

Run:

```powershell
npm install pdfkit
```

Expected: `backend/package.json` and lockfile update with `pdfkit`.

- [ ] **Step 2: Write package service test**

Create `backend/test-handoff-package-service.mjs`:

```js
import fs from 'fs';
import path from 'path';
import { generateShotTablePdf } from './src/services/HandoffPackageService.js';

const outputDir = path.resolve('backend/uploads/handoff-test');
fs.mkdirSync(outputDir, { recursive: true });

const result = await generateShotTablePdf({
  outputDir,
  title: '广州记忆',
  shots: [
    {
      index: 1,
      durationSeconds: 5,
      visualIntent: '奶奶端汤',
      captionOrVoiceover: '一碗热汤，藏着广州记忆。',
      source: { label: '现场素材' },
      productionNote: '优先保留现场图。',
    },
  ],
});

if (!fs.existsSync(result.pdfPath)) {
  throw new Error('PDF was not created');
}

const stats = fs.statSync(result.pdfPath);
if (stats.size < 1000) {
  throw new Error(`PDF is too small: ${stats.size}`);
}

console.log('PASS handoff package pdf', result);
```

- [ ] **Step 3: Implement PDF generation**

Create `backend/src/services/HandoffPackageService.js`:

```js
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export async function generateShotTablePdf({ outputDir, title, shots }) {
  if (!shots || !Array.isArray(shots) || shots.length === 0) {
    throw new Error('shots is required');
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `handoff_shot_table_${Date.now()}.pdf`;
  const pdfPath = path.join(outputDir, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(pdfPath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);

    doc.fontSize(18).text(title || '视频交接样片分镜表');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#666').text(`导出时间：${new Date().toLocaleString('zh-CN')}`);
    doc.moveDown();

    shots.forEach((shot) => {
      doc.fillColor('#000').fontSize(12).text(`镜头 ${shot.index} · ${shot.durationSeconds || 5}s`);
      doc.fontSize(9).fillColor('#333').text(`画面意图：${shot.visualIntent || ''}`);
      doc.text(`字幕/旁白：${shot.captionOrVoiceover || ''}`);
      doc.text(`素材来源：${shot.source?.label || '待制作'}`);
      doc.text(`制作备注：${shot.productionNote || ''}`);
      doc.moveDown(0.8);
    });

    doc.end();
  });

  return {
    pdfPath,
    pdfUrl: `/uploads/handoff/${path.basename(outputDir)}/${filename}`,
    filename,
  };
}
```

- [ ] **Step 4: Write sample export service test**

Create `backend/test-handoff-export-service.mjs`:

```js
import fs from 'fs';
import path from 'path';
import { normalizeHandoffScenesForExport } from './src/services/HandoffSampleExportService.js';

const scenes = normalizeHandoffScenesForExport([
  { source: { type: 'placeholder', label: '待制作' }, durationSeconds: 5, visualIntent: '补素材' },
  { source: { type: 'uploaded_asset', label: '现场素材', assetUrl: '/uploads/assets/test.jpg' }, durationSeconds: 4, visualIntent: '现场图' },
]);

if (scenes.length !== 2) throw new Error('Expected 2 normalized scenes');
if (!scenes[0].placeholderText.includes('补素材')) throw new Error('Missing placeholder text');
if (scenes[1].assetUrl !== '/uploads/assets/test.jpg') throw new Error('Missing asset url');

console.log('PASS handoff export normalization', scenes);
```

- [ ] **Step 5: Implement export normalization service**

Create `backend/src/services/HandoffSampleExportService.js`:

```js
export function normalizeHandoffScenesForExport(shots) {
  if (!Array.isArray(shots) || shots.length === 0) {
    throw new Error('shots is required');
  }

  return shots.map((shot) => ({
    videoUrl: shot.videoUrl,
    assetUrl: shot.source?.assetUrl,
    durationSeconds: shot.durationSeconds || 5,
    placeholderText: shot.source?.assetUrl ? undefined : (shot.visualIntent || '待制作镜头'),
    postProcessing: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
    },
  }));
}
```

In the first implementation, export uses existing video-capable scenes only. If no `videoUrl` or video `assetUrl` exists, return a clear 400 error telling the frontend to show “样片 MP4 需要先生成动态预览”. Image-to-video conversion can be added in a follow-up by extending `VideoConcatService`.

- [ ] **Step 6: Add controller and route**

Create `backend/src/controllers/handoffExportController.js`:

```js
import path from 'path';
import { fileURLToPath } from 'url';
import VideoConcatService from '../services/VideoConcatService.js';
import { toPublicUrl } from '../config/serverConfig.js';
import { normalizeHandoffScenesForExport } from '../services/HandoffSampleExportService.js';
import { generateShotTablePdf } from '../services/HandoffPackageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function exportHandoffPackage(req, res) {
  try {
    const { title, shots } = req.body;
    const normalizedScenes = normalizeHandoffScenesForExport(shots);
    const videoReadyScenes = normalizedScenes.filter(scene => scene.videoUrl || scene.assetUrl);
    if (videoReadyScenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '样片 MP4 需要至少一个可导出的视频素材或已生成视频镜头',
      });
    }

    const folderName = `handoff_${Date.now()}`;
    const outputDir = path.join(__dirname, '../../uploads/handoff', folderName);
    const videoResult = await VideoConcatService.concatVideos({
      scenes: videoReadyScenes,
      outputDir,
      outputFilename: `handoff_sample_${Date.now()}.mp4`,
    });
    const pdfResult = await generateShotTablePdf({ outputDir, title, shots });

    return res.json({
      success: true,
      data: {
        sampleVideoUrl: toPublicUrl(videoResult.videoUrl),
        shotTablePdfUrl: toPublicUrl(pdfResult.pdfUrl),
        filenameBase: folderName,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

Create `backend/src/routes/handoffExportRoutes.js`:

```js
import express from 'express';
import { exportHandoffPackage } from '../controllers/handoffExportController.js';

const router = express.Router();

router.post('/package', exportHandoffPackage);

export default router;
```

Modify `backend/src/index.js`:

```js
import handoffExportRoutes from './routes/handoffExportRoutes.js';
app.use('/api/v1/handoff-export', handoffExportRoutes);
```

- [ ] **Step 7: Add frontend export API**

Create `frontend/src/api/handoffExportApi.ts`:

```ts
import type { HandoffExportPackage, HandoffShot } from '../types/videoHandoff';

const API_BASE_URL = 'http://localhost:4300';

export async function exportHandoffPackage(params: {
  title: string;
  shots: HandoffShot[];
}): Promise<HandoffExportPackage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/handoff-export/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || '交接包导出失败');
  }
  return data.data;
}
```

- [ ] **Step 8: Run backend service tests**

Run:

```powershell
node backend/test-handoff-package-service.mjs
node backend/test-handoff-export-service.mjs
```

Expected: both print `PASS`.

- [ ] **Step 9: Run frontend build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit Task 5**

```powershell
git add backend/package.json backend/package-lock.json backend/src/services/HandoffSampleExportService.js backend/src/services/HandoffPackageService.js backend/src/controllers/handoffExportController.js backend/src/routes/handoffExportRoutes.js backend/src/index.js backend/test-handoff-export-service.mjs backend/test-handoff-package-service.mjs frontend/src/api/handoffExportApi.ts
git commit -m "feat: add handoff package export api"
```

## Task 6: Export Controls And End-To-End Validation

**Files:**
- Modify: `frontend/src/components/handoff/VideoHandoffPage.tsx`
- Create: `frontend/src/components/handoff/HandoffExportPanel.tsx`
- Modify: `frontend/src/components/handoff/HandoffPlayer.tsx`

- [ ] **Step 1: Add export panel component**

Create `frontend/src/components/handoff/HandoffExportPanel.tsx`:

```tsx
import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { HandoffExportPackage } from '../../types/videoHandoff';

interface HandoffExportPanelProps {
  isExporting: boolean;
  result: HandoffExportPackage | null;
  error: string | null;
  onExport: () => void;
}

export const HandoffExportPanel: React.FC<HandoffExportPanelProps> = ({ isExporting, result, error, onExport }) => (
  <section className="rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:border-white/10 dark:bg-[#0b0b0d]">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">交接包</h2>
        <p className="mt-1 text-xs text-neutral-400">包含视频样片和结构化分镜表</p>
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={isExporting}
        className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {isExporting ? '正在导出' : '导出交接包'}
      </button>
    </div>
    {error && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">{error}</p>}
    {result && (
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <a className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-white/10" href={result.sampleVideoUrl} target="_blank" rel="noreferrer">打开视频样片</a>
        <a className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-white/10" href={result.shotTablePdfUrl} target="_blank" rel="noreferrer">打开分镜表 PDF</a>
      </div>
    )}
  </section>
);
```

- [ ] **Step 2: Wire export state into page**

Modify `VideoHandoffPage.tsx`:

```tsx
import { exportHandoffPackage } from '../../api/handoffExportApi';
import { HandoffExportPanel } from './HandoffExportPanel';
```

Add state:

```tsx
const [isExporting, setIsExporting] = useState(false);
const [exportResult, setExportResult] = useState(null);
const [exportError, setExportError] = useState<string | null>(null);
```

Add handler:

```tsx
const handleExport = async () => {
  setIsExporting(true);
  setExportError(null);
  try {
    const result = await exportHandoffPackage({ title: agent.sample.title, shots: agent.sample.shots });
    setExportResult(result);
  } catch (error) {
    setExportError(error instanceof Error ? error.message : '交接包导出失败');
  } finally {
    setIsExporting(false);
  }
};
```

Render below the Agent panel:

```tsx
<HandoffExportPanel
  isExporting={isExporting}
  result={exportResult}
  error={exportError}
  onExport={handleExport}
/>
```

- [ ] **Step 3: Build and test**

Run:

```powershell
npx vitest run src/components/handoff/handoffSampleBuilder.test.ts src/components/handoff/useHandoffAgent.test.ts
npm run build
```

Expected: tests PASS and build PASS.

- [ ] **Step 4: End-to-end browser validation**

Start or reuse the dev server at `http://127.0.0.1:5173`.

Check:

- `/` shows the simplified reporter entry.
- Submitting sample input navigates to `/handoff`.
- `/handoff` shows playable sample area, Agent panel, and shot table.
- Selecting a row updates Agent context.
- Quick Agent action creates a visible proposal.
- Confirming proposal updates the row and player label.
- Export panel returns a clear error if no video-capable scenes exist.
- With at least one video scene, export returns MP4 and PDF links.

- [ ] **Step 5: Commit Task 6**

```powershell
git add frontend/src/components/handoff frontend/src/api/handoffExportApi.ts
git commit -m "feat: wire handoff export controls"
```

## Task 7: Final Regression And Documentation Update

**Files:**
- Modify: `docs/superpowers/specs/2026-05-12-news-video-handoff-sample-design.md` only if implementation decisions changed.
- Modify: `README.md` only if it currently documents the old quick/draft reporter flow.

- [ ] **Step 1: Run full frontend validation**

Run:

```powershell
npm run build
npx vitest run
```

Expected: build PASS; Vitest PASS for all frontend tests.

- [ ] **Step 2: Run backend validation**

Run:

```powershell
node backend/test-handoff-package-service.mjs
node backend/test-handoff-export-service.mjs
```

Expected: both print `PASS`.

- [ ] **Step 3: Browser screenshot QA**

Capture three screenshots:

- Reporter entry page.
- Handoff sample page with Agent proposal preview.
- Export panel after a successful or expected-error export attempt.

Save screenshots outside committed source, for example:

```text
C:\Users\JD\Downloads\handoff-entry.png
C:\Users\JD\Downloads\handoff-agent-preview.png
C:\Users\JD\Downloads\handoff-export.png
```

- [ ] **Step 4: Review old mode copy**

Run:

```powershell
rg -n "快速成片|可编辑草稿|精修交接|生成方式" frontend/src docs README.md
```

Expected:

- Old copy may remain in advanced storyboard internals or archived docs.
- Old copy should not appear on the reporter entry page.
- If README describes the reporter path as quick/draft modes, update it to “视频交接样片”.

- [ ] **Step 5: Final commit**

```powershell
git add README.md docs/superpowers/specs/2026-05-12-news-video-handoff-sample-design.md
git commit -m "docs: align handoff sample workflow documentation"
```

## Self-Review

Spec coverage:

- Single reporter entry is covered by Task 3.
- Video sample result page is covered by Task 2.
- CUI Agent with preview/confirmation is covered by Task 4.
- Player/table/Agent linkage is covered by Tasks 2 and 4.
- Minimal handoff package is covered by Tasks 5 and 6.
- Existing storyboard workbench as advanced route is covered by Task 2.

No-placeholder scan:

- The plan avoids TBD/TODO/later placeholders.
- The one deliberate limitation is explicit: Task 5 returns a clear MP4 export error when there are no video-capable scenes. This is a scoped implementation decision, not a placeholder.

Type consistency:

- `HandoffSample`, `HandoffShot`, `HandoffAgentProposedChange`, and `HandoffExportPackage` are defined in Task 1 and used consistently in later tasks.
- Export API returns `HandoffExportPackage`, matching the frontend export panel.
