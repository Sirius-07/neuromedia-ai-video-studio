# NeuroMedia Promo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Remotion-based promo video project that packages real NeuroMedia screen recordings into a 70-second technology-forward product film and ends with a real 10-second generated output clip.

**Architecture:** Keep the promo as an isolated `promo-video/` workspace so it can iterate independently from the app. Use typed scene data, pure timing/layout helpers, and small presentation components so most non-visual logic is testable with Vitest while Remotion handles sequencing, animation, and rendering.

**Tech Stack:** Remotion 4, React 18, TypeScript 5, Vitest 4, Zod 4, Node/npm

---

## File Structure

### New workspace

- Create: `promo-video/package.json`
- Create: `promo-video/tsconfig.json`
- Create: `promo-video/remotion.config.ts`
- Create: `promo-video/src/index.ts`
- Create: `promo-video/src/Root.tsx`
- Create: `promo-video/src/env.d.ts`

### Promo source files

- Create: `promo-video/src/data/promoSchema.ts`
- Create: `promo-video/src/data/promoData.ts`
- Create: `promo-video/src/lib/timing.ts`
- Create: `promo-video/src/lib/assetPaths.ts`
- Create: `promo-video/src/lib/easing.ts`
- Create: `promo-video/src/styles/theme.ts`
- Create: `promo-video/src/components/PromoShell.tsx`
- Create: `promo-video/src/components/SectionTitle.tsx`
- Create: `promo-video/src/components/HighlightFrame.tsx`
- Create: `promo-video/src/components/ScreenVideo.tsx`
- Create: `promo-video/src/components/ProgressPulse.tsx`
- Create: `promo-video/src/scenes/HookScene.tsx`
- Create: `promo-video/src/scenes/ProjectCreationScene.tsx`
- Create: `promo-video/src/scenes/ScriptGenerationScene.tsx`
- Create: `promo-video/src/scenes/StyleStoryboardScene.tsx`
- Create: `promo-video/src/scenes/IterationScene.tsx`
- Create: `promo-video/src/scenes/EditorScene.tsx`
- Create: `promo-video/src/scenes/FinalOutputScene.tsx`
- Create: `promo-video/src/scenes/index.ts`

### Tests and docs

- Create: `promo-video/src/lib/timing.test.ts`
- Create: `promo-video/src/data/promoSchema.test.ts`
- Create: `promo-video/README.md`
- Create: `promo-video/public/.gitkeep`
- Create: `promo-video/public/recordings/.gitkeep`
- Create: `promo-video/public/final-output/.gitkeep`
- Modify: `.gitignore`

## Task 1: Create the standalone Remotion workspace

**Files:**
- Create: `promo-video/package.json`
- Create: `promo-video/tsconfig.json`
- Create: `promo-video/remotion.config.ts`
- Create: `promo-video/src/index.ts`
- Create: `promo-video/src/Root.tsx`
- Create: `promo-video/src/env.d.ts`
- Create: `promo-video/public/.gitkeep`
- Create: `promo-video/public/recordings/.gitkeep`
- Create: `promo-video/public/final-output/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Write the workspace bootstrap files**

```json
// promo-video/package.json
{
  "name": "neuromedia-promo-video",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "render": "remotion render src/index.ts NeuroMediaPromo out/neuromedia-promo.mp4",
    "still": "remotion still src/index.ts NeuroMediaPromo out/frame-030.png --frame=30 --scale=0.5",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "remotion": "^4.0.365",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "typescript": "^5.3.3",
    "vitest": "^4.0.18"
  }
}
```

```json
// promo-video/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src"]
}
```

```ts
// promo-video/remotion.config.ts
import {Config} from 'remotion';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
```

```ts
// promo-video/src/index.ts
import {registerRoot} from 'remotion';
import {Root} from './Root';

registerRoot(Root);
```

```ts
// promo-video/src/env.d.ts
/// <reference types="remotion" />
```

```tsx
// promo-video/src/Root.tsx
import {Composition} from 'remotion';

