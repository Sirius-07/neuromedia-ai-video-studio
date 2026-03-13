/**
 * buildStoryboardContext 单元测试
 *
 * 覆盖场景：
 *  1. image 模式 - 正常输入，基础字段正确
 *  2. video 模式 - 正常输入，基础字段正确
 *  3. 空 scenes 数组 - totalShots=0, completionRate=0, shots=[]
 *  4. scenes 字段缺失/空值 - nullIfEmpty 容错
 *  5. duration 解析：纯数字 / 带"s"后缀 / 大写"S" / 空值 / 负数 / 非数字
 *  6. totalDuration 格式化 - 保留一位小数
 *  7. completionRate 计算 - image 模式按 visualPrompt, video 按 motionPrompt
 *  8. selectedShotId 存在 → selectedShotOrder 正确
 *  9. selectedShotId 不在 scenes 中 → selectedShotOrder 为 null
 * 10. selectedShotId 为 null → selectedShotOrder 为 null
 * 11. projectId / lastActionSummary 选项注入
 * 12. lastActionSummary 未传 → 结果中不含该字段
 * 13. image/video 模式字段互斥（image shots 无 motionPrompt，video shots 无 visualPrompt）
 * 14. modeSchema 非空且包含模式关键词
 * 15. page 字段固定为 "storyboard"
 * 16. smartGeneration.cameraControl 缺失时 video shot 的相机字段为 null
 */

import { describe, it, expect } from "vitest";
import {
  buildStoryboardContext,
  type ImageStoryboardContextPayload,
  type VideoStoryboardContextPayload,
} from "./buildStoryboardContext";
import type { Scene } from "../types";

// ─────────────────────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<Scene> & { id: number }): Scene {
  return {
    type: "ai",
    duration: "5",
    script: "默认脚本",
    isAiGenerated: true,
    visualPrompt: "",
    motionPrompt: "",
    generationStatus: "idle",
    footageStatus: "empty",
    ...overrides,
  };
}

const SCENE_1 = makeScene({
  id: 1,
  duration: "3",
  visualPrompt: "一片森林",
  motionPrompt: "镜头缓慢推进",
  narration: "旁白1",
  size: "Long Shot",
  perspective: "Eye-level",
  equipment: "Tripod",
  focalLength: "35mm",
  notes: "备注1",
  smartGeneration: {
    cameraControl: { movement: "zoom_in", strength: 40 },
  },
});

const SCENE_2 = makeScene({
  id: 2,
  duration: "4s",
  visualPrompt: "城市夜景",
  motionPrompt: "",
  narration: "旁白2",
});

const SCENE_3 = makeScene({
  id: 3,
  duration: "10.5S",
  visualPrompt: "",
  motionPrompt: "快速切换镜头",
});

// ─────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────

