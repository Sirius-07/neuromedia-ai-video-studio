import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildStructuredStoryboardCsv,
  buildStructuredStoryboardRows,
  exportRoughCutWithProgress,
  getExportableVideoScenes,
} from './videoExportApi';
import type { Scene } from '../components/storyboard/types';

const baseScene: Scene = {
  id: 1,
  type: 'ai',
  duration: '5',
  script: 'scene',
  isAiGenerated: true,
  visualPrompt: 'scene',
  motionPrompt: '',
  generationStatus: 'idle',
  footageStatus: 'empty',
};

describe('video export API', () => {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  });

  it('streams export progress without opening a GET EventSource request', async () => {
    const progress = vi.fn();
    globalThis.EventSource = class {
      constructor() {
        throw new Error('EventSource should not be constructed for POST exports');
      }
    } as unknown as typeof EventSource;
    globalThis.fetch = vi.fn(async () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              [
                'data: {"stage":"downloading","current":1,"total":1}',
                '',
                'data: {"stage":"completed","result":{"success":true,"videoPath":"/tmp/out.mp4","videoUrl":"/uploads/video/out.mp4","filename":"out.mp4","videoCount":1}}',
                '',
              ].join('\n')
            )
          );
          controller.close();
        },
      });

      return new Response(body, { status: 200 });
    }) as typeof fetch;

    const result = await exportRoughCutWithProgress([baseScene], progress);

    expect(result.filename).toBe('out.mp4');
    expect(progress).toHaveBeenCalledWith({ stage: 'downloading', current: 1, total: 1 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/video-export\/rough-cut$/),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('keeps only generated videos and uploaded video assets for rough-cut export', () => {
    const scenes: Scene[] = [
      { ...baseScene, id: 1, assetUrl: '/uploads/assets/photo.png' },
      { ...baseScene, id: 2, assetUrl: '/uploads/assets/clip.mp4' },
      { ...baseScene, id: 3, videoUrl: '/uploads/video/generated.mp4' },
    ];

    expect(getExportableVideoScenes(scenes).map(scene => scene.id)).toEqual([2, 3]);
  });

  it('builds a structured storyboard table for every shot', () => {
    const scenes: Scene[] = [
      {
        ...baseScene,
        id: 1,
        duration: '6s',
        script: '城市更新浪潮中，老街早餐店如何坚守？',
        narration: '一碗汤粉，承载几代人的记忆',
        visualPrompt: '清晨街巷和早餐店门头',
        motionPrompt: '缓慢推进',
        videoUrl: '/uploads/video/shot-1.mp4',
      },
      {
        ...baseScene,
        id: 2,
        duration: '8',
        assetUrl: '/uploads/assets/reference.png',
        notes: '等待生成视频',
      },
    ];

    const rows = buildStructuredStoryboardRows(scenes);
    const csv = buildStructuredStoryboardCsv(scenes);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      shotNumber: 1,
      durationSeconds: 6,
      sourceType: 'AI 生成视频',
      productionStatus: '视频已就绪',
    });
    expect(rows[1]).toMatchObject({
      sourceType: '图片/参考画面',
      productionStatus: '有画面，待生成视频',
    });
    expect(csv).toContain('"镜号","分镜ID","时长(秒)"');
    expect(csv).toContain('"城市更新浪潮中，老街早餐店如何坚守？"');
    expect(csv).toContain('"一碗汤粉，承载几代人的记忆"');
  });
});
