/**
 * 脚本编辑服务
 * 提供AI驱动的脚本优化和交互功能
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ScriptEditService {
  // 火山方舟AI配置
  static API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  static MODEL_ID = 'ep-m-20251107114928-w8j8v';
  static ENHANCE_MODEL_ID = 'doubao-seed-1-8-251228'; // 场景润色专用：与创意方案生成同款高质量模型

  /**
   * 调用火山方舟AI聊天API
   */
  async callAI(messages, options = {}) {
    const apiKey = process.env.ARK_API_KEY;
    
    if (!apiKey) {
      throw new Error('缺少环境变量 ARK_API_KEY');
    }

    try {
      const response = await axios.post(
        ScriptEditService.API_URL,
        {
          model: ScriptEditService.MODEL_ID,
          messages: messages,
          temperature: options.temperature || 0.8,
          max_tokens: options.max_tokens || 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('AI返回格式异常');
      }
    } catch (error) {
      console.error('AI调用失败:', error.message);
      throw new Error('AI调用失败: ' + error.message);
    }
  }
  /**
   * AI对话 - Few-Shot + 结构化 JSON 返回
   * 使用 doubao-seed-1-8-251228 高质量模型，理解用户自然语言指令，
   * 直接返回 {message, action, changes[]} 供前端应用到分镜列表
   */
  async chatWithAI({ userInput, currentScenes, conversationHistory, proposal, userPrompt }) {
    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) throw new Error('缺少环境变量 ARK_API_KEY');

    // ── System Prompt ──
    const systemPrompt = `你是专业的视频分镜脚本编辑助手，帮用户修改、增删分镜场景。

【你能执行的操作类型】
- edit：修改某个场景的描述/旁白/镜头运动/时长
- add：在某个场景后插入新场景
- delete：删除某个场景
- batch_edit：同时修改多个场景（改时长、批量润色等）
- no_change：只回答问题，不改动分镜

【强制规则】
1. 只输出一个 JSON 对象，绝对不要任何多余文字
2. description 长度和风格必须与当前项目的现有分镜描述保持一致——若现有分镜描述较短（20-40字），新场景描述也应同等简洁；若现有分镜描述较长（100字以上），新场景才写得更详细。除非用户明确要求"丰富内容""写详细"等，否则不要擅自加长
3. cameraMovement 只能是：none/zoom_in/zoom_out/pan_left/pan_right/tilt_up/tilt_down/drone
4. sceneIndex 从0开始（第1个场景=0，第2个场景=1，依此类推）
5. afterIndex=-1 表示插入最前面，afterIndex=N 表示插入到第N+1个场景后面
6. 实拍素材场景（[实拍]标注）改描述时需保留其核心内容
7. 严格保留用户设定的主体内容，不要擅自改变场景主题

【输出 JSON 格式】
{
  "message": "用中文说明你做了什么（1-2句话，简洁）",
  "action": "edit_scene | add_scene | delete_scene | batch_edit | no_change",
  "changes": [
    {"type": "edit", "sceneIndex": 2, "fields": {"description": "...", "narration": "...", "cameraMovement": "zoom_in", "duration": 5}},
    {"type": "add", "afterIndex": 1, "scene": {"description": "...", "narration": "...", "cameraMovement": "none", "duration": 4}},
    {"type": "delete", "sceneIndex": 3}
  ]
}`;

    // ── Few-Shot 示例（涵盖5种典型指令）──
    const fewShots = [
      // 示例1：修改单个场景
      {
        role: 'user',
        content: `项目主题：广州旅游宣传片 | 视觉风格：国潮风 | 共4个场景
场景1[AI]（3秒）：广州塔夜景延时摄影
场景2[AI]（5秒）：早茶文化，茶楼吃饭
场景3[AI]（4秒）：骑楼建筑街道漫步
场景4[AI]（3秒）：珠江夕阳船只

用户指令：第2个场景太平淡，改成更有活力的早茶场景`
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          message: '已将第2个场景改写为充满活力的早茶场景，增加了人群互动与动感镜头切换。',
          action: 'edit_scene',
          changes: [{
            type: 'edit',
            sceneIndex: 1,
            fields: {
              description: '镜头快速推进进入热闹的广州传统茶楼，红木雕花桌椅间食客摩肩接踵，伙计托举精致的竹蒸笼穿梭其中，蒸腾热气在光影中化为金色薄雾。画面快切茶客们举杯相碰的特写，虾饺晶莹剔透的细节，老人与孩子共享早茶的温馨瞬间。镜头向上拉高俯拍整个茶楼全景，人声鼎沸、烟火气息扑面而来，广州人慢中有快的市井活力在这一刻尽显无遗。',
              narration: '一盅两件，人间烟火',
              cameraMovement: 'zoom_in'
            }
          }]
        })
      },
      // 示例2：插入新场景（描述与现有分镜长度一致，现有分镜描述很短时新增也保持简短）
      {
        role: 'user',
        content: `项目主题：品牌广告 | 视觉风格：现代简约 | 共5个场景
场景1[AI]（4秒）：产品特写
场景2[AI]（3秒）：用户使用场景
场景3[AI]（5秒）：生活方式展示
场景4[AI]（3秒）：品牌logo展示
场景5[AI]（4秒）：结尾口号

用户指令：在第3和第4场景中间加一个用户真实好评的场景`
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          message: '已在第3和第4场景之间插入用户好评场景，增强品牌可信度。',
          action: 'add_scene',
          changes: [{
            type: 'add',
            afterIndex: 2,
            scene: {
              description: '用户好评展示，竖起大拇指，五星评价图标浮现',
              narration: '万千用户的真实之选',
              cameraMovement: 'none',
              duration: 4
            }
          }]
        })
      },
      // 示例2b：插入新场景（现有分镜描述较长时，新增场景描述也相应丰富）
      {
        role: 'user',
        content: `项目主题：广州旅游宣传片 | 视觉风格：国潮风 | 共3个场景
场景1[AI]（5秒）：广州塔夜景延时摄影，霓虹倒映珠江水面，车流光轨与塔身交相辉映，镜头从地面缓缓仰拍至塔顶，光影流动间展现城市脉动
场景2[AI]（5秒）：骑楼建筑街道漫步，青砖灰瓦与鲜艳花布交错，老街坊撑着油纸伞闲聊，镜头随行人穿梭游走，记录岭南风情的日常烟火
场景3[AI]（4秒）：珠江夕阳船只，金红落日映照江面，白鹭低飞掠过，游船鸣笛而过，广角镜头将诗意晚景尽收其中

用户指令：在第1和第2场景之间加一个早茶文化的场景`
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          message: '已在第1和第2场景之间插入早茶文化场景，与前后分镜的描述详细程度保持一致。',
          action: 'add_scene',
          changes: [{
            type: 'add',
            afterIndex: 0,
            scene: {
              description: '热闹茶楼内早茶时分，竹蒸笼叠叠摞起腾起白雾，食客举杯相碰推杯换盏，伙计托盘穿梭其间，镜头在茶壶特写与全景之间快切，人声鼎沸中尽显广府市井活力',
              narration: '一盅两件，人间烟火',
              cameraMovement: 'pan_right',
              duration: 5
            }
          }]
        })
      },
      // 示例3：删除场景
      {
        role: 'user',
        content: `项目主题：运动品牌 | 共6个场景
场景1[AI]（3秒）：晨跑
场景2[AI]（4秒）：健身房训练
场景3[实拍]（5秒）：产品展示
场景4[AI]（6秒）：慢镜头回放
场景5[AI]（3秒）：团队运动
场景6[AI]（4秒）：品牌标语

用户指令：删除第4个场景，节奏太慢`
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          message: '已删除第4个场景（慢镜头回放），整体节奏更加紧凑有力。',
          action: 'delete_scene',
          changes: [{ type: 'delete', sceneIndex: 3 }]
        })
      },
      // 示例4：批量调整时长
      {
        role: 'user',
        content: `项目主题：美食探店 | 共5个场景
场景1[AI]（5秒）：店门外观
场景2[AI]（6秒）：招牌菜展示
场景3[AI]（5秒）：食客品尝
场景4[AI]（4秒）：厨师制作
场景5[AI]（5秒）：结尾logo

用户指令：所有场景都缩短到3秒，快节奏一点`
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          message: '已将全部5个场景时长统一调整为3秒，整体节奏大幅加快。',
          action: 'batch_edit',
          changes: [0,1,2,3,4].map(i => ({ type: 'edit', sceneIndex: i, fields: { duration: 3 } }))
        })
      },
      // 示例5：不需要修改，纯回答
      {
        role: 'user',
        content: `项目主题：科技产品发布 | 共8个场景
用户指令：这个项目适合配什么风格的背景音乐？`
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          message: '科技产品发布适合配合成器电子乐或极简钢琴曲，如 Hans Zimmer 风格的沉稳弦乐也很合适，能同时体现科技感与情感共鸣。无需修改分镜。',
          action: 'no_change',
          changes: []
        })
      }
    ];

    // ── 构建当前项目上下文 ──
    const projectInfo = [];
    if (userPrompt) projectInfo.push(`项目主题：${userPrompt}`);
    if (proposal?.title) projectInfo.push(`创意方向：${proposal.title}`);
    if (proposal?.visualStyle) projectInfo.push(`视觉风格：${proposal.visualStyle}`);
    if (proposal?.bgmStyle) projectInfo.push(`BGM氛围：${proposal.bgmStyle}`);

    const sceneList = currentScenes.map((s, i) => {
      const tag = (s.assetType === 'real_footage' || s.assetType === 'image') ? '[实拍]' : '[AI]';
      const desc = s.description || '（空）';
      return `场景${i + 1}${tag}（${s.duration || 5}秒）：${desc}`;
    }).join('\n');

    const contextContent = `${projectInfo.join(' | ')} | 共${currentScenes.length}个场景\n${sceneList}\n\n用户指令：${userInput}`;

    // ── 拼接完整消息列表（Few-Shot + 近期对话历史 + 当前指令）──
    const messages = [
      { role: 'system', content: systemPrompt },
      ...fewShots,
      // 保留最近4轮对话历史，避免 token 过多
      ...conversationHistory.slice(-4).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: contextContent }
    ];

    try {
      const response = await axios.post(
        ScriptEditService.API_URL,
        {
          model: ScriptEditService.ENHANCE_MODEL_ID,
          messages,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const aiText = response.data?.choices?.[0]?.message?.content;
      if (!aiText) throw new Error('AI返回格式异常');

      // 解析 JSON
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI未返回JSON');
        return JSON.parse(jsonMatch[0]);
      } catch {
        // 降级：至少返回文本消息
        return { message: aiText, action: 'no_change', changes: [] };
      }
    } catch (error) {
      console.error('AI对话失败:', error.message);
      throw new Error('AI对话失败: ' + error.message);
    }
  }

  /**
   * 批量优化场景
   */
  async optimizeScenes(scenes, optimizationType = 'general', userDirection = null) {
    try {
      const systemPrompt = this.buildOptimizationPrompt(optimizationType, userDirection);
      
      let userPrompt = `当前脚本有 ${scenes.length} 个场景，请帮我优化：\n\n${
        scenes.map((scene, i) => {
          const assetTag = scene.assetType === 'real_footage' || scene.assetType === 'image' ? ' [实拍素材，可优化描述但需保留]' : '';
          return `场景${i + 1}${assetTag}: ${scene.description}`;
        }).join('\n')
      }`;
      if (userDirection) {
        userPrompt = `用户修改方向：${userDirection}\n\n` + userPrompt;
      }

      const response = await this.callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.7,
        max_tokens: 2000
      });

      return {
        optimizedScenes: this.parseOptimizedScenes(response, scenes),
        explanation: response
      };
    } catch (error) {
      console.error('场景优化失败:', error);
      throw new Error('场景优化失败: ' + error.message);
    }
  }

  /**
   * 插入新场景
   */
  async insertScene({ scenes, insertPosition, sceneDescription }) {
    try {
      const beforeScene = scenes[insertPosition - 1];
      const afterScene = scenes[insertPosition];

      const systemPrompt = `你是一个专业的视频脚本编剧。用户想在两个场景之间插入一个新场景，你需要生成一个详细且有画面感的过渡场景。

【场景描述要求】
1. 长度：100-150字，必须详细
2. 必须包含：
   - 场景环境（地点、时间、氛围）
   - 主体描述（人物/物体的状态和细节）
   - 动作动态（具体的运动和变化）
   - 镜头语言（镜头运动、角度）
   - 光影氛围（色调、光线效果）
3. 要有画面感，让人能在脑海中看到完整画面`;
      
      const userPrompt = `
前一个场景: ${beforeScene ? beforeScene.description : '（开始）'}
后一个场景: ${afterScene ? afterScene.description : '（结束）'}

用户想法: ${sceneDescription}

请生成一个详细的场景描述（100-150字），包含场景环境、主体描述、动作动态、镜头语言、光影氛围。
要有强烈的画面感，让人能想象出具体的视觉画面。
`;

      const response = await this.callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.8,
        max_tokens: 300
      });

      const newScene = {
        id: `scene-${Date.now()}`,
        sceneNumber: insertPosition + 1,
        description: response.trim(),
        assetType: 'ai_generated',
        duration: 5
      };

      const updatedScenes = [
        ...scenes.slice(0, insertPosition),
        newScene,
        ...scenes.slice(insertPosition)
      ].map((scene, index) => ({
        ...scene,
        sceneNumber: index + 1
      }));

      return {
        scenes: updatedScenes,
        insertedScene: newScene
      };
    } catch (error) {
      console.error('插入场景失败:', error);
      throw new Error('插入场景失败: ' + error.message);
    }
  }

  /**
   * 调整节奏
   */
  async adjustPacing(scenes, pacingType = 'faster') {
    const pacingAdjustments = {
      faster: { durationMultiplier: 0.7, description: '加快节奏' },
      slower: { durationMultiplier: 1.3, description: '放慢节奏' },
      balanced: { durationMultiplier: 1.0, description: '平衡节奏' }
    };

    const adjustment = pacingAdjustments[pacingType] || pacingAdjustments.balanced;

    const adjustedScenes = scenes.map(scene => ({
      ...scene,
      duration: Math.max(2, Math.min(10, Math.round(scene.duration * adjustment.durationMultiplier)))
    }));

    return {
      scenes: adjustedScenes,
      message: `已将所有场景${adjustment.description}（时长调整为原来的${Math.round(adjustment.durationMultiplier * 100)}%）`
    };
  }

  // ===== 辅助方法 =====

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个专业的视频脚本创意助手。你的任务是帮助用户优化视频分镜脚本。

