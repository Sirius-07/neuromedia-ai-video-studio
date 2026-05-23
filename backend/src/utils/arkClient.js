/**
 * ARK API 原生 HTTPS 客户端
 *
 * axios 与火山方舟 ARK API 存在兼容性问题（持续返回 503 空响应），
 * 改用 Node.js 原生 https + zlib 模块直接发请求，完全绕开 axios。
 */

import https from 'https';
import zlib from 'zlib';

/**
 * 解压响应体
 */
function decompress(buffer, encoding) {
  if (encoding === 'gzip') {
    return new Promise((resolve, reject) =>
      zlib.gunzip(buffer, (err, d) => (err ? reject(err) : resolve(d)))
    );
  }
  if (encoding === 'deflate') {
    return new Promise((resolve, reject) =>
      zlib.inflate(buffer, (err, d) => (err ? reject(err) : resolve(d)))
    );
  }
  if (encoding === 'br') {
    return new Promise((resolve, reject) =>
      zlib.brotliDecompress(buffer, (err, d) => (err ? reject(err) : resolve(d)))
    );
  }
  return Promise.resolve(buffer);
}

/**
 * 向 ARK API 发起 POST 请求
 *
 * @param {string} url        完整 URL，如 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
 * @param {object} body       请求体（会被 JSON 序列化）
 * @param {string} apiKey     ARK API Key
 * @param {number} [timeoutMs=120000] 超时毫秒数
 * @returns {Promise<object>} 解析后的响应 JSON
 */
export async function arkPost(url, body, apiKey, timeoutMs = 120000) {
  const parsed = new URL(url);
  const bodyStr = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      timeout: timeoutMs,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        try {
          const raw = Buffer.concat(chunks);
          const decompressed = await decompress(raw, res.headers['content-encoding']);
          const text = decompressed.toString('utf8');

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(text));
          } else {
            const err = new Error(`ARK API returned ${res.statusCode}: ${text.substring(0, 200)}`);
            err.status = res.statusCode;
            try { err.data = JSON.parse(text); } catch { err.data = text; }
            reject(err);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`ARK API request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}
