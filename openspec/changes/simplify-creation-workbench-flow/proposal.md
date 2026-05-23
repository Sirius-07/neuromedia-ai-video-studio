## Why

The current creation flow asks users to move through proposal selection, script editing, style selection, and storyboard editing as separate steps. For short-video creation, users think in shots: what each shot says, shows, uses as source material, and generates next.

This change reduces the number of mandatory stops and turns the storyboard into the main editable draft surface, so users can get to a useful result faster while still keeping control when they want to refine.

## What Changes

- Introduce a unified creation workbench that combines script text, visual description, source asset selection, style controls, and generation status at the shot level.
- Change "quick video" behavior so it can auto-select recommended defaults and move directly toward a generated draft instead of requiring every intermediate confirmation.
- Change "editable draft" behavior so it opens the workbench with editable shot cards instead of a separate script-only page followed by style selection.
- Add an optional theme/intention field for asset-based creation, so uploaded material can be guided by a user idea such as "Guangzhou memories".
- Keep proposal alternatives available, but make the recommended proposal the default instead of a blocking decision for the happy path.
- Preserve advanced controls for users who need them, including proposal switching, style changes, per-shot editing, and regeneration.
- No breaking API changes are intended; existing script, project, inspiration, and storyboard APIs should be reused where practical.

## Capabilities

### New Capabilities
- `creation-workbench-flow`: Defines the simplified homepage-to-workbench creation flow, quick-video defaults, editable shot draft behavior, and asset-theme guidance.

### Modified Capabilities

None. There are no existing OpenSpec capabilities in this repository yet.

## Impact

- Frontend flow: `frontend/src/components/StartPage.tsx`, `frontend/src/components/InspirationModal.tsx`, `frontend/src/components/ScriptEditorPage.tsx`, `frontend/src/components/StyleSelectionPage.tsx`, and `frontend/src/components/storyboard/VisualStoryboardPage.tsx`.
- Frontend data/state: navigation state between start, proposal, script/style, and storyboard pages; project creation and persisted storyboard data.
- Backend APIs: likely reuse `backend/src/controllers/inspirationController.js`, `backend/src/controllers/scriptController.js`, `backend/src/controllers/projectController.js`, and storyboard project routes. Minor request-shape extensions may be needed for asset theme/intention.
- QA: run the four homepage entry combinations with text/assets and quick/editable modes, verifying fewer mandatory steps and workbench editability.