你的能力：
1. 理解用户的意图（增加场景、删除场景、修改描述、调整节奏等）
2. 提供专业的创意建议
3. ⭐ 优化场景描述，使其更具画面感和吸引力（必须详细，100-150字）
4. 确保场景之间的连贯性和逻辑性
5. 根据情绪和风格调整内容

场景描述标准：
- 长度：100-150字（必须详细，不要简洁概括）
- 必须包含：场景环境、主体描述、动作动态、镜头语言、光影氛围
- 要有强烈的画面感，让人能在脑海中浮现完整的视觉画面
- 包含具体的细节：光线、色彩、动作、镜头运动、情绪氛围

交流风格：
- 友好、鼓励性
- 具体、可操作
- 富有创意但不过分夸张
- 用中文回复

当用户提出修改需求时：
- 如果是具体操作（删除、增加），直接给出建议
- 如果是模糊的（"更好"、"更有趣"），询问具体方向
- 提供2-3个可选方案而不是单一答案
- 生成的场景描述必须详细且有画面感`;
  }

  /**
   * 构建上下文消息
   */
  buildContextMessage({ currentScenes, proposal, userPrompt }) {
    return `
【当前项目信息】
项目主题: ${userPrompt}
创意风格: ${proposal?.title || '未指定'}
场景总数: ${currentScenes.length}

