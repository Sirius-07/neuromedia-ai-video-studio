/**
 * 图片生成控制器 - 火山方舟 Seedream API
 * 处理文生图和图生图请求
 * 使用 Node.js 原生 https 模块（避免 axios 与 ARK API 的兼容性问题）
 */

import https from 'https';
import zlib from 'zlib';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 调用火山方舟图片生成 API（原生 https，支持 gzip 解压）
 */
function callArkAPI(apiKey, requestBody) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(requestBody);
    const options = {
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/images/generations',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      timeout: 180000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const decompress = (buf) => {
          const enc = res.headers['content-encoding'];
          if (enc === 'gzip') return new Promise((r, e) => zlib.gunzip(buf, (err, d) => err ? e(err) : r(d)));
          if (enc === 'deflate') return new Promise((r, e) => zlib.inflate(buf, (err, d) => err ? e(err) : r(d)));
          if (enc === 'br') return new Promise((r, e) => zlib.brotliDecompress(buf, (err, d) => err ? e(err) : r(d)));
          return Promise.resolve(buf);
        };
        decompress(rawBuffer).then(buf => {
          const text = buf.toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(text)); } catch { resolve(text); }
          } else {
            const err = new Error(`ARK API returned ${res.statusCode}`);
            err.status = res.statusCode;
            try { err.data = JSON.parse(text); } catch { err.data = text; }
            reject(err);
          }
        }).catch(reject);
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

/**
 * 生成图片（文生图或图生图）
 * POST /api/v1/image-gen/generate
 */
export const generateImage = async (req, res) => {
  try {
    const apiKey = process.env.ARK_API_KEY;
    
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: '服务未配置：缺少 ARK_API_KEY'
      });
    }

    const {
      model = 'doubao-seedream-4-5-251128',
      prompt,
      image,
      size = '2K',
      seed,
      sequential_image_generation = 'disabled',
      sequential_image_generation_options,
      response_format = 'url',
      watermark = true
    } = req.body;

    console.log('🎨 [图片生成] 收到请求:', {
      model,
      prompt: prompt?.substring(0, 50),
      hasImage: !!image,
      imageCount: Array.isArray(image) ? image.length : (image ? 1 : 0),
      size,
      sequential_image_generation,
    });

    if (!prompt) {
      return res.status(400).json({ success: false, error: '缺少必填参数: prompt' });
    }

    const requestBody = {
      model,
      prompt,
      size,
      response_format,
      watermark,
      sequential_image_generation
    };

    if (image) requestBody.image = image;
    if (seed !== undefined && seed !== -1) requestBody.seed = seed;

    if (sequential_image_generation === 'auto' && sequential_image_generation_options) {
      requestBody.sequential_image_generation_options = sequential_image_generation_options;
      console.log('✅ [后端] 组图功能已启用:', sequential_image_generation_options);
    }

    console.log('📤 [图片生成] 调用火山方舟API:', {
      model: requestBody.model,
      hasImage: !!requestBody.image,
      size: requestBody.size,
    });

    let result;

    if (sequential_image_generation === 'auto' && sequential_image_generation_options?.max_images && !image) {
      // 批量生成：顺序调用多次
      const maxImages = sequential_image_generation_options.max_images;
      console.log(`🔄 [图片生成] 将顺序调用 ${maxImages} 次API`);
      const allImages = [];
      const totalUsage = { generated_images: 0, output_tokens: 0, total_tokens: 0 };
      const singleBody = { ...requestBody };
      delete singleBody.sequential_image_generation_options;

      for (let i = 0; i < maxImages; i++) {
        try {
          console.log(`   [${i + 1}/${maxImages}] 生成第${i + 1}张图片...`);
          const singleResult = await callArkAPI(apiKey, singleBody);
          if (singleResult.data?.length > 0) {
            allImages.push(...singleResult.data);
            totalUsage.generated_images += singleResult.usage?.generated_images || 0;
            totalUsage.output_tokens += singleResult.usage?.output_tokens || 0;
            totalUsage.total_tokens += singleResult.usage?.total_tokens || 0;
            console.log(`   ✓ 第${i + 1}张图片生成成功`);
          }
          if (i < maxImages - 1) await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
          console.error(`   ✗ 第${i + 1}张图片生成失败:`, error.message);
        }
      }

      result = {
        model: requestBody.model,
        created: Math.floor(Date.now() / 1000),
        data: allImages,
        usage: totalUsage
      };
      console.log(`✅ [图片生成] 批量生成完成: ${allImages.length}/${maxImages} 张`);
    } else {
      // 单张生成
      result = await callArkAPI(apiKey, requestBody);
    }

    console.log('✅ [图片生成] 生成成功:', {
      model: result.model,
      imageCount: result.data?.length || 0,
    });

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('❌ [图片生成] 生成失败:', error.message);

    const status = error.status;
    const data = error.data;

    if (status) {
      console.error('API错误响应:', { status, data });
      if (status === 401) return res.status(401).json({ success: false, error: 'API认证失败：请检查 ARK_API_KEY 是否正确' });
      if (status === 429) return res.status(429).json({ success: false, error: 'API请求频率超限：请稍后再试' });
      if (status === 400) return res.status(400).json({ success: false, error: `API请求参数错误: ${data?.error?.message || JSON.stringify(data)}` });
    }

    res.status(500).json({ success: false, error: error.message || '图片生成失败' });
  }
};
