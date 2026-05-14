import { describe, expect, it } from "vitest";
import type { Scene } from "../types";
import {
  createLocalStoryboardAssistantResponse,
  deriveStoryboardAgentState,
} from "./agentIntelligence";
import { buildStoryboardContext } from "./buildStoryboardContext";

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

describe("deriveStoryboardAgentState", () => {
  it("根据选中分镜生成上下文推荐", () => {
    const scenes = [
      makeScene({ id: 1, visualPrompt: "城市天际线" }),
      makeScene({ id: 2, visualPrompt: "" }),
    ];

    const insight = deriveStoryboardAgentState(scenes, "image", 2);

    expect(insight.focusLabel).toBe("分镜 2");
    expect(insight.completionPercent).toBe(50);
    expect(insight.recommendedPrompt).toContain("分镜 2");
    expect(insight.quickPrompts.some((prompt) => prompt.includes("构图方案"))).toBe(true);
  });

  it("全局模式优先提示补齐缺失内容", () => {
    const scenes = [
      makeScene({ id: 1, motionPrompt: "慢速推进" }),
      makeScene({ id: 2, motionPrompt: "" }),
      makeScene({ id: 3, motionPrompt: "" }),
    ];

    const insight = deriveStoryboardAgentState(scenes, "video", null);

    expect(insight.focusLabel).toBe("全局");
    expect(insight.primaryNeed).toContain("2 个分镜");
    expect(insight.optionPrompt).toContain("节奏方向");
  });
});

describe("createLocalStoryboardAssistantResponse", () => {
  it("在图片模式下为缺失画面提示词生成可确认 action", () => {
    const scenes = [
      makeScene({ id: 1, narration: "广州塔夜景" }),
      makeScene({ id: 2, visualPrompt: "珠江两岸灯光" }),
    ];
    const context = buildStoryboardContext(scenes, "image", null, "夜游广州");

    const response = createLocalStoryboardAssistantResponse("补全空白分镜", context);

    expect(response?.actions[0].type).toBe("update_shot_field");
    expect(JSON.stringify(response?.actions)).toContain("新闻纪录片质感");
    expect(response?.warnings?.[0]).toContain("本地导演兜底");
  });

  it("模糊需求会先返回 ask_user 选项", () => {
    const context = buildStoryboardContext(
      [makeScene({ id: 1, visualPrompt: "城市夜景" })],
      "image",
      1,
      "夜游广州"
    );

    const response = createLocalStoryboardAssistantResponse("优化一下", context);

    expect(response?.actions[0].type).toBe("ask_user");
    expect(response?.suggestions?.length).toBeGreaterThanOrEqual(3);
  });

  it("用户选择澄清选项后会承接为可确认修改", () => {
    const context = buildStoryboardContext(
      [
        makeScene({ id: 1, visualPrompt: "广州塔夜景" }),
        makeScene({ id: 2, visualPrompt: "珠江灯光" }),
      ],
      "image",
      null,
      "夜游广州"
    );

    const response = createLocalStoryboardAssistantResponse("电影感夜景", context);

    expect(response?.actions[0].type).toBe("bulk_update_shots");
    expect(response?.reply).toContain("电影感夜景");
    expect(JSON.stringify(response?.actions)).toContain("蓝青色夜景调性");
  });
});
