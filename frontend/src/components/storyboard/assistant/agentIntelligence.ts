import type { Scene } from "../types";
import type { StoryboardAssistantResponse, StoryboardMode } from "./types";
import type {
  ImageContextShot,
  StoryboardContextPayload,
  VideoContextShot,
} from "./buildStoryboardContext";

type AgentTone = "good" | "warn" | "neutral";

export interface StoryboardAgentMetric {
  label: string;
  value: string;
  tone: AgentTone;
}

export interface StoryboardAgentInsight {
  modeLabel: string;
  focusLabel: string;
  completionPercent: number;
  primaryNeed: string;
  recommendedPrompt: string;
  optionPrompt: string;
  quickPrompts: string[];
  emptyTitle: string;
  emptyDescription: string;
  metrics: StoryboardAgentMetric[];
}

const uniq = (items: string[]): string[] =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const clean = (value: string | null | undefined): string =>
  value?.trim() ?? "";

const clampText = (value: string, max = 220): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

function parseDuration(raw: string | undefined): number {
  const value = Number.parseFloat((raw ?? "").replace(/s$/i, ""));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function selectedSceneInfo(scenes: Scene[], selectedShotId: number | null) {
  if (selectedShotId === null) return { scene: null, order: null };
  const index = scenes.findIndex((scene) => scene.id === selectedShotId);
  return {
    scene: index >= 0 ? scenes[index] : null,
    order: index >= 0 ? index + 1 : null,
  };
}

export function deriveStoryboardAgentState(
  scenes: Scene[],
  mode: StoryboardMode,
  selectedShotId: number | null
): StoryboardAgentInsight {
  const total = scenes.length;
  const { scene: selectedScene, order: selectedOrder } = selectedSceneInfo(
    scenes,
    selectedShotId
  );

  const missingVisuals = scenes.filter((scene) => !clean(scene.visualPrompt)).length;
  const missingMotions = scenes.filter((scene) => !clean(scene.motionPrompt)).length;
  const missingNarration = scenes.filter((scene) => !clean(scene.narration)).length;
  const generatedImages = scenes.filter((scene) => Boolean(scene.assetUrl)).length;
  const generatedVideos = scenes.filter((scene) => Boolean(scene.videoUrl)).length;
  const totalDuration = scenes.reduce((sum, scene) => sum + parseDuration(scene.duration), 0);
  const completeCount =
    mode === "image" ? total - missingVisuals : total - missingMotions;
  const completionPercent = total === 0 ? 0 : Math.round((completeCount / total) * 100);
  const modeLabel = mode === "image" ? "图片" : "视频";
  const focusLabel = selectedOrder ? `分镜 ${selectedOrder}` : "全局";

  const metrics: StoryboardAgentMetric[] = [
    {
      label: mode === "image" ? "画面提示" : "运动提示",
      value: `${completeCount}/${total || 0}`,
      tone: completeCount === total && total > 0 ? "good" : "warn",
    },
    {
      label: "旁白",
      value: `${Math.max(total - missingNarration, 0)}/${total || 0}`,
      tone: missingNarration === 0 && total > 0 ? "good" : "neutral",
    },
    {
      label: mode === "image" ? "已出图" : "已出片",
      value: mode === "image" ? `${generatedImages}/${total || 0}` : `${generatedVideos}/${total || 0}`,
      tone:
        (mode === "image" ? generatedImages : generatedVideos) > 0
          ? "good"
          : "neutral",
    },
  ];

  if (total === 0) {
    return {
      modeLabel,
      focusLabel,
      completionPercent: 0,
      primaryNeed: "当前还没有分镜，适合先让助手把主题拆成可生成的镜头结构。",
      recommendedPrompt: "根据项目目标先生成 5 个分镜草案，并给我 3 种叙事方向选择",
      optionPrompt: "先给我 3 个分镜叙事方向，让我选择后再生成",
      quickPrompts: [
        "先给我 3 个分镜叙事方向，让我选择后再生成",
        "按短视频节奏规划 5 个镜头",
        "把当前主题拆成开场、转折、高潮、收束",
      ],
      emptyTitle: "先定方向",
      emptyDescription: "让助手先出可选择的分镜路线，再进入生成。",
      metrics,
    };
  }

  if (selectedScene && selectedOrder) {
    const selectedNeedsPrompt =
      mode === "image"
        ? !clean(selectedScene.visualPrompt)
        : !clean(selectedScene.motionPrompt);
    const selectedNeedsNarration = !clean(selectedScene.narration);

    const recommendedPrompt =
      mode === "image"
        ? selectedNeedsPrompt
          ? `为分镜 ${selectedOrder} 补全可直接生成的画面提示词，并给我 2 个风格选项`
          : `优化分镜 ${selectedOrder} 的画面提示词，让主体、环境、光线和镜头参数更明确`
        : selectedNeedsPrompt
          ? `为分镜 ${selectedOrder} 设计镜头运动，并给我 3 个节奏选项`
          : `优化分镜 ${selectedOrder} 的运动描述，让镜头运动更自然并匹配旁白`;

    const quickPrompts = [
      recommendedPrompt,
      selectedNeedsNarration
        ? `为分镜 ${selectedOrder} 写一句更有画面感的旁白/字幕`
        : `检查分镜 ${selectedOrder} 的旁白和画面是否匹配`,
      mode === "image"
        ? `给分镜 ${selectedOrder} 提供 3 个构图方案让我选`
        : `给分镜 ${selectedOrder} 提供 3 个镜头运动方案让我选`,
    ];

    return {
      modeLabel,
      focusLabel,
      completionPercent,
      primaryNeed: selectedNeedsPrompt
        ? `${focusLabel} 缺少${mode === "image" ? "画面提示词" : "运动提示词"}，可以先补齐再生成。`
        : `${focusLabel} 已有基础内容，适合做导演级精修和选项比较。`,
      recommendedPrompt,
      optionPrompt:
        mode === "image"
          ? `给分镜 ${selectedOrder} 提供 3 个构图方案让我选`
          : `给分镜 ${selectedOrder} 提供 3 个镜头运动方案让我选`,
      quickPrompts: uniq(quickPrompts),
      emptyTitle: `${focusLabel} 已锁定`,
      emptyDescription: selectedNeedsPrompt
        ? "先补齐核心提示词，再进入生成或重生成。"
        : "可以直接让助手精修、诊断或给出多个方向。",
      metrics,
    };
  }

  const missingCount = mode === "image" ? missingVisuals : missingMotions;
  const recommendedPrompt =
    missingCount > 0
      ? mode === "image"
        ? `补全 ${missingCount} 个空白分镜的画面提示词，并保持全片视觉统一`
        : `补全 ${missingCount} 个空白分镜的运动提示词，并保持节奏连贯`
      : mode === "image"
        ? "先做一次全局导演审片，指出画面风格、景别和叙事衔接的问题"
        : "先检查全片镜头运动和时长节奏，给出可选择的优化方案";

  const quickPrompts = [
    recommendedPrompt,
    mode === "image"
      ? "给我 3 个整体视觉风格方向，让我选择后再统一"
      : "给我 3 个视频节奏方向，让我选择后再统一",
    mode === "image"
      ? "统一所有分镜的光线、焦段和色彩基调"
      : "统一所有分镜的镜头运动强度和时长",
  ];

  return {
    modeLabel,
    focusLabel,
    completionPercent,
    primaryNeed:
      missingCount > 0
        ? `还有 ${missingCount} 个分镜需要补齐${mode === "image" ? "画面提示词" : "运动提示词"}。`
        : `总时长约 ${totalDuration.toFixed(0)}s，适合进入全局质量诊断和风格统一。`,
    recommendedPrompt,
    optionPrompt:
      mode === "image"
        ? "给我 3 个整体视觉风格方向，让我选择后再统一"
        : "给我 3 个视频节奏方向，让我选择后再统一",
    quickPrompts: uniq(quickPrompts),
    emptyTitle: "全局导演模式",
    emptyDescription: "让助手先诊断整条分镜线，再选择统一或精修。",
    metrics,
  };
}

function getSelectedImageShot(context: StoryboardContextPayload): ImageContextShot | null {
  if (context.mode !== "image" || context.selectedShotId == null) return null;
  return context.shots.find((shot) => shot.id === context.selectedShotId) ?? null;
}

function getSelectedVideoShot(context: StoryboardContextPayload): VideoContextShot | null {
  if (context.mode !== "video" || context.selectedShotId == null) return null;
  return context.shots.find((shot) => shot.id === context.selectedShotId) ?? null;
}

function baseVisualPrompt(shot: ImageContextShot, projectTitle: string): string {
  const seed =
    clean(shot.visualPrompt) ||
    clean(shot.narration) ||
    `${projectTitle || "当前项目"}第 ${shot.order} 个分镜`;
  return clampText(
    `${seed}。新闻纪录片质感，主体明确，城市环境层次清晰，真实自然光影，35mm cinematic framing，high detail，画面干净可用于视频分镜生成。`
  );
}

function baseMotionPrompt(shot: VideoContextShot, projectTitle: string): string {
  const seed =
    clean(shot.motionPrompt) ||
    clean(shot.narration) ||
    `${projectTitle || "当前项目"}第 ${shot.order} 个分镜`;
  return clampText(
    `${seed}。镜头缓慢推进并保持主体稳定，运动自然克制，保留城市夜景氛围和叙事信息，适合 4-5 秒短片节奏。`
  );
}

function askUserResponse(
  reply: string,
  question: string,
  options: string[],
  hypothesis?: string
): StoryboardAssistantResponse {
  return {
    reply,
    intent: "clarify_with_options",
    needConfirm: false,
    actions: [
      {
        type: "ask_user",
        question,
        options,
        ...(hypothesis ? { hypothesis } : {}),
      },
    ],
    suggestions: options,
    warnings: ["AI 服务暂不可用，已切换为本地导演兜底建议。"],
  };
}

export function createLocalStoryboardAssistantResponse(
  message: string,
  context: StoryboardContextPayload
): StoryboardAssistantResponse | null {
  const text = message.trim();
  if (!text) return null;

  const selectedVisualStyle = [
    "电影感夜景",
    "新闻纪实质感",
    "更强城市品牌露出",
  ].find((option) => text.includes(option));
  const selectedVideoPace = [
    "慢速沉浸",
    "紧凑短视频节奏",
    "关键镜头突出",
  ].find((option) => text.includes(option));

  if (context.mode === "image" && selectedVisualStyle) {
    const selected = getSelectedImageShot(context);
    const targets = selected ? [selected] : context.shots;
    const styleNote =
      selectedVisualStyle === "电影感夜景"
        ? "电影感夜景，高反差城市灯光，蓝青色夜景调性"
        : selectedVisualStyle === "新闻纪实质感"
          ? "新闻纪实质感，真实自然光影，信息清晰"
          : "突出城市品牌符号、地标和活动 logo 露出";
    const items = targets.map((shot) => ({
      shotId: shot.id,
      patch: {
        mode: "image" as const,
        visualPrompt: clampText(`${baseVisualPrompt(shot, context.projectTitle)} ${styleNote}。`),
        focalLength: selectedVisualStyle === "更强城市品牌露出" ? "50mm" : "35mm",
        notes: `按用户选择统一为：${selectedVisualStyle}`,
      },
    }));

    return {
      reply: selected
        ? `已按“${selectedVisualStyle}”为分镜 ${selected.order} 准备精修方案。`
        : `已按“${selectedVisualStyle}”为全部 ${items.length} 个分镜准备统一方案。`,
      intent: "apply_selected_visual_direction",
      needConfirm: items.length > 3,
      actions:
        items.length === 1
          ? [{ type: "update_shot_field", ...items[0], reason: `用户选择 ${selectedVisualStyle}` }]
          : [{ type: "bulk_update_shots", items, reason: `用户选择 ${selectedVisualStyle}` }],
      suggestions: ["确认后生成图片", "继续优化旁白", "换一个视觉方向"],
      warnings: ["AI 服务暂不可用，已切换为本地导演兜底建议。"],
    };
  }

  if (context.mode === "video" && selectedVideoPace) {
    const selected = getSelectedVideoShot(context);
    const targets = selected ? [selected] : context.shots;
    const duration =
      selectedVideoPace === "慢速沉浸"
        ? 6
        : selectedVideoPace === "紧凑短视频节奏"
          ? 3
          : 5;
    const strength =
      selectedVideoPace === "慢速沉浸"
        ? 22
        : selectedVideoPace === "紧凑短视频节奏"
          ? 48
          : 34;
    const items = targets.map((shot) => ({
      shotId: shot.id,
      patch: {
        mode: "video" as const,
        motionPrompt: clampText(`${baseMotionPrompt(shot, context.projectTitle)} 节奏方向：${selectedVideoPace}。`),
        cameraMovement: selectedVideoPace === "关键镜头突出" ? "zoom_in" as const : "pan_right" as const,
        cameraStrength: strength,
        duration,
      },
    }));

    return {
      reply: selected
        ? `已按“${selectedVideoPace}”为分镜 ${selected.order} 准备运动方案。`
        : `已按“${selectedVideoPace}”为全部 ${items.length} 个分镜准备运动方案。`,
      intent: "apply_selected_video_pace",
      needConfirm: items.length > 3,
      actions:
        items.length === 1
          ? [{ type: "update_shot_field", ...items[0], reason: `用户选择 ${selectedVideoPace}` }]
          : [{ type: "bulk_update_shots", items, reason: `用户选择 ${selectedVideoPace}` }],
      suggestions: ["确认后生成视频", "继续检查旁白匹配", "换一个节奏方向"],
      warnings: ["AI 服务暂不可用，已切换为本地导演兜底建议。"],
    };
  }

  const wantsOptions = /选项|方向|方案|让我选|选择|先问|不要直接/.test(text);
  const isBroadOptimize = /优化一下|改一下|调整一下|看看|诊断|审片/.test(text);

  if (wantsOptions || isBroadOptimize) {
    const scope = context.selectedShotOrder
      ? `分镜 ${context.selectedShotOrder}`
      : "全片";
    return askUserResponse(
      `我先不直接改，先把 ${scope} 的可行方向拆给你。`,
      context.mode === "image"
        ? `你希望我优先从哪个方向处理 ${scope}？`
        : `你希望我优先用哪种节奏处理 ${scope}？`,
      context.mode === "image"
        ? ["电影感夜景", "新闻纪实质感", "更强城市品牌露出"]
        : ["慢速沉浸", "紧凑短视频节奏", "关键镜头突出"],
      "当前请求更适合先让用户选择方向，再执行结构化修改"
    );
  }

  if (context.mode === "image") {
    const selected = getSelectedImageShot(context);
    const wantsFill = /补全|空白|补齐/.test(text);
    const wantsUnify = /统一|风格|电影感|光线|色彩|焦段/.test(text);
    const targets = selected
      ? [selected]
      : context.shots.filter((shot) => wantsFill ? !clean(shot.visualPrompt) : true);

    if ((wantsFill || wantsUnify || /画面提示|视觉|构图/.test(text)) && targets.length > 0) {
      const items = targets.map((shot) => ({
        shotId: shot.id,
        patch: {
          mode: "image" as const,
          visualPrompt: baseVisualPrompt(shot, context.projectTitle),
          focalLength: clean(shot.focalLength) || "35mm",
          equipment: clean(shot.equipment) || "Tripod",
          notes: wantsUnify ? "统一为新闻纪录片式城市夜景质感" : "补齐为可直接生成的分镜提示词",
        },
      }));

      return {
        reply: selected
          ? `已为分镜 ${selected.order} 准备好画面提示词精修方案。`
          : `已为 ${items.length} 个分镜准备好画面提示词补全方案。`,
        intent: selected ? "polish_selected_visual" : "complete_visual_prompts",
        needConfirm: items.length > 3,
        actions:
          items.length === 1
            ? [{ type: "update_shot_field", ...items[0], reason: "提升图像生成稳定性" }]
            : [{ type: "bulk_update_shots", items, reason: "补齐并统一画面生成提示词" }],
        suggestions: ["确认后生成图片", "再给我 3 个视觉方向", "继续检查旁白匹配"],
        warnings: ["AI 服务暂不可用，已切换为本地导演兜底建议。"],
      };
    }
  }

  if (context.mode === "video") {
    const selected = getSelectedVideoShot(context);
    const wantsDuration = /时长|节奏|快|慢|紧凑/.test(text);
    const targets = selected ? [selected] : context.shots;

    if (/运动|镜头|推|拉|摇|节奏|时长/.test(text) && targets.length > 0) {
      const items = targets.map((shot) => ({
        shotId: shot.id,
        patch: {
          mode: "video" as const,
          motionPrompt: wantsDuration
            ? clean(shot.motionPrompt) || baseMotionPrompt(shot, context.projectTitle)
            : baseMotionPrompt(shot, context.projectTitle),
          cameraMovement: "zoom_in" as const,
          cameraStrength: wantsDuration ? 28 : 36,
          duration: wantsDuration ? 4 : shot.duration ?? 5,
        },
      }));

      return {
        reply: selected
          ? `已为分镜 ${selected.order} 准备好镜头运动优化方案。`
          : `已为 ${items.length} 个分镜准备好镜头运动统一方案。`,
        intent: selected ? "polish_selected_motion" : "unify_motion_design",
        needConfirm: items.length > 3,
        actions:
          items.length === 1
            ? [{ type: "update_shot_field", ...items[0], reason: "提升视频运动稳定性" }]
            : [{ type: "bulk_update_shots", items, reason: "统一视频节奏和镜头运动" }],
        suggestions: ["确认后生成视频", "给我 3 个节奏方案", "检查旁白和运动是否匹配"],
        warnings: ["AI 服务暂不可用，已切换为本地导演兜底建议。"],
      };
    }
  }

  return askUserResponse(
    "我需要先确认你的修改方向，避免误改分镜。",
    "这次你希望我怎么处理？",
    ["只给诊断不修改", "先给 3 个方案让我选", "直接生成可确认的修改"],
    "当前指令没有明确目标字段或范围"
  );
}
