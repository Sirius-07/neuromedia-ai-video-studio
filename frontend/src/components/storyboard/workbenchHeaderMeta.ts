import type { CreationInputMode, CreationPublishGoal } from '../../types/creationIntent';

export interface WorkbenchHeaderIntent {
  inputMode?: CreationInputMode;
  publishGoal?: CreationPublishGoal;
  assetTheme?: string;
}

export function getWorkbenchHeaderMeta(intent?: WorkbenchHeaderIntent | null) {
  const inputMode = intent?.inputMode || 'article';
  const publishGoal = intent?.publishGoal || 'refine_handoff';
  const sourceLabel = inputMode === 'assets' ? '素材' : '文稿';
  const modeLabel = publishGoal === 'fast_publish' ? '快速成片' : '可编辑草稿';
  const statusLabel = inputMode === 'assets'
    ? publishGoal === 'fast_publish' ? '用素材生成' : '可调引用'
    : publishGoal === 'fast_publish' ? '自动生图' : '先审分镜';
  const contextLabel = `${sourceLabel} · ${modeLabel}`;
  const themeLabel = intent?.assetTheme?.trim() || undefined;

  return {
    summary: `${contextLabel} · ${statusLabel}`,
    contextLabel,
    sourceLabel,
    modeLabel,
    statusLabel,
    themeLabel,
  };
}
