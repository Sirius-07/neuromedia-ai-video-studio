import { getWorkbenchHeaderMeta, type WorkbenchHeaderIntent } from '../storyboard/workbenchHeaderMeta';

const stageLabels: Record<string, string> = {
  draft: '项目',
  script: '脚本',
  style: '风格',
  storyboard: '分镜',
  handoff: '交接样片',
};

export function getStudioHeaderSummary(stage: string, intent?: WorkbenchHeaderIntent | null) {
  const stageLabel = stageLabels[stage] || '项目';

  if (stage === 'storyboard' && intent) {
    return `${stageLabel} · ${getWorkbenchHeaderMeta(intent).contextLabel}`;
  }

  return stageLabel;
}
