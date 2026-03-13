/**
 * 即梦 (Jimeng) 4.0 API 服务
 * 字节跳动/火山引擎图像生成服务
 * 支持文生图和图生图功能
 */

import crypto from 'crypto';
import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// API 配置
const CONFIG = {
  // 火山引擎 API 配置
  host: 'visual.volcengineapi.com',
  region: 'cn-north-1',
  service: 'cv',
  version: '2022-08-31',
  
  // 请求超时（毫秒）
  timeout: 60000,
  
  // 轮询配置
  pollInterval: 3000,      // 轮询间隔（毫秒）- 增加间隔减轻服务器压力
  maxPollAttempts: 300,    // 最大轮询次数（约15分钟）- 延长等待时间
  videoPollInterval: 3000, // 视频生成轮询间隔（毫秒）
  videoMaxPollAttempts: 300, // 视频生成最大轮询次数（约15分钟）
  
  // 服务标识
  reqKey: 'jimeng_t2i_v40',
  videoReqKey_Pro: 'jimeng_ti2v_v30_pro',  // 即梦3.0 Pro 图生视频
  videoReqKey_FirstTail: 'jimeng_i2v_first_tail_v30',  // 即梦3.0 720P 图生视频-首尾帧
  videoReqKey_First: 'jimeng_i2v_first_v30'  // 即梦3.0 720P 图生视频-首帧
};

/**
 * 火山引擎 API 签名工具类
 */
class VolcengineSigner {
  constructor(accessKey, secretKey) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  /**
   * 生成 HMAC-SHA256 签名
   */
  hmacSha256(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }

  /**
   * 生成 SHA256 哈希
   */
  sha256(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * 获取签名密钥
   */
  getSigningKey(date, region, service) {
    const kDate = this.hmacSha256(this.secretKey, date);
    const kRegion = this.hmacSha256(kDate, region);
    const kService = this.hmacSha256(kRegion, service);
    const kSigning = this.hmacSha256(kService, 'request');
    return kSigning;
  }

  /**
   * 生成请求签名
   * @param {Object} options - 签名选项
   * @returns {Object} 签名后的请求头
   */
  sign(options) {
    const {
      method = 'POST',
      host,
      path,
      query,
      headers,
      body,
      region,
      service
    } = options;

    // 生成时间戳
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    // 规范化请求头
    const signedHeaders = 'content-type;host;x-content-sha256;x-date';
    const payloadHash = this.sha256(body || '');

    const canonicalHeaders = [
      `content-type:${headers['Content-Type'] || 'application/json'}`,
      `host:${host}`,
      `x-content-sha256:${payloadHash}`,
      `x-date:${amzDate}`
    ].join('\n') + '\n';

    // 规范化查询字符串
    const sortedQuery = query.split('&').sort().join('&');

    // 构建规范请求
    const canonicalRequest = [
      method,
      path,
      sortedQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // 构建待签名字符串
    const algorithm = 'HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest)
    ].join('\n');

    // 计算签名
    const signingKey = this.getSigningKey(dateStamp, region, service);
    const signature = this.hmacSha256(signingKey, stringToSign).toString('hex');

    // 构建 Authorization 头
    const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      'Authorization': authorization,
      'X-Date': amzDate,
      'X-Content-Sha256': payloadHash,
      'Content-Type': headers['Content-Type'] || 'application/json',
      'Host': host
    };
  }
}

class JimengService {
  constructor() {
    // 从环境变量获取 AK/SK
    this.accessKey = process.env.VOLCENGINE_ACCESS_KEY;
    this.secretKey = process.env.VOLCENGINE_SECRET_KEY;
    
    if (!this.accessKey || !this.secretKey) {
      console.warn('⚠️ 警告: 未配置火山引擎 AK/SK，即梦API将无法使用');
      console.warn('请在 .env 文件中配置 VOLCENGINE_ACCESS_KEY 和 VOLCENGINE_SECRET_KEY');
    }
    
    this.signer = new VolcengineSigner(this.accessKey, this.secretKey);
  }

  /**
   * 发送 API 请求
   * @private
   */
  async _request(action, body) {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('未配置火山引擎 AK/SK，请检查环境变量');
    }

    const path = '/';
    const query = `Action=${action}&Version=${CONFIG.version}`;
    const bodyStr = JSON.stringify(body);

