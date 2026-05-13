## Context

The current homepage flow is split across four major user-facing surfaces:

1. `StartPage.tsx`: accepts article text or uploaded assets, then opens `InspirationModal`.
2. `InspirationModal.tsx`: asks the user to choose one proposal.
3. `ScriptEditorPage.tsx`: edits generated script scenes and continues to style selection.
4. `StyleSelectionPage.tsx`: chooses aspect ratio and visual style, then navigates to `VisualStoryboardPage.tsx`.
5. `VisualStoryboardPage.tsx`: generates and edits storyboard shot cards.

This separation is technically workable, but it makes the user confirm several intermediate artifacts before seeing the real creative object: a shot-by-shot draft. The existing `VisualStoryboardPage` already contains the most important future workbench behaviors: editable scene cards, per-shot generation state, project persistence, uploaded asset context, and regeneration controls.

## Goals / Non-Goals

**Goals:**

- Reduce the common creation path from "proposal -> script -> style -> storyboard" to "input -> workbench".
- Make "quick video" feel automatic by using recommended defaults and starting generation with minimal confirmation.
- Make "editable draft" open directly into shot cards where script, visual description, source material, timing, and generation status live together.
- Let asset-based creation carry an optional user theme/intention, such as "Guangzhou memories".
- Preserve existing power-user controls as optional workbench controls instead of mandatory pages.
- Reuse existing APIs and data shapes where possible.

**Non-Goals:**

- Replacing the current script generation API or image/video generation providers.
- Redesigning the final video editor, audio editor, or export pipeline.
- Removing `ScriptEditorPage` or `StyleSelectionPage` immediately. They can remain available for legacy links or advanced editing while new creation flows bypass them.
- Changing authentication, billing, storage providers, or deployment architecture.

## Decisions

### Decision 1: Use `VisualStoryboardPage` as the unified workbench

The new flow should navigate new projects directly to `VisualStoryboardPage`, with a new "creation workbench" state instead of introducing another editor page. The storyboard page already owns the user's most useful editing surface: shot cards.

Alternative considered: merge storyboard controls into `ScriptEditorPage`. This would preserve the current script-first route, but it would keep the user anchored in a text document instead of the actual video structure.

Implementation direction:

- Treat each generated scene as a shot card with these editable fields:
  - narration/script text
  - visual description / visual prompt
  - source asset references
  - duration
  - aspect ratio and visual style context
  - generation state and errors
- Keep advanced script-only editing as an optional drawer or link from the workbench, not as a required step.

### Decision 2: Introduce a single creation intent object

Navigation and persistence should pass a normalized creation intent instead of scattered route state. This avoids losing context when moving from homepage to proposal to storyboard.

Suggested shape:

```ts
type CreationIntent = {
  inputMode: 'article' | 'assets';
  publishGoal: 'fast_publish' | 'refine_handoff';
  prompt: string;
  assetTheme?: string;
  uploadedAssets: AssetInfo[];
  generationMode: 'ai_generated' | 'ai_plus_real';
  selectedProposal?: InspirationProposal;
  proposalAlternatives?: InspirationProposal[];
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  artStyle: string;
  flowVersion: 'workbench_v1';
};
```

The object can be carried through React Router state and saved into the project record through existing project/storyboard save calls. If the backend needs a smaller payload, the frontend can derive API request bodies from this object.

### Decision 3: Make proposal selection non-blocking

The system should still generate multiple proposals, but the recommended one should be auto-selected for the happy path.

- Quick video: use the recommended proposal automatically and show alternatives in the workbench.
- Editable draft: show the recommended proposal by default, with a compact "change idea" control rather than a blocking modal.
- Manual proposal selection remains available when the user wants it.

Alternative considered: remove proposal generation entirely. That would be faster, but it loses a useful planning step and would reduce quality for vague prompts.

### Decision 4: Move style selection into workbench defaults

The standalone style page should no longer be mandatory for new creation flows. The workbench should initialize with defaults:

- aspect ratio: `16:9`, unless the user previously selected another target
- visual style: `真实` / realistic, or the proposal's suggested style

The workbench header or right panel should expose compact controls for aspect ratio and style. Changing either control before generating visuals should update all pending shots; changing after generation should ask whether to apply to future shots only or regenerate existing visuals.

### Decision 5: Differentiate quick and editable by automation level, not by separate destinations

Both modes should land in the same workbench. The difference is what the system does automatically:

- Quick video:
  - auto-select recommended proposal
  - apply default ratio/style
  - generate script/scenes
  - start storyboard image generation when the scene draft is ready, if the existing generation pipeline supports it safely
  - show progress and a "pause/edit" escape hatch
- Editable draft:
  - auto-select recommended proposal
  - generate script/scenes
  - stop at editable shot cards before visual generation
  - focus the user on editing shot content and source assets

This keeps the mental model simple: one destination, two levels of automation.

### Decision 6: Add theme/intention input for asset mode

Asset mode currently derives a generic prompt from the number of uploaded assets. That prevents the user from expressing a topic like "Guangzhou memories". Add a small optional field in asset mode:

- Label: `这组素材想讲什么？`
- Placeholder: `例如：广州记忆、祖孙家常味、珠江傍晚`
- If filled, use it as `assetTheme` and combine it with uploaded asset descriptions when generating proposals and scripts.
- If empty, keep the current generic asset prompt behavior.

### Decision 7: Persist workbench context early

Project creation should happen before generation starts, then the project should be updated as proposal, scenes, style, and storyboard outputs arrive. This makes refresh and error recovery safer.

The existing project/storyboard persistence APIs can remain the primary mechanism. The new flow should make saved project data explicit enough that reloads can restore:

- original prompt or asset theme
- uploaded assets
- selected proposal
- proposal alternatives
- generation mode
- aspect ratio and style
- generated scenes and shot statuses

## Risks / Trade-offs

- [Risk] Quick mode may start expensive generation before the user notices a bad proposal. -> Mitigation: show a visible "pause/edit" control while generation is in progress and keep proposal alternatives available.
- [Risk] `VisualStoryboardPage` may become too large if all controls are added directly. -> Mitigation: split workbench controls into focused components such as `CreationWorkbenchHeader`, `ProposalSwitcher`, `ShotCardEditor`, and `AssetIntentPanel`.
- [Risk] Bypassing `ScriptEditorPage` could hide useful script assistant features. -> Mitigation: expose script assistant behavior inside the workbench side panel or keep a link to advanced script editing.
- [Risk] Existing route-state assumptions may break refresh or back navigation. -> Mitigation: persist `CreationIntent` to the project as soon as possible and make route state only an accelerator.
- [Risk] Asset theme may diverge from actual uploaded image content. -> Mitigation: prompt generation should treat the theme as direction and uploaded asset analysis as source evidence, not blindly overwrite asset facts.

## Migration Plan

1. Add `CreationIntent` helpers and route-state normalization without changing current UI behavior.
2. Add the optional asset theme field on the homepage and persist it through generation requests.
3. Add workbench entry mode to `VisualStoryboardPage` so it can accept creation intent and render a combined draft surface.
4. Change editable draft to navigate directly to the workbench after proposal/script generation.
5. Change quick video to auto-select defaults and start the workbench generation pipeline.
6. Keep `ScriptEditorPage` and `StyleSelectionPage` reachable from existing routes until the new flow is stable.
7. QA all four homepage combinations before removing any legacy navigation.

Rollback is straightforward: route new homepage actions back through the existing proposal -> script -> style -> storyboard chain and leave the new workbench components dormant.

## Open Questions

- Should quick video auto-start video clip generation, or stop after storyboard images in the first release? The safer first release is auto storyboard images only, with video generation still user-confirmed.
- Should proposal alternatives appear in a modal, right drawer, or compact top-bar dropdown? The recommended first release is a right drawer because it avoids interrupting the workbench.