export const Root = () => {
  return (
    <Composition
      id="NeuroMediaPromo"
      component={() => null}
      durationInFrames={2100}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
```

```gitignore
# .gitignore (append)
promo-video/node_modules/
promo-video/out/
promo-video/.cache/
promo-video/.tmp/
promo-video/public/recordings/*.mp4
promo-video/public/final-output/*.mp4
promo-video/public/recordings/*.mov
promo-video/public/final-output/*.mov
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Working directory: `F:\AI 3\NeruoMedia\promo-video`

Expected: npm installs Remotion, React, Vitest, TypeScript without peer dependency errors.

- [ ] **Step 3: Run typecheck to verify the workspace compiles**

Run: `npm run typecheck`

Working directory: `F:\AI 3\NeruoMedia\promo-video`

Expected: `tsc --noEmit` exits with code 0.

- [ ] **Step 4: Verify the empty Remotion composition registers**

Run: `npm run still`

Working directory: `F:\AI 3\NeruoMedia\promo-video`

Expected: Remotion renders `out/frame-030.png` successfully, even though the composition is blank.

- [ ] **Step 5: Commit**

```bash
git add .gitignore promo-video/package.json promo-video/tsconfig.json promo-video/remotion.config.ts promo-video/src/index.ts promo-video/src/Root.tsx promo-video/src/env.d.ts promo-video/public/.gitkeep promo-video/public/recordings/.gitkeep promo-video/public/final-output/.gitkeep
git commit -m "chore: scaffold promo video remotion workspace"
```

## Task 2: Add typed promo data, asset mapping, and timing helpers

**Files:**
- Create: `promo-video/src/data/promoSchema.ts`
- Create: `promo-video/src/data/promoData.ts`
- Create: `promo-video/src/lib/timing.ts`
- Create: `promo-video/src/lib/assetPaths.ts`
- Create: `promo-video/src/data/promoSchema.test.ts`
- Create: `promo-video/src/lib/timing.test.ts`
- Modify: `promo-video/src/Root.tsx`

- [ ] **Step 1: Write the failing schema test**

```ts
// promo-video/src/data/promoSchema.test.ts
import {describe, expect, it} from 'vitest';
import {promoVideoSchema} from './promoSchema';

describe('promoVideoSchema', () => {
  it('accepts the seven-scene promo structure', () => {
    const parsed = promoVideoSchema.parse({
      title: 'NeuroMedia Promo',
      fps: 30,
      scenes: [
        {id: 'hook', durationInFrames: 180, subtitle: '从一个想法，开始一支视频。', assetKey: 'hook-grid'},
        {id: 'project-creation', durationInFrames: 300, subtitle: '一句描述，启动创作流程。', assetKey: 'project-create'},
        {id: 'script-generation', durationInFrames: 300, subtitle: '脚本、节奏与结构，同时展开。', assetKey: 'script-result'},
        {id: 'style-storyboard', durationInFrames: 360, subtitle: '风格可选，分镜可控。', assetKey: 'style-storyboard'},
        {id: 'iteration', durationInFrames: 420, subtitle: '修改、迭代、重组，都在同一条工作流里。', assetKey: 'iteration-montage'},
        {id: 'editor', durationInFrames: 240, subtitle: '从生成，到编辑，到输出。', assetKey: 'editor-workspace'},
        {id: 'final-output', durationInFrames: 300, subtitle: 'NeuroMedia', assetKey: 'final-output'}
      ]
    });

    expect(parsed.scenes).toHaveLength(7);
    expect(parsed.scenes[6].id).toBe('final-output');
  });
});
```

- [ ] **Step 2: Write the failing timing helper test**

```ts
// promo-video/src/lib/timing.test.ts
import {describe, expect, it} from 'vitest';
import {buildTimeline, secondsToFrames, totalDurationInFrames} from './timing';

describe('timing helpers', () => {
  it('converts seconds to frames at 30fps', () => {
    expect(secondsToFrames(10, 30)).toBe(300);
  });

  it('builds contiguous scene offsets', () => {
    const timeline = buildTimeline([
      {id: 'a', durationInFrames: 90},
      {id: 'b', durationInFrames: 120},
      {id: 'c', durationInFrames: 30}
    ]);

    expect(timeline).toEqual([
      {id: 'a', from: 0, durationInFrames: 90},
      {id: 'b', from: 90, durationInFrames: 120},
      {id: 'c', from: 210, durationInFrames: 30}
    ]);
    expect(totalDurationInFrames(timeline)).toBe(240);
  });
});
```

- [ ] **Step 3: Implement the schema and data files**

```ts
// promo-video/src/data/promoSchema.ts
import {z} from 'zod';

export const promoSceneSchema = z.object({
  id: z.enum([
    'hook',
    'project-creation',
    'script-generation',
    'style-storyboard',
    'iteration',
    'editor',
    'final-output'
  ]),
  durationInFrames: z.number().int().positive(),
  subtitle: z.string().min(1),
  assetKey: z.string().min(1)
});

export const promoVideoSchema = z.object({
  title: z.string().min(1),
  fps: z.number().int().positive(),
  scenes: z.array(promoSceneSchema).length(7)
});

export type PromoScene = z.infer<typeof promoSceneSchema>;
export type PromoVideoData = z.infer<typeof promoVideoSchema>;
```

```ts
// promo-video/src/data/promoData.ts
import {promoVideoSchema, type PromoVideoData} from './promoSchema';

export const promoVideoData: PromoVideoData = promoVideoSchema.parse({
  title: 'NeuroMedia Promo',
  fps: 30,
  scenes: [
    {id: 'hook', durationInFrames: 180, subtitle: '从一个想法，开始一支视频。', assetKey: 'hook-grid'},
    {id: 'project-creation', durationInFrames: 300, subtitle: '一句描述，启动创作流程。', assetKey: 'project-create'},
    {id: 'script-generation', durationInFrames: 300, subtitle: '脚本、节奏与结构，同时展开。', assetKey: 'script-result'},
    {id: 'style-storyboard', durationInFrames: 360, subtitle: '风格可选，分镜可控。', assetKey: 'style-storyboard'},
    {id: 'iteration', durationInFrames: 420, subtitle: '修改、迭代、重组，都在同一条工作流里。', assetKey: 'iteration-montage'},
    {id: 'editor', durationInFrames: 240, subtitle: '从生成，到编辑，到输出。', assetKey: 'editor-workspace'},
    {id: 'final-output', durationInFrames: 300, subtitle: 'NeuroMedia', assetKey: 'final-output'}
  ]
});
```

```ts
// promo-video/src/lib/timing.ts
export interface TimelineItem {
  id: string;
  from: number;
  durationInFrames: number;
}

export interface DurationOnly {
  id: string;
  durationInFrames: number;
}

export const secondsToFrames = (seconds: number, fps: number): number => {
  return Math.round(seconds * fps);
};

export const buildTimeline = (items: DurationOnly[]): TimelineItem[] => {
  let cursor = 0;

  return items.map((item) => {
    const timelineItem = {
      id: item.id,
      from: cursor,
      durationInFrames: item.durationInFrames
    };

    cursor += item.durationInFrames;

    return timelineItem;
  });
};

export const totalDurationInFrames = (items: TimelineItem[]): number => {
  return items.reduce((sum, item) => sum + item.durationInFrames, 0);
};
```

```ts
// promo-video/src/lib/assetPaths.ts
const assetMap = {
  'hook-grid': ['/recordings/project-create.mp4', '/recordings/storyboard-overview.mp4', '/recordings/editor-workspace.mp4'],
  'project-create': '/recordings/project-create.mp4',
  'script-result': '/recordings/script-result.mp4',
  'style-storyboard': '/recordings/style-storyboard.mp4',
  'iteration-montage': '/recordings/iteration-montage.mp4',
  'editor-workspace': '/recordings/editor-workspace.mp4',
  'final-output': '/final-output/generated-showcase.mp4'
} as const;

export type AssetKey = keyof typeof assetMap;

export const getAssetPath = (assetKey: AssetKey) => assetMap[assetKey];
```

- [ ] **Step 4: Wire the real composition duration into `Root.tsx`**

```tsx
// promo-video/src/Root.tsx
import {Composition} from 'remotion';
import {promoVideoData} from './data/promoData';
import {buildTimeline, totalDurationInFrames} from './lib/timing';

const durationInFrames = totalDurationInFrames(
  buildTimeline(
    promoVideoData.scenes.map((scene) => ({
      id: scene.id,
      durationInFrames: scene.durationInFrames
    }))
  )
);

export const Root = () => {
  return (
    <Composition
      id="NeuroMediaPromo"
      component={() => null}
      durationInFrames={durationInFrames}
      fps={promoVideoData.fps}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run test`

Expected: both `promoSchema.test.ts` and `timing.test.ts` pass.

Run: `npm run typecheck`

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add promo-video/src/data/promoSchema.ts promo-video/src/data/promoData.ts promo-video/src/data/promoSchema.test.ts promo-video/src/lib/timing.ts promo-video/src/lib/timing.test.ts promo-video/src/lib/assetPaths.ts promo-video/src/Root.tsx
git commit -m "feat: add promo video data model and timing helpers"
```

## Task 3: Build the visual system and reusable promo primitives

**Files:**
- Create: `promo-video/src/lib/easing.ts`
- Create: `promo-video/src/styles/theme.ts`
- Create: `promo-video/src/components/PromoShell.tsx`
- Create: `promo-video/src/components/SectionTitle.tsx`
- Create: `promo-video/src/components/HighlightFrame.tsx`
- Create: `promo-video/src/components/ScreenVideo.tsx`
- Create: `promo-video/src/components/ProgressPulse.tsx`
- Modify: `promo-video/src/Root.tsx`

- [ ] **Step 1: Add the shared visual tokens and easing helpers**

```ts
// promo-video/src/styles/theme.ts
export const theme = {
  colors: {
    background: '#050816',
    backgroundElevated: 'rgba(12, 18, 36, 0.78)',
    cyan: '#59e3ff',
    cyanSoft: 'rgba(89, 227, 255, 0.22)',
    text: '#f4f7fb',
    textMuted: 'rgba(244, 247, 251, 0.72)',
    stroke: 'rgba(132, 173, 255, 0.28)'
  },
  shadows: {
    glow: '0 0 60px rgba(89, 227, 255, 0.18)',
    card: '0 20px 80px rgba(0, 0, 0, 0.35)'
  },
  radius: {
    xl: 28,
    lg: 20
  }
} as const;
```

```ts
// promo-video/src/lib/easing.ts
import {Easing} from 'remotion';

export const softReveal = Easing.bezier(0.16, 1, 0.3, 1);
export const quickExit = Easing.bezier(0.7, 0, 0.84, 0);
```

- [ ] **Step 2: Implement the shell and title components**

```tsx
// promo-video/src/components/PromoShell.tsx
import type {ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {theme} from '../styles/theme';

export const PromoShell = ({children}: {children: ReactNode}) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at top left, rgba(53, 90, 255, 0.18), transparent 34%), linear-gradient(180deg, #08101f 0%, ${theme.colors.background} 100%)`,
        color: theme.colors.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden'
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

```tsx
// promo-video/src/components/SectionTitle.tsx
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../styles/theme';

export const SectionTitle = ({eyebrow, title}: {eyebrow?: string; title: string}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({frame, fps, durationInFrames: 18});
  const translateY = interpolate(progress, [0, 1], [28, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div style={{position: 'absolute', left: 120, bottom: 96, zIndex: 20, opacity, transform: `translateY(${translateY}px)`}}>
      {eyebrow ? (
        <div style={{fontSize: 18, letterSpacing: '0.24em', textTransform: 'uppercase', color: theme.colors.cyan, marginBottom: 18}}>
          {eyebrow}
        </div>
      ) : null}
      <div style={{fontSize: 56, lineHeight: 1.1, fontWeight: 700, maxWidth: 920}}>{title}</div>
    </div>
  );
};
```

- [ ] **Step 3: Implement reusable highlight, screen, and progress components**

```tsx
// promo-video/src/components/HighlightFrame.tsx
import {theme} from '../styles/theme';

export const HighlightFrame = ({x, y, width, height}: {x: number; y: number; width: number; height: number}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: theme.radius.lg,
        border: `2px solid ${theme.colors.cyan}`,
        boxShadow: theme.shadows.glow,
        background: 'rgba(89, 227, 255, 0.04)'
      }}
    />
  );
};
```

```tsx
// promo-video/src/components/ScreenVideo.tsx
import {OffthreadVideo} from 'remotion';
import {theme} from '../styles/theme';

export const ScreenVideo = ({
  src,
  style
}: {
  src: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 72,
        overflow: 'hidden',
        borderRadius: theme.radius.xl,
        border: `1px solid ${theme.colors.stroke}`,
        boxShadow: theme.shadows.card,
        background: theme.colors.backgroundElevated,
        ...style
      }}
    >
      <OffthreadVideo src={src} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    </div>
  );
};
```

```tsx
// promo-video/src/components/ProgressPulse.tsx
import {interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../styles/theme';

export const ProgressPulse = ({label}: {label: string}) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame % 60, [0, 59], [120, 420]);

  return (
    <div style={{position: 'absolute', right: 120, bottom: 120, width: 460}}>
      <div style={{fontSize: 20, color: theme.colors.textMuted, marginBottom: 14}}>{label}</div>
      <div style={{height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden'}}>
        <div style={{width, height: '100%', borderRadius: 999, background: theme.colors.cyan, boxShadow: theme.shadows.glow}} />
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Register a simple component smoke composition before scene work**

```tsx
// promo-video/src/Root.tsx
import {Composition} from 'remotion';
import {promoVideoData} from './data/promoData';
import {buildTimeline, totalDurationInFrames} from './lib/timing';
import {PromoShell} from './components/PromoShell';
import {SectionTitle} from './components/SectionTitle';

const durationInFrames = totalDurationInFrames(
  buildTimeline(
    promoVideoData.scenes.map((scene) => ({
      id: scene.id,
      durationInFrames: scene.durationInFrames
    }))
  )
);

const PromoSmoke = () => (
  <PromoShell>
    <SectionTitle eyebrow="NeuroMedia" title="从一个想法，开始一支视频。" />
  </PromoShell>
);

export const Root = () => {
  return (
    <>
      <Composition
        id="NeuroMediaPromo"
        component={PromoSmoke}
        durationInFrames={durationInFrames}
        fps={promoVideoData.fps}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
```

- [ ] **Step 5: Verify the visual primitives**

Run: `npm run still`

Expected: the output still shows the dark shell and section title with correct typography and spacing.

Run: `npm run typecheck`

Expected: all component props typecheck cleanly.

- [ ] **Step 6: Commit**

```bash
git add promo-video/src/lib/easing.ts promo-video/src/styles/theme.ts promo-video/src/components/PromoShell.tsx promo-video/src/components/SectionTitle.tsx promo-video/src/components/HighlightFrame.tsx promo-video/src/components/ScreenVideo.tsx promo-video/src/components/ProgressPulse.tsx promo-video/src/Root.tsx
git commit -m "feat: add promo video visual system primitives"
```

## Task 4: Implement the seven-scene promo composition

**Files:**
- Create: `promo-video/src/scenes/HookScene.tsx`
- Create: `promo-video/src/scenes/ProjectCreationScene.tsx`
- Create: `promo-video/src/scenes/ScriptGenerationScene.tsx`
- Create: `promo-video/src/scenes/StyleStoryboardScene.tsx`
- Create: `promo-video/src/scenes/IterationScene.tsx`
- Create: `promo-video/src/scenes/EditorScene.tsx`
- Create: `promo-video/src/scenes/FinalOutputScene.tsx`
- Create: `promo-video/src/scenes/index.ts`
- Modify: `promo-video/src/Root.tsx`

- [ ] **Step 1: Implement the first three scenes**

```tsx
// promo-video/src/scenes/HookScene.tsx
import {AbsoluteFill, Sequence} from 'remotion';
import {PromoShell} from '../components/PromoShell';
import {ScreenVideo} from '../components/ScreenVideo';
import {SectionTitle} from '../components/SectionTitle';

export const HookScene = () => {
  return (
    <PromoShell>
      <AbsoluteFill>
        <Sequence from={0} durationInFrames={180}>
          <ScreenVideo src="/recordings/project-create.mp4" style={{inset: 90, width: 780, height: 420}} />
        </Sequence>
        <Sequence from={18} durationInFrames={162}>
          <ScreenVideo src="/recordings/storyboard-overview.mp4" style={{left: 940, top: 180, width: 760, height: 380}} />
        </Sequence>
        <Sequence from={36} durationInFrames={144}>
          <ScreenVideo src="/recordings/editor-workspace.mp4" style={{left: 360, top: 560, width: 980, height: 340}} />
        </Sequence>
      </AbsoluteFill>
      <SectionTitle eyebrow="NeuroMedia" title="从一个想法，开始一支视频。" />
    </PromoShell>
  );
};
```

```tsx
// promo-video/src/scenes/ProjectCreationScene.tsx
import {PromoShell} from '../components/PromoShell';
import {ScreenVideo} from '../components/ScreenVideo';
import {SectionTitle} from '../components/SectionTitle';
import {HighlightFrame} from '../components/HighlightFrame';

export const ProjectCreationScene = () => {
  return (
    <PromoShell>
      <ScreenVideo src="/recordings/project-create.mp4" />
      <HighlightFrame x={260} y={298} width={980} height={210} />
      <SectionTitle eyebrow="Project Start" title="一句描述，启动创作流程。" />
    </PromoShell>
  );
};
```

```tsx
// promo-video/src/scenes/ScriptGenerationScene.tsx
import {PromoShell} from '../components/PromoShell';
import {ScreenVideo} from '../components/ScreenVideo';
import {SectionTitle} from '../components/SectionTitle';
import {ProgressPulse} from '../components/ProgressPulse';

export const ScriptGenerationScene = () => {
  return (
    <PromoShell>
      <ScreenVideo src="/recordings/script-result.mp4" />
      <ProgressPulse label="Generating structured script..." />
      <SectionTitle eyebrow="Script" title="脚本、节奏与结构，同时展开。" />
    </PromoShell>
  );
};
```

- [ ] **Step 2: Implement the middle workflow scenes**

```tsx
// promo-video/src/scenes/StyleStoryboardScene.tsx
import {PromoShell} from '../components/PromoShell';
import {ScreenVideo} from '../components/ScreenVideo';
import {SectionTitle} from '../components/SectionTitle';
import {HighlightFrame} from '../components/HighlightFrame';

export const StyleStoryboardScene = () => {
  return (
    <PromoShell>
      <ScreenVideo src="/recordings/style-storyboard.mp4" />
      <HighlightFrame x={1260} y={176} width={440} height={560} />
      <SectionTitle eyebrow="Style + Storyboard" title="风格可选，分镜可控。" />
    </PromoShell>
  );
};
```

```tsx
// promo-video/src/scenes/IterationScene.tsx
import {PromoShell} from '../components/PromoShell';
import {ScreenVideo} from '../components/ScreenVideo';
import {SectionTitle} from '../components/SectionTitle';

export const IterationScene = () => {
  return (
    <PromoShell>
      <ScreenVideo src="/recordings/iteration-montage.mp4" />
      <SectionTitle eyebrow="Iteration" title="修改、迭代、重组，都在同一条工作流里。" />
    </PromoShell>
  );
};
```

```tsx
// promo-video/src/scenes/EditorScene.tsx
import {PromoShell} from '../components/PromoShell';
import {ScreenVideo} from '../components/ScreenVideo';
import {SectionTitle} from '../components/SectionTitle';
import {HighlightFrame} from '../components/HighlightFrame';

export const EditorScene = () => {
  return (
    <PromoShell>
      <ScreenVideo src="/recordings/editor-workspace.mp4" />
      <HighlightFrame x={210} y={710} width={1500} height={180} />
      <SectionTitle eyebrow="Editor" title="从生成，到编辑，到输出。" />
    </PromoShell>
  );
};
```

- [ ] **Step 3: Implement the final proof scene and exports**

```tsx
// promo-video/src/scenes/FinalOutputScene.tsx
import {OffthreadVideo} from 'remotion';
import {PromoShell} from '../components/PromoShell';
import {SectionTitle} from '../components/SectionTitle';

export const FinalOutputScene = () => {
  return (
    <PromoShell>
      <div
        style={{
          position: 'absolute',
          inset: 72,
          borderRadius: 28,
          overflow: 'hidden'
        }}
      >
        <OffthreadVideo src="/final-output/generated-showcase.mp4" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </div>
      <SectionTitle eyebrow="Final Output" title="NeuroMedia" />
    </PromoShell>
  );
};
```

```ts
// promo-video/src/scenes/index.ts
export {HookScene} from './HookScene';
export {ProjectCreationScene} from './ProjectCreationScene';
export {ScriptGenerationScene} from './ScriptGenerationScene';
export {StyleStoryboardScene} from './StyleStoryboardScene';
export {IterationScene} from './IterationScene';
export {EditorScene} from './EditorScene';
export {FinalOutputScene} from './FinalOutputScene';
```

- [ ] **Step 4: Assemble all scenes into the root composition**

```tsx
// promo-video/src/Root.tsx
import {Composition, Sequence} from 'remotion';
import {promoVideoData} from './data/promoData';
import {buildTimeline, totalDurationInFrames} from './lib/timing';
import {
  EditorScene,
  FinalOutputScene,
  HookScene,
  IterationScene,
  ProjectCreationScene,
  ScriptGenerationScene,
  StyleStoryboardScene
} from './scenes';

const timeline = buildTimeline(
  promoVideoData.scenes.map((scene) => ({
    id: scene.id,
    durationInFrames: scene.durationInFrames
  }))
);

const sceneMap = {
  hook: HookScene,
  'project-creation': ProjectCreationScene,
  'script-generation': ScriptGenerationScene,
  'style-storyboard': StyleStoryboardScene,
  iteration: IterationScene,
  editor: EditorScene,
  'final-output': FinalOutputScene
} as const;

const NeuroMediaPromo = () => {
  return (
    <>
      {timeline.map((item) => {
        const SceneComponent = sceneMap[item.id as keyof typeof sceneMap];

        return (
          <Sequence key={item.id} from={item.from} durationInFrames={item.durationInFrames}>
            <SceneComponent />
          </Sequence>
        );
      })}
    </>
  );
};

export const Root = () => {
  return (
    <Composition
      id="NeuroMediaPromo"
      component={NeuroMediaPromo}
      durationInFrames={totalDurationInFrames(timeline)}
      fps={promoVideoData.fps}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
```

- [ ] **Step 5: Verify scene sequencing**

Run: `npm run still`

Expected: frame 30 renders the hook scene correctly.

Run: `npm run studio`

Expected: Remotion Studio opens and each section appears in the expected time window when scrubbing the timeline.

- [ ] **Step 6: Commit**

```bash
git add promo-video/src/scenes/HookScene.tsx promo-video/src/scenes/ProjectCreationScene.tsx promo-video/src/scenes/ScriptGenerationScene.tsx promo-video/src/scenes/StyleStoryboardScene.tsx promo-video/src/scenes/IterationScene.tsx promo-video/src/scenes/EditorScene.tsx promo-video/src/scenes/FinalOutputScene.tsx promo-video/src/scenes/index.ts promo-video/src/Root.tsx
git commit -m "feat: assemble neuromedia promo video scenes"
```

## Task 5: Add operational docs, asset checklist, and first render verification

**Files:**
- Create: `promo-video/README.md`
- Modify: `promo-video/src/data/promoData.ts`

- [ ] **Step 1: Add explicit asset notes to the promo data file**

```ts
// promo-video/src/data/promoData.ts
import {promoVideoSchema, type PromoVideoData} from './promoSchema';

/**
 * Asset naming contract:
 * - /public/recordings/project-create.mp4
 * - /public/recordings/script-result.mp4
 * - /public/recordings/style-storyboard.mp4
 * - /public/recordings/iteration-montage.mp4
 * - /public/recordings/editor-workspace.mp4
 * - /public/recordings/storyboard-overview.mp4
 * - /public/final-output/generated-showcase.mp4
 */
export const promoVideoData: PromoVideoData = promoVideoSchema.parse({
  title: 'NeuroMedia Promo',
  fps: 30,
  scenes: [
    {id: 'hook', durationInFrames: 180, subtitle: '从一个想法，开始一支视频。', assetKey: 'hook-grid'},
    {id: 'project-creation', durationInFrames: 300, subtitle: '一句描述，启动创作流程。', assetKey: 'project-create'},
    {id: 'script-generation', durationInFrames: 300, subtitle: '脚本、节奏与结构，同时展开。', assetKey: 'script-result'},
    {id: 'style-storyboard', durationInFrames: 360, subtitle: '风格可选，分镜可控。', assetKey: 'style-storyboard'},
    {id: 'iteration', durationInFrames: 420, subtitle: '修改、迭代、重组，都在同一条工作流里。', assetKey: 'iteration-montage'},
    {id: 'editor', durationInFrames: 240, subtitle: '从生成，到编辑，到输出。', assetKey: 'editor-workspace'},
    {id: 'final-output', durationInFrames: 300, subtitle: 'NeuroMedia', assetKey: 'final-output'}
  ]
});
```

- [ ] **Step 2: Write the operator README**

```md
<!-- promo-video/README.md -->
# NeuroMedia Promo Video

## Purpose

This workspace renders the 16:9 product promo video for NeuroMedia.

## Required assets

Place these files before rendering:

- `public/recordings/project-create.mp4`
- `public/recordings/script-result.mp4`
- `public/recordings/style-storyboard.mp4`
- `public/recordings/iteration-montage.mp4`
- `public/recordings/editor-workspace.mp4`
- `public/recordings/storyboard-overview.mp4`
- `public/final-output/generated-showcase.mp4`

## Recommended recording method

- Record each workflow stage as a short focused clip.
- Do not record full API waiting periods.
- Keep the mouse movement clean and intentional.
- Re-record any section with distracting cursor motion or lag spikes.

## Commands

```bash
npm install
npm run test
npm run typecheck
npm run studio
npm run still
npm run render
```

## Output

The final MP4 will be written to:

- `out/neuromedia-promo.mp4`
```

- [ ] **Step 3: Run the complete verification pass**

Run: `npm run test`

Expected: helper and schema tests pass.

Run: `npm run typecheck`

Expected: no TS errors.

Run: `npm run render`

Expected: Remotion renders `out/neuromedia-promo.mp4` successfully once required asset files have been added.

- [ ] **Step 4: Commit**

```bash
git add promo-video/README.md promo-video/src/data/promoData.ts
git commit -m "docs: add promo video asset and render guide"
```

## Spec Coverage Check

- Promo is isolated from the main app in `promo-video/`, matching the implementation direction.
- The seven approved scenes are mapped one-to-one into the composition.
- Real screen recordings remain the base assets.
- API wait time handling is represented by the progress/packaging layer rather than long raw footage.
- The final 10-second generated clip is preserved as the proof segment.
- Asset checklist and render commands are documented for repeatable execution.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation markers remain.
- Each task has exact file paths.
- Each command includes an expected result.
- Each code-writing step includes concrete code instead of vague instructions.

## Type Consistency Check

- Scene ids are defined in `promoSchema.ts`, used in `promoData.ts`, and consumed in `Root.tsx`.
- Timing helpers use `durationInFrames` consistently across tests and implementation.
- Asset names are aligned between `assetPaths.ts`, `promoData.ts`, and `README.md`.

