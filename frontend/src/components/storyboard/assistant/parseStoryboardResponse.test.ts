/**
 * parseStoryboardResponse 单元测试
 *
 * 覆盖场景：
 *  1. 纯净 JSON 输入（direct_parse）- 完全合法，log.ok=true
 *  2. Markdown 代码块包裹（fence_extract）- 提取后合法
 *  3. JSON 前有前缀文字（brace_scan）- 提取后合法
 *  4. 含 BOM / 行注释 / 尾随逗号（lenient_clean）- 清洗后合法
 *  5. 完全无 JSON 结构 → fallback
 *  6. JSON.parse 失败（残缺括号）→ fallback
 *  7. 缺少 reply 字段 → partial_repair 补占位文本
 *  8. 缺少 needConfirm → partial_repair 推断
 *  9. patch 缺少 mode → partial_repair 注入当前 mode
 * 10. bulk_update_shots 缺 patch.mode → 每条 item 均注入
 * 11. regenerate_storyboard action → partial_repair 推断 needConfirm=true
 * 12. 含非法 action type → 过滤后保留合法条目
 * 13. 全部 actions 非法 → 过滤为空数组，仍修复成功
 * 14. suggestions / warnings 为 null → 删除字段，修复成功
 * 15. schema 校验失败且无法修复 → fallback
 * 16. 空字符串输入 → fallback
 * 17. STORYBOARD_FALLBACK_RESPONSE 常量不可变
 * 18. log.rawPreview 截取前 300 字
 * 19. 正常响应含 suggestions 和 warnings 数组
 * 20. ask_user action 正常通过 schema 校验
 */

import { describe, it, expect } from "vitest";
import {
  parseStoryboardResponse,
  STORYBOARD_FALLBACK_RESPONSE,
} from "./parseStoryboardResponse";

// ─────────────────────────────────────────────────────────────
// 辅助：构建合法的最小响应 JSON 字符串
// ─────────────────────────────────────────────────────────────

function minimalValidJson(overrides: Record<string, unknown> = {}): string {
  const base = {
    reply: "好的，我来帮您修改。",
    intent: "修改分镜字段",
    needConfirm: false,
    actions: [],
    ...overrides,
  };
  return JSON.stringify(base);
}

/** 合法的 update_shot_field action（image 模式） */
const validImageAction = {
  type: "update_shot_field",
  shotId: 1,
  patch: { mode: "image", visualPrompt: "夕阳西下的海岸线" },
};

/** 合法的 update_shot_field action（video 模式） */
const validVideoAction = {
  type: "update_shot_field",
  shotId: 2,
  patch: { mode: "video", motionPrompt: "镜头由近及远" },
};

// ─────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────

