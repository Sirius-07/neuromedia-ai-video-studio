import { describe, expect, it } from 'vitest';
import { buildInitialHandoffSample } from './handoffSampleBuilder';
import type { CreationIntent } from '../../types/creationIntent';

describe('buildInitialHandoffSample', () => {
  it('marks selected images as storyboard frames and unselected images as style references', () => {
    const creationIntent = {
      inputMode: 'article',
      publishGoal: 'refine_handoff',
      prompt: '社区旧厂房改造为公共阅读空间，居民希望保留工业记忆。',
      uploadedAssets: [],
      generationMode: 'ai_plus_real',
      proposalAlternatives: [],
      aspectRatio: '16:9',
      artStyle: 'realistic',
      flowVersion: 'workbench_v1',
    } satisfies CreationIntent;

    const sample = buildInitialHandoffSample({
      creationIntent,
      projectTitle: '旧厂房阅读空间',
      assets: [
        {
          file_path: '/uploads/assets/factory-before.jpg',
          file_type: 'image',
          name: 'factory-before.jpg',
          description: null,
        },
        {
          file_path: '/uploads/assets/light-reference.jpg',
          file_type: 'image',
          name: 'light-reference.jpg',
          description: null,
        },
      ],
      selectedAssetIds: ['/uploads/assets/factory-before.jpg'],
      scenes: [
        {
          description: '旧厂房外立面与居民走进空间',
          narration: '一座旧厂房，正在变成社区新的公共客厅。',
          duration: 6,
          assetUrl: '/uploads/assets/factory-before.jpg',
        },
      ],
    });

    expect(sample.title).toBe('旧厂房阅读空间');
    expect(sample.assets).toHaveLength(2);
    expect(sample.assets[0]).toMatchObject({
      fileName: 'factory-before.jpg',
      includedInStoryboard: true,
      referenceRole: 'storyboard_frame',
    });
    expect(sample.assets[1]).toMatchObject({
      fileName: 'light-reference.jpg',
      includedInStoryboard: false,
      referenceRole: 'style_reference',
    });
    expect(sample.shots[0].assetRefs).toEqual([
      expect.objectContaining({
        fileName: 'factory-before.jpg',
        referenceRole: 'storyboard_frame',
      }),
    ]);
  });

  it('uses selected assets as storyboard shots even when scenes do not reference them', () => {
    const sample = buildInitialHandoffSample({
      reportText: '街区志愿者在暴雨后清理排水口。',
      assets: [
        {
          file_path: '/uploads/assets/volunteer.png',
          file_type: 'image',
          description: null,
          selected: true,
        },
      ],
      proposal: {
        title: '暴雨后的街区互助',
        tags: [],
        reasoning: '突出现场行动',
        visualStyle: '纪实',
        bgmStyle: '克制',
        roughScript: {
          scenes: [
            {
              type: 'opening',
              description: '雨后的街道路面与排水口特写',
              script: '暴雨过后，志愿者第一时间来到现场。',
              duration: 5,
            },
          ],
        },
      },
      scenes: [],
    });

    expect(sample.shots).toHaveLength(1);
    expect(sample.shots[0].source.type).toBe('uploaded_asset');
    expect(sample.shots[0].assetRefs).toEqual([
      expect.objectContaining({
        fileName: 'volunteer.png',
        referenceRole: 'storyboard_frame',
      }),
    ]);
    expect(sample.assets[0]).toMatchObject({
      fileName: 'volunteer.png',
      includedInStoryboard: true,
      referenceRole: 'storyboard_frame',
    });
  });

  it('falls back to an empty planning state without route state', () => {
    const sample = buildInitialHandoffSample({});

    expect(sample.title).toBe('视频交接样片');
    expect(sample.shots).toHaveLength(1);
    expect(sample.shots[0].source.type).toBe('placeholder');
    expect(sample.emptyState).toBe(true);
  });
});
