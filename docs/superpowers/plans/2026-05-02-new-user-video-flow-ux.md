# NeuroMedia New User Video Flow UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NeuroMedia easier for inexperienced video makers by turning the current expert-facing workflow into a guided short-video creation flow.

**Architecture:** Keep the existing React/Vite app, routing, dark visual system, and API contracts. Improve information architecture, Chinese UI copy, responsive layout, and progressive disclosure without changing backend behavior.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind utility classes, Framer Motion, lucide-react, Playwright for browser QA, Vitest for tests where existing patterns allow.

---

## Current UX Problems

1. **Entry point is too narrow:** `新闻稿处理台` assumes a newsroom user. New users who want to make a video from an idea or素材 may not know whether they can start.
2. **Workflow is hidden:** The app has a real flow, but it is only implied through top nav: draft -> script -> style -> storyboard. New users need explicit "where am I / what happens next".
3. **Primary actions use mixed language:** `GENERATE`, `GENERATE STORYBOARD`, `Generate Soundtrack`, `SCRIPT`, `STYLE`, `STORYBOARD` create unnecessary friction for Chinese novice users.
4. **Proposal modal is too dense:** 5W1H, tags, source references, lock controls, scene preview, and recommendation rationale compete for attention before the user understands the decision.
5. **Script and storyboard pages expose expert controls too early:** `Size`, `Perspective`, `Equipment`, `Focal Length`, `Notes`, drag handles, auto-fill, and batch controls are useful, but not first-read information.
6. **Storyboard responsive layout breaks:** At about 1071px width, the AI assistant is partly off-screen. On mobile, the workflow nav and storyboard surface overflow horizontally.
7. **Error recovery is ambiguous:** When inspiration generation fails, the modal can show both failure and "generating" status, leaving users unsure whether to wait or retry.

## UX Direction

Use a guided creation model:

`导入内容 -> 选视频方案 -> 改脚本 -> 选风格 -> 生成分镜 -> 生成配乐/粗剪`

Default surfaces should answer:

- What do I do here?
- Which fields matter?
- What happens after I click the main button?
- How do I recover if AI fails?
- Where can I ask AI for help?

Professional controls stay available, but behind "高级设置", drawer panels, or secondary actions.

---

## File Ownership

### Agent A: Entry + Proposal Selection

**Modify:**
- `frontend/src/components/StartPage.tsx`
- `frontend/src/components/InspirationModal.tsx`

**Responsibilities:**
- Rewrite the entry page copy into beginner-facing Chinese.
- Make primary CTA labels action-specific.
- Make inspiration/proposal modal easier to scan.
- Fix failure state so it does not show simultaneous "failed" and "still generating" messaging.

### Agent B: App Shell + Style Selection

**Modify:**
- `frontend/src/components/studio/StudioApp.tsx`
- `frontend/src/components/StyleSelectionPage.tsx`

**Responsibilities:**
- Localize stepper labels.
- Add clearer step-state messaging.
- Fix style page bottom action bar on mobile.
- Rename style page CTAs into Chinese and explain required selections.

### Agent C: Storyboard Workspace

**Modify:**
- `frontend/src/components/storyboard/VisualStoryboardPage.tsx`

**Responsibilities:**
- Make storyboard cards beginner-friendly by default.
- Move expert shot parameters behind progressive disclosure.
- Fix AI assistant responsive behavior.
- Make bottom CTA reflect the actual next step.
- Fix mobile horizontal overflow.

### Controller

**Modify only if needed:**
- This plan file.
- Small integration edits across touched files.

**Responsibilities:**
- Coordinate agents.
- Resolve integration issues.
- Run build/tests/browser QA.
- Keep existing user changes intact.

---

## Task 1: Entry Page Beginner Flow

**Files:**
- Modify: `frontend/src/components/StartPage.tsx`

- [ ] Replace hero label and title:
  - `NEWS DESK` -> `VIDEO START`
  - `新闻稿处理台` -> `开始制作短视频`
  - Subtitle -> `粘贴新闻稿、输入视频想法，或上传现场素材。AI 会先给你几个可选方案，再生成脚本和分镜。`

- [ ] Rename tabs:
  - `粘贴 / 导入新闻稿` -> `粘贴文稿 / 输入想法`
  - `上传现场素材` -> `上传图片 / 视频素材`

- [ ] Rewrite textarea placeholder:

```text
在这里粘贴新闻稿，或直接描述你想做的视频……

例如：
• 一条政务快讯，要快速说明发生了什么
• 一个活动回顾，需要做成 30 秒短视频
• 一组现场素材，希望 AI 帮我整理成脚本

AI 会先生成几个视频方案，你确认后再进入脚本编辑。
```

- [ ] Rename goal selector:
  - `快速发布` -> `快速成片`
  - `精修交接` -> `可编辑草稿`
  - Tooltips:
    - 快速成片: `优先生成可直接发布的短视频结构`
    - 可编辑草稿: `保留更多细节，方便人工继续修改`

- [ ] Rename primary CTA:
  - Empty disabled: `先输入内容`
  - Ready: `生成视频方案`
  - Loading: `正在生成方案...`

- [ ] Update the three support cards:
  - `事实提炼` -> `自动整理重点`
  - `来源标注` -> `保留来源依据`
  - `新闻风格` -> `适合短视频发布`

**Acceptance:**
- On desktop and mobile, a new user can tell that this page starts a video workflow.
- No English primary action labels remain on this page.
- Disabled button explains what is missing.

---

## Task 2: Proposal Modal Simplification

**Files:**
- Modify: `frontend/src/components/InspirationModal.tsx`

- [ ] Rename modal title:
  - `灵感实验室` -> `选择一个视频方案`
  - Subtitle during loading -> `AI 正在整理素材，准备 3 个可选方向...`
  - Subtitle complete -> `先选一个方向。下一步你还可以修改脚本和分镜。`

- [ ] Fix error state:
  - If `error` exists, hide the normal generating status block.
  - Show this copy:

```text
方案生成失败
稿件和素材已保留。你可以重试，或关闭弹窗后调整内容再生成。
```

  - Keep a clear `重试生成` action.

- [ ] Simplify proposal cards:
  - Keep title prominent.
  - Add a one-sentence section label: `适合：{paceTag or scenarioTags summary}`.
  - Show tags in one row only.
  - Collapse detailed `新闻事实提炼`, 5W1H, `必须保留`, and full scene list behind the existing scene preview/detail controls.

- [ ] Rename bottom actions:
  - `取消` -> `返回修改`
  - `确定选择并生成` -> `选这个方案，生成脚本`

**Acceptance:**
- When generation fails, the UI shows one clear failure state only.
- Proposal cards are scannable in under 5 seconds.
- User understands that choosing a proposal is not final.

---

## Task 3: App Shell Workflow Labels

**Files:**
- Modify: `frontend/src/components/studio/StudioApp.tsx`

- [ ] Change `stepperStages`:
  - `SCRIPT` -> `脚本`
  - `STYLE` -> `风格`
  - `STORYBOARD` -> `分镜`

- [ ] Rename `PROJECTS` button to `项目`.

- [ ] Add a compact workflow status near the stepper when not on the start page:
  - Script route: `第 1 步：检查脚本`
  - Style route: `第 2 步：选择画幅和风格`
  - Storyboard route: `第 3 步：生成分镜画面`

- [ ] Keep the existing visual treatment, spacing, and icons.

**Acceptance:**
- Top navigation is understandable without English production terms.
- On mobile, stepper should not push essential content horizontally off-screen.

---

## Task 4: Style Selection Mobile and Copy

**Files:**
- Modify: `frontend/src/components/StyleSelectionPage.tsx`

- [ ] Rename page subtitle:
  - `为你的故事选择画幅比例和艺术方向。` -> `先选发布比例，再选画面风格。之后 AI 会生成分镜图。`

- [ ] Rename bottom status:
  - `SELECT RATIO + STYLE` -> `请选择画幅和风格`
  - `RATIO SELECTED · SELECT STYLE` -> `已选画幅，还需选择风格`
  - `STYLE SELECTED · SELECT RATIO` -> `已选风格，还需选择画幅`
  - `READY TO GENERATE` -> `已选好，可以生成分镜`

- [ ] Rename CTA:
  - `GENERATE STORYBOARD` -> `生成分镜`
  - `GENERATING...` -> `正在生成分镜...`

- [ ] Fix mobile footer:
  - Replace absolute footer with sticky footer or keep absolute only on desktop.
  - Ensure art style cards are not covered by the button at `390x844`.
  - Ensure body has no horizontal overflow at `390x844`.