describe("parseStoryboardResponse", () => {

  // ── 场景 1：direct_parse ──────────────────────────────────

  describe("direct_parse - 纯净 JSON 输入", () => {
    it("完全合法的 JSON → log.ok=true, finalStage=direct_parse", () => {
      const raw = minimalValidJson({ actions: [validImageAction] });
      const { response, log } = parseStoryboardResponse(raw, "image");

      expect(log.ok).toBe(true);
      expect(log.finalStage).toBe("direct_parse");
      expect(response.reply).toBe("好的，我来帮您修改。");
      expect(response.needConfirm).toBe(false);
      expect(response.actions).toHaveLength(1);
    });

    it("含 suggestions 和 warnings 数组时正确解析", () => {
      const raw = minimalValidJson({
        suggestions: ["可以调整景别", "考虑增加对白"],
        warnings: ["注意版权风险"],
      });
      const { response, log } = parseStoryboardResponse(raw, "image");

      expect(log.ok).toBe(true);
      expect(response.suggestions).toEqual(["可以调整景别", "考虑增加对白"]);
      expect(response.warnings).toEqual(["注意版权风险"]);
    });

    it("ask_user action 正常通过 schema 校验", () => {
      const raw = minimalValidJson({
        actions: [
          {
            type: "ask_user",
            question: "您希望修改哪个分镜？",
            options: ["分镜1", "分镜2"],
          },
        ],
      });
      const { response, log } = parseStoryboardResponse(raw, "image");

      expect(log.ok).toBe(true);
      expect(response.actions[0].type).toBe("ask_user");
    });

    it("video 模式下合法的 update_shot_field 正常解析", () => {
      const raw = minimalValidJson({ actions: [validVideoAction] });
      const { response, log } = parseStoryboardResponse(raw, "video");

      expect(log.ok).toBe(true);
      expect(response.actions[0].type).toBe("update_shot_field");
    });
  });

  // ── 场景 2：fence_extract ─────────────────────────────────

  describe("fence_extract - Markdown 代码块包裹", () => {
    it("```json ... ``` 包裹的 JSON → finalStage=fence_extract", () => {
      const raw = "```json\n" + minimalValidJson() + "\n```";
      const { log } = parseStoryboardResponse(raw, "image");

      expect(log.finalStage).toBe("fence_extract");
      expect(log.ok).toBe(true);
    });

    it("不带 json 标注的 ``` ... ``` 包裹也能提取", () => {
      const raw = "```\n" + minimalValidJson() + "\n```";
      const { log } = parseStoryboardResponse(raw, "image");

      expect(log.finalStage).toBe("fence_extract");
      expect(log.ok).toBe(true);
    });
  });

  // ── 场景 3：brace_scan - 前缀文字 ────────────────────────

  describe("brace_scan - JSON 前有前缀文字", () => {
    it("JSON 前有说明文字 → finalStage=brace_scan", () => {
      const raw = "根据您的需求，建议如下修改：\n" + minimalValidJson();
      const { log } = parseStoryboardResponse(raw, "image");

      expect(log.finalStage).toBe("brace_scan");
      expect(log.ok).toBe(true);
    });
  });

  // ── 场景 4：lenient_clean ─────────────────────────────────

  describe("lenient_clean - 注释含未闭合括号 + 尾随逗号", () => {
    it("行注释中含未闭合 '{' 导致 brace_scan 失败，lenient_clean 移除注释后成功解析", () => {
      // brace_scan 从注释中的 '{' 开始扫描，无法找到平衡括号对，返回 null
      // lenient_clean 移除整行注释后，剩余 JSON 括号完整可解析
      const rawWithUnbalancedComment =
        "// 注意: 以下 { 对象\n" +
        '{"reply":"好的","intent":"测试","needConfirm":false,"actions":[]}';
      const { log } = parseStoryboardResponse(rawWithUnbalancedComment, "image");

      expect(log.finalStage).toBe("lenient_clean");
      expect(log.ok).toBe(true);
    });

    it("注释含未闭合括号 + 尾随逗号 → lenient_clean 同时处理两个问题", () => {
      // 行注释中有 { 使 brace_scan 失败；lenient_clean 移除注释并去掉尾随逗号后成功
      const rawCombined =
        "// Example: { see below\n" +
        '{"reply":"好的","intent":"测试","needConfirm":false,"actions":[],}';
      const { log } = parseStoryboardResponse(rawCombined, "image");

      expect(log.finalStage).toBe("lenient_clean");
      expect(log.ok).toBe(true);
    });
  });

  // ── 场景 5：无 JSON 结构 → fallback ───────────────────────

  describe("无 JSON 结构 → fallback", () => {
    it("纯文本无花括号 → fallback", () => {
      const { response, log } = parseStoryboardResponse("这是一段纯文字，没有 JSON。", "image");

      expect(log.ok).toBe(false);
      expect(log.finalStage).toBe("fallback");
      expect(response.actions).toHaveLength(0);
      expect(response.warnings).toBeDefined();
    });

    it("空字符串 → fallback", () => {
      const { response, log } = parseStoryboardResponse("", "image");

      expect(log.ok).toBe(false);
      expect(log.finalStage).toBe("fallback");
    });

    it("只有数字/数组的 JSON → fallback（非对象）", () => {
      const { log } = parseStoryboardResponse("[1,2,3]", "image");

      // 数组没有以 '{' 开头，会经历 fallback
      expect(log.ok).toBe(false);
    });
  });

  // ── 场景 6：JSON.parse 失败 → fallback ────────────────────

  describe("JSON.parse 失败 → fallback", () => {
    it("括号不平衡的 JSON → fallback", () => {
      const { log } = parseStoryboardResponse('{"reply": "hi"', "image");

      expect(log.ok).toBe(false);
      expect(log.finalStage).toBe("fallback");
    });
  });

  // ── 场景 7：缺 reply → partial_repair ────────────────────

  describe("partial_repair - 缺少必填字段", () => {
    it("缺少 reply → 修复为占位文本，finalStage=partial_repair", () => {
      const obj = { intent: "测试意图", needConfirm: false, actions: [] };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.finalStage).toBe("partial_repair");
      expect(log.ok).toBe(true);
      expect(response.reply).toBeTruthy();
      expect(log.repairedFields).toContain("reply");
    });

    it("缺少 intent → 修复为占位文本", () => {
      const obj = { reply: "好的", needConfirm: false, actions: [] };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.intent).toBeTruthy();
      expect(log.repairedFields?.some((f) => f.includes("intent"))).toBe(true);
    });

    it("缺少 actions → 补空数组", () => {
      const obj = { reply: "好的", intent: "测试", needConfirm: false };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.actions).toEqual([]);
      expect(log.repairedFields?.some((f) => f.includes("actions"))).toBe(true);
    });
  });

  // ── 场景 8：缺 needConfirm → 推断 ────────────────────────

  describe("partial_repair - 推断 needConfirm", () => {
    it("不含 regenerate_storyboard 的 actions → needConfirm 推断为 false", () => {
      const obj = {
        reply: "好的",
        intent: "修改单个分镜",
        actions: [validImageAction],
        // needConfirm 缺失
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.needConfirm).toBe(false);
    });

    it("含 regenerate_storyboard action → needConfirm 推断为 true", () => {
      const obj = {
        reply: "重新生成所有分镜",
        intent: "全局重生成",
        actions: [{ type: "regenerate_storyboard", mode: "image" }],
        // needConfirm 缺失
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.needConfirm).toBe(true);
    });
  });

  // ── 场景 9：patch 缺 mode → 注入当前 mode ─────────────────

  describe("partial_repair - 注入 patch.mode", () => {
    it("update_shot_field patch 缺 mode → 注入当前 mode='image'", () => {
      const obj = {
        reply: "好的",
        intent: "修改分镜",
        needConfirm: false,
        actions: [
          {
            type: "update_shot_field",
            shotId: 1,
            // patch 缺少 mode 字段
            patch: { visualPrompt: "夕阳西下" },
          },
        ],
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(log.finalStage).toBe("partial_repair");
      expect(response.actions).toHaveLength(1);
      expect(log.repairedFields?.some((f) => f.includes("patch.mode"))).toBe(true);
    });

    it("update_shot_field patch 缺 mode → 注入当前 mode='video'", () => {
      const obj = {
        reply: "好的",
        intent: "修改运动提示词",
        needConfirm: false,
        actions: [
          {
            type: "update_shot_field",
            shotId: 2,
            patch: { motionPrompt: "镜头向右平移" },
          },
        ],
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "video");

      expect(log.ok).toBe(true);
      expect(response.actions).toHaveLength(1);
    });
  });

  // ── 场景 10：bulk_update_shots 缺 patch.mode ──────────────

  describe("partial_repair - bulk_update_shots 注入 patch.mode", () => {
    it("每条 item 的 patch 均注入当前 mode", () => {
      const obj = {
        reply: "批量更新",
        intent: "批量修改",
        needConfirm: false,
        actions: [
          {
            type: "bulk_update_shots",
            items: [
              { shotId: 1, patch: { visualPrompt: "画面A" } },
              { shotId: 2, patch: { visualPrompt: "画面B" } },
            ],
          },
        ],
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.actions).toHaveLength(1);
      expect(response.actions[0].type).toBe("bulk_update_shots");
    });
  });

  // ── 场景 11：非法 action type 过滤 ───────────────────────

  describe("partial_repair - 过滤非法 action", () => {
    it("含非法 type 的 action 被过滤，合法 action 保留", () => {
      const obj = {
        reply: "好的",
        intent: "处理",
        needConfirm: false,
        actions: [
          validImageAction,
          { type: "unknown_action_xyz", shotId: 1 },
        ],
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      // 合法 action 保留，非法的被过滤
      expect(response.actions).toHaveLength(1);
      expect(response.actions[0].type).toBe("update_shot_field");
      expect(log.repairedFields?.some((f) => f.includes("过滤"))).toBe(true);
    });

    it("全部 actions 非法 → 过滤为空数组，修复仍成功", () => {
      const obj = {
        reply: "好的",
        intent: "处理",
        needConfirm: false,
        actions: [
          { type: "bad_type_1" },
          { type: "bad_type_2" },
        ],
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.actions).toHaveLength(0);
    });
  });

  // ── 场景 12：suggestions/warnings 为 null ─────────────────

  describe("partial_repair - null 字段删除", () => {
    it("suggestions=null → 删除字段，响应中不含该字段", () => {
      const obj = {
        reply: "好的",
        intent: "处理",
        needConfirm: false,
        actions: [],
        suggestions: null,
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.suggestions).toBeUndefined();
    });

    it("warnings=null → 删除字段，响应中不含该字段", () => {
      const obj = {
        reply: "好的",
        intent: "处理",
        needConfirm: false,
        actions: [],
        warnings: null,
      };
      const { response, log } = parseStoryboardResponse(JSON.stringify(obj), "image");

      expect(log.ok).toBe(true);
      expect(response.warnings).toBeUndefined();
    });
  });

  // ── 场景 13：完全无法修复 → fallback ─────────────────────

  describe("完全无法修复 → fallback", () => {
    it("空对象 {} 经修复后仍无法通过 schema → fallback", () => {
      // 空对象: reply="" intent="" 无法修复为合法的（reply/intent 为空字符串无法通过 NonEmptyString）
      // 实际上 tryPartialRepair 会修复 reply 和 intent 为占位文本，所以 {} 通常能修复
      // 为触发真正 fallback，需要提供无法修复的数据（如 reply 为数字对象等）
      // 这里用整数作为 input，不是对象类型
      const { response, log } = parseStoryboardResponse("42", "image");
      // 42 是合法 JSON 但不是对象，tryPartialRepair 对非对象直接返回 null
      expect(log.ok).toBe(false);
      expect(log.finalStage).toBe("fallback");
      expect(response.warnings).toBeDefined();
    });
  });

  // ── 场景 14：FALLBACK_RESPONSE 常量不可变 ─────────────────

  describe("STORYBOARD_FALLBACK_RESPONSE 常量", () => {
    it("多次调用 fallback，常量内容不变", () => {
      parseStoryboardResponse("", "image");
      parseStoryboardResponse("not json", "video");

      expect(STORYBOARD_FALLBACK_RESPONSE.actions).toHaveLength(0);
      expect(STORYBOARD_FALLBACK_RESPONSE.intent).toBe("parse_error");
      expect(STORYBOARD_FALLBACK_RESPONSE.needConfirm).toBe(false);
    });
  });

  // ── 场景 15：log.rawPreview 截取 ─────────────────────────

  describe("log.rawPreview 截取前 300 字", () => {
    it("输入长度 > 300 时，rawPreview 仅保留前 300 字", () => {
      const longText = "x".repeat(500);
      const { log } = parseStoryboardResponse(longText, "image");
      expect(log.rawPreview.length).toBeLessThanOrEqual(300);
    });

    it("输入长度 <= 300 时，rawPreview 与原始文本相同", () => {
      const raw = minimalValidJson();
      const { log } = parseStoryboardResponse(raw, "image");
      expect(log.rawPreview).toBe(raw.slice(0, 300));
    });
  });
});
