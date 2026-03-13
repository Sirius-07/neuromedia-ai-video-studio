import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * MultimodalAIService - 火山方舟多模态AI视频分析服务
 * 
 * 使用火山引擎 Ark 平台的 doubao-1-5-vision-pro-32k-250115 模型
 * 来分析视频内容并生成音频指令蓝图。
 * 
 * 支持两种视频输入方式：
 * 1. 公网URL（http/https开头）
 * 2. 本地文件路径（自动转换为Base64编码）
 */

class MultimodalAIService {
  /**
   * 分析视频并生成音频指令蓝图
   * @param {string} videoInput - 视频URL（公网URL）或本地文件路径
   * @returns {Promise<Object>} 指令蓝图JSON对象
   */
  static async analyzeVideo(videoInput) {
    console.log(`🤖 [火山方舟AI] 开始分析视频: ${videoInput}`);
    
    // 从环境变量获取API密钥
    const apiKey = process.env.ARK_API_KEY;
    
    if (!apiKey) {
      throw new Error('缺少环境变量 ARK_API_KEY。请在 .env 文件中配置火山方舟API密钥。');
    }

    // 判断输入类型：URL 还是本地文件路径
    const isUrl = videoInput.startsWith('http://') || videoInput.startsWith('https://');
    let videoContent;
    
    if (isUrl) {
      // 公网URL方式
      console.log(`📡 [火山方舟AI] 使用公网URL方式`);
      videoContent = {
        type: 'video_url',
        video_url: {
          url: videoInput,
          fps: 2  // 每秒采样2帧
        }
      };
    } else {
      // 本地文件 - 转换为Base64
      console.log(`📦 [火山方舟AI] 使用Base64编码方式（本地文件）`);
      
      // 检查文件是否存在
      if (!fs.existsSync(videoInput)) {
        throw new Error(`视频文件不存在: ${videoInput}`);
      }
      
      // 读取文件并转换为Base64
      const videoBuffer = fs.readFileSync(videoInput);
      const base64Video = videoBuffer.toString('base64');
      const fileExt = path.extname(videoInput).slice(1).toLowerCase(); // 获取文件扩展名（去掉点）
      
      console.log(`📊 [火山方舟AI] 视频文件大小: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 [火山方舟AI] Base64编码长度: ${base64Video.length} 字符`);
      
      videoContent = {
        type: 'video_uri',  // 注意：Base64方式使用 video_uri
        video_url: {
          url: `data:video/${fileExt};base64,${base64Video}`
        }
      };
    }

    // 构建指令提示词
    const instructionPrompt = `请按照【分析维度】和【音效分类规则】（已在系统提示词中说明），分析这个视频并返回JSON格式的"指令蓝图"。

【JSON输出格式】

必须包含以下键：

background_music: 一个对象，包含：
- prompt: (string) 描述视频整体情绪、风格、场景的详细BGM提示词（英文）
  示例："upbeat cinematic orchestral music, hopeful and inspiring, for travel vlog"
- mood: (string) 情绪标签（如 "upbeat", "calm", "dramatic", "tense"）
- genre: (string) 音乐类型（如 "pop", "orchestral", "electronic", "ambient"）
- duration: (number) 时长（秒），设为视频总时长
- startTime: (string) 开始时间，固定为 "00:00:00.000"
- volume: (number) 音量（0-1），推荐 0.5-0.7

sound_effects: 一个对象数组，数组中每个对象代表一个音效，包含：
- prompt: (string) 描述这个音效的英文提示词
  示例："fast whoosh transition sound effect", "impact hit sound", "button click sound"
- timestamp: (string) 音效开始播放的精确时间戳，格式为 "HH:MM:SS.mmm"
  示例："00:00:15.033", "00:01:23.500"
- description: (string) 音效的场景描述（中文，说明为什么需要此音效）
  示例："镜头快速切换到新场景", "字幕标题出现", "人物点击按钮"
- category: (string) 音效分类（必填，从以下8种中选择一种）：
  "转场音效", "强调音效", "短氛围音效", "互动音效", "喜剧/幽默音效", "节奏音效", "情绪触发音效", "拟物简化音效"
- duration: (number) 音效时长（秒），通常为 0.5-3.0
- volume: (number) 音量（0-1），推荐 0.7-0.9

【分析要求】

1. 综合运用四个维度（画面内容、动作逻辑、情绪倾向、剪辑节奏）识别关键节点
2. 为每个音效选择最匹配的分类（category），确保符合触发条件和场景合理性
3. 时间戳必须精确，与视频中的实际事件时刻对应
4. 音效数量适中（3-10个），避免过度堆砌
5. 所有 prompt 必须使用英文，description 和 category 使用中文

请只返回JSON对象，不要包含markdown代码块标记或其他说明文字。`;

    try {
      // 调用火山方舟 API
      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
          model: 'ep-m-20251107114928-w8j8v',
          messages: [
            // 🎯 系统提示词 - 设定AI的角色和行为
            {
              role: 'system',
              content: `你是一个专业的视频AI配乐助手，拥有丰富的音乐和音效制作经验。

【核心能力】
1. 准确识别视频中的场景、情绪和关键事件
2. 为视频推荐合适的背景音乐风格和情绪
3. 识别需要音效强化的关键时间点
4. 生成精确的时间戳和详细的音频描述

【分析维度 - 需综合判断】
从以下四个维度识别潜在的音效添加节点：

1. 画面内容 - 视觉元素的变化（物体、场景、人物）
2. 动作逻辑 - 关键动作的触发时机（撞击、移动、操作）
3. 情绪倾向 - 画面传递的情绪（紧张、惊喜、伤感、幽默）
4. 剪辑节奏 - 镜头切换和时序逻辑（转场、卡点、节奏）

【音效添加节点识别】
需识别以下四类关键节点：

- 转场场景：镜头切换（切镜、淡入淡出、滑动转场）、时空转换（日夜交替、地点变化）
- 动作细节：人物/物体的关键动作（撞击、滑动、点击、坠落、快速移动、操作设备）
- 情绪氛围：需烘托的场景氛围（自然环境、人群互动、喜剧场景）
- 信息强调：需突出的关键信息（字幕出现、重要物体展示、步骤完成、节奏卡点）

【音效分类及匹配规则】
为每个节点推荐最适配的音效类型（需同时满足触发条件和场景合理性）：

1. 转场音效 - 镜头/场景切换、时空转换
   触发：切镜、淡入淡出、滑动转场
   示例：whoosh sound effect, mechanical click, transition swipe, fade reverb

2. 强调音效 - 关键动作/信息需突出
   触发：撞击、字幕出现、重点展示
   示例：impact hit sound, notification ding, snap sound, pop sound

3. 短氛围音效 - 快速烘托场景氛围
   触发：自然场景、人文环境
   示例：short wind gust, rain drop, crowd murmur, ambient rumble

4. 互动音效 - 人机/人际互动动作
   触发：点击、掌声、耳语、操作
   示例：button click, applause clap, whisper breath, interface beep

5. 喜剧/幽默音效 - 画面传递幽默感
   触发：搞笑动作、卡通场景、夸张效果
   示例：cartoon slip, comic boing, deflate sound, silly crash

6. 节奏音效 - 配合剪辑节奏
   触发：卡点、动作韵律、节奏变化
   示例：drum hit, rhythmic beat, snap rhythm, percussion accent

7. 情绪触发音效 - 强化画面情绪
   触发：紧张、惊喜、伤感等情绪
   示例：heartbeat tension, surprise chime, emotional swell, suspense drone

8. 拟物简化音效 - 还原物体动态
   触发：坠落、快速移动、物理碰撞
   示例：object drop, fast whoosh, door creak, footstep thud

【输出规则】
- 严格按照JSON格式返回数据，不添加任何额外的解释、注释或markdown格式
- 所有音效提示词（prompt）必须使用英文，便于音频生成模型理解
- 时间戳必须精确到毫秒（格式：HH:MM:SS.mmm）
- 音效时长通常在 0.5-3.0 秒之间
- 每个音效必须标注其所属分类（从上述8种分类中选择）
- 确保音效与视频内容、节奏、情绪高度匹配`
            },
            // 用户请求 - 包含视频和具体指令
            {
              role: 'user',
              content: [
                videoContent,  // 根据输入类型自动使用 URL 或 Base64 方式
                {
                  type: 'text',
                  text: instructionPrompt
                }
              ]
            }
          ],
          response_format: {
            type: 'json_object'  // 强制返回JSON格式
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000  // 2分钟超时
        }
      );

      console.log(`✅ [火山方舟AI] 视频分析完成`);

      // 解析API响应
      const aiResponse = response.data;
      
      if (!aiResponse.choices || !aiResponse.choices[0]) {
        throw new Error('API响应格式错误：缺少 choices 字段');
      }

      const content = aiResponse.choices[0].message.content;
      
      // 解析JSON字符串为对象
      let instructionBlueprint;
      try {
        instructionBlueprint = JSON.parse(content);
      } catch (parseError) {
        console.error('❌ JSON解析失败:', content);
        throw new Error(`AI返回的内容不是有效的JSON: ${parseError.message}`);
      }

      // 验证必需字段
      if (!instructionBlueprint.background_music) {
        throw new Error('AI返回的JSON缺少 background_music 字段');
      }
      
      if (!instructionBlueprint.sound_effects || !Array.isArray(instructionBlueprint.sound_effects)) {
        console.warn('⚠️ AI返回的JSON缺少 sound_effects 数组，将使用空数组');
        instructionBlueprint.sound_effects = [];
      }

      // 添加元数据
      instructionBlueprint.videoInput = videoInput;
      instructionBlueprint.inputType = isUrl ? 'url' : 'base64';
      instructionBlueprint.analyzedAt = new Date().toISOString();
      instructionBlueprint.aiModel = 'doubao-seed-1-6-vision-250815';

      console.log(`📋 [火山方舟AI] 生成的指令蓝图:`, JSON.stringify(instructionBlueprint, null, 2));

      return instructionBlueprint;

    } catch (error) {
      console.error(`❌ [火山方舟AI] 视频分析失败:`, error);

      // 详细错误处理
      if (error.response) {
        // API返回了错误响应
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
        // 请求已发送但没有收到响应
        throw new Error('API请求超时或无响应：请检查网络连接');
      } else {
        // 其他错误
        throw error;
      }
    }
  }

  /**
   * 通用的文本对话接口（用于标签精炼等纯文本任务）
   * @param {string} systemPrompt - 系统提示词
   * @param {string} userPrompt - 用户提示词
   * @returns {Promise<string>} AI 返回的文本内容
   */
  static async chatWithAI(systemPrompt, userPrompt) {
    console.log(`💬 [火山方舟AI] 开始文本对话任务`);
    
    const apiKey = process.env.ARK_API_KEY;
    
    if (!apiKey) {
      throw new Error('缺少环境变量 ARK_API_KEY。请在 .env 文件中配置火山方舟API密钥。');
    }

    try {
      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
          model: 'doubao-seed-1-6-vision-250815',  // 使用与视频分析相同的模型
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000  // 60秒超时
        }
      );

      console.log(`✅ [火山方舟AI] 对话完成`);

      const aiResponse = response.data;
      
      if (!aiResponse.choices || !aiResponse.choices[0]) {
        throw new Error('API响应格式错误：缺少 choices 字段');
      }

      const content = aiResponse.choices[0].message.content;
      console.log(`📝 [火山方舟AI] 返回内容长度: ${content.length} 字符`);
      
      return content;

    } catch (error) {
      console.error(`❌ [火山方舟AI] 对话失败:`, error);

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        console.error(`API错误 (${status}):`, data);
        
        if (status === 401) {
          throw new Error('API认证失败：请检查 ARK_API_KEY 是否正确');
        } else if (status === 429) {
          throw new Error('API请求频率超限：请稍后再试');
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

export default MultimodalAIService;