**Acceptance:**
- Mobile screenshot at `390x844` shows no clipped top nav content that blocks use.
- Bottom CTA does not cover selectable style cards.

---

## Task 5: Storyboard Beginner Mode

**Files:**
- Modify: `frontend/src/components/storyboard/VisualStoryboardPage.tsx`

- [ ] Rename main title and mode labels:
  - `STORYBOARD` -> `分镜`
  - `Image Mode` -> `图片模式`
  - `Video Mode` -> `视频模式`
  - `Generate Soundtrack` -> context-aware Chinese CTA.

- [ ] Change card fields in image mode:
  - `Description` -> `画面内容`
  - Show `画面内容` as the only always-open text field.
  - Move `Size`, `Perspective`, `Equipment`, `Focal Length`, `Aspect Ratio`, `Notes` into a collapsed `高级镜头参数` section per card.
  - Default collapsed.

- [ ] Rename field labels inside advanced section:
  - `Size` -> `景别`
  - `Perspective` -> `视角`
  - `Equipment` -> `设备`
  - `Focal Length` -> `焦距`
  - `Aspect Ratio` -> `画幅`
  - `Notes` -> `备注`

- [ ] Rename action labels:
  - `Auto-fill` -> `生成画面`
  - `ADD SHOT` -> `添加分镜`
  - `重新生成` -> `重新生成分镜`
  - `批量图片` -> `批量生成图片`
  - `批量视频` -> `批量生成视频`
  - `导出粗剪` -> `导出草稿视频`

- [ ] Make bottom CTA context-aware:
  - If no generated images/videos exist: `先生成分镜画面`
  - If images exist and no soundtrack: `生成配乐`
  - If soundtrack/editor flow is ready: `进入配乐与粗剪`

**Acceptance:**
- A new user can edit a shot without seeing camera jargon by default.
- Advanced controls are still reachable.
- No English action labels remain in the main storyboard workflow.

---

## Task 6: Storyboard Responsive Layout

**Files:**
- Modify: `frontend/src/components/storyboard/VisualStoryboardPage.tsx`

- [ ] Fix assistant panel:
  - Desktop: keep right-side assistant drawer.
  - Width below `1280px`: assistant opens as an overlay drawer over content instead of pushing content off-screen.
  - Mobile: assistant opens as a full-width bottom or right drawer.
  - Toggle button stays visible and does not create horizontal overflow.

- [ ] Fix storyboard grid:
  - At `390x844`, cards should fit within viewport width.
  - Header action buttons can wrap into a second row.
  - Main content should use `overflow-x-hidden` unless a specific horizontal surface is intentionally scrollable.

- [ ] Fix top workflow nav interaction with mobile:
  - It should not render off-screen as the only visible nav state.
  - Hiding labels on mobile is acceptable if icons remain usable and screen does not overflow.

**Acceptance:**
- Browser QA at `1071x1024` shows the AI assistant accessible without being clipped.
- Browser QA at `390x844` shows no accidental horizontal page overflow.
- Story cards and bottom CTA remain usable on mobile.

---

## Task 7: Verification

**Files:**
- No planned code changes unless verification finds defects.

- [ ] Run frontend build:

```powershell
cd "F:\AI 3\NeruoMedia\frontend"
npm run build
```

- [ ] Run available frontend tests:

```powershell
cd "F:\AI 3\NeruoMedia\frontend"
npm test
```

- [ ] Start services if not already running:

```powershell
cd "F:\AI 3\NeruoMedia\backend"
npm start

cd "F:\AI 3\NeruoMedia\frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```

- [ ] Browser QA desktop:
  - Open `http://127.0.0.1:4301/`.
  - Enter a short Chinese news稿.
  - Generate proposal modal.
  - If AI API fails, verify the failure state is understandable.
  - Open an existing project.
  - Go through style selection.
  - Open storyboard.
  - Toggle AI assistant.
  - Check no clipped content at `1071x1024`.

- [ ] Browser QA mobile:
  - Resize to `390x844`.
  - Check start page, style page, storyboard page.
  - Verify no accidental horizontal overflow.
  - Verify sticky CTAs do not cover required choices.

- [ ] Fix every issue discovered by verification before final report.

**Acceptance:**
- Build exits 0.
- Available tests either pass or failures are documented with exact failing tests and reason.
- Core UI flow is browser-tested.
- No unresolved P0/P1 UX defects remain in the modified flow.