【当前脚本】
${currentScenes.map((scene, i) => `
场景${i + 1} [${scene.assetType === 'ai_generated' ? 'AI生成' : '实拍素材'}]:
描述: ${scene.description}
时长: ${scene.duration}秒
${scene.visualStyle ? `视觉风格: ${scene.visualStyle}` : ''}
${scene.bgmStyle ? `BGM风格: ${scene.bgmStyle}` : ''}
`).join('\n')}

请基于以上信息回答用户的问题或提供建议。
`;
  }

  /**
   * 提取用户意图
   */
  extractActionIntent(userInput, scenes) {
    const lowerInput = userInput.toLowerCase();
    
    // 删除意图
    if (lowerInput.includes('删除') || lowerInput.includes('去掉') || lowerInput.includes('移除')) {
      const sceneMatch = userInput.match(/第?(\d+)/);
      if (sceneMatch) {
        return {
          action: 'delete',
          sceneIndex: parseInt(sceneMatch[1]) - 1
        };
      }
      return { action: 'delete', sceneIndex: null };
    }
    
    // 增加意图
    if (lowerInput.includes('增加') || lowerInput.includes('添加') || lowerInput.includes('插入') || lowerInput.includes('加上')) {
      return { action: 'insert' };
    }
    
    // 修改意图
    if (lowerInput.includes('修改') || lowerInput.includes('改成') || lowerInput.includes('换成')) {
      const sceneMatch = userInput.match(/第?(\d+)/);
      if (sceneMatch) {
        return {
          action: 'modify',
          sceneIndex: parseInt(sceneMatch[1]) - 1
        };
      }
      return { action: 'modify', sceneIndex: null };
    }
    
    // 节奏调整
    if (lowerInput.includes('节奏') || lowerInput.includes('快') || lowerInput.includes('慢') || lowerInput.includes('紧凑')) {
      const faster = lowerInput.includes('快') || lowerInput.includes('紧凑');
      const slower = lowerInput.includes('慢') || lowerInput.includes('缓');
      return {
        action: 'adjust_pacing',
        pacingType: faster ? 'faster' : slower ? 'slower' : 'balanced'
      };
    }
    
    // 整体重新生成
    if (lowerInput.includes('整体重新生成') || lowerInput.includes('全部重新生成') || lowerInput.includes('重新生成全部')) {
      return { action: 'optimize', optimizationType: 'regenerate', userDirection: userInput };
    }
    
    // 整体优化
    if (lowerInput.includes('优化') || lowerInput.includes('改进') || lowerInput.includes('提升')) {
      return { action: 'optimize', scope: 'all', optimizationType: 'general' };
    }
    
    return { action: 'chat' };
  }

  /**
   * 构建优化提示词
   */
  buildOptimizationPrompt(optimizationType, userDirection = null) {
    const prompts = {
      general: '请优化以下脚本，使其更具吸引力、画面感更强、节奏更合理。',
      pacing: '请调整脚本节奏，确保快慢结合，有起伏感。',
      visual: '请优化每个场景的视觉描述，增强画面感和镜头语言。',
      emotion: '请增强脚本的情感表达，让故事更能打动人心。',
      conflict: '请在适当位置增加冲突和转折，让剧情更有张力。',
      regenerate: '请根据用户的修改方向，整体重新生成所有分镜描述。实拍素材场景需保留，但可优化其描述和叙事衔接。'
    };

    let basePrompt = prompts[optimizationType] || prompts.general;
    if (userDirection && (optimizationType === 'regenerate' || optimizationType === 'general')) {
      basePrompt += `\n\n用户特别强调的修改方向：${userDirection}`;
    }

    return `你是专业的视频脚本编剧。${basePrompt}

