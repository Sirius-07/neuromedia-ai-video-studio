import { describe, expect, it } from 'vitest';
import { getStudioHeaderSummary } from './studioHeaderMeta';

describe('getStudioHeaderSummary', () => {
  it('keeps storyboard state compact for workbench projects', () => {
    expect(getStudioHeaderSummary('storyboard', {
      inputMode: 'assets',
      publishGoal: 'fast_publish',
    })).toBe('分镜 · 素材 · 快速成片');
  });

  it('falls back to a short stage label when no creation intent exists', () => {
    expect(getStudioHeaderSummary('script')).toBe('脚本');
    expect(getStudioHeaderSummary('style')).toBe('风格');
    expect(getStudioHeaderSummary('storyboard')).toBe('分镜');
  });
});
