## 1. Creation Intent Foundation

- [x] 1.1 Add a frontend `CreationIntent` type and helper functions for normalizing homepage input, uploaded assets, publish goal, proposal data, aspect ratio, and style.
- [x] 1.2 Update project/storyboard save payload mapping so prompt, asset theme, uploaded assets, selected proposal, proposal alternatives, generation mode, aspect ratio, style, and flow version can be persisted.
- [x] 1.3 Add refresh recovery logic that rebuilds workbench state from persisted project data when route state is missing.

## 2. Homepage Entry Updates

- [x] 2.1 Add an optional asset theme field to asset mode with copy for "这组素材想讲什么？".
- [x] 2.2 Make asset-mode generation combine asset theme and uploaded asset context instead of using only a generic asset-count prompt.
- [x] 2.3 Keep the quick video and editable draft selector, but change their downstream behavior to automation level rather than separate editor destinations.

## 3. Proposal Flow Simplification

- [x] 3.1 Update proposal generation handling so the recommended proposal can be auto-selected without forcing the modal as a blocking step.
- [x] 3.2 Preserve all returned proposal alternatives in `CreationIntent` for later switching in the workbench.
- [x] 3.3 Add error handling that lets users retry proposal generation without losing homepage input or uploaded assets.

## 4. Workbench Entry Mode

- [x] 4.1 Add a workbench entry mode to `VisualStoryboardPage` that accepts `CreationIntent` and initializes project context from it.
- [x] 4.2 For editable draft mode, generate shot cards and stop before storyboard visual generation.
- [x] 4.3 For quick video mode, generate shot cards, apply default ratio/style, and start storyboard visual generation when safe.
- [x] 4.4 Show generation progress and a pause/edit escape hatch while quick video automation is running.

## 5. Integrated Workbench Controls

- [x] 5.1 Add compact aspect ratio and visual style controls to the workbench header or side panel.
- [x] 5.2 Apply style changes to pending shots before generation.
- [x] 5.3 When visuals already exist, ask whether style changes apply only to future generation or regenerate existing visuals.
- [x] 5.4 Add a proposal switcher in the workbench that can apply an alternative proposal with a clear regenerate-or-preserve choice.

## 6. Shot Card Editing

- [x] 6.1 Ensure each shot card exposes editable narration/script text, visual description, duration, source asset selection, and generation controls.
- [x] 6.2 Persist per-shot edits before generation, after generation, and when navigating away from the workbench.
- [x] 6.3 Keep advanced script-only editing reachable from the workbench without making it part of the default creation path.

## 7. Compatibility And Cleanup

- [x] 7.1 Keep existing direct routes for `ScriptEditorPage`, `StyleSelectionPage`, and storyboard projects working during migration.
- [x] 7.2 Route new homepage quick video and editable draft flows directly to the workbench after creation intent is prepared.
- [x] 7.3 Remove or hide obsolete mandatory "choose style then generate storyboard" copy from the new flow while preserving legacy pages.

## 8. QA And Verification

- [x] 8.1 Run article + quick video from homepage and verify it reaches workbench without mandatory script/style pages.
- [x] 8.2 Run article + editable draft from homepage and verify editable shot cards appear before visual generation.
- [x] 8.3 Run assets + quick video with an asset theme and verify the theme persists and informs generated content.
- [x] 8.4 Run assets + editable draft with an asset theme and verify uploaded assets can be attached or referenced by shot cards.
- [x] 8.5 Refresh a newly created workbench project and verify prompt/theme, assets, proposal, style, and shot edits are restored.
- [x] 8.6 Verify legacy direct script/style/storyboard routes still load or redirect safely.
