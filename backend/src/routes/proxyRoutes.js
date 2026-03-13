/**
 * 媒体代理路由
 * 用于绕过跨域限制播放/显示即梦视频和图片
 */

import express from 'express';
import https from 'https';
import http from 'http';

const router = express.Router();

/**
 * @route OPTIONS /api/v1/proxy/video
 * @desc 处理 CORS 预检请求（视频）
 */
router.options('/video', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24小时
  res.status(204).send();
});

/**
 * @route OPTIONS /api/v1/proxy/image
 * @desc 处理 CORS 预检请求（图片）
 */
router.options('/image', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24小时
  res.status(204).send();
});

/**
 * @route GET /api/v1/proxy/video
 * @desc 代理视频流
 * @query url - 视频URL
 */
router.get('/video', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: '缺少视频URL参数'
      });
    }

    console.log('📹 代理视频请求:', url);

    // 检查是否是本地路径
    if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
      console.log('🎬 本地视频，重定向到静态文件:', url);
      // 重定向到静态文件服务
      return res.redirect(url.startsWith('/') ? url : `/${url}`);
    }

    // 解析远程URL
    const videoUrl = new URL(url);
    const isHttps = videoUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    // 转发请求
    const videoRequest = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'video/*,*/*',
      }
    }, (videoResponse) => {
      // 设置响应头
      res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
      res.setHeader('Content-Length', videoResponse.headers['content-length'] || '');
      res.setHeader('Accept-Ranges', 'bytes');
      
      // CORS 头 - 允许跨域访问
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
      // 允许 Canvas 导出 (解决 tainted canvas 问题)
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      // 支持range请求（视频拖动）
      if (req.headers.range && videoResponse.headers['content-range']) {
        res.setHeader('Content-Range', videoResponse.headers['content-range']);
        res.status(206);
      }

      // 流式传输视频
      videoResponse.pipe(res);
    });

    videoRequest.on('error', (error) => {
      console.error('❌ 代理视频失败:', error);
      res.status(500).json({
        success: false,
        error: '视频加载失败'
      });
    });

  } catch (error) {
    console.error('❌ 代理视频错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/proxy/image
 * @desc 代理图片
 * @query url - 图片URL
 */
router.get('/image', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: '缺少图片URL参数'
      });
    }

    console.log('🖼️ 代理图片请求:', url);

    // 检查是否是本地路径
    if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
      console.log('🎨 本地图片，重定向到静态文件:', url);
      // 重定向到静态文件服务
      return res.redirect(url.startsWith('/') ? url : `/${url}`);
    }

    // 解析远程URL
    const imageUrl = new URL(url);
    const isHttps = imageUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    // 转发请求
    const imageRequest = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': imageUrl.origin
      }
    }, (imageResponse) => {
      // 设置响应头
      const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', imageResponse.headers['content-length'] || '');
      
      // CORS 头 - 允许跨域访问
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
      // 允许 Canvas 导出
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
      
      // 缓存设置
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      // 流式传输图片
      imageResponse.pipe(res);
    });

    imageRequest.on('error', (error) => {
      console.error('❌ 代理图片失败:', error);
      res.status(500).json({
        success: false,
        error: '图片加载失败'
      });
    });

  } catch (error) {
    console.error('❌ 代理图片错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route ALL /api/v1/proxy/python/*
 * @desc 代理Python后端API请求
 * @body 任意JSON数据
 */
router.all('/python/*', async (req, res) => {
  try {
    const pythonPath = req.params[0]; // 获取通配符部分
    const pythonUrl = `http://localhost:8000/api/${pythonPath}`;
    
    console.log(`🐍 代理Python API请求: ${req.method} ${pythonUrl}`);

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 使用原生http模块转发请求
    const postData = req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : null;
    
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: `/api/${pythonPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData ? Buffer.byteLength(postData) : 0,
      },
    };

    const pythonRequest = http.request(options, (pythonResponse) => {
      let data = '';

      pythonResponse.on('data', (chunk) => {
        data += chunk;
      });

      pythonResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.status(pythonResponse.statusCode).json(jsonData);
        } catch (parseError) {
          console.error('❌ 解析Python响应失败:', parseError);
          res.status(500).json({
            success: false,
            error: '解析响应失败'
          });
        }
      });
    });

    pythonRequest.on('error', (error) => {
      console.error('❌ 代理Python API失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    });

    // 发送请求体
    if (postData) {
      pythonRequest.write(postData);
    }
    
    pythonRequest.end();

  } catch (error) {
    console.error('❌ 代理Python API失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route OPTIONS /api/v1/proxy/python/*
 * @desc 处理Python API的CORS预检请求
 */
router.options('/python/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

export default router;