要求：
1. 保持场景数量不变
2. ⭐ 每个场景描述必须100-150字，要详细且有画面感
3. 必须包含五大要素：场景环境、主体描述、动作动态、镜头语言、光影氛围
4. 场景之间要有连贯性
5. 包含具体的视觉元素、动作、镜头运动
6. 符合短视频的节奏特点
7. 让人能在脑海中浮现出完整的画面

请直接输出优化后的场景列表，格式：
场景1: [详细描述，100-150字，包含所有要素]
场景2: [详细描述，100-150字，包含所有要素]
...`;
  }

  /**
   * 解析优化后的场景
   */
  parseOptimizedScenes(response, originalScenes) {
    const lines = response.split('\n').filter(line => line.trim());
    const scenePattern = /场景\s*(\d+)\s*[:：]\s*(.+)/;
    
    const optimizedScenes = [];
    
    for (const line of lines) {
      const match = line.match(scenePattern);
      if (match) {
        const sceneNum = parseInt(match[1]) - 1;
        const description = match[2].trim();
        
        if (originalScenes[sceneNum]) {
          optimizedScenes.push({
            ...originalScenes[sceneNum],
            description: description
          });
        }
      }
    }
    
    // 如果解析失败，返回原始场景
    return optimizedScenes.length === originalScenes.length 
      ? optimizedScenes 
      : originalScenes;
  }

  /**
   * AI润色单条自定义场景
   * 使用与创意方案生成相同的高质量模型，结合完整项目上下文和全局分镜列表，
   * 深度理解叙事结构与前后关系，将用户草稿扩写成专业分镜描述
   */
  async enhanceScene({ scene, surroundingScenes, allScenes, proposal, userPrompt }) {
    const prevScene = surroundingScenes?.prev;
    const nextScene = surroundingScenes?.next;

    // ── 构建项目信息区 ──
    const projectLines = [];
    if (userPrompt) projectLines.push(`项目主题：${userPrompt}`);
    if (proposal) {
      if (proposal.title) projectLines.push(`创意方向：${proposal.title}`);
      if (proposal.visualStyle) projectLines.push(`视觉风格：${proposal.visualStyle}`);
      if (proposal.bgmStyle) projectLines.push(`BGM/音乐氛围：${proposal.bgmStyle}`);
      if (proposal.emotion) projectLines.push(`情绪基调：${proposal.emotion}`);
      if (proposal.brandTone) projectLines.push(`品牌调性：${proposal.brandTone}`);
      if (proposal.tagline) projectLines.push(`核心文案/标语：${proposal.tagline}`);
    }
    const projectSection = projectLines.length > 0
      ? projectLines.join('\n')
      : '（暂无项目信息）';

    // ── 构建完整分镜列表区 ──
    let scenesSection = '（暂无其他分镜）';
    if (allScenes && allScenes.length > 0) {
      const currentSceneId = scene.id;
      const sceneLines = allScenes.map((s, i) => {
        const isCurrent = s.id === currentSceneId;
        const tag = isCurrent ? '【→ 当前待写场景 ←】' : '';
        const desc = s.description
          ? (s.description.length > 60 ? s.description.slice(0, 60) + '…' : s.description)
          : '（空）';
        return `  分镜${i + 1}${tag}：${desc}（${s.duration || 5}秒）`;
      });
      scenesSection = sceneLines.join('\n');
    }

    // ── 确定场景位置描述 ──
    let positionDesc = '中间';
    if (allScenes && allScenes.length > 0) {
      const idx = allScenes.findIndex(s => s.id === scene.id);
      const total = allScenes.length;
      if (idx === 0) positionDesc = '开篇（第一个场景，需要抓住眼球、建立基调）';
      else if (idx === total - 1) positionDesc = '结尾（最后一个场景，需要收束升华或留下余韵）';
      else if (idx <= Math.floor(total * 0.3)) positionDesc = '前段（建立氛围、引入主题）';
      else if (idx >= Math.floor(total * 0.7)) positionDesc = '后段（推向高潮或过渡到结尾）';
      else positionDesc = '中段（递进叙事，承上启下）';
    }

    const systemPrompt = `你是专业的商业视频编剧，擅长根据品牌调性和叙事结构创作高品质分镜描述。

