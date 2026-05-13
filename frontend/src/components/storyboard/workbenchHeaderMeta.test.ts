import { describe, expect, it } from 'vitest';
import { getWorkbenchHeaderMeta } from './workbenchHeaderMeta';

describe('getWorkbenchHeaderMeta', () => {
  it('labels article fast-publish projects as auto-generating', () => {
    expect(getWorkbenchHeaderMeta({
      inputMode: 'article',
      publishGoal: 'fast_publish',
    })).toMatchObject({
      summary: '文稿 · 快速成片 · 自动生图',
      contextLabel: '文稿 · 快速成片',
      sourceLabel: '文稿',
      modeLabel: '快速成片',
      statusLabel: '自动生图',
    });
  });

  it('labels article draft projects as storyboard review first', () => {
    expect(getWorkbenchHeaderMeta({
      inputMode: 'article',
      publishGoal: 'refine_handoff',
    })).toMatchObject({
      summary: '文稿 · 可编辑草稿 · 先审分镜',
      contextLabel: '文稿 · 可编辑草稿',
      statusLabel: '先审分镜',
    });
  });

  it('labels asset flows with source-specific status', () => {
    expect(getWorkbenchHeaderMeta({
      inputMode: 'assets',
      publishGoal: 'fast_publish',
      assetTheme: '广州记忆',
    })).toMatchObject({
      summary: '素材 · 快速成片 · 用素材生成',
      contextLabel: '素材 · 快速成片',
      sourceLabel: '素材',
      statusLabel: '用素材生成',
      themeLabel: '广州记忆',
    });

    expect(getWorkbenchHeaderMeta({
      inputMode: 'assets',
      publishGoal: 'refine_handoff',
    })).toMatchObject({
      summary: '素材 · 可编辑草稿 · 可调引用',
      contextLabel: '素材 · 可编辑草稿',
      statusLabel: '可调引用',
    });
  });
});
