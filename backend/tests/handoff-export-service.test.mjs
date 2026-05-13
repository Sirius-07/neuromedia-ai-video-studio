import assert from 'node:assert/strict';
import {
  buildSampleVideoNotice,
  normalizeHandoffSample,
} from '../src/services/HandoffSampleExportService.js';

const sample = normalizeHandoffSample({
  sample: {
    title: '社区新闻样片',
    shots: [
      {
        index: 1,
        durationSeconds: 5,
        visualIntent: '居民在社区服务站排队办理业务',
        captionOrVoiceover: '今天，社区服务站迎来办事高峰。',
        source: { type: 'uploaded_asset', label: '现场素材', assetUrl: '/uploads/assets/community.jpg' },
        productionNote: '优先使用现场图片，后续可替换为视频。',
      },
    ],
  },
});

assert.equal(sample.title, '社区新闻样片');
assert.equal(sample.shots.length, 1);
assert.equal(sample.shots[0].durationSeconds, 5);

const notice = buildSampleVideoNotice(sample);
assert.equal(notice.generated, false);
assert.match(notice.message, /尚未生成/);
assert.match(notice.message, /storyboard\.pdf/);

assert.throws(
  () => normalizeHandoffSample({ sample: { title: '空样片', shots: [] } }),
  (error) => error.statusCode === 400 && /shots/.test(error.message),
);

assert.throws(
  () => normalizeHandoffSample({}),
  (error) => error.statusCode === 400 && /sample/.test(error.message),
);

console.log('PASS handoff export service smoke');
