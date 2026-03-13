// assistant/mockData.ts
// 用于演示的 mock 消息数据

import type { AssistantMessage } from "./types";

export const MOCK_MESSAGES: AssistantMessage[] = [
  {
    id: "msg_001",
    role: "assistant",
    content:
      "你好！我是你的 AI 脚本助手。当前项目共 5 个 shot，总时长 50 秒。\n\n我可以帮你优化旁白文案、调整节奏、新增或删除镜头，也可以对全局风格进行润色。",
    timestamp: "2026-03-10T10:00:00Z",
    status: "done",
    suggestions: ["开始创作", "让节奏更紧凑", "增加情绪张力"],
  },
  {
    id: "msg_002",
    role: "user",
    content: "帮我把第 3 个 shot 的旁白改得更有感染力，突出广州的现代活力。",
    timestamp: "2026-03-10T10:01:00Z",
    status: "done",
  },
  {
    id: "msg_003",
    role: "assistant",
    content:
      "已为 Shot 3 重写旁白：\n\n**原文**：无人机俯瞰珠江新城CBD，摩天大楼林立，广州塔在距光下闪耀\n\n**新文案**：镜头从云端俯冲而下——珠江新城的玻璃森林拔地而起，广州塔在金色光海中傲然矗立，这座城市，正以最自信的姿态，向世界宣告它的时代。\n\n是否应用此修改？",
    timestamp: "2026-03-10T10:01:30Z",
    status: "done",
    suggestions: ["应用修改", "再优化一次", "恢复原文"],
  },
];

export const GLOBAL_SUGGESTIONS = [
  "开始创作",
  "让节奏更紧凑",
  "增加情绪张力",
  "优化镜头语言",
  "增加一个收尾镜头",
  "统一风格基调",
];

export const SHOT_SUGGESTIONS = [
  "改写旁白",
  "优化画面描述",
  "缩短时长",
  "加强情绪",
  "换一个角度",
];
