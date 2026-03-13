/**
 * applyScriptAssistantActions 单元测试
 *
 * 覆盖场景：
 *  1. update_shot_script 成功更新指定 shot
 *  2. add_shot 插入到指定位置后 order 正确
 *  3. remove_shot 删除后 order 重排
 *  4. reorder_shots 能按 orderedShotIds 正确排序
 *  5. update_shot_duration 后 totalDuration 正确变化
 *  6. bulk_rewrite_shots 批量更新多个 shot
 *  7. ask_user 不应修改 project
 *  8. 非法 shotId 时返回 warnings
 *  9. 删除最后一个 shot 时走保护逻辑
 * 10. add_shot 无 afterShotId 时追加到末尾
 * 11. reorder_shots 包含幽灵 id 时发出 warning 并正常排序
 * 12. reorder_shots 未覆盖的 shot 追加末尾
 * 13. bulk_rewrite_shots 全部 id 非法时整条 action 跳过
 * 14. bulk_rewrite_shots 部分 id 非法时继续处理合法条目
 * 15. update_project_style_note 更新 project 元数据
 * 16. 多条 actions 串行执行，顺序正确
 * 17. add_shot afterShotId 不存在时降级追加末尾并 warning
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyScriptAssistantActions,
  type Shot,
  type Project,
  type AssistantAction,
} from "./applyScriptAssistantActions";

// ─────────────────────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────────────────────

function makeShot(overrides: Partial<Shot> & { id: string }): Shot {
  return {
    order: 1,
    narration: "默认旁白",
    visualDescription: "默认画面描述",
    duration: 5,
    status: "draft",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProject(shots: Shot[], overrides?: Partial<Project>): Project {
  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
  return {
    id: "proj_001",
    title: "测试项目",
    styleNote: "电影风格",
    soundtrackNote: "轻音乐",
    totalDuration,
    shots,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// 固定 Shot 数据（order 与下标对齐）
// ─────────────────────────────────────────────────────────────

const SHOT_A = makeShot({ id: "shot_a", order: 1, narration: "旁白A", visualDescription: "画面A", duration: 3 });
const SHOT_B = makeShot({ id: "shot_b", order: 2, narration: "旁白B", visualDescription: "画面B", duration: 4 });
const SHOT_C = makeShot({ id: "shot_c", order: 3, narration: "旁白C", visualDescription: "画面C", duration: 5 });

// ─────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────

describe("applyScriptAssistantActions", () => {
  let project: Project;

  beforeEach(() => {
    project = makeProject([SHOT_A, SHOT_B, SHOT_C]);
  });

  // ── 场景 1：update_shot_script 成功更新指定 shot ──────────

  describe("update_shot_script", () => {
    it("应更新目标 shot 的 narration", () => {
      const actions: AssistantAction[] = [
        {
          type: "update_shot_script",
          shotId: "shot_b",
          patch: { narration: "新旁白B" },
        },
      ];
      const { nextProject, appliedActions, warnings } = applyScriptAssistantActions(project, actions);

      const updatedShot = nextProject.shots.find((s) => s.id === "shot_b")!;
      expect(updatedShot.narration).toBe("新旁白B");
      // 其他字段不受影响
      expect(updatedShot.visualDescription).toBe("画面B");
      expect(updatedShot.duration).toBe(4);
      // 应用成功，无 warnings
      expect(appliedActions).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });

    it("应同时更新 visualDescription 和 musicNote", () => {
      const actions: AssistantAction[] = [
        {
          type: "update_shot_script",
          shotId: "shot_a",
          patch: { visualDescription: "新画面A", musicNote: "钢琴" },
        },
      ];
      const { nextProject } = applyScriptAssistantActions(project, actions);

      const s = nextProject.shots.find((s) => s.id === "shot_a")!;
      expect(s.visualDescription).toBe("新画面A");
      expect(s.musicNote).toBe("钢琴");
      // narration 未传入 patch，应保持原值
      expect(s.narration).toBe("旁白A");
    });

    it("不应修改原始 project 对象（immutable）", () => {
      const actions: AssistantAction[] = [
        { type: "update_shot_script", shotId: "shot_a", patch: { narration: "x" } },
      ];
      applyScriptAssistantActions(project, actions);
      expect(project.shots[0].narration).toBe("旁白A");
    });
  });

  // ── 场景 2：add_shot 插入到指定位置后 order 正确 ─────────

  describe("add_shot", () => {
    it("在 shot_b 后插入新 shot，order 应从 1 连续递增", () => {
      const actions: AssistantAction[] = [
        {
          type: "add_shot",
          afterShotId: "shot_b",
          shot: { narration: "插入旁白", visualDescription: "插入画面", duration: 2 },
        },
      ];
      const { nextProject, appliedActions } = applyScriptAssistantActions(project, actions);

      expect(nextProject.shots).toHaveLength(4);
      // 插入后排列：A B NEW C
      expect(nextProject.shots[0].id).toBe("shot_a");
      expect(nextProject.shots[1].id).toBe("shot_b");
      expect(nextProject.shots[2].narration).toBe("插入旁白");
      expect(nextProject.shots[3].id).toBe("shot_c");
      // order 应从 1 开始连续
      nextProject.shots.forEach((s, i) => {
        expect(s.order).toBe(i + 1);
      });
      expect(appliedActions).toHaveLength(1);
    });

    it("新 shot 的 status 应为 ai-generated", () => {
      const actions: AssistantAction[] = [
        {
          type: "add_shot",
          shot: { narration: "末尾新增", duration: 6 },
        },
      ];
      const { nextProject } = applyScriptAssistantActions(project, actions);
      const newShot = nextProject.shots[nextProject.shots.length - 1];
      expect(newShot.status).toBe("ai-generated");
    });

    it("不指定 afterShotId 时，新 shot 追加到末尾", () => {
      const actions: AssistantAction[] = [
        {
          type: "add_shot",
          shot: { narration: "末尾新增", duration: 6 },
        },
      ];
      const { nextProject } = applyScriptAssistantActions(project, actions);

      expect(nextProject.shots).toHaveLength(4);
      const last = nextProject.shots[3];
      expect(last.narration).toBe("末尾新增");
      expect(last.order).toBe(4);
    });

    it("afterShotId 不存在时，降级追加末尾并产生 warning", () => {
      const actions: AssistantAction[] = [
        {
          type: "add_shot",
          afterShotId: "shot_ghost",
          shot: { narration: "降级追加", duration: 2 },
        },
      ];
      const { nextProject, warnings } = applyScriptAssistantActions(project, actions);

      expect(nextProject.shots).toHaveLength(4);
      const last = nextProject.shots[3];
      expect(last.narration).toBe("降级追加");
      expect(warnings.some((w) => w.includes("降级追加到末尾"))).toBe(true);
    });
  });

  // ── 场景 3：remove_shot 删除后 order 重排 ────────────────

  describe("remove_shot", () => {
    it("删除中间 shot 后，order 应从 1 连续重排", () => {
      const actions: AssistantAction[] = [
        { type: "remove_shot", shotId: "shot_b" },
      ];
      const { nextProject, appliedActions } = applyScriptAssistantActions(project, actions);

      expect(nextProject.shots).toHaveLength(2);
      expect(nextProject.shots.map((s) => s.id)).toEqual(["shot_a", "shot_c"]);
      // order 重排
      expect(nextProject.shots[0].order).toBe(1);
      expect(nextProject.shots[1].order).toBe(2);
      expect(appliedActions).toHaveLength(1);
    });

    it("删除后 totalDuration 应重新计算", () => {
      const actions: AssistantAction[] = [
        { type: "remove_shot", shotId: "shot_b" },
      ];
      const { nextProject } = applyScriptAssistantActions(project, actions);
      // A(3) + C(5) = 8
      expect(nextProject.totalDuration).toBe(8);
    });
  });

  // ── 场景 4：reorder_shots 能按 orderedShotIds 正确排序 ───

  describe("reorder_shots", () => {
    it("按给定顺序 C→A→B 排列后，order 应正确", () => {
      const actions: AssistantAction[] = [
        {
          type: "reorder_shots",
          orderedShotIds: ["shot_c", "shot_a", "shot_b"],
        },
      ];
      const { nextProject, warnings } = applyScriptAssistantActions(project, actions);

      expect(nextProject.shots.map((s) => s.id)).toEqual(["shot_c", "shot_a", "shot_b"]);
      nextProject.shots.forEach((s, i) => {
        expect(s.order).toBe(i + 1);
      });
      expect(warnings).toHaveLength(0);
    });

    it("orderedShotIds 包含幽灵 id 时，幽灵 id 被剔除并产生 warning", () => {
      const actions: AssistantAction[] = [
        {
          type: "reorder_shots",
          orderedShotIds: ["shot_ghost", "shot_c", "shot_a", "shot_b"],
        },
      ];
      const { nextProject, warnings } = applyScriptAssistantActions(project, actions);

      // shots 数量不变，且幽灵 id 不影响实际排序
      expect(nextProject.shots).toHaveLength(3);
      expect(nextProject.shots.map((s) => s.id)).toEqual(["shot_c", "shot_a", "shot_b"]);
      expect(warnings.some((w) => w.includes("shot_ghost"))).toBe(true);
    });

    it("orderedShotIds 未覆盖的 shot 追加末尾并产生 warning", () => {
      const actions: AssistantAction[] = [
        {
          type: "reorder_shots",
          orderedShotIds: ["shot_c", "shot_a"],  // 缺少 shot_b
        },
      ];
      const { nextProject, warnings } = applyScriptAssistantActions(project, actions);

      // shot_b 应被追加到末尾，整体 shots 数量不变
      expect(nextProject.shots).toHaveLength(3);
      expect(nextProject.shots[2].id).toBe("shot_b");
      expect(warnings.some((w) => w.includes("shot_b"))).toBe(true);
    });
  });

  // ── 场景 5：update_shot_duration 后 totalDuration 正确变化 ─

  describe("update_shot_duration", () => {
    it("更新 shot_a 的 duration 后，totalDuration 应重算", () => {
      // 原始：A(3) + B(4) + C(5) = 12
      const actions: AssistantAction[] = [
        { type: "update_shot_duration", shotId: "shot_a", duration: 10 },
      ];
      const { nextProject, appliedActions } = applyScriptAssistantActions(project, actions);

      const updatedShot = nextProject.shots.find((s) => s.id === "shot_a")!;
      expect(updatedShot.duration).toBe(10);
      // 新 totalDuration：10 + 4 + 5 = 19
      expect(nextProject.totalDuration).toBe(19);
      expect(appliedActions).toHaveLength(1);
    });

    it("连续更新两个 shot 的 duration，totalDuration 应累积重算", () => {
      const actions: AssistantAction[] = [
        { type: "update_shot_duration", shotId: "shot_a", duration: 10 },
        { type: "update_shot_duration", shotId: "shot_b", duration: 10 },
      ];
      const { nextProject } = applyScriptAssistantActions(project, actions);
      // 10 + 10 + 5 = 25
      expect(nextProject.totalDuration).toBe(25);
    });
  });

  // ── 场景 6：bulk_rewrite_shots 批量更新多个 shot ─────────

  describe("bulk_rewrite_shots", () => {
    it("批量更新多个 shot 的 narration", () => {
      const actions: AssistantAction[] = [
        {
          type: "bulk_rewrite_shots",
          items: [
            { shotId: "shot_a", patch: { narration: "批量旁白A" } },
            { shotId: "shot_c", patch: { narration: "批量旁白C" } },
          ],
        },
      ];
      const { nextProject, appliedActions, warnings } = applyScriptAssistantActions(project, actions);

      expect(nextProject.shots.find((s) => s.id === "shot_a")!.narration).toBe("批量旁白A");
      expect(nextProject.shots.find((s) => s.id === "shot_b")!.narration).toBe("旁白B"); // 未修改
      expect(nextProject.shots.find((s) => s.id === "shot_c")!.narration).toBe("批量旁白C");
      expect(appliedActions).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });

    it("部分 shotId 无效时，仍更新合法条目并产生 warning", () => {
      const actions: AssistantAction[] = [
        {
          type: "bulk_rewrite_shots",
          items: [
            { shotId: "shot_a", patch: { narration: "有效更新" } },
            { shotId: "shot_invalid", patch: { narration: "无效" } },
          ],
        },
      ];
      const { nextProject, appliedActions, warnings } = applyScriptAssistantActions(project, actions);

      // 合法条目正常更新
      expect(nextProject.shots.find((s) => s.id === "shot_a")!.narration).toBe("有效更新");
      // action 仍然算作 applied（有部分成功）
      expect(appliedActions).toHaveLength(1);
      // 对无效 shotId 发出 warning
      expect(warnings.some((w) => w.includes("shot_invalid"))).toBe(true);
    });

    it("全部 shotId 无效时，整条 action 跳过", () => {
      const actions: AssistantAction[] = [
        {
          type: "bulk_rewrite_shots",
          items: [
            { shotId: "ghost_1", patch: { narration: "无效1" } },
            { shotId: "ghost_2", patch: { narration: "无效2" } },
          ],
        },
      ];
      const { nextProject, appliedActions, skippedActions, warnings } =
        applyScriptAssistantActions(project, actions);

      // project 的 shots 不应改变
      expect(nextProject.shots.map((s) => s.narration)).toEqual(["旁白A", "旁白B", "旁白C"]);
      expect(appliedActions).toHaveLength(0);
      expect(skippedActions).toHaveLength(1);
      expect(warnings).toHaveLength(1);
    });
  });

  // ── 场景 7：ask_user 不应修改 project ────────────────────

  describe("ask_user", () => {
    it("ask_user action 不修改 shots 也不修改 totalDuration", () => {
      const actions: AssistantAction[] = [
        {
          type: "ask_user",
          question: "您希望添加几个镜头？",
          options: ["1", "3", "5"],
        },
      ];
      const { nextProject, appliedActions, skippedActions } =
        applyScriptAssistantActions(project, actions);

      // shots 和 totalDuration 原样保留
      expect(nextProject.shots).toHaveLength(3);
      expect(nextProject.totalDuration).toBe(project.totalDuration);
      // ask_user 进入 skipped，不进入 applied
      expect(appliedActions).toHaveLength(0);
      expect(skippedActions).toHaveLength(1);
      expect(skippedActions[0].action.type).toBe("ask_user");
    });
  });

  // ── 场景 8：非法 shotId 时返回 warnings ──────────────────

  describe("非法 shotId 处理", () => {
    it("update_shot_script 使用非法 shotId 时，action 被跳过并产生 warning", () => {
      const actions: AssistantAction[] = [
        {
          type: "update_shot_script",
          shotId: "shot_not_exist",
          patch: { narration: "不应写入" },
        },
      ];
      const { nextProject, skippedActions, warnings } =
        applyScriptAssistantActions(project, actions);

      // shots 不变
      expect(nextProject.shots.map((s) => s.narration)).toEqual(["旁白A", "旁白B", "旁白C"]);
      expect(skippedActions).toHaveLength(1);
      expect(warnings[0]).toContain("shot_not_exist");
    });

    it("remove_shot 使用非法 shotId 时，返回 warning 且 shots 不变", () => {
      const actions: AssistantAction[] = [
        { type: "remove_shot", shotId: "ghost_shot" },
      ];
      const { nextProject, skippedActions, warnings } =
        applyScriptAssistantActions(project, actions);

      expect(nextProject.shots).toHaveLength(3);
      expect(skippedActions).toHaveLength(1);
      expect(warnings[0]).toContain("ghost_shot");
    });

    it("update_shot_duration 使用非法 shotId 时，totalDuration 不变", () => {
      const actions: AssistantAction[] = [
        { type: "update_shot_duration", shotId: "ghost_shot", duration: 999 },
      ];
      const { nextProject, warnings } = applyScriptAssistantActions(project, actions);

      expect(nextProject.totalDuration).toBe(12); // A(3)+B(4)+C(5)
      expect(warnings[0]).toContain("ghost_shot");
    });
  });

  // ── 场景 9：删除最后一个 shot 时走保护逻辑 ───────────────

  describe("remove_shot 最后一个 shot 保护", () => {
    it("project 只有一个 shot 时，remove_shot 应被拒绝", () => {
      const singleShotProject = makeProject([SHOT_A]);
      const actions: AssistantAction[] = [
        { type: "remove_shot", shotId: "shot_a" },
      ];
      const { nextProject, skippedActions, warnings } =
        applyScriptAssistantActions(singleShotProject, actions);

      // shot 未被删除
      expect(nextProject.shots).toHaveLength(1);
      expect(nextProject.shots[0].id).toBe("shot_a");
      // 应有 skipped 和 warning
      expect(skippedActions).toHaveLength(1);
      expect(warnings[0]).toContain("低于最少保留数量");
    });

    it("project 有两个 shot 时，删除一个应成功", () => {
      const twoShotProject = makeProject([SHOT_A, SHOT_B]);
      const actions: AssistantAction[] = [
        { type: "remove_shot", shotId: "shot_a" },
      ];
      const { nextProject, appliedActions } =
        applyScriptAssistantActions(twoShotProject, actions);

      expect(nextProject.shots).toHaveLength(1);
      expect(nextProject.shots[0].id).toBe("shot_b");
      expect(appliedActions).toHaveLength(1);
    });
  });

  // ── 场景 10：update_project_style_note ───────────────────

  describe("update_project_style_note", () => {
    it("应更新 styleNote 和 soundtrackNote", () => {
      const actions: AssistantAction[] = [
        {
          type: "update_project_style_note",
          patch: { styleNote: "纪录片风格", soundtrackNote: "交响乐" },
        },
      ];
      const { nextProject, appliedActions } = applyScriptAssistantActions(project, actions);

      expect(nextProject.styleNote).toBe("纪录片风格");
      expect(nextProject.soundtrackNote).toBe("交响乐");
      // shots 不受影响
      expect(nextProject.shots).toHaveLength(3);
      expect(appliedActions).toHaveLength(1);
    });

    it("只传入 styleNote 时，soundtrackNote 应保持原值", () => {
      const actions: AssistantAction[] = [
        {
          type: "update_project_style_note",
          patch: { styleNote: "只改风格" },
        },
      ];
      const { nextProject } = applyScriptAssistantActions(project, actions);

      expect(nextProject.styleNote).toBe("只改风格");
      expect(nextProject.soundtrackNote).toBe("轻音乐"); // 原值
    });
  });

  // ── 场景 11：多条 actions 串行执行 ───────────────────────

  describe("多条 actions 串行执行", () => {
    it("update_shot_script + update_shot_duration 串行，结果应累积", () => {
      const actions: AssistantAction[] = [
        {
          type: "update_shot_script",
          shotId: "shot_a",
          patch: { narration: "串行旁白A" },
        },
        {
          type: "update_shot_duration",
          shotId: "shot_a",
          duration: 20,
        },
      ];
      const { nextProject, appliedActions } = applyScriptAssistantActions(project, actions);

      const shotA = nextProject.shots.find((s) => s.id === "shot_a")!;
      expect(shotA.narration).toBe("串行旁白A");
      expect(shotA.duration).toBe(20);
      // totalDuration: 20 + 4 + 5 = 29
      expect(nextProject.totalDuration).toBe(29);
      expect(appliedActions).toHaveLength(2);
    });

    it("add_shot 后立即对新 shot reorder，order 应一致", () => {
      const actions: AssistantAction[] = [
        {
          type: "add_shot",
          afterShotId: "shot_a",
          shot: { narration: "中间插入", duration: 7 },
        },
        {
          type: "reorder_shots",
          orderedShotIds: ["shot_c", "shot_b", "shot_a"],
          // 新 shot 未包含在 orderedShotIds 中，会被追加末尾
        },
      ];
      const { nextProject, warnings } = applyScriptAssistantActions(project, actions);

      // 共 4 个 shot
      expect(nextProject.shots).toHaveLength(4);
      // 前三个按 C B A 排序，新增 shot 追加末尾
      expect(nextProject.shots[0].id).toBe("shot_c");
      expect(nextProject.shots[1].id).toBe("shot_b");
      expect(nextProject.shots[2].id).toBe("shot_a");
      // 新 shot 在末尾
      expect(nextProject.shots[3].narration).toBe("中间插入");
      // 因为新 shot 未在 orderedShotIds 中，应有 warning
      expect(warnings.some((w) => w.includes("未出现在 orderedShotIds"))).toBe(true);
      // order 连续
      nextProject.shots.forEach((s, i) => {
        expect(s.order).toBe(i + 1);
      });
    });

    it("ask_user 混入多条 actions 中，只跳过 ask_user", () => {
      const actions: AssistantAction[] = [
        { type: "update_shot_script", shotId: "shot_a", patch: { narration: "有效" } },
        { type: "ask_user", question: "你好" },
        { type: "update_shot_duration", shotId: "shot_b", duration: 100 },
      ];
      const { appliedActions, skippedActions } =
        applyScriptAssistantActions(project, actions);

      expect(appliedActions).toHaveLength(2);
      expect(skippedActions).toHaveLength(1);
      expect(skippedActions[0].action.type).toBe("ask_user");
    });
  });

  // ── 场景 12：空 actions 数组 ──────────────────────────────

  describe("空 actions 数组", () => {
    it("传入空 actions 时，nextProject 与原 project 内容等价", () => {
      const { nextProject, appliedActions, skippedActions, warnings } =
        applyScriptAssistantActions(project, []);

      expect(nextProject.shots).toHaveLength(3);
      expect(nextProject.totalDuration).toBe(12);
      expect(nextProject.title).toBe("测试项目");
      expect(appliedActions).toHaveLength(0);
      expect(skippedActions).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });
  });
});
