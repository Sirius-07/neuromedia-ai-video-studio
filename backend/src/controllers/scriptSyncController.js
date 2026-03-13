/**
 * 脚本同步控制器
 * 用于将叙事性脚本转换为AI绘画提示词
 */

/**
 * 将脚本转换为提示词
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const convertScriptToPrompt = async (req, res) => {
  try {
    const { scriptText, lockedTags = [], previousPrompt = '', sceneType = 'ai' } = req.body;

    if (!scriptText || typeof scriptText !== 'string') {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: scriptText'
      });
    }

    console.log(`\n📝 收到脚本转换请求`);
    console.log(`  脚本长度: ${scriptText.length} 字`);
    console.log(`  锁定标签: ${lockedTags.length} 个`);

    // 简单的关键词提取（后续可以接入 GPT/Claude）
    const extractedKeywords = extractKeywordsFromScript(scriptText);
    
    // 组合提示词：锁定标签 + 提取的关键词
    const visualPrompt = buildVisualPrompt(extractedKeywords, lockedTags);
    const motionPrompt = buildMotionPrompt(extractedKeywords);

    console.log(`✅ 转换完成`);
    console.log(`  视觉提示词: ${visualPrompt}`);
    console.log(`  动作提示词: ${motionPrompt}`);

    return res.status(200).json({
      success: true,
      data: {
        visualPrompt,
        motionPrompt,
        extractedKeywords,
        confidence: 0.85 // 简单版本的置信度
      }
    });

  } catch (error) {
    console.error('❌ 脚本转换失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * 使用 LLM 进行高质量转换（需要配置 OpenAI/Claude API）
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 */
export const convertScriptToPromptWithLLM = async (req, res) => {
  try {
    const { scriptText, lockedTags = [], previousPrompt = '', sceneType = 'ai' } = req.body;

    if (!scriptText || typeof scriptText !== 'string') {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: scriptText'
      });
    }

    // 检查是否配置了 LLM
    const hasLLM = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!hasLLM) {
      console.warn('⚠️ 未配置 LLM API Key，回退到简单模式');
      return convertScriptToPrompt(req, res);
    }

    console.log(`\n🤖 使用 LLM 转换脚本`);

    // TODO: 接入 OpenAI/Claude API
    // const prompt = buildSystemPrompt(scriptText, lockedTags, sceneType);
    // const response = await callLLM(prompt);

    // 暂时使用简单模式
    return convertScriptToPrompt(req, res);

  } catch (error) {
    console.error('❌ LLM 转换失败:', error);
    return res.status(500).json({
      success: false,
      error: 'LLM 调用失败',
      message: error.message
    });
  }
};

/**
 * 从脚本中提取关键词
 * @private
 * @param {string} scriptText - 脚本文本
 * @returns {Object} 提取的关键词分类
 */
function extractKeywordsFromScript(scriptText) {
  const subjects = [];
  const environment = [];
  const actions = [];

  // 关键词库（可以扩展）
  const keywordDatabase = {
    subjects: [
      '人物', '老人', '少年', '女孩', '男孩', '小孩', '婴儿',
      '建筑', '广州塔', '大桥', '古塔', '寺庙', '教堂',
      '动物', '狗', '猫', '鸟', '鱼', '马',
      '车辆', '汽车', '自行车', '火车', '飞机',
      '舞狮', '龙', '凤凰', '麒麟'
    ],
    environment: [
      '晨光', '日出', '日落', '夕阳', '夜晚', '黄昏', '正午',
      '晴天', '雨天', '雪天', '阴天', '多云',
      '室内', '室外', '街道', '公园', '广场', '海边', '山上',
      '赛博朋克', '古风', '现代', '未来', '科幻',
      '柔和光线', '逆光', '侧光', '顶光', '暖色调', '冷色调',
      '4K', '高清', '电影感', '胶片颗粒'
    ],
    actions: [
      '奔跑', '行走', '跳跃', '跳舞', '飞行', '游泳',
      '站立', '坐下', '躺下', '蹲下',
      '欢呼', '挥手', '鼓掌', '拥抱', '亲吻',
      '打太极', '练武', '舞剑', '打鼓',
      '微笑', '大笑', '哭泣', '愤怒',
      '飘扬', '摇晃', '旋转', '跳动'
    ]
  };

  // 匹配关键词
  Object.entries(keywordDatabase).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (scriptText.includes(keyword)) {
        if (category === 'subjects' && !subjects.includes(keyword)) {
          subjects.push(keyword);
        } else if (category === 'environment' && !environment.includes(keyword)) {
          environment.push(keyword);
        } else if (category === 'actions' && !actions.includes(keyword)) {
          actions.push(keyword);
        }
      }
    });
  });

  return { subjects, environment, actions };
}

/**
 * 构建视觉提示词
 * @private
 * @param {Object} keywords - 提取的关键词
 * @param {Array} lockedTags - 锁定的标签
 * @returns {string} 视觉提示词
 */
function buildVisualPrompt(keywords, lockedTags = []) {
  const parts = [];

  // 锁定标签优先
  if (lockedTags.length > 0) {
    parts.push(lockedTags.join(', '));
  }

  // 添加主体
  if (keywords.subjects.length > 0) {
    parts.push(keywords.subjects.join(', '));
  }

  // 添加环境
  if (keywords.environment.length > 0) {
    parts.push(keywords.environment.join(', '));
  }

  // 默认质量标签
  if (parts.length > 0) {
    parts.push('high quality', 'detailed', 'cinematic lighting');
  }

  return parts.join(', ');
}

/**
 * 构建动作提示词
 * @private
 * @param {Object} keywords - 提取的关键词
 * @returns {string} 动作提示词
 */
function buildMotionPrompt(keywords) {
  if (keywords.actions.length === 0) {
    return 'smooth motion, natural movement';
  }

  return keywords.actions.join(', ') + ', smooth motion';
}

/**
 * 构建 LLM System Prompt（用于高质量转换）
 * @private
 */
function buildSystemPrompt(scriptText, lockedTags, sceneType) {
  return `You are an expert in converting narrative video scripts into AI image generation prompts (Stable Diffusion/Midjourney format).

Task: Convert the following Chinese video script into English visual description keywords.

Guidelines:
1. Extract SUBJECTS (characters, objects, buildings)
2. Extract ENVIRONMENT (lighting, weather, style, mood)
3. Extract ACTIONS/MOTION (what is happening in the scene)
4. Use concise keywords, not full sentences
5. Focus on VISUAL elements only (no psychological descriptions)
6. Output format: comma-separated keywords

${lockedTags.length > 0 ? `IMPORTANT: These tags are LOCKED and must be included: ${lockedTags.join(', ')}` : ''}

Script:
"""
${scriptText}
"""

Output format:
{
  "visualPrompt": "locked tags, subject, environment, style, quality tags",
  "motionPrompt": "action keywords, motion style",
  "confidence": 0.85
}`;
}








