import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
});
