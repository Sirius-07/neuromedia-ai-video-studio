import { describe, expect, it } from 'vitest';
import { getPublishGoalHelp, getPublishGoalMeta } from './startPageFlowCopy';

describe('startPageFlowCopy', () => {
  it('keeps publish goal copy compact', () => {
    expect(getPublishGoalMeta('fast_publish')).toMatchObject({
      title: '快速成片',
      badge: '自动生图',
    });
    expect(getPublishGoalMeta('refine_handoff')).toMatchObject({
      title: '可编辑草稿',
      badge: '先审分镜',
    });
  });

  it('describes the follow-up flow for each publish goal', () => {
    expect(getPublishGoalHelp('fast_publish')).toMatchObject({
      title: '快速成片会怎么走？',
      resultLabel: '结果：进入工作台后自动生成画面',
      steps: expect.arrayContaining([
        expect.objectContaining({
          title: '4. 自动生成画面',
          imageSrc: '/flow-help/dark-auto-result.png',
        }),
      ]),
    });
    expect(getPublishGoalHelp('refine_handoff')).toMatchObject({
      title: '可编辑草稿会怎么走？',
      resultLabel: '结果：先得到可编辑分镜草稿',
      steps: expect.arrayContaining([
        expect.objectContaining({
          title: '4. 确认后再生成画面',
          imageSrc: '/flow-help/light-draft-result.png',
        }),
      ]),
    });
  });
});
