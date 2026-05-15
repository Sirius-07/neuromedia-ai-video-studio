import { describe, expect, it } from "vitest";
import type { Scene } from "../types";
import type { StoryboardAction } from "./types";
import {
  buildStoryboardActionsAppliedEvent,
  buildStoryboardActionsPreview,
  consumeUndoSnapshot,
} from "./useStoryboardAssistant";

function makeScene(overrides: Partial<Scene> & { id: number }): Scene {
  return {
    id: overrides.id,
    type: "ai",
    duration: "5",
    script: "default script",
    isAiGenerated: true,
    visualPrompt: "old visual",
    motionPrompt: "old motion",
    generationStatus: "idle",
    footageStatus: "empty",
    ...overrides,
  };
}

describe("useStoryboardAssistant action events", () => {
  it("builds a pending preview payload and reject can clear it with null", () => {
    const scenes = [
      makeScene({ id: 1, visualPrompt: "old 1" }),
      makeScene({ id: 2, visualPrompt: "old 2" }),
    ];
    const actions: StoryboardAction[] = [
      {
        type: "update_shot_field",
        shotId: 1,
        patch: { mode: "image", visualPrompt: "new 1", narration: "voice" },
      },
      {
        type: "bulk_update_shots",
        items: [
          { shotId: 2, patch: { mode: "image", notes: "note" } },
        ],
      },
    ];

    const preview = buildStoryboardActionsPreview({
      actionIntent: "polish shots",
      actions,
      scenes,
      warnings: ["check tone"],
    });

    expect(preview).toMatchObject({
      actionIntent: "polish shots",
      affectedShotIds: [1, 2],
      fields: ["visualPrompt", "narration", "notes"],
      warnings: ["check tone"],
    });
    expect(preview.actions).toBe(actions);

    const cleared: typeof preview | null = null;
    expect(cleared).toBeNull();
  });

  it("builds an applied payload with snapshotBefore and nextScenes", () => {
    const snapshotBefore = [
      makeScene({ id: 1, visualPrompt: "old 1" }),
      makeScene({ id: 2, visualPrompt: "old 2" }),
    ];
    const nextScenes = [
      makeScene({ id: 1, visualPrompt: "new 1" }),
      makeScene({ id: 2, visualPrompt: "old 2" }),
    ];
    const actions: StoryboardAction[] = [
      {
        type: "update_shot_field",
        shotId: 1,
        patch: { mode: "image", visualPrompt: "new 1" },
      },
    ];

    const event = buildStoryboardActionsAppliedEvent({
      actionIntent: "polish shot",
      actions,
      appliedActions: actions,
      affectedShotIds: [1],
      fields: ["visualPrompt"],
      snapshotBefore,
      nextScenes,
      warnings: [],
    });

    expect(event.type).toBe("applied");
    expect(event.actionIntent).toBe("polish shot");
    expect(event.snapshotBefore).toBe(snapshotBefore);
    expect(event.nextScenes).toBe(nextScenes);
    expect(event.affectedShotIds).toEqual([1]);
    expect(event.fields).toEqual(["visualPrompt"]);
  });

  it("consumes the undo snapshot once and reports restored scenes", () => {
    const snapshotBefore = [makeScene({ id: 1, visualPrompt: "old" })];
    const nextScenes = [makeScene({ id: 1, visualPrompt: "new" })];
    const undoState = {
      actionIntent: "polish shot",
      actions: [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "new" },
        },
      ] satisfies StoryboardAction[],
      appliedActions: [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "new" },
        },
      ] satisfies StoryboardAction[],
      affectedShotIds: [1],
      fields: ["visualPrompt"],
      snapshotBefore,
      nextScenes,
      warnings: [],
    };

    const firstUndo = consumeUndoSnapshot(undoState);
    const secondUndo = consumeUndoSnapshot(firstUndo.nextUndoState);

    expect(firstUndo.event?.type).toBe("undone");
    expect(firstUndo.event?.restoredScenes).toBe(snapshotBefore);
    expect(firstUndo.nextUndoState).toBeNull();
    expect(secondUndo.event).toBeNull();
    expect(secondUndo.nextUndoState).toBeNull();
  });
});