describe("buildStoryboardContext", () => {
  // ── 场景 1：image 模式基础字段 ─────────────────────────────

  describe("image 模式 - 正常输入", () => {
    it("应返回 page='storyboard' 且 mode='image'", () => {
      const result = buildStoryboardContext([SCENE_1, SCENE_2], "image", null, "测试项目");
      expect(result.page).toBe("storyboard");
      expect(result.mode).toBe("image");
    });

    it("应包含正确的 totalShots 和 projectTitle", () => {
      const result = buildStoryboardContext([SCENE_1, SCENE_2], "image", null, "我的项目");
      expect(result.totalShots).toBe(2);
      expect(result.projectTitle).toBe("我的项目");
    });

    it("image 模式 shots 包含 visualPrompt 但不含 motionPrompt", () => {
      const result = buildStoryboardContext(
        [SCENE_1],
        "image",
        null,
        "项目"
      ) as ImageStoryboardContextPayload;
      const shot = result.shots[0];
      expect(shot.visualPrompt).toBe("一片森林");
      expect("motionPrompt" in shot).toBe(false);
    });

    it("image 模式 shots 包含 size / perspective / equipment / focalLength", () => {
      const result = buildStoryboardContext(
        [SCENE_1],
        "image",
        null,
        "项目"
      ) as ImageStoryboardContextPayload;
      const shot = result.shots[0];
      expect(shot.size).toBe("Long Shot");
      expect(shot.perspective).toBe("Eye-level");
      expect(shot.equipment).toBe("Tripod");
      expect(shot.focalLength).toBe("35mm");
    });

    it("order 从 1 开始连续递增", () => {
      const result = buildStoryboardContext(
        [SCENE_1, SCENE_2, SCENE_3],
        "image",
        null,
        "项目"
      ) as ImageStoryboardContextPayload;
      result.shots.forEach((shot, i) => {
        expect(shot.order).toBe(i + 1);
      });
    });
  });

  // ── 场景 2：video 模式基础字段 ─────────────────────────────

  describe("video 模式 - 正常输入", () => {
    it("应返回 mode='video'", () => {
      const result = buildStoryboardContext([SCENE_1], "video", null, "项目");
      expect(result.mode).toBe("video");
    });

    it("video 模式 shots 包含 motionPrompt 但不含 visualPrompt", () => {
      const result = buildStoryboardContext(
        [SCENE_1],
        "video",
        null,
        "项目"
      ) as VideoStoryboardContextPayload;
      const shot = result.shots[0];
      expect(shot.motionPrompt).toBe("镜头缓慢推进");
      expect("visualPrompt" in shot).toBe(false);
    });

    it("video 模式 shot 包含 cameraMovement 和 cameraStrength", () => {
      const result = buildStoryboardContext(
        [SCENE_1],
        "video",
        null,
        "项目"
      ) as VideoStoryboardContextPayload;
      const shot = result.shots[0];
      expect(shot.cameraMovement).toBe("zoom_in");
      expect(shot.cameraStrength).toBe(40);
    });
  });

  // ── 场景 3：空 scenes ──────────────────────────────────────

  describe("空 scenes 数组", () => {
    it("totalShots=0, shots=[], completionRate=0", () => {
      const result = buildStoryboardContext([], "image", null, "空项目");
      expect(result.totalShots).toBe(0);
      expect(result.shots).toHaveLength(0);
      expect(result.completionRate).toBe(0);
    });

    it("totalDuration 应为 '0.0s'", () => {
      const result = buildStoryboardContext([], "image", null, "空项目");
      expect(result.totalDuration).toBe("0.0s");
    });

    it("selectedShotOrder 应为 null", () => {
      const result = buildStoryboardContext([], "image", 42, "空项目");
      expect(result.selectedShotOrder).toBe(null);
    });
  });

  // ── 场景 4：字段缺失/空值容错 ─────────────────────────────

  describe("字段缺失/空值容错（nullIfEmpty）", () => {
    it("空字符串 visualPrompt 应转为 null", () => {
      const scene = makeScene({ id: 10, visualPrompt: "" });
      const result = buildStoryboardContext(
        [scene],
        "image",
        null,
        "项目"
      ) as ImageStoryboardContextPayload;
      expect(result.shots[0].visualPrompt).toBeNull();
    });

    it("纯空格字符串应转为 null", () => {
      const scene = makeScene({ id: 11, visualPrompt: "   ", motionPrompt: "  " });
      const result = buildStoryboardContext(
        [scene],
        "image",
        null,
        "项目"
      ) as ImageStoryboardContextPayload;
      expect(result.shots[0].visualPrompt).toBeNull();
    });

    it("undefined narration 应转为 null", () => {
      const scene = makeScene({ id: 12, narration: undefined });
      const result = buildStoryboardContext(
        [scene],
        "image",
        null,
        "项目"
      ) as ImageStoryboardContextPayload;
      expect(result.shots[0].narration).toBeNull();
    });

    it("smartGeneration 不存在时 video shot 的 cameraMovement/cameraStrength 应为 null", () => {
      const scene = makeScene({ id: 13, smartGeneration: undefined });
      const result = buildStoryboardContext(
        [scene],
        "video",
        null,
        "项目"
      ) as VideoStoryboardContextPayload;
      expect(result.shots[0].cameraMovement).toBeNull();
      expect(result.shots[0].cameraStrength).toBeNull();
    });

    it("smartGeneration.cameraControl 不存在时应为 null", () => {
      const scene = makeScene({ id: 14, smartGeneration: {} });
      const result = buildStoryboardContext(
        [scene],
        "video",
        null,
        "项目"
      ) as VideoStoryboardContextPayload;
      expect(result.shots[0].cameraMovement).toBeNull();
      expect(result.shots[0].cameraStrength).toBeNull();
    });
  });

  // ── 场景 5：duration 解析 ──────────────────────────────────

  describe("duration 解析", () => {
    it("纯数字字符串 '5' 应解析为 5 秒", () => {
      const scene = makeScene({ id: 20, duration: "5" });
      const result = buildStoryboardContext([scene], "video", null, "项目") as VideoStoryboardContextPayload;
      expect(result.shots[0].duration).toBe(5);
    });

    it("带小写's'后缀 '7.5s' 应解析为 7.5 秒", () => {
      const scene = makeScene({ id: 21, duration: "7.5s" });
      const result = buildStoryboardContext([scene], "video", null, "项目") as VideoStoryboardContextPayload;
      expect(result.shots[0].duration).toBe(7.5);
    });

    it("带大写'S'后缀 '10S' 应解析为 10 秒", () => {
      const scene = makeScene({ id: 22, duration: "10S" });
      const result = buildStoryboardContext([scene], "video", null, "项目") as VideoStoryboardContextPayload;
      expect(result.shots[0].duration).toBe(10);
    });

    it("空字符串 duration 应返回 null（视为未设定）", () => {
      const scene = makeScene({ id: 23, duration: "" });
      const result = buildStoryboardContext([scene], "video", null, "项目") as VideoStoryboardContextPayload;
      expect(result.shots[0].duration).toBeNull();
    });

    it("非数字字符串 duration 应返回 null", () => {
      const scene = makeScene({ id: 24, duration: "abc" });
      const result = buildStoryboardContext([scene], "video", null, "项目") as VideoStoryboardContextPayload;
      expect(result.shots[0].duration).toBeNull();
    });

    it("负数 duration 应返回 null", () => {
      const scene = makeScene({ id: 25, duration: "-5" });
      const result = buildStoryboardContext([scene], "video", null, "项目") as VideoStoryboardContextPayload;
      expect(result.shots[0].duration).toBeNull();
    });
  });

  // ── 场景 6：totalDuration 格式化 ──────────────────────────

  describe("totalDuration 格式化", () => {
    it("多个 scene duration 累加后格式化为带一位小数的字符串", () => {
      // 3 + 4 + 10.5 = 17.5
      const result = buildStoryboardContext([SCENE_1, SCENE_2, SCENE_3], "image", null, "项目");
      expect(result.totalDuration).toBe("17.5s");
    });

    it("整数 duration 也应保留一位小数", () => {
      const scene = makeScene({ id: 30, duration: "10" });
      const result = buildStoryboardContext([scene], "image", null, "项目");
      expect(result.totalDuration).toBe("10.0s");
    });
  });

  // ── 场景 7：completionRate 计算 ────────────────────────────

  describe("completionRate 计算", () => {
    it("image 模式：只计算非空 visualPrompt 的比例", () => {
      // SCENE_1(visualPrompt="一片森林") SCENE_2(visualPrompt="城市夜景") SCENE_3(visualPrompt="")
      // 2/3 ≈ 0.67
      const result = buildStoryboardContext([SCENE_1, SCENE_2, SCENE_3], "image", null, "项目");
      expect(result.completionRate).toBe(0.67);
    });

    it("video 模式：只计算非空 motionPrompt 的比例", () => {
      // SCENE_1(motionPrompt="镜头缓慢推进") SCENE_2(motionPrompt="") SCENE_3(motionPrompt="快速切换镜头")
      // 2/3 ≈ 0.67
      const result = buildStoryboardContext([SCENE_1, SCENE_2, SCENE_3], "video", null, "项目");
      expect(result.completionRate).toBe(0.67);
    });

    it("全部字段填写时 completionRate=1", () => {
      const scenes = [
        makeScene({ id: 40, visualPrompt: "画面A" }),
        makeScene({ id: 41, visualPrompt: "画面B" }),
      ];
      const result = buildStoryboardContext(scenes, "image", null, "项目");
      expect(result.completionRate).toBe(1);
    });

    it("全部字段为空时 completionRate=0", () => {
      const scenes = [
        makeScene({ id: 42, visualPrompt: "" }),
        makeScene({ id: 43, visualPrompt: "" }),
      ];
      const result = buildStoryboardContext(scenes, "image", null, "项目");
      expect(result.completionRate).toBe(0);
    });
  });

  // ── 场景 8/9/10：selectedShotId 和 selectedShotOrder ──────

  describe("selectedShotId / selectedShotOrder", () => {
    it("selectedShotId 存在时，selectedShotOrder 为 1-based index", () => {
      const result = buildStoryboardContext([SCENE_1, SCENE_2, SCENE_3], "image", 2, "项目");
      // SCENE_2 是第 2 个（index 1 → order 2）
      expect(result.selectedShotOrder).toBe(2);
      expect(result.selectedShotId).toBe(2);
    });

    it("selectedShotId 指向第一个 scene 时，selectedShotOrder=1", () => {
      const result = buildStoryboardContext([SCENE_1, SCENE_2], "image", 1, "项目");
      expect(result.selectedShotOrder).toBe(1);
    });

    it("selectedShotId 不在 scenes 中时，selectedShotOrder=null", () => {
      const result = buildStoryboardContext([SCENE_1, SCENE_2], "image", 999, "项目");
      expect(result.selectedShotOrder).toBeNull();
      expect(result.selectedShotId).toBe(999);
    });

    it("selectedShotId 为 null 时，selectedShotOrder=null", () => {
      const result = buildStoryboardContext([SCENE_1], "image", null, "项目");
      expect(result.selectedShotOrder).toBeNull();
      expect(result.selectedShotId).toBeNull();
    });
  });

  // ── 场景 11/12：options 注入 ───────────────────────────────

  describe("选项参数注入", () => {
    it("传入 projectId 时，结果中 projectId 正确", () => {
      const result = buildStoryboardContext([], "image", null, "项目", {
        projectId: "proj_abc",
      });
      expect(result.projectId).toBe("proj_abc");
    });

    it("未传 projectId 时，默认为空字符串", () => {
      const result = buildStoryboardContext([], "image", null, "项目");
      expect(result.projectId).toBe("");
    });

    it("传入 lastActionSummary 时，结果中包含该字段", () => {
      const result = buildStoryboardContext([], "image", null, "项目", {
        lastActionSummary: "批量更新了 3 个分镜",
      });
      expect(result.lastActionSummary).toBe("批量更新了 3 个分镜");
    });

    it("未传 lastActionSummary 时，结果中不含该字段", () => {
      const result = buildStoryboardContext([], "image", null, "项目");
      expect("lastActionSummary" in result).toBe(false);
    });
  });

  // ── 场景 13：模式字段互斥 ──────────────────────────────────

  describe("image/video 模式字段互斥", () => {
    it("image 模式的 shot 不含 duration 字段", () => {
      const result = buildStoryboardContext(
        [SCENE_1],
        "image",
        null,
        "项目"
      ) as ImageStoryboardContextPayload;
      expect("duration" in result.shots[0]).toBe(false);
    });

    it("video 模式的 shot 不含 size 字段", () => {
      const result = buildStoryboardContext(
        [SCENE_1],
        "video",
        null,
        "项目"
      ) as VideoStoryboardContextPayload;
      expect("size" in result.shots[0]).toBe(false);
    });
  });

  // ── 场景 14：modeSchema 非空且含关键词 ─────────────────────

  describe("modeSchema 内容校验", () => {
    it("image 模式的 modeSchema 包含 'image' 关键词", () => {
      const result = buildStoryboardContext([], "image", null, "项目") as ImageStoryboardContextPayload;
      expect(result.modeSchema).toContain("image");
      expect(result.modeSchema.length).toBeGreaterThan(10);
    });

    it("video 模式的 modeSchema 包含 'video' 关键词", () => {
      const result = buildStoryboardContext([], "video", null, "项目") as VideoStoryboardContextPayload;
      expect(result.modeSchema).toContain("video");
      expect(result.modeSchema.length).toBeGreaterThan(10);
    });
  });
});
