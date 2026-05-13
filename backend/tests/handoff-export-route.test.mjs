import assert from 'node:assert/strict';
import express from 'express';
import handoffExportRoutes from '../src/routes/handoffExportRoutes.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/handoff', handoffExportRoutes);

const server = app.listen(0);
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const okResponse = await fetch(`${baseUrl}/api/handoff/export-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sample: {
        title: '社区新闻样片',
        shots: [
          {
            index: 1,
            durationSeconds: 5,
            visualIntent: '居民在社区服务站排队办理业务',
            captionOrVoiceover: '今天，社区服务站迎来办事高峰。',
            source: { type: 'placeholder', label: '待制作' },
          },
        ],
      },
    }),
  });

  assert.equal(okResponse.status, 200);
  assert.match(okResponse.headers.get('content-type') || '', /application\/zip/);
  assert.match(okResponse.headers.get('x-handoff-package-files') || '', /storyboard\.pdf/);
  assert.match(okResponse.headers.get('x-handoff-package-files') || '', /sample\.json/);

  const zipBuffer = Buffer.from(await okResponse.arrayBuffer());
  assert.equal(zipBuffer.subarray(0, 2).toString('utf8'), 'PK');

  const badResponse = await fetch(`${baseUrl}/api/handoff/export-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(badResponse.status, 400);
  const badBody = await badResponse.json();
  assert.equal(badBody.success, false);
  assert.match(badBody.error, /sample/);

  console.log('PASS handoff export route smoke');
} finally {
  server.close();
}
