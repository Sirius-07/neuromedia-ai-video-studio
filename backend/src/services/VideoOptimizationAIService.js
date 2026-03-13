import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * VideoOptimizationAIService - 视频后期处理AI优化服务
 * 
 * 使用豆包多模态模型分析视频内容，自动生成最佳的后期处理参数
 */
class VideoOptimizationAIService {
  /**
   * 分析视频并生成后期处理优化参数
   * @param {string} videoInput - 视频URL或本地文件路径
   * @param {string} projectTheme - 项目主题/内容描述
   * @param {string} sceneScript - 场景脚本/旁白
   * @returns {Promise<Object>} 优化参数对象
   */
  static async optimizeVideo(videoInput, projectTheme = '', sceneScript = '') {
    console.log(`🎨 [AI视频优化] 开始分析视频: ${videoInput}`);
    console.log(`📝 项目主题: ${projectTheme}`);
    console.log(`📄 场景脚本: ${sceneScript}`);
    
    // 从环境变量获取API密钥
    const apiKey = process.env.ARK_API_KEY;
    
    if (!apiKey) {
      throw new Error('缺少环境变量 ARK_API_KEY。请在 .env 文件中配置火山方舟API密钥。');
    }

    // 判断输入类型：URL 还是本地文件路径
    const isUrl = videoInput.startsWith('http://') || videoInput.startsWith('https://');
    let videoContent;
    
    if (isUrl) {
      console.log(`📡 [AI视频优化] 使用公网URL方式`);
      videoContent = {
        type: 'video_url',
        video_url: {
          url: videoInput,
          fps: 2  // 每秒采样2帧
        }
      };
    } else {
      console.log(`📦 [AI视频优化] 使用Base64编码方式（本地文件）`);
      
      // 检查文件是否存在
      if (!fs.existsSync(videoInput)) {
        throw new Error(`视频文件不存在: ${videoInput}`);
      }
      
      // 读取文件并转换为Base64
      const videoBuffer = fs.readFileSync(videoInput);
      const fileSizeMB = videoBuffer.length / 1024 / 1024;
      
      console.log(`📊 [AI视频优化] 视频文件大小: ${fileSizeMB.toFixed(2)}MB`);
      
      // 检查文件大小（建议不超过20MB，因为Base64会增大约33%）
      if (fileSizeMB > 20) {
        console.warn(`⚠️ [AI视频优化] 警告：视频文件较大 (${fileSizeMB.toFixed(2)}MB)，可能导致请求超时`);
      }
      
      const base64Video = videoBuffer.toString('base64');
      const fileExt = path.extname(videoInput).slice(1).toLowerCase();
      
      videoContent = {
        type: 'video_url',
        video_url: {
          url: `data:video/${fileExt};base64,${base64Video}`
        }
      };
    }

    // 构建优化指令提示词
    const optimizationPrompt = `你是一个专业的视频后期调色师和画面优化专家。请分析这个视频片段，并根据视频的内容、主题、情绪和氛围，给出最佳的后期处理参数建议。

【项目背景】
${projectTheme ? `项目主题: ${projectTheme}` : ''}
${sceneScript ? `场景描述: ${sceneScript}` : ''}

【分析维度】
1. 画面整体亮度 - 是否曝光过度或欠曝
2. 对比度水平 - 是否需要增强层次感
3. 色彩饱和度 - 是否需要更鲜艳或更柔和
4. 色温倾向 - 画面偏暖还是偏冷，是否需要调整
5. 画面细节 - 是否需要锐化或柔化
6. 画面噪点 - 是否有明显噪点需要降噪
7. 风格匹配 - 最适合的滤镜风格（复古、科技、纪实等）

【输出要求】
请严格按照以下JSON格式输出，不要包含任何markdown代码块标记或其他说明文字：

{
  "analysis": "简要分析这个视频的画面特点、主题风格、情绪氛围（50字以内）",
  "recommendations": [
    "调整建议1",
    "调整建议2",
    "调整建议3"
  ],
  "parameters": {
    "brightness": <整数，范围-100到100，0表示不调整>,
    "contrast": <整数，范围-100到100，0表示不调整>,
    "saturation": <整数，范围-100到100，0表示不调整>,
    "temperature": <字符串，只能是以下之一："原始"、"暖色调"、"冷色调"、"中性">,
    "detail": <字符串，只能是以下之一："柔和"、"标准"、"锐利">,
    "denoiseLevel": <字符串，只能是以下之一："关闭"、"轻度"、"中度"、"重度">,
    "filter": <字符串，只能是以下之一："原片"、"复古胶片"、"冷调科技"、"暖色纪实"、"黑白"、"高饱和">
  }
}

【参数说明】
- brightness: 负值变暗，正值变亮。建议范围 -30 到 +30
- contrast: 负值降低对比，正值增强对比。建议范围 -20 到 +30
- saturation: 负值降低饱和度，正值增加饱和度。建议范围 -20 到 +40
- temperature: 根据画面色温选择。暖色调适合温馨场景，冷色调适合科技/夜景
- detail: 锐利适合清晰场景，柔和适合人像/浪漫场景
- denoiseLevel: 根据视频拍摄质量选择，夜景/低光可能需要中度或重度降噪
- filter: 根据视频主题和情绪选择最匹配的风格滤镜

【重要提示】
1. 所有参数都要根据视频实际情况给出，不要使用极端值
2. 如果某个参数不需要调整，请设为0或"标准"/"关闭"
3. 优先考虑画面的真实感和舒适度
4. 风格滤镜要与视频主题高度契合

请只返回JSON对象，不要包含其他内容。`;

    try {
      console.log('📤 [AI视频优化] 发送请求到豆包模型...');
      
      // 调用豆包多模态API
      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
          model: 'ep-m-20251107114928-w8j8v',
          messages: [
            {
              role: 'system',
              content: `你是一个专业的视频后期调色师和画面优化专家，拥有丰富的视频制作和色彩校正经验。

【核心能力】
1. 准确评估视频的画面质量和视觉效果
2. 识别画面的色彩倾向、亮度问题和细节问题
3. 根据视频主题和情绪推荐最佳的后期处理参数
4. 提供专业的调色建议和风格匹配方案

【分析原则】
1. 客观性 - 基于画面的客观特征进行分析
2. 适度性 - 参数调整要适度，避免过度处理
3. 风格性 - 考虑视频的主题和情绪，选择匹配的风格
4. 真实性 - 保持画面的真实感和自然度

【输出规则】
- 严格按照JSON格式返回数据
- 所有参数必须在指定范围内
- 建议要具体且可操作
- 不添加任何额外的解释或markdown格式`
            },
            {
              role: 'user',
              content: [
                videoContent,
                {
                  type: 'text',
                  text: optimizationPrompt
                }
              ]
            }
          ],
          response_format: {
            type: 'json_object'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 180000,  // 3分钟超时（处理视频可能需要更长时间）
          maxBodyLength: Infinity,  // 允许大文件
          maxContentLength: Infinity
        }
      );

      console.log('✅ [AI视频优化] 分析完成');

      // 解析API响应
      const aiResponse = response.data;
      
      if (!aiResponse.choices || !aiResponse.choices[0]) {
        throw new Error('API响应格式错误：缺少 choices 字段');
      }

      const content = aiResponse.choices[0].message.content;
      
      // 解析JSON
      let optimizationResult;
      try {
        optimizationResult = JSON.parse(content);
      } catch (parseError) {
        console.error('❌ JSON解析失败:', content);
        throw new Error(`AI返回的内容不是有效的JSON: ${parseError.message}`);
      }

      // 验证必需字段
      if (!optimizationResult.parameters) {
        throw new Error('AI返回的JSON缺少 parameters 字段');
      }

      // 添加元数据
      optimizationResult.videoInput = videoInput;
      optimizationResult.optimizedAt = new Date().toISOString();
      optimizationResult.aiModel = 'doubao-seed-1-6-vision-250815';

      console.log('📋 [AI视频优化] 生成的优化参数:', JSON.stringify(optimizationResult, null, 2));

      return optimizationResult;

    } catch (error) {
      console.error('❌ [AI视频优化] 分析失败:', error);

      // 详细错误处理
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        console.error(`API错误 (${status}):`, data);
        
        if (status === 401) {
          throw new Error('API认证失败：请检查 ARK_API_KEY 是否正确');
        } else if (status === 429) {
          throw new Error('API请求频率超限：请稍后再试');
        } else if (status === 400) {
          throw new Error(`API请求参数错误: ${JSON.stringify(data)}`);
        } else {
          throw new Error(`API请求失败 (${status}): ${JSON.stringify(data)}`);
        }
      } else if (error.request) {
        throw new Error('API请求超时或无响应：请检查网络连接');
      } else {
        throw error;
      }
    }
  }
}

export default VideoOptimizationAIService;

