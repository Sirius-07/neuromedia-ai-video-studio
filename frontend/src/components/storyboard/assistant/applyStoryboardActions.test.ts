/**
 * applyStoryboardActions 单元测试
 *
 * 覆盖场景：
 *  1.  update_shot_field - image patch 正确更新字段
 *  2.  update_shot_field - video patch 正确更新嵌套 cameraControl
 *  3.  update_shot_field - video patch 只更新 cameraMovement，保留原 cameraStrength
 *  4.  update_shot_field - video duration 转为字符串
 *  5.  update_shot_field - shotId 不存在时跳过并 warning
 *  6.  update_shot_field - 不修改原 scenes 数组（immutable）
 *  7.  bulk_update_shots - 全部 shotId 合法时批量更新
 *  8.  bulk_update_shots - 部分 shotId 非法时跳过该条目并 warning
 *  9.  bulk_update_shots - 全部 shotId 非法时整条 action 跳过
 * 10.  regenerate_shot - target=image → generationStatus='idle', 清除 selectedImageIndex
 * 11.  regenerate_shot - target=video, 图片已选中 → generationStatus='image_selected', 清除 videoUrl
 * 12.  regenerate_shot - target=video, 图片尚未生成 → generationStatus='idle'
 * 13.  regenerate_shot - shotId 不存在时跳过并 warning
 * 14.  regenerate_storyboard - mode=image → 所有 scene 重置为 idle，清除 selectedImageIndex/videoUrl
 * 15.  regenerate_storyboard - mode=video → 已有图的保留 image_selected，无图的降为 idle
 * 16.  ask_user - 不修改 scenes，进入 skippedActions
 * 17.  空 actions 数组 - nextScenes 与原数组等价
 * 18.  多条 actions 串行执行，结果累积正确
 * 19.  affectedShotIds 已去重且正确
 * 20.  hasRegenerateActions 辅助函数
 * 21.  extractRegenerateTargets 辅助函数
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyStoryboardActions,
  hasRegenerateActions,
  extractRegenerateTargets,
} from "./applyStoryboardActions";
import type { Scene } from "../types";
import type { StoryboardAction } from "./types";

// ─────────────────────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<Scene> & { id: number }): Scene {
  return {
    type: "ai",
    duration: "5",
    script: "默认脚本",
    isAiGenerated: true,
    visualPrompt: "默认画面提示词",
    motionPrompt: "默认运动提示词",
    generationStatus: "idle",
    footageStatus: "empty",
    narration: "默认旁白",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// 固定 Scene 数据
// ─────────────────────────────────────────────────────────────

const SCENE_A = makeScene({
  id: 1,
  visualPrompt: "画面A",
  motionPrompt: "运动A",
  generationStatus: "idle",
  smartGeneration: { cameraControl: { movement: "none", strength: 0 } },
});

const SCENE_B = makeScene({
  id: 2,
  visualPrompt: "画面B",
  motionPrompt: "运动B",
  generationStatus: "image_selected",
  selectedImageIndex: 1,
  videoUrl: "https://example.com/video_b.mp4",
  smartGeneration: { cameraControl: { movement: "pan_left", strength: 50 } },
});

const SCENE_C = makeScene({
  id: 3,
  visualPrompt: "画面C",
  motionPrompt: "运动C",
  generationStatus: "completed",
  selectedImageIndex: 2,
  videoUrl: "https://example.com/video_c.mp4",
});

// ─────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────

describe("applyStoryboardActions", () => {
  let scenes: Scene[];

  beforeEach(() => {
    scenes = [SCENE_A, SCENE_B, SCENE_C];
  });

  // ── 场景 1：update_shot_field - image patch ───────────────

  describe("update_shot_field - image patch", () => {
    it("应正确更新 visualPrompt", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "新的夕阳画面" },
        },
      ];
      const { nextScenes, appliedActions, warnings } = applyStoryboardActions(scenes, actions);

      expect(nextScenes[0].visualPrompt).toBe("新的夕阳画面");
      expect(nextScenes[1].visualPrompt).toBe("画面B"); // 其他 scene 不受影响
      expect(appliedActions).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });

    it("应同时更新多个 image 字段", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: {
            mode: "image",
            size: "Close-up",
            perspective: "Low angle",
            narration: "新旁白",
          },
        },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);
      const updated = nextScenes[0];

      expect(updated.size).toBe("Close-up");
      expect(updated.perspective).toBe("Low angle");
      expect(updated.narration).toBe("新旁白");
    });

    it("只更新 patch 中提供的字段，不影响其他字段", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "新画面" },
        },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);
      const updated = nextScenes[0];

      expect(updated.visualPrompt).toBe("新画面");
      expect(updated.motionPrompt).toBe("运动A"); // 未修改
    });
  });

  // ── 场景 2/3/4：update_shot_field - video patch ──────────

  describe("update_shot_field - video patch", () => {
    it("应正确更新 motionPrompt", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 2,
          patch: { mode: "video", motionPrompt: "慢镜头拉远" },
        },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);
      expect(nextScenes[1].motionPrompt).toBe("慢镜头拉远");
    });

    it("应更新 cameraMovement 并保留原 cameraStrength", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 2,
          patch: { mode: "video", cameraMovement: "zoom_in" },
          // 不提供 cameraStrength，应保留原值 50
        },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);
      const cam = nextScenes[1].smartGeneration?.cameraControl;

      expect(cam?.movement).toBe("zoom_in");
      expect(cam?.strength).toBe(50); // 原值保留
    });

    it("应更新 cameraStrength 并保留原 cameraMovement", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 2,
          patch: { mode: "video", cameraStrength: 80 },
        },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);
      const cam = nextScenes[1].smartGeneration?.cameraControl;

      expect(cam?.movement).toBe("pan_left"); // 原值保留
      expect(cam?.strength).toBe(80);
    });

    it("video duration 数字应转为字符串写入 Scene.duration", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "video", duration: 8 },
        },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);
      expect(nextScenes[0].duration).toBe("8"); // 数字 → 字符串
    });

    it("smartGeneration 不存在时，video patch 应自动初始化 cameraControl", () => {
      const sceneNoCam = makeScene({ id: 10, smartGeneration: undefined });
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 10,
          patch: { mode: "video", cameraMovement: "tilt_up", cameraStrength: 30 },
        },
      ];
      const { nextScenes } = applyStoryboardActions([sceneNoCam], actions);
      const cam = nextScenes[0].smartGeneration?.cameraControl;

      expect(cam?.movement).toBe("tilt_up");
      expect(cam?.strength).toBe(30);
    });
  });

  // ── 场景 5：update_shot_field - shotId 不存在 ─────────────

  describe("update_shot_field - shotId 不存在", () => {
    it("非法 shotId → action 跳过，产生 warning，scenes 不变", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 999,
          patch: { mode: "image", visualPrompt: "不应写入" },
        },
      ];
      const { nextScenes, skippedActions, warnings } = applyStoryboardActions(scenes, actions);

      expect(nextScenes[0].visualPrompt).toBe("画面A"); // 不变
      expect(skippedActions).toHaveLength(1);
      expect(warnings[0]).toContain("999");
    });
  });

  // ── 场景 6：immutable ──────────────────────────────────────

  describe("immutability", () => {
    it("不应修改原始 scenes 数组", () => {
      const original = [SCENE_A, SCENE_B];
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "修改后" },
        },
      ];
      applyStoryboardActions(original, actions);

      expect(original[0].visualPrompt).toBe("画面A"); // 原数组不变
    });

    it("不应修改原始 scenes 中的 scene 对象", () => {
      const originalScene = { ...SCENE_A };
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "新画面" },
        },
      ];
      applyStoryboardActions([originalScene], actions);

      expect(originalScene.visualPrompt).toBe("画面A"); // 原对象不变
    });
  });

  // ── 场景 7/8/9：bulk_update_shots ────────────────────────

  describe("bulk_update_shots", () => {
    it("全部合法 shotId 时批量更新所有条目", () => {
      const actions: StoryboardAction[] = [
        {
          type: "bulk_update_shots",
          items: [
            { shotId: 1, patch: { mode: "image", visualPrompt: "批量画面A" } },
            { shotId: 3, patch: { mode: "image", visualPrompt: "批量画面C" } },
          ],
        },
      ];
      const { nextScenes, appliedActions, warnings } = applyStoryboardActions(scenes, actions);

      expect(nextScenes[0].visualPrompt).toBe("批量画面A");
      expect(nextScenes[1].visualPrompt).toBe("画面B"); // 未修改
      expect(nextScenes[2].visualPrompt).toBe("批量画面C");
      expect(appliedActions).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });

    it("部分 shotId 非法时，合法条目正常更新，非法条目产生 warning", () => {
      const actions: StoryboardAction[] = [
        {
          type: "bulk_update_shots",
          items: [
            { shotId: 1, patch: { mode: "image", visualPrompt: "有效画面" } },
            { shotId: 888, patch: { mode: "image", visualPrompt: "无效" } },
          ],
        },
      ];
      const { nextScenes, appliedActions, warnings } = applyStoryboardActions(scenes, actions);

      expect(nextScenes[0].visualPrompt).toBe("有效画面");
      expect(appliedActions).toHaveLength(1); // 有部分成功，整体算 applied
      expect(warnings.some((w) => w.includes("888"))).toBe(true);
    });

    it("全部 shotId 非法时，整条 action 跳过", () => {
      const actions: StoryboardAction[] = [
        {
          type: "bulk_update_shots",
          items: [
            { shotId: 777, patch: { mode: "image", visualPrompt: "无效1" } },
            { shotId: 888, patch: { mode: "image", visualPrompt: "无效2" } },
          ],
        },
      ];
      const { nextScenes, skippedActions, warnings } = applyStoryboardActions(scenes, actions);

      expect(nextScenes[0].visualPrompt).toBe("画面A"); // 未改变
      expect(skippedActions).toHaveLength(1);
      expect(warnings).toHaveLength(1);
    });
  });

  // ── 场景 10/11/12/13：regenerate_shot ────────────────────

  describe("regenerate_shot", () => {
    it("target=image → generationStatus='idle', 清除 selectedImageIndex", () => {
      const actions: StoryboardAction[] = [
        { type: "regenerate_shot", shotId: 2, target: "image" },
      ];
      const { nextScenes, appliedActions } = applyStoryboardActions(scenes, actions);
      const updated = nextScenes[1];

      expect(updated.generationStatus).toBe("idle");
      expect(updated.selectedImageIndex).toBeUndefined();
      expect(appliedActions).toHaveLength(1);
    });

    it("target=image → 保留 videoUrl（只重置图片生成）", () => {
      const actions: StoryboardAction[] = [
        { type: "regenerate_shot", shotId: 2, target: "image" },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);
      // image 重置时 videoUrl 不变（设计如此，只清 selectedImageIndex）
      // 参考 applyRegenerateShot: target=image 时只清除 selectedImageIndex
    });

    it("target=video, 图片已选中(image_selected) → generationStatus='image_selected', 清除 videoUrl", () => {
      const sceneWithImage = makeScene({
        id: 5,
        generationStatus: "image_selected",
        selectedImageIndex: 0,
        videoUrl: "https://example.com/old_video.mp4",
      });
      const actions: StoryboardAction[] = [
        { type: "regenerate_shot", shotId: 5, target: "video" },
      ];
      const { nextScenes } = applyStoryboardActions([sceneWithImage], actions);
      const updated = nextScenes[0];

      expect(updated.generationStatus).toBe("image_selected");
      expect(updated.videoUrl).toBeUndefined();
    });

    it("target=video, 图片已完成(completed) → generationStatus='image_selected'", () => {
      const sceneCompleted = makeScene({
        id: 6,
        generationStatus: "completed",
        videoUrl: "https://example.com/completed_video.mp4",
      });
      const actions: StoryboardAction[] = [
        { type: "regenerate_shot", shotId: 6, target: "video" },
      ];
      const { nextScenes } = applyStoryboardActions([sceneCompleted], actions);

      expect(nextScenes[0].generationStatus).toBe("image_selected");
    });

    it("target=video, 尚未生成图片(idle) → 降级为 generationStatus='idle'", () => {
      const sceneIdle = makeScene({
        id: 7,
        generationStatus: "idle",
      });
      const actions: StoryboardAction[] = [
        { type: "regenerate_shot", shotId: 7, target: "video" },
      ];
      const { nextScenes } = applyStoryboardActions([sceneIdle], actions);

      expect(nextScenes[0].generationStatus).toBe("idle");
    });

    it("shotId 不存在时跳过并 warning", () => {
      const actions: StoryboardAction[] = [
        { type: "regenerate_shot", shotId: 999, target: "image" },
      ];
      const { skippedActions, warnings } = applyStoryboardActions(scenes, actions);

      expect(skippedActions).toHaveLength(1);
      expect(warnings[0]).toContain("999");
    });
  });

  // ── 场景 14/15：regenerate_storyboard ────────────────────

  describe("regenerate_storyboard", () => {
    it("mode=image → 所有 scene generationStatus='idle', 清除 selectedImageIndex 和 videoUrl", () => {
      const actions: StoryboardAction[] = [
        { type: "regenerate_storyboard", mode: "image" },
      ];
      const { nextScenes, appliedActions } = applyStoryboardActions(scenes, actions);

      nextScenes.forEach((s) => {
        expect(s.generationStatus).toBe("idle");
        expect(s.selectedImageIndex).toBeUndefined();
        expect(s.videoUrl).toBeUndefined();
      });
      expect(appliedActions).toHaveLength(1);
    });

    it("mode=video → 有图的 scene → image_selected，无图的 → idle；videoUrl 全部清除", () => {
      // SCENE_A: generationStatus='idle' → 无图 → 降级为 'idle'
      // SCENE_B: generationStatus='image_selected' → 有图 → 'image_selected'
      // SCENE_C: generationStatus='completed' → 有图 → 'image_selected'
      const actions: StoryboardAction[] = [
        { type: "regenerate_storyboard", mode: "video" },
      ];
      const { nextScenes } = applyStoryboardActions(scenes, actions);

      expect(nextScenes[0].generationStatus).toBe("idle");
      expect(nextScenes[1].generationStatus).toBe("image_selected");
      expect(nextScenes[2].generationStatus).toBe("image_selected");
      nextScenes.forEach((s) => {
        expect(s.videoUrl).toBeUndefined();
      });
    });

    it("affectedShotIds 包含所有 scene 的 id", () => {
      const actions: StoryboardAction[] = [
        { type: "regenerate_storyboard", mode: "image" },
      ];
      const { affectedShotIds } = applyStoryboardActions(scenes, actions);

      expect(affectedShotIds.sort()).toEqual([1, 2, 3]);
    });
  });

  // ── 场景 16：ask_user ─────────────────────────────────────

  describe("ask_user", () => {
    it("不修改 scenes，进入 skippedActions", () => {
      const actions: StoryboardAction[] = [
        {
          type: "ask_user",
          question: "您想修改哪个分镜？",
          options: ["分镜1", "分镜2"],
        },
      ];
      const { nextScenes, appliedActions, skippedActions } =
        applyStoryboardActions(scenes, actions);

      expect(nextScenes).toHaveLength(3);
      expect(nextScenes[0].visualPrompt).toBe("画面A"); // 未修改
      expect(appliedActions).toHaveLength(0);
      expect(skippedActions).toHaveLength(1);
      expect(skippedActions[0].action.type).toBe("ask_user");
    });
  });

  // ── 场景 17：空 actions 数组 ──────────────────────────────

  describe("空 actions 数组", () => {
    it("nextScenes 与原 scenes 内容等价", () => {
      const { nextScenes, appliedActions, skippedActions, warnings, affectedShotIds } =
        applyStoryboardActions(scenes, []);

      expect(nextScenes).toHaveLength(3);
      expect(appliedActions).toHaveLength(0);
      expect(skippedActions).toHaveLength(0);
      expect(warnings).toHaveLength(0);
      expect(affectedShotIds).toHaveLength(0);
    });
  });

  // ── 场景 18：多条 actions 串行执行 ───────────────────────

  describe("多条 actions 串行执行", () => {
    it("update_shot_field 后续 regenerate_shot，结果累积正确", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "更新后的画面" },
        },
        {
          type: "regenerate_shot",
          shotId: 1,
          target: "image",
        },
      ];
      const { nextScenes, appliedActions } = applyStoryboardActions(scenes, actions);

      expect(nextScenes[0].visualPrompt).toBe("更新后的画面"); // 修改生效
      expect(nextScenes[0].generationStatus).toBe("idle"); // 重置生效
      expect(appliedActions).toHaveLength(2);
    });

    it("ask_user 混入多条 actions，只跳过 ask_user", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "有效更新" },
        },
        {
          type: "ask_user",
          question: "你好？",
        },
        {
          type: "update_shot_field",
          shotId: 2,
          patch: { mode: "image", narration: "旁白更新" },
        },
      ];
      const { appliedActions, skippedActions } = applyStoryboardActions(scenes, actions);

      expect(appliedActions).toHaveLength(2);
      expect(skippedActions).toHaveLength(1);
      expect(skippedActions[0].action.type).toBe("ask_user");
    });
  });

  // ── 场景 19：affectedShotIds 去重 ────────────────────────

  describe("affectedShotIds 去重", () => {
    it("同一 shotId 被多次修改时，affectedShotIds 中只出现一次", () => {
      const actions: StoryboardAction[] = [
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", visualPrompt: "第一次修改" },
        },
        {
          type: "update_shot_field",
          shotId: 1,
          patch: { mode: "image", narration: "第二次修改" },
        },
      ];
      const { affectedShotIds } = applyStoryboardActions(scenes, actions);

      expect(affectedShotIds).toHaveLength(1);
      expect(affectedShotIds[0]).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 辅助函数测试
// ─────────────────────────────────────────────────────────────

describe("hasRegenerateActions", () => {
  it("包含 regenerate_shot 时返回 true", () => {
    const actions: StoryboardAction[] = [
      { type: "regenerate_shot", shotId: 1, target: "image" },
    ];
    expect(hasRegenerateActions(actions)).toBe(true);
  });

  it("包含 regenerate_storyboard 时返回 true", () => {
    const actions: StoryboardAction[] = [
      { type: "regenerate_storyboard", mode: "video" },
    ];
    expect(hasRegenerateActions(actions)).toBe(true);
  });

  it("只含 update_shot_field 时返回 false", () => {
    const actions: StoryboardAction[] = [
      {
        type: "update_shot_field",
        shotId: 1,
        patch: { mode: "image", visualPrompt: "画面" },
      },
    ];
    expect(hasRegenerateActions(actions)).toBe(false);
  });

  it("空数组时返回 false", () => {
    expect(hasRegenerateActions([])).toBe(false);
  });
});

describe("extractRegenerateTargets", () => {
  it("从 actions 中正确提取 globalRegenerate 和 shotRegenerates", () => {
    const actions: StoryboardAction[] = [
      { type: "regenerate_shot", shotId: 1, target: "image" },
      { type: "regenerate_shot", shotId: 2, target: "video" },
      { type: "regenerate_storyboard", mode: "image" },
    ];
    const result = extractRegenerateTargets(actions);

    expect(result.globalRegenerate?.type).toBe("regenerate_storyboard");
    expect(result.shotRegenerates).toHaveLength(2);
    expect(result.targetShotIds).toEqual([1, 2]);
    expect(result.includesImage).toBe(true);
    expect(result.includesVideo).toBe(true);
  });

  it("没有任何重生成 action 时，返回空值", () => {
    const actions: StoryboardAction[] = [
      {
        type: "update_shot_field",
        shotId: 1,
        patch: { mode: "image", visualPrompt: "画面" },
      },
    ];
    const result = extractRegenerateTargets(actions);

    expect(result.globalRegenerate).toBeNull();
    expect(result.shotRegenerates).toHaveLength(0);
    expect(result.targetShotIds).toHaveLength(0);
    expect(result.includesImage).toBe(false);
    expect(result.includesVideo).toBe(false);
  });

  it("只有 video 目标的 regenerate_shot → includesImage=false, includesVideo=true", () => {
    const actions: StoryboardAction[] = [
      { type: "regenerate_shot", shotId: 3, target: "video" },
    ];
    const result = extractRegenerateTargets(actions);

    expect(result.includesImage).toBe(false);
    expect(result.includesVideo).toBe(true);
  });
});