【你的任务】
用户手工填写了一个分镜的草稿内容。你需要：
1. 深入理解整个项目的主题、调性和视觉风格
2. 通读完整分镜列表，把握整体叙事节奏和故事走向
3. 分析这个分镜在整体叙事中的位置、前后关系
4. 在严格保留用户原始创意意图的基础上，将草稿扩写成专业的标准分镜描述

【输出格式要求】
只输出一个 JSON 对象，不要任何额外说明文字：
{
  "description": "润色后的场景描述（100-150字，必须包含：场景环境/主体描述/动作动态/镜头语言/光影氛围五大要素，画面感极强）",
  "narration": "旁白或字幕文案（10-30字，简洁有力，紧扣主题，可为空字符串）",
  "visualStyle": "该场景视觉风格（10-20字，与整体风格协调）",
  "cameraMovement": "镜头运动（只能选一个：none/zoom_in/zoom_out/pan_left/pan_right/tilt_up/tilt_down/drone）",
  "designReason": "这个场景在整体叙事中的作用（一句话）"
}

【润色标准】
1. description 必须100-150字，让人读完后脑海中能浮现完整的电影级视觉画面
2. 根据场景叙事位置选择合适节奏：开篇抓眼球、中段递进情绪、结尾收束升华
3. 镜头语言服务情感表达：传递紧迫/震撼用推进，表现广阔/孤独用拉远，跟随动作用摇移
4. 旁白要与品牌调性和画面情绪高度匹配，言简意赅
5. 严格保留用户输入的核心内容和创意意图，不能改变用户想要的主体元素
6. 与前后场景保持叙事连贯性，不能出现情节跳跃或风格突变`;

    const userMessage = `【项目信息】
