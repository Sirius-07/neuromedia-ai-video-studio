export type StartPublishGoal = 'fast_publish' | 'refine_handoff';
export type PublishGoalHelpStepIcon = 'brief' | 'style' | 'workbench' | 'result';

export interface PublishGoalHelpStep {
  icon: PublishGoalHelpStepIcon;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
}

export interface PublishGoalHelp {
  title: string;
  summary: string;
  resultLabel: string;
  steps: PublishGoalHelpStep[];
}

export function getPublishGoalMeta(publishGoal: StartPublishGoal) {
  if (publishGoal === 'refine_handoff') {
    return {
      title: '可编辑草稿',
      badge: '先审分镜',
      description: '先得到分镜草稿，确认后再生成画面。',
    };
  }

  return {
    title: '快速成片',
    badge: '自动生图',
    description: '生成分镜后自动补齐镜头画面，快速看到完整视频方向。',
  };
}

export function getPublishGoalHelp(publishGoal: StartPublishGoal): PublishGoalHelp {
  if (publishGoal === 'refine_handoff') {
    return {
      title: '可编辑草稿会怎么走？',
      summary: '适合需要先确认分镜、再决定哪些镜头生成画面的项目。',
      resultLabel: '结果：先得到可编辑分镜草稿',
      steps: [
        {
          icon: 'brief',
          title: '1. AI 读懂内容',
          description: '分析文稿、想法和素材，提炼主题、受众和关键信息。',
          imageSrc: '/flow-help/light-brief.png',
          imageAlt: '白色主题创作入口界面截图',
        },
        {
          icon: 'style',
          title: '2. 生成方案并选风格',
          description: '先给视频方案，再进入风格与画幅选择。',
          imageSrc: '/flow-help/light-style.png',
          imageAlt: '白色主题风格选择界面截图',
        },
        {
          icon: 'workbench',
          title: '3. 进入分镜工作台',
          description: '生成镜头卡、文案和节奏建议，方便逐条修改。',
          imageSrc: '/flow-help/light-workbench.png',
          imageAlt: '白色主题分镜工作台界面截图',
        },
        {
          icon: 'result',
          title: '4. 确认后再生成画面',
          description: '你审完分镜后，再手动触发需要的镜头画面。',
          imageSrc: '/flow-help/light-draft-result.png',
          imageAlt: '白色主题确认生成画面界面截图',
        },
      ],
    };
  }

  return {
    title: '快速成片会怎么走？',
    summary: '适合先快速看到完整方向，再在工作台里微调镜头。',
    resultLabel: '结果：进入工作台后自动生成画面',
    steps: [
      {
        icon: 'brief',
        title: '1. AI 读懂内容',
        description: '分析文稿、想法和素材，提炼主题、受众和关键信息。',
        imageSrc: '/flow-help/dark-brief.png',
        imageAlt: '黑色主题创作入口界面截图',
      },
      {
        icon: 'style',
        title: '2. 生成方案并选风格',
        description: '先给推荐视频方案，再进入风格与画幅选择。',
        imageSrc: '/flow-help/dark-style.png',
        imageAlt: '黑色主题风格选择界面截图',
      },
      {
        icon: 'workbench',
        title: '3. 进入分镜工作台',
        description: '自动整理镜头、文案、节奏和素材使用建议。',
        imageSrc: '/flow-help/dark-workbench.png',
        imageAlt: '黑色主题分镜工作台界面截图',
      },
      {
        icon: 'result',
        title: '4. 自动生成画面',
        description: '系统开始生成镜头画面，你可以随时暂停或调整。',
        imageSrc: '/flow-help/dark-auto-result.png',
        imageAlt: '黑色主题自动生成画面界面截图',
      },
    ],
  };
}
