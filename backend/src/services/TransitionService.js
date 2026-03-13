import axios from 'axios';

class TransitionService {
  /**
   * 生成AI转场提示词
   * @param {string} prevSceneScript - 上一个场景的脚本
   * @param {string} nextSceneScript - 下一个场景的脚本
   * @param {string} videoTheme - 视频主题
   * @param {string} firstFrameBase64 - 首帧图片的Base64编码
   * @param {string} lastFrameBase64 - 尾帧图片的Base64编码
   * @returns {Promise<string>} 生成的转场提示词
   */
  static async generateTransitionPrompt(
    prevSceneScript,
    nextSceneScript,
    videoTheme,
    firstFrameBase64,
    lastFrameBase64
  ) {
    try {
      console.log('[TransitionService] 开始生成转场提示词...');

      // 构建AI提示词
      const systemPrompt = `你是一个专业的视频转场特效设计师。你需要根据两个视频场景的脚本内容和首尾帧画面，设计合适的转场效果描述。

要求：
1. 仔细观察首帧和尾帧的画面内容、构图、光线、色调、主体物等视觉元素
2. 根据画面的相似度和差异性，设计合适的转场方式
3. 转场描述要简洁明了，包含镜头运动、画面过渡方式、光影效果等
4. 转场要自然流畅，符合两个场景之间的逻辑关系和视觉连续性
5. 考虑视频的整体主题风格
6. 直接输出转场描述，不要有其他多余的解释
7. 描述要用中文，但可以包含英文的专业术语
8. 描述长度控制在50-80字以内`;

      // 调用火山方舟 AI 模型
      const apiKey = process.env.ARK_API_KEY;
      const endpoint = process.env.ARK_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3';

      if (!apiKey) {
        console.warn('[TransitionService] 未配置 ARK_API_KEY，使用默认转场描述');
        return this.generateDefaultPrompt(prevSceneScript, nextSceneScript);
      }

      // 构建多模态消息内容（包含图片）
      const userContent = [];
      
      // 添加文字说明
      userContent.push({
        type: 'text',
        text: `视频主题：${videoTheme || '未指定'}

上一个场景脚本：${prevSceneScript || '无'}
下一个场景脚本：${nextSceneScript || '无'}

下面是两个场景的首尾帧画面。请仔细观察这两张图片：
- 第一张是上一个场景的最后一帧（首帧）
- 第二张是下一个场景的第一帧（尾帧）

请分析这两帧画面的视觉特征，并设计一个自然流畅的转场效果描述。`
      });

      // 添加首帧图片
      if (firstFrameBase64) {
        console.log('[TransitionService] 添加首帧图片到分析');
        // 提取纯base64数据（去除 data:image/xxx;base64, 前缀）
        const firstFrameData = firstFrameBase64.includes('base64,') 
          ? firstFrameBase64.split('base64,')[1] 
          : firstFrameBase64;
        
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${firstFrameData}`
          }
        });
      }

      // 添加尾帧图片
      if (lastFrameBase64) {
        console.log('[TransitionService] 添加尾帧图片到分析');
        // 提取纯base64数据
        const lastFrameData = lastFrameBase64.includes('base64,') 
          ? lastFrameBase64.split('base64,')[1] 
          : lastFrameBase64;
        
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${lastFrameData}`
          }
        });
      }

      console.log('[TransitionService] 使用多模态AI分析，包含', 
        firstFrameBase64 ? '首帧图片' : '无首帧', 
        '和', 
        lastFrameBase64 ? '尾帧图片' : '无尾帧'
      );

      // 使用指定的豆包模型生成转场提示词
      console.log('[TransitionService] 使用豆包模型生成转场提示词...');
      
      // 构建文本提示（不使用多模态，因为该模型可能不支持图片）
      const textPrompt = `${userContent[0].text}

场景信息：
- 视频主题：${videoTheme}
- 上一个场景：${prevSceneScript}
- 下一个场景：${nextSceneScript}

请根据这两个场景的内容和逻辑关系，设计一个自然流畅的转场效果描述。`;

      const response = await axios.post(
        `${endpoint}/chat/completions`,
        {
          model: 'doubao-seed-1-6-flash-250828', // 使用指定的豆包模型
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: textPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );
      
      console.log('[TransitionService] ✅ 豆包模型生成成功');

      const prompt = response.data?.choices?.[0]?.message?.content?.trim();

      if (!prompt) {
        console.warn('[TransitionService] AI返回空内容，使用默认转场描述');
        return this.generateDefaultPrompt(prevSceneScript, nextSceneScript);
      }

      console.log('[TransitionService] 转场提示词生成成功:', prompt);
      return prompt;

    } catch (error) {
      console.error('[TransitionService] 生成转场提示词失败:', error.message);
      
      // 打印更详细的错误信息
      if (error.response) {
        console.error('[TransitionService] API错误详情:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      // 失败时返回默认提示词
      console.log('[TransitionService] 使用默认转场提示词生成逻辑');
      return this.generateDefaultPrompt(prevSceneScript, nextSceneScript);
    }
  }

  /**
   * 生成默认转场提示词（当AI调用失败时使用）
   */
  static generateDefaultPrompt(prevSceneScript, nextSceneScript) {
    console.log('[TransitionService] 使用默认转场提示词生成逻辑');

    // 分析场景类型
    const isIndoor = (text) => {
      if (!text) return false;
      return /室内|房间|办公室|会议|演播室|店铺/.test(text);
    };

    const isOutdoor = (text) => {
      if (!text) return false;
      return /户外|街道|公园|风景|城市|自然/.test(text);
    };

    const hasMovement = (text) => {
      if (!text) return false;
      return /运动|移动|行走|飞行|驾驶|奔跑/.test(text);
    };

    const prevIndoor = isIndoor(prevSceneScript);
    const nextIndoor = isIndoor(nextSceneScript);
    const prevOutdoor = isOutdoor(prevSceneScript);
    const nextOutdoor = isOutdoor(nextSceneScript);
    const prevMovement = hasMovement(prevSceneScript);
    const nextMovement = hasMovement(nextSceneScript);

    // 根据场景特征选择合适的转场描述
    if (prevIndoor && nextOutdoor) {
      return '镜头从室内平滑推出，光线逐渐明亮，自然过渡到户外场景';
    } else if (prevOutdoor && nextIndoor) {
      return '镜头缓慢推进，光线逐渐柔和，顺畅进入室内空间';
    } else if (prevMovement || nextMovement) {
      return '镜头跟随运动主体，动态过渡，画面流畅衔接';
    } else if (prevIndoor && nextIndoor) {
      return '镜头平稳转换，光影自然融合，营造连贯的室内氛围';
    } else if (prevOutdoor && nextOutdoor) {
      return '镜头缓慢推移，景深变化自然，画面平滑衔接不同场景';
    } else {
      return '画面自然淡化过渡，镜头平稳切换，光影柔和融合';
    }
  }
}

export default TransitionService;

