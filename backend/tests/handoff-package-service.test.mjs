import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHandoffPackage } from '../src/services/HandoffPackageService.js';

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-package-'));

const result = await createHandoffPackage({
  outputDir,
  sample: {
    title: '社区新闻样片',
    summary: '用于交接给视频制作人员的新闻样片说明。',
    shots: [
      {
        index: 1,
        durationSeconds: 5,
        visualIntent: '居民在社区服务站排队办理业务',
        captionOrVoiceover: '今天，社区服务站迎来办事高峰。',
        source: { type: 'uploaded_asset', label: '现场素材', assetUrl: '/uploads/assets/community.jpg' },
        productionNote: '优先使用现场图片，后续可替换为视频。',
      },
      {
        index: 2,
        durationSeconds: 4,
        visualIntent: '服务窗口的细节画面',
        captionOrVoiceover: '工作人员正在解答居民问题。',
        source: { type: 'ai_reference', label: 'AI 参考画面' },
        productionNote: 'AI 画面只做参考，不能误认为真实现场。',
      },
    ],
  },
});

assert.ok(fs.existsSync(result.zipPath), 'zip package should exist');
assert.ok(result.files.includes('storyboard.pdf'));
assert.ok(result.files.includes('sample.json'));
assert.ok(result.files.includes('sample-video-status.txt'));

const zipHeader = fs.readFileSync(result.zipPath).subarray(0, 2).toString('utf8');
assert.equal(zipHeader, 'PK');

const stats = fs.statSync(result.zipPath);
assert.ok(stats.size > 1000, `zip should not be empty, got ${stats.size}`);

console.log('PASS handoff package service smoke', result.zipPath);