${projectSection}

【完整分镜列表（共 ${allScenes ? allScenes.length : '未知'} 个场景）】
${scenesSection}

【当前待写分镜】
叙事位置：${positionDesc}
${prevScene ? `上一个场景：${prevScene.description || '（空）'}` : '上一个场景：（无，这是第一个场景）'}
${nextScene ? `下一个场景：${nextScene.description || '（空）'}` : '下一个场景：（无，这是最后一个场景）'}

用户填写的草稿：
- 场景描述：${scene.description || '（空）'}
- 旁白/字幕：${scene.narration || '（空）'}
- 镜头运动偏好：${scene.cameraMovement || 'none'}
- 时长：${scene.duration || 5}秒

请在深度理解整体叙事架构和上下文关系的基础上，将以上草稿润色为标准专业分镜，输出 JSON。`;

    // 使用与创意方案相同的高质量模型
    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) throw new Error('缺少环境变量 ARK_API_KEY');

    const response = await axios.post(
      ScriptEditService.API_URL,
      {
        model: ScriptEditService.ENHANCE_MODEL_ID,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const aiText = response.data?.choices?.[0]?.message?.content;
    if (!aiText) throw new Error('AI返回格式异常');

    // 解析AI返回的JSON
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI未返回JSON');
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        ...scene,
        description: parsed.description || scene.description,
        narration: parsed.narration !== undefined ? parsed.narration : scene.narration,
        visualStyle: parsed.visualStyle || scene.visualStyle,
        cameraMovement: parsed.cameraMovement || scene.cameraMovement || 'none',
        designReason: parsed.designReason || ''
      };
    } catch {
      console.warn('[ScriptEditService] enhanceScene JSON解析失败，返回原始场景');
      return scene;
    }
  }
}

export default new ScriptEditService();