    // 生成签名
    const signedHeaders = this.signer.sign({
      method: 'POST',
      host: CONFIG.host,
      path,
      query,
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      region: CONFIG.region,
      service: CONFIG.service
    });

    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: CONFIG.host,
        port: 443,
        path: `${path}?${query}`,
        method: 'POST',
        headers: {
          ...signedHeaders,
          'Content-Length': Buffer.byteLength(bodyStr)
        },
        timeout: CONFIG.timeout
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            reject(new Error(`解析响应失败: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.write(bodyStr);
      req.end();
    });
  }

  /**
   * 提交图像生成任务
   * @param {Object} params - 生成参数
   * @param {string} params.prompt - 提示词（必填）
   * @param {string[]} [params.imageUrls] - 参考图片URL数组（图生图时使用）
   * @param {number} [params.width] - 图片宽度
   * @param {number} [params.height] - 图片高度
   * @param {number} [params.scale=0.5] - 文本影响程度 (0-1)
   * @param {boolean} [params.forceSingle=false] - 是否强制单图输出
   * @param {number} [params.imageCount=4] - 期望生成的图片数量（1-4）
   * @returns {Promise<Object>} 任务信息
   */
  async submitTask(params) {
    const {
      prompt,
      imageUrls = [],
      width,
      height,
      scale = 0.5,
      forceSingle = false,
      imageCount = 4,
      minRatio = 1/3,
      maxRatio = 3
    } = params;

    if (!prompt) {
      throw new Error('prompt 参数是必填的');
    }

    if (prompt.length > 800) {
      throw new Error('prompt 长度不能超过 800 字符');
    }

    // 构建提示词，添加生成多图的指示
    let finalPrompt = prompt;
    if (!forceSingle && imageCount > 1) {
      // 在提示词中添加生成多张图片的指示
      finalPrompt = `${prompt}，请生成${imageCount}张不同角度或风格的图片`;
    }

    // 构建请求体
    const body = {
      req_key: CONFIG.reqKey,
      prompt: finalPrompt,
      scale,
      force_single: forceSingle,
      min_ratio: minRatio,
      max_ratio: maxRatio
    };

    // 图生图场景：添加参考图片
    if (imageUrls && imageUrls.length > 0) {
      if (imageUrls.length > 10) {
        throw new Error('最多支持 10 张参考图片');
      }
      
      // 🔄 处理localhost URL
      const processedImageUrls = imageUrls.map((url, index) => {
        if (url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')) {
          // 🎯 检查是否是代理URL（包含真实远程图片地址）
          const proxyMatch = url.match(/\/proxy\/image\?url=([^&]+)/);
          if (proxyMatch) {
            // 提取并解码真实的远程URL
            const realUrl = decodeURIComponent(proxyMatch[1]);
            console.log(`✅ 图片${index + 1}检测到代理URL，提取真实URL`);
            return realUrl;
          }
          
          // 优先使用PUBLIC_URL
          if (process.env.PUBLIC_URL) {
            const publicUrl = url.replace(
              /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/,
              process.env.PUBLIC_URL
            );
            console.log(`✅ 图片${index + 1}使用公网URL`);
            return publicUrl;
          }
          
          // 尝试Base64转换
          const relativePath = url.replace(/^https?:\/\/(localhost|127\.0\.0\.1):\d+\//, '');
          const localFilePath = path.join(process.cwd(), relativePath);
          
          if (!fs.existsSync(localFilePath)) {
            throw new Error(`图片${index + 1}文件不存在: ${localFilePath}`);
          }
          
          const imageBuffer = fs.readFileSync(localFilePath);
          const fileSizeMB = imageBuffer.length / 1024 / 1024;
          
          if (fileSizeMB > 5) {
            throw new Error(`图片${index + 1}过大 (${fileSizeMB.toFixed(2)}MB)`);
          }
          
          const base64Image = imageBuffer.toString('base64');
          const fileExt = path.extname(localFilePath).slice(1).toLowerCase();
          
          console.log(`✅ 图片${index + 1}转Base64 (${(base64Image.length / 1024).toFixed(0)}KB)`);
          return `data:image/${fileExt};base64,${base64Image}`;
        }
        return url;
      });
      
      body.image_urls = processedImageUrls;
    }

    // 如果指定了宽高，添加到请求
    if (width && height) {
      // 验证宽高乘积范围
      const area = width * height;
      if (area < 1024 * 1024 || area > 4096 * 4096) {
        throw new Error('宽高乘积必须在 1024*1024 到 4096*4096 之间');
      }
      body.width = width;
      body.height = height;
    }

    // 日志输出时省略Base64图片数据
    const logBody = {
      ...body,
      image_urls: body.image_urls?.map(url => 
        url.startsWith('data:') ? '<Base64图片数据已省略>' : url
      )
    };
    console.log('📤 提交即梦生成任务:', JSON.stringify(logBody, null, 2));

    const result = await this._request('CVSync2AsyncSubmitTask', body);

    if (result.code !== 10000) {
      console.error('❌ 请求失败:', result);
      
      // 处理特定错误码
      if (result.code === 50400) {
        throw new Error(`权限不足 (Access Denied): 您的账号可能未开通此服务或功能 (code: 50400)。请检查火山引擎控制台是否已开通相关模型权限。`);
      }
      
      throw new Error(`请求失败: ${result.message || '未知错误'} (code: ${result.code})`);
    }

    console.log('✅ 任务提交成功, task_id:', result.data.task_id);

    return {
      taskId: result.data.task_id,
      requestId: result.request_id,
      timeElapsed: result.time_elapsed
    };
  }

  /**
   * 查询任务结果
   * @param {string} taskId - 任务ID
   * @param {Object} [options] - 查询选项
   * @param {boolean} [options.returnUrl=true] - 是否返回图片URL
   * @param {Object} [options.logoInfo] - 水印配置（默认不添加水印）
   * @returns {Promise<Object>} 任务结果
   */
  async queryTask(taskId, options = {}) {
    const { returnUrl = true, logoInfo } = options;

    // 构建 req_json - 默认不添加水印
    const reqJsonObj = {
      return_url: returnUrl,
      logo_info: {
        add_logo: false  // 默认不添加水印
      }
    };

    // 如果明确指定了水印配置，则使用用户配置
    if (logoInfo && logoInfo.addLogo) {
      reqJsonObj.logo_info = {
        add_logo: true,
        position: logoInfo.position || 0,
        language: logoInfo.language || 0,
        opacity: logoInfo.opacity || 1,
        logo_text_content: logoInfo.textContent || ''
      };
    }

    const body = {
      req_key: CONFIG.reqKey,
      task_id: taskId,
      req_json: JSON.stringify(reqJsonObj)
    };

    const result = await this._request('CVSync2AsyncGetResult', body);

    if (result.code !== 10000) {
      // 特殊处理任务状态相关的错误
      if (result.data && result.data.status) {
        return {
          status: result.data.status,
          code: result.code,
          message: result.message
        };
      }
      console.error('❌ 查询任务失败:', result);
      throw new Error(`查询任务失败: ${result.message || '未知错误'} (code: ${result.code})`);
    }

    const data = result.data;
    
    return {
      status: data.status,
      imageUrls: data.image_urls || [],
      base64Images: data.binary_data_base64 || [],
      requestId: result.request_id,
      timeElapsed: result.time_elapsed
    };
  }

  /**
   * 等待任务完成（轮询）
   * @param {string} taskId - 任务ID
   * @param {Function} [onProgress] - 进度回调
   * @param {Object} [queryOptions] - 查询选项
   * @returns {Promise<Object>} 最终结果
   */
  async waitForCompletion(taskId, onProgress, queryOptions = {}) {
    let attempts = 0;

    while (attempts < CONFIG.maxPollAttempts) {
      attempts++;
      
      const result = await this.queryTask(taskId, queryOptions);
      
      // 回调进度
      if (onProgress) {
        onProgress({
          attempt: attempts,
          maxAttempts: CONFIG.maxPollAttempts,
          status: result.status,
          ...result
        });
      }

      console.log(`🔍 [${attempts}/${CONFIG.maxPollAttempts}] 任务状态: ${result.status}`);

      switch (result.status) {
        case 'done':
          console.log('✅ 任务完成!');
          return result;
          
        case 'not_found':
          throw new Error('任务未找到，可能已过期（12小时）');
          
        case 'expired':
          throw new Error('任务已过期，请重新提交');
          
        case 'in_queue':
        case 'generating':
          // 继续等待
          await this._sleep(CONFIG.pollInterval);
          break;
          
        default:
          // 检查是否有错误
          if (result.code && result.code !== 10000) {
            throw new Error(`任务失败: ${result.message} (code: ${result.code})`);
          }
          await this._sleep(CONFIG.pollInterval);
      }
    }

    throw new Error(`任务超时: 超过最大轮询次数 (${CONFIG.maxPollAttempts})`);
  }

  /**
   * 一键生成图像（提交任务并等待完成）
   * @param {Object} params - 生成参数（同 submitTask）
   * @param {Function} [onProgress] - 进度回调
   * @returns {Promise<Object>} 生成结果
   */
  async generateImage(params, onProgress) {
    // 1. 提交任务
    const submitResult = await this.submitTask(params);
    
    // 2. 等待完成
    const finalResult = await this.waitForCompletion(
      submitResult.taskId,
      onProgress,
      { returnUrl: true }
    );

    return {
      taskId: submitResult.taskId,
      imageUrls: finalResult.imageUrls,
      base64Images: finalResult.base64Images,
      requestId: finalResult.requestId
    };
  }

  /**
   * 文生图
   * @param {string} prompt - 提示词
   * @param {Object} [options] - 可选参数
   * @returns {Promise<Object>} 生成结果
   */
  async textToImage(prompt, options = {}) {
    return this.generateImage({
      prompt,
      ...options,
      imageUrls: [] // 文生图不需要参考图
    }, options.onProgress);
  }

  /**
   * 图生图
   * @param {string} prompt - 提示词
   * @param {string[]} imageUrls - 参考图片URL数组
   * @param {Object} [options] - 可选参数
   * @returns {Promise<Object>} 生成结果
   */
  async imageToImage(prompt, imageUrls, options = {}) {
    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('图生图模式需要至少一张参考图片');
    }
    
    return this.generateImage({
      prompt,
      imageUrls,
      ...options
    }, options.onProgress);
  }

  /**
   * 检查服务配置状态
   * @returns {Object} 配置状态
   */
  getConfigStatus() {
    return {
      configured: !!(this.accessKey && this.secretKey),
      hasAccessKey: !!this.accessKey,
      hasSecretKey: !!this.secretKey,
      host: CONFIG.host,
      region: CONFIG.region,
      service: CONFIG.service
    };
  }

  // ==================== 视频生成相关方法 ====================

  /**
   * 提交视频生成任务（即梦3.0 Pro）
   * @param {Object} params - 生成参数
   * @param {string} [params.prompt] - 提示词（文生视频必填）
   * @param {string} [params.imageUrl] - 首帧图片URL（图生视频使用）
   * @param {number} [params.frames=121] - 帧数（121=5秒，241=10秒）
   * @param {string} [params.aspectRatio='16:9'] - 宽高比
   * @param {number} [params.seed=-1] - 随机种子
   * @returns {Promise<Object>} 任务信息
   */
  async submitVideoTask(params) {
    const {
      prompt,
      imageUrl,
      frames = 121,  // 默认5秒
      aspectRatio = '16:9',
      seed = -1
    } = params;

    // 验证参数
    if (!prompt && !imageUrl) {
      throw new Error('prompt 或 imageUrl 至少需要提供一个');
    }

    if (prompt && prompt.length > 800) {
      throw new Error('prompt 长度不能超过 800 字符');
    }

    // 验证帧数
    if (![121, 241].includes(frames)) {
      throw new Error('frames 必须是 121（5秒）或 241（10秒）');
    }

    // 验证宽高比
    const validAspectRatios = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
    if (!validAspectRatios.includes(aspectRatio)) {
      throw new Error(`aspectRatio 必须是以下值之一: ${validAspectRatios.join(', ')}`);
    }

    // 构建请求体
    const body = {
      req_key: CONFIG.videoReqKey_Pro,
      seed,
      frames,
      aspect_ratio: aspectRatio
    };

    // 添加提示词
    if (prompt) {
      body.prompt = prompt;
    }

    // 添加首帧图片（图生视频）
    if (imageUrl) {
      let processedImageUrl = imageUrl;
      
      // 🔄 处理localhost URL
      if (imageUrl.startsWith('http://localhost:') || imageUrl.startsWith('http://127.0.0.1:')) {
        console.log('🔄 检测到localhost URL...');
        
        // 🎯 检查是否是代理URL（包含真实远程图片地址）
        const proxyMatch = imageUrl.match(/\/proxy\/image\?url=([^&]+)/);
        if (proxyMatch) {
          // 提取并解码真实的远程URL
          const realUrl = decodeURIComponent(proxyMatch[1]);
          console.log(`✅ 检测到代理URL，提取真实URL: ${realUrl}`);
          processedImageUrl = realUrl;
        }
        // 优先使用PUBLIC_URL
        else if (process.env.PUBLIC_URL) {
          processedImageUrl = imageUrl.replace(
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/,
            process.env.PUBLIC_URL
          );
          console.log(`✅ 使用公网URL: ${processedImageUrl}`);
        } else {
          // 尝试Base64转换
          console.log('⚠️  未配置PUBLIC_URL，尝试Base64转换...');
          
          const relativePath = imageUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1):\d+\//, '');
          const localFilePath = path.join(process.cwd(), relativePath);
          
          if (!fs.existsSync(localFilePath)) {
            throw new Error(`图片文件不存在: ${localFilePath}`);
          }
          
          const imageBuffer = fs.readFileSync(localFilePath);
          const fileSizeMB = imageBuffer.length / 1024 / 1024;
          
          if (fileSizeMB > 5) {
            throw new Error(
              `图片文件过大 (${fileSizeMB.toFixed(2)}MB)！建议使用<5MB的图片或配置ngrok。`
            );
          }
          
          const base64Image = imageBuffer.toString('base64');
          const fileExt = path.extname(localFilePath).slice(1).toLowerCase();
          processedImageUrl = `data:image/${fileExt};base64,${base64Image}`;
          
          console.log(`✅ 已转换为Base64 (${(base64Image.length / 1024).toFixed(0)}KB)`);
        }
      }
      
      body.image_urls = [processedImageUrl];
    }

    // 日志输出时省略Base64图片数据
    const logBody = {
      ...body,
      image_urls: body.image_urls?.map(url => 
        url.startsWith('data:') ? '<Base64图片数据已省略>' : url
      )
    };
    console.log('📤 提交即梦3.0 Pro 视频生成任务:', JSON.stringify(logBody, null, 2));

    const result = await this._request('CVSync2AsyncSubmitTask', body);

    if (result.code !== 10000) {
      console.error('❌ 提交视频任务失败:', result);
      
      // 处理特定错误码
      if (result.code === 50400) {
        throw new Error(`权限不足 (Access Denied): 您的账号可能未开通此服务或功能 (code: 50400)。请检查火山引擎控制台是否已开通相关模型权限。`);
      }
      
      throw new Error(`提交视频任务失败: ${result.message || '未知错误'} (code: ${result.code})`);
    }

    console.log('✅ 视频任务提交成功, task_id:', result.data.task_id);

    return {
      taskId: result.data.task_id,
      requestId: result.request_id,
      timeElapsed: result.time_elapsed
    };
  }

  /**
   * 提交首尾帧视频生成任务（即梦3.0 720P 首尾帧）
   * @param {Object} params - 生成参数
   * @param {string} params.prompt - 提示词（必填）
   * @param {string} params.firstImageUrl - 首帧图片URL（必填）
   * @param {string} params.lastImageUrl - 尾帧图片URL（必填）
   * @param {number} [params.frames=121] - 帧数（121=5秒，241=10秒）
   * @param {number} [params.seed=-1] - 随机种子
   * @returns {Promise<Object>} 任务信息
   */
  async submitFirstTailVideoTask(params) {
    const {
      prompt,
      firstImageUrl,
      lastImageUrl,
      frames = 121,  // 默认5秒
      seed = -1
    } = params;

    // 验证必填参数
    if (!prompt) {
      throw new Error('prompt 是必填参数');
    }

    if (!firstImageUrl || !lastImageUrl) {
      throw new Error('首帧图片和尾帧图片都是必填的');
    }

    if (prompt.length > 800) {
      throw new Error('prompt 长度不能超过 800 字符');
    }

    // 验证帧数
    if (![121, 241].includes(frames)) {
      throw new Error('frames 必须是 121（5秒）或 241（10秒）');
    }

    // 构建请求体
    const body = {
      req_key: CONFIG.videoReqKey_FirstTail,
      prompt,
      image_urls: [firstImageUrl, lastImageUrl],  // 第一张是首帧，第二张是尾帧
      frames,
      seed
    };

    // 日志输出时省略Base64图片数据
    const logBody = {
      ...body,
      image_urls: body.image_urls?.map(url => 
        url.startsWith('data:') ? '<Base64图片数据已省略>' : url
      )
    };
    console.log('📤 提交即梦3.0 首尾帧视频生成任务:', JSON.stringify(logBody, null, 2));

    const result = await this._request('CVSync2AsyncSubmitTask', body);

    if (result.code !== 10000) {
      console.error('❌ 提交首尾帧视频任务失败:', result);

      // 处理特定错误码
      if (result.code === 50400) {
        throw new Error(`权限不足 (Access Denied): 您的账号可能未开通"即梦3.0首尾帧"服务 (code: 50400)。请检查火山引擎控制台。`);
      }

      throw new Error(`提交视频任务失败: ${result.message || '未知错误'} (code: ${result.code})`);
    }

    console.log('✅ 首尾帧视频任务提交成功, task_id:', result.data.task_id);

    return {
      taskId: result.data.task_id,
      requestId: result.request_id,
      timeElapsed: result.time_elapsed
    };
  }

  /**
   * 查询视频任务结果（即梦3.0 Pro）
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务结果
   */
  async queryVideoTask(taskId) {
    const body = {
      req_key: CONFIG.videoReqKey_Pro,
      task_id: taskId
    };

    const result = await this._request('CVSync2AsyncGetResult', body);

    if (result.code !== 10000) {
      // 特殊处理任务状态相关的错误
      if (result.data && result.data.status) {
        return {
          status: result.data.status,
          code: result.code,
          message: result.message
        };
      }
      console.error('❌ 查询视频任务失败:', result);
      throw new Error(`查询视频任务失败: ${result.message || '未知错误'} (code: ${result.code})`);
    }

    const data = result.data;
    
    return {
      status: data.status,
      videoUrl: data.video_url || null,
      aigcMetaTagged: data.aigc_meta_tagged || false,
      requestId: result.request_id,
      timeElapsed: result.time_elapsed
    };
  }

  /**
   * 查询首尾帧视频任务结果
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务结果
   */
  async queryFirstTailVideoTask(taskId) {
    const body = {
      req_key: CONFIG.videoReqKey_FirstTail,
      task_id: taskId
    };

    const result = await this._request('CVSync2AsyncGetResult', body);

    return {
      status: result.data?.status || 'unknown',
      videoUrl: result.data?.video_url,
      code: result.code,
      message: result.message,
      requestId: result.request_id,
      timeElapsed: result.time_elapsed,
      aigcMetaTagged: result.data?.aigc_meta_tagged
    };
  }

  /**
   * 提交首帧720P视频生成任务（即梦3.0 720P 首帧）
   * @param {Object} params - 生成参数
   * @param {string} params.imageUrl - 首帧图片URL（必填）
   * @param {string} params.prompt - 提示词（必填）
   * @param {number} [params.frames=121] - 帧数（121=5秒，241=10秒）
   * @param {number} [params.seed=-1] - 随机种子
   * @returns {Promise<Object>} 任务信息
   */
  async submitFirstFrameVideoTask(params) {
    const {
      imageUrl,
      prompt,
      frames = 121,  // 默认5秒
      seed = -1
    } = params;

    // 验证必填参数
    if (!imageUrl) {
      throw new Error('imageUrl 是必填参数');
    }

    if (!prompt) {
      throw new Error('prompt 是必填参数');
    }

    if (prompt.length > 800) {
      throw new Error('prompt 长度不能超过 800 字符');
    }

    // 验证帧数
    if (![121, 241].includes(frames)) {
      throw new Error('frames 必须是 121（5秒）或 241（10秒）');
    }

    // 🔄 处理localhost URL
    let processedImageUrl = imageUrl;
    
    if (imageUrl.startsWith('http://localhost:') || imageUrl.startsWith('http://127.0.0.1:')) {
      console.log('🔄 检测到localhost URL...');
      
      // 🎯 检查是否是代理URL（包含真实远程图片地址）
      const proxyMatch = imageUrl.match(/\/proxy\/image\?url=([^&]+)/);
      if (proxyMatch) {
        // 提取并解码真实的远程URL
        const realUrl = decodeURIComponent(proxyMatch[1]);
        console.log(`✅ 检测到代理URL，提取真实URL: ${realUrl}`);
        processedImageUrl = realUrl;
      }
      // 优先使用PUBLIC_URL（如果已配置）
      else if (process.env.PUBLIC_URL) {
        processedImageUrl = imageUrl.replace(
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/,
          process.env.PUBLIC_URL
        );
        console.log(`✅ 使用公网URL: ${processedImageUrl}`);
      } else {
        // 尝试转换为Base64（作为备选方案）
        console.log('⚠️  未配置PUBLIC_URL，尝试Base64转换（可能不被所有API支持）...');
        
        const relativePath = imageUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1):\d+\//, '');
        const localFilePath = path.join(process.cwd(), relativePath);
        
        if (!fs.existsSync(localFilePath)) {
          throw new Error(`图片文件不存在: ${localFilePath}`);
        }
        
        const imageBuffer = fs.readFileSync(localFilePath);
        const fileSizeMB = imageBuffer.length / 1024 / 1024;
        
        console.log(`📊 图片大小: ${fileSizeMB.toFixed(2)}MB`);
        
        // 限制图片大小（首帧视频生成对文件大小更敏感）
        if (fileSizeMB > 3) {
          throw new Error(
            `图片文件过大 (${fileSizeMB.toFixed(2)}MB)！首帧视频生成建议使用<3MB的图片。\n` +
            `解决方案：\n` +
            `1. 压缩图片后重新上传\n` +
            `2. 配置 PUBLIC_URL 环境变量使用ngrok`
          );
        }
        
        const base64Image = imageBuffer.toString('base64');
        const fileExt = path.extname(localFilePath).slice(1).toLowerCase();
        processedImageUrl = `data:image/${fileExt};base64,${base64Image}`;
        
        console.log(`✅ 已转换为Base64 (${(base64Image.length / 1024).toFixed(0)}KB)`);
      }
    }

    // 构建请求体
    const body = {
      req_key: CONFIG.videoReqKey_First,
      prompt,
      image_urls: [processedImageUrl],  // 使用处理后的URL（可能是Base64）
      frames,
      seed
    };

    console.log('📤 提交即梦3.0 首帧720P视频生成任务:', JSON.stringify({
      ...body,
      image_urls: body.image_urls[0].startsWith('data:') 
        ? ['<Base64图片数据已省略>'] 
        : body.image_urls
    }, null, 2));

    const result = await this._request('CVSync2AsyncSubmitTask', body);

    if (result.code !== 10000) {
      console.error('❌ 提交首帧视频任务失败:', result);

      // 处理特定错误码
      if (result.code === 50400) {
        throw new Error(`权限不足 (Access Denied): 您的账号可能未开通"即梦3.0首帧"服务 (code: 50400)。请检查火山引擎控制台。`);
      }

      throw new Error(`提交视频任务失败: ${result.message || '未知错误'} (code: ${result.code})`);
    }

    console.log('✅ 首帧视频任务提交成功, task_id:', result.data.task_id);

    return {
      taskId: result.data.task_id,
      requestId: result.request_id,
      timeElapsed: result.time_elapsed
    };
  }

  /**
   * 查询首帧720P视频任务结果
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务结果
   */
  async queryFirstFrameVideoTask(taskId) {
    const body = {
      req_key: CONFIG.videoReqKey_First,
      task_id: taskId
    };

    const result = await this._request('CVSync2AsyncGetResult', body);

    return {
      status: result.data?.status || 'unknown',
      videoUrl: result.data?.video_url,
      code: result.code,
      message: result.message,
      requestId: result.request_id,
      timeElapsed: result.time_elapsed,
      aigcMetaTagged: result.data?.aigc_meta_tagged
    };
  }

  /**
   * 等待视频任务完成（轮询）- 通用方法
   * @param {string} taskId - 任务ID
   * @param {Function} queryMethod - 查询方法（queryVideoTask 或 queryFirstTailVideoTask）
   * @param {Function} [onProgress] - 进度回调
   * @returns {Promise<Object>} 最终结果
   */
  async waitForVideoCompletion(taskId, queryMethod, onProgress) {
    let attempts = 0;

    while (attempts < CONFIG.videoMaxPollAttempts) {
      attempts++;
      
      const result = await queryMethod.call(this, taskId);
      
      // 回调进度
      if (onProgress) {
        onProgress({
          attempt: attempts,
          maxAttempts: CONFIG.videoMaxPollAttempts,
          status: result.status,
          ...result
        });
      }

      console.log(`🎬 [${attempts}/${CONFIG.videoMaxPollAttempts}] 视频任务状态: ${result.status}`);

      switch (result.status) {
        case 'done':
          console.log('✅ 视频生成完成!');
          return result;
          
        case 'not_found':
          throw new Error('视频任务未找到，可能已过期（12小时）');
          
        case 'expired':
          throw new Error('视频任务已过期，请重新提交');
          
        case 'in_queue':
        case 'generating':
          // 继续等待
          await this._sleep(CONFIG.videoPollInterval);
          break;
          
        default:
          // 检查是否有错误
          if (result.code && result.code !== 10000) {
            throw new Error(`视频任务失败: ${result.message} (code: ${result.code})`);
          }
          await this._sleep(CONFIG.videoPollInterval);
      }
    }

    throw new Error(`视频任务超时: 超过最大轮询次数 (${CONFIG.videoMaxPollAttempts})`);
  }

  /**
   * 图生视频（一键生成）- 即梦3.0 Pro
   * @param {string} imageUrl - 首帧图片URL
   * @param {string} [prompt] - 动态描述提示词
   * @param {Object} [options] - 可选参数
   * @param {Function} [options.onProgress] - 进度回调
   * @returns {Promise<Object>} 生成结果
   */
  async imageToVideo(imageUrl, prompt, options = {}) {
    const {
      frames = 121,
      aspectRatio = '16:9',
      seed = -1,
      onProgress
    } = options;

    if (!imageUrl) {
      throw new Error('imageUrl 是必填的');
    }

    // 1. 提交任务
    const submitResult = await this.submitVideoTask({
      imageUrl,
      prompt,
      frames,
      aspectRatio,
      seed
    });

    // 2. 等待完成
    const finalResult = await this.waitForVideoCompletion(
      submitResult.taskId, 
      this.queryVideoTask,
      onProgress
    );

    return {
      taskId: submitResult.taskId,
      videoUrl: finalResult.videoUrl,
      requestId: finalResult.requestId
    };
  }

  /**
   * 首尾帧图生视频（一键生成）- 即梦3.0 720P 首尾帧
   * @param {string} firstImageUrl - 首帧图片URL
   * @param {string} lastImageUrl - 尾帧图片URL
   * @param {string} prompt - 提示词
   * @param {Object} [options] - 可选参数
   * @param {Function} [options.onProgress] - 进度回调
   * @returns {Promise<Object>} 生成结果
   */
  async firstTailImageToVideo(firstImageUrl, lastImageUrl, prompt, options = {}) {
    const {
      frames = 121,
      seed = -1,
      onProgress
    } = options;

    if (!firstImageUrl || !lastImageUrl) {
      throw new Error('首帧图片和尾帧图片都是必填的');
    }

    if (!prompt) {
      throw new Error('prompt 是必填的');
    }

    // 1. 提交任务
    const submitResult = await this.submitFirstTailVideoTask({
      firstImageUrl,
      lastImageUrl,
      prompt,
      frames,
      seed
    });

    // 2. 等待完成
    const finalResult = await this.waitForVideoCompletion(
      submitResult.taskId,
      this.queryFirstTailVideoTask,
      onProgress
    );

    return {
      taskId: submitResult.taskId,
      videoUrl: finalResult.videoUrl,
      requestId: finalResult.requestId,
      aigcMetaTagged: finalResult.aigcMetaTagged
    };
  }

  /**
   * 首帧图生视频（一键生成）- 即梦3.0 720P 首帧
   * @param {string} imageUrl - 首帧图片URL
   * @param {string} prompt - 提示词（必填）
   * @param {Object} [options] - 可选参数
   * @param {Function} [options.onProgress] - 进度回调
   * @returns {Promise<Object>} 生成结果
   */
  async firstFrameImageToVideo(imageUrl, prompt, options = {}) {
    const {
      frames = 121,
      seed = -1,
      onProgress
    } = options;

    if (!imageUrl) {
      throw new Error('imageUrl 是必填的');
    }

    if (!prompt) {
      throw new Error('prompt 是必填的');
    }

    // 1. 提交任务
    const submitResult = await this.submitFirstFrameVideoTask({
      imageUrl,
      prompt,
      frames,
      seed
    });

    // 2. 等待完成
    const finalResult = await this.waitForVideoCompletion(
      submitResult.taskId,
      this.queryFirstFrameVideoTask,
      onProgress
    );

    return {
      taskId: submitResult.taskId,
      videoUrl: finalResult.videoUrl,
      requestId: finalResult.requestId,
      aigcMetaTagged: finalResult.aigcMetaTagged
    };
  }

  /**
   * 文生视频（一键生成）
   * @param {string} prompt - 视频描述提示词
   * @param {Object} [options] - 可选参数
   * @param {Function} [options.onProgress] - 进度回调
   * @returns {Promise<Object>} 生成结果
   */
  async textToVideo(prompt, options = {}) {
    const {
      frames = 121,
      aspectRatio = '16:9',
      seed = -1,
      onProgress
    } = options;

    if (!prompt) {
      throw new Error('prompt 是必填的');
    }

    // 1. 提交任务
    const submitResult = await this.submitVideoTask({
      prompt,
      frames,
      aspectRatio,
      seed
    });

    // 2. 等待完成
    const finalResult = await this.waitForVideoCompletion(submitResult.taskId, onProgress);

    return {
      taskId: submitResult.taskId,
      videoUrl: finalResult.videoUrl,
      requestId: finalResult.requestId
    };
  }

  /**
   * 辅助方法：休眠
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export default new JimengService();

// 同时导出类，方便测试
export { JimengService, VolcengineSigner, CONFIG };

