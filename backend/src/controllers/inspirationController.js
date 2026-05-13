/**
 * 灵感激发模式控制器
 * 提供情绪分析、创意方案生成等功能
 */

import { arkPost } from '../utils/arkClient.js';
import AssetAnalysisService from '../services/AssetAnalysisService.js';

const ARK_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
// doubao-seed-1-6-flash 是 seed 系列的快速版本，具备思考能力但响应更快
// doubao-seed-1-8-251228 思考时间过长（>2min），容易导致浏览器连接超时
const ARK_MODEL_ID = 'doubao-seed-1-6-flash-250828';

function getSceneAssetPath(scene = {}) {
  return scene.assetPath || scene.reference_asset_path || scene.asset_path || scene.assetUrl || scene.asset_url || null;
}

function getAssetSceneType(asset = {}) {
  return asset.file_type === 'video' ? 'mixed_media' : 'ai_generated';
}

function stripWrappingQuotes(text = '') {
  return String(text).trim().replace(/^[`'""“”]+|[`'""“”]+$/g, '');
}

function cleanPromptPart(value = '') {
  return stripWrappingQuotes(value)
    .replace(/\s+/g, ' ')
    .replace(/[，。；;,.、\s]+$/g, '');
}

function buildVisualDescription(scene = {}, proposal = {}, index = 0) {
  const base = cleanPromptPart(scene.visual || scene.description || scene.script || `场景 ${index + 1}`);
  const style = cleanPromptPart(scene.visualStyle || proposal.visualStyle || '');
  const parts = [base];

  if (style && !base.includes(style) && !style.includes(base)) {
    parts.push(style);
  }

  return parts.filter(Boolean).join('，');
}

function getDefaultAssetNarration(description = '', index = 0) {
  const text = String(description);
  if (/汤|碗|绿豆|小吃|砂锅/.test(text)) return '一碗热气，盛住日常的温柔';
  if (/包|蒸笼|手艺|传承|捏/.test(text)) return '手把手之间，老味道继续流传';
  if (/厨房|家|烟火|老人|孩子/.test(text)) return '烟火升起，家的味道有了形状';
  return ['真实的瞬间，正在成为故事', '生活的细节，慢慢靠近心里', '这一刻，把温度留给镜头'][index % 3];
}

function getDefaultAssetCamera(index = 0) {
  const presets = [
    { size: '中景', perspective: '平视', equipment: '稳定器', focalLength: '35mm', cameraMovement: '轻微推进' },
    { size: '近景', perspective: '平视', equipment: '手持', focalLength: '50mm', cameraMovement: '轻微推进' },
    { size: '中景', perspective: '平视', equipment: '三脚架', focalLength: '50mm', cameraMovement: '缓慢拉近' },
  ];
  return presets[index % presets.length];
}

function normalizeProposalsForSelectedAssets(proposals, assets = []) {
  const selectedAssets = assets.filter(asset => asset && asset.selected !== false);
  if (selectedAssets.length === 0) return proposals;

  return proposals.map((proposal) => {
    const roughScript = proposal.roughScript || {};
    const scenes = Array.isArray(roughScript.scenes) ? [...roughScript.scenes] : [];

    selectedAssets.forEach((asset, assetIndex) => {
      const assetPath = asset.file_path || asset.url;
      if (!assetPath) return;

      const existingIndex = scenes.findIndex(scene => getSceneAssetPath(scene) === assetPath);
      const targetIndex = existingIndex >= 0 ? existingIndex : Math.min(assetIndex, scenes.length);
      const previousScene = scenes[targetIndex] || {};
      const forcedAssetScene = existingIndex < 0;
      const assetDescription = stripWrappingQuotes(
        asset.description || previousScene.description || `${asset.file_type === 'video' ? '视频' : '图片'}素材${assetIndex + 1}`,
      );
      const cameraDefaults = getDefaultAssetCamera(assetIndex);

      scenes[targetIndex] = {
        ...previousScene,
        type: getAssetSceneType(asset),
        description: forcedAssetScene ? assetDescription : stripWrappingQuotes(previousScene.description || assetDescription),
        narration: forcedAssetScene ? getDefaultAssetNarration(assetDescription, assetIndex) : (previousScene.narration || getDefaultAssetNarration(assetDescription, assetIndex)),
        visual: forcedAssetScene ? assetDescription : stripWrappingQuotes(previousScene.visual || assetDescription),
        assetPath,
        reference_asset_path: assetPath,
        isRealShot: true,
        sourceRef: previousScene.sourceRef || `素材${assetIndex + 1}`,
        duration: previousScene.duration || 5,
        visualStyle: forcedAssetScene ? (proposal.visualStyle || '') : (previousScene.visualStyle || proposal.visualStyle || ''),
        bgmStyle: previousScene.bgmStyle || proposal.bgmStyle || '',
        size: forcedAssetScene ? cameraDefaults.size : (previousScene.size || cameraDefaults.size),
        perspective: forcedAssetScene ? cameraDefaults.perspective : (previousScene.perspective || cameraDefaults.perspective),
        equipment: forcedAssetScene ? cameraDefaults.equipment : (previousScene.equipment || cameraDefaults.equipment),
        focalLength: forcedAssetScene ? cameraDefaults.focalLength : (previousScene.focalLength || cameraDefaults.focalLength),
        cameraMovement: forcedAssetScene ? cameraDefaults.cameraMovement : (previousScene.cameraMovement || cameraDefaults.cameraMovement),
        dialogue: forcedAssetScene ? '' : (previousScene.dialogue || ''),
        notes: forcedAssetScene ? '' : (previousScene.notes || ''),
      };
    });

    return {
      ...proposal,
      roughScript: {
        ...roughScript,
        scenes,
      },
    };
  });
}

/**
 * 分析内容情绪
 * POST /api/inspiration/analyze
 */
export const analyzeContent = async (req, res) => {
  try {
    const { assets = [], userPrompt = '' } = req.body;
    
    console.log('[InspirationController] 🎯 开始AI情绪分析...');
    console.log('[InspirationController] 提示词:', userPrompt.substring(0, 50));
    console.log('[InspirationController] 素材数量:', assets.length);
    
    // 使用AI真正分析情绪
    const emotionResult = await analyzeEmotionWithAI(userPrompt, assets);
    
    console.log('[InspirationController] ✅ AI识别情绪:', emotionResult.emotion);
    
    res.json(emotionResult);
    
  } catch (error) {
    console.error('[InspirationController] ❌ 分析失败:', error.message);
    let userMessage = error.message || '情绪分析失败';
    if (error.status === 503 || /503|Service Unavailable|Request failed with status code 503/i.test(userMessage)) {
      userMessage = 'AI 服务暂时繁忙，请稍后重试';
    }
    res.status(500).json({
      success: false,
      error: userMessage
    });
  }
};

/**
 * 生成创意方案
 * POST /api/inspiration/generate
 */
export const generateProposals = async (req, res) => {
  try {
    const { assets = [], userPrompt = '', generationMode = 'ai_generated', newsArticle = '', publishGoal = 'fast_publish' } = req.body;
    
    console.log('[InspirationController] 🎨 开始AI生成创意方案...');
    console.log('[InspirationController] 用户提示:', userPrompt.substring(0, 50));
    console.log('[InspirationController] 素材数量:', assets.length);
    console.log('[InspirationController] 生成模式:', generationMode);
    
    // AI+实拍模式：先分析素材，获取真实的内容描述
    let analyzedAssets = assets;
    if (generationMode === 'ai_plus_real' && assets.length > 0) {
      console.log('[InspirationController] 🔍 AI+实拍模式：先分析上传素材...');
      try {
        analyzedAssets = await AssetAnalysisService.analyzeAssets(assets);
        console.log('[InspirationController] ✅ 素材分析完成');
      } catch (analysisError) {
        console.warn('[InspirationController] ⚠️ 素材分析失败，使用原始素材信息:', analysisError.message);
        analyzedAssets = assets;
      }
    }
    
    // 使用AI真正生成创意方案
    const proposals = normalizeProposalsForSelectedAssets(
      await generateProposalsWithAI(null, userPrompt, analyzedAssets, generationMode, newsArticle, publishGoal),
      analyzedAssets,
    );
    
    console.log('[InspirationController] ✅ AI生成方案数:', proposals.length);
    
    res.json({ proposals });
    
  } catch (error) {
    console.error('[InspirationController] ❌ 生成方案失败:', error.message);

    // 将底层技术错误转为用户友好的信息
    let userMessage = error.message || '方案生成失败';
    if (
      error.status === 503 ||
      /503|Service Unavailable|Request failed with status code 503/i.test(userMessage)
    ) {
      userMessage = 'AI 服务暂时繁忙，请稍后重试';
    } else if (error.status === 429 || /429|rate limit|too many requests/i.test(userMessage)) {
      userMessage = 'AI 请求频率超限，请稍候片刻再试';
    } else if (error.status === 401 || /401|unauthorized|api key/i.test(userMessage)) {
      userMessage = 'AI 服务认证失败，请联系管理员检查配置';
    } else if (/timeout|timed out/i.test(userMessage)) {
      userMessage = 'AI 响应超时，请重试';
    } else if (/ARK API returned \d+:/i.test(userMessage)) {
      // 裁掉底层技术细节，只保留简洁描述
      const match = userMessage.match(/ARK API returned (\d+):/);
      const code = match ? match[1] : '';
      userMessage = code === '503'
        ? 'AI 服务暂时繁忙，请稍后重试'
        : `AI 服务异常（${code}），请重试`;
    }

    res.status(500).json({
      success: false,
      error: userMessage
    });
  }
};

/**
 * 转换方案为分镜脚本（简单转换，已废弃）
 * POST /api/inspiration/convert
 */
export const convertToScenes = async (req, res) => {
  try {
    const { proposal } = req.body;
    
    if (!proposal || !proposal.roughScript || !proposal.roughScript.scenes) {
      return res.status(400).json({
        success: false,
        error: '无效的方案数据'
      });
    }
    
    console.log('[InspirationController] 转换方案为分镜脚本...');
    
    // 将粗略脚本转换为详细分镜
    const scenes = proposal.roughScript.scenes.map((scene, index) => ({
      scene_id: index + 1,
      type: scene.type || 'ai_generated',
      script_content: scene.description || scene.script || '',
      visual_description: buildVisualDescription(scene, proposal, index),
      estimated_duration: scene.duration || 5,
      reference_asset_path: getSceneAssetPath(scene)
    }));
    
    console.log('[InspirationController] 转换完成，共', scenes.length, '个场景');
    
    res.json({ scenes });
    
  } catch (error) {
    console.error('[InspirationController] 转换失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '方案转换失败'
    });
  }
};

/**
 * 扩展为详细脚本（新接口）
 * POST /api/inspiration/expand
 */
export const expandProposalToScript = async (req, res) => {
  try {
    const { proposal, projectTitle } = req.body;
    
    if (!proposal) {
      return res.status(400).json({
        success: false,
        error: '缺少方案数据'
      });
    }
    
    console.log('[InspirationController] 扩展方案为详细脚本...');
    console.log('[InspirationController] 方案标题:', proposal.title);
    
    // 将方案扩展为完整的分镜脚本
    const scenes = proposal.roughScript?.scenes?.map((scene, index) => {
      const visualDescription = buildVisualDescription(scene, proposal, index);
      
      return {
        scene_id: index + 1,
        type: scene.type || 'ai_generated',
        script_content: scene.description || scene.script || `场景 ${index + 1} 的脚本内容`,
        visual_description: visualDescription,
        narration: scene.narration || scene.description || scene.script || '',
        estimated_duration: scene.duration || 5,
        reference_asset_path: getSceneAssetPath(scene),
        bgm_style: scene.bgmStyle || proposal.bgmStyle || 'ambient',
        transition: index > 0 ? 'fade' : null,
        // 摄影参数（直接透传来自 AI 生成的方案场景字段）
        shot_size: scene.size || '',
        perspective: scene.perspective || '',
        equipment: scene.equipment || '',
        focal_length: scene.focalLength || '',
        camera_movement: scene.cameraMovement || '',
        dialogue: scene.dialogue || '',
        notes: scene.notes || '',
      };
    }) || [];
    
    // 计算总时长
    const totalDuration = scenes.reduce((sum, scene) => sum + scene.estimated_duration, 0);
    
    const result = {
      project_id: `proj_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: projectTitle || proposal.title || 'AI 生成视频',
      scenes: scenes,
      total_duration: totalDuration,
      visual_style: proposal.visualStyle,
      bgm_style: proposal.bgmStyle,
      tags: proposal.tags || []
    };
    
    console.log('[InspirationController] 脚本扩展完成，共', scenes.length, '个分镜');
    
    res.json(result);
    
  } catch (error) {
    console.error('[InspirationController] 扩展失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '脚本扩展失败'
    });
  }
};

// ==================== AI生成函数 ====================

/**
 * 使用AI分析内容情绪
 */
async function analyzeEmotionWithAI(userPrompt, assets) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    throw new Error('缺少环境变量 ARK_API_KEY');
  }

  // 构建素材描述
  let assetsDescription = '';
  if (assets.length > 0) {
    assetsDescription = '\n\n素材内容：\n';
    assets.forEach((asset, index) => {
      assetsDescription += `${index + 1}. ${asset.description || '素材' + (index + 1)}\n`;
    });
  }

  const systemPrompt = `你是一个专业的内容情绪分析专家。请分析用户的需求和素材，判断适合的情绪风格类型。

可选的情绪类型：
- professional: 专业商务（适合企业宣传、产品展示等）
- high_energy: 欢快活力（适合庆祝、运动、派对等）
- aesthetic: 治愈美学（适合风景、浪漫、温馨等）
- dramatic: 戏剧震撼（适合史诗、宏大、紧张等）
- minimalist: 极简现代（适合简约、高端、艺术等）
- neutral: 中性平衡（适合日常、记录等）

请返回JSON格式（不要有其他文字）：
{
  "emotion": "情绪类型代码",
  "emotionLabel": "中文标签",
  "confidence": 0.8,
  "detectedElements": ["检测到的关键元素1", "元素2"]
}`;

  const userMessage = `用户需求：${userPrompt}${assetsDescription}

请分析适合的情绪风格类型。`;

  console.log('[InspirationController] 📤 调用AI分析情绪...');

  try {
    const response = await arkPost(ARK_API_URL, {
      model: ARK_MODEL_ID,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 500
    }, apiKey, 60000);

    const content = response.choices[0].message.content;
    
    // 解析JSON（去掉 markdown 包裹、修复单引号等）
    let jsonText = content.trim();
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/g, '').trim();
    jsonText = jsonText.replace(/^```\s*/, '').replace(/```\s*$/g, '').trim();
    jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');

    const result = JSON.parse(jsonText);
    console.log('[InspirationController] ✅ AI情绪分析完成:', result.emotion);
    return result;

  } catch (error) {
    console.error('[InspirationController] ❌ AI情绪分析失败:', error.message);
    
    // 降级到关键词分析
    console.log('[InspirationController] 🔄 使用关键词降级分析');
    return detectEmotion_DEPRECATED(userPrompt, assets);
  }
}

/**
 * 使用AI生成创意方案
 */
async function generateProposalsWithAI(analysisResult, userPrompt, assets, generationMode = 'ai_generated', newsArticle = '', publishGoal = 'fast_publish') {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    throw new Error('缺少环境变量 ARK_API_KEY');
  }

  const hasAssets = assets.length > 0;
  const isAiPlusReal = generationMode === 'ai_plus_real';
  const hasNewsArticle = typeof newsArticle === 'string' && newsArticle.trim().length > 0;

  // ── 新闻稿模式 ──────────────────────────────────────────────
  if (hasNewsArticle) {
    const sceneSourceRefExample = `"sourceRef": "原稿第2段：'市应急管理局局长王某表示，救援队已于当日下午抵达现场'（来自原稿）"`;
    const isRefineMode = publishGoal === 'refine_handoff';

    const systemPrompt = `你是资深融媒体视频编辑，专门将新闻稿转化为可信的融媒体短视频脚本。

【核心原则：新闻准确性第一】
1. 必须先从原稿中提炼关键新闻事实（5W1H），不得虚构任何数据、人名、地名、时间
2. 每个分镜场景必须注明对应原稿哪一段/哪句话（sourceRef字段）
3. AI补充的画面描述必须标注 isAISupplemented:true，原稿内容标注 false
4. 严禁在 narration（旁白）中添加原稿没有的事实性信息
5. 默认风格：新闻快讯 / 融媒体短视频，不做创意大片处理

【JSON格式（只返回JSON，数组长度必须为3）】
[{
  "title": "视频标题（直接源自新闻标题，不做创意改写）",
  "tags": ["新闻标签1", "新闻标签2"],
  "styleTags": ["风格标签，必须从以下选择：新闻快讯/深度报道/现场直击/融媒体/民生关注/政务发布（选1-2个）"],
  "paceTag": "节奏，从以下选一个：快 / 中速 / 舒缓",
  "scenarioTags": ["适用场景，从以下选：突发新闻/常规报道/民生服务/政策解读/调查报道（选1-2个）"],
  "isRecommended": false,
  "recommendationReason": "仅在isRecommended为true时填写（结合新闻类型说明为何推荐）",
  "reasoning": "为什么选这个叙事角度（1句话）",
  "visualStyle": "视觉风格（中文，新闻类：如'纪实手持 配合字幕条'/'官方稳重 图文并茂'/'现场感强 推拉镜头'）",
  "bgmStyle": "配乐风格（新闻类：如'无配乐-纯环境音'/'轻新闻背景乐'/'紧张感背景'）",
  "newsFacts": {
    "headline": "从原稿提炼的新闻标题（原文或最接近原文）",
    "who": "涉及的主要人物/机构（原稿原文）",
    "what": "核心事件/事实（原稿原文）",
    "when": "时间信息（原稿原文，没有则填'未提及'）",
    "where": "地点信息（原稿原文，没有则填'未提及'）",
    "why": "原因/背景（原稿原文，没有则填'未提及'）",
    "keyQuotes": ["原稿中的关键引语1（原文照录）", "引语2"],
    "mustRetain": ["必须在视频中保留的关键信息1（原文）", "关键信息2"]
  },
  "roughScript": {
    "scenes": [
      {
        "type": "ai_generated",
        "description": "该场景的画面描述（中文，100字内，AI对原稿内容的视觉化演绎）",
        "narration": "旁白文案（严格基于原稿事实，不添加原稿没有的内容，约7字/秒）",
        "duration": 5,
        "visualStyle": "该场景视觉风格（中文）",
        "sourceRef": "对应原稿第X段：'摘录原稿原文关键句'（来自原稿）",
        "isAISupplemented": false,
        "size": "景别：大远景/远景/中景/近景/特写/大特写（选一）",
        "perspective": "视角：平视/仰视/俯视/鸟瞰/荷兰角（选一）",
        "equipment": "拍摄设备：稳定器/三脚架/手持/摇臂/无人机（选一）",
        "focalLength": "焦距：24mm/35mm/50mm/85mm/135mm（选一）",
        "cameraMovement": "镜头运动：静止/推进/拉远/左摇/右摇/上摇/下摇/跟拍/升降（选一）",
        "dialogue": "现场同期声/采访引语（直接引用原稿原文，如无则填空字符串）",
        "notes": "制作备注（如：需字幕条标注信源；画面需配原稿配图等）"
      },
      {
        "type": "ai_generated",
        "description": "AI补充的过渡画面或背景画面描述",
        "narration": "过渡旁白（可适当扩展背景，但不能违背原稿事实）",
        "duration": 5,
        "visualStyle": "视觉风格",
        "sourceRef": "AI补充场景（无原稿对应段落，用于视觉衔接）",
        "isAISupplemented": true,
        "size": "景别",
        "perspective": "视角",
        "equipment": "设备",
        "focalLength": "焦距",
        "cameraMovement": "镜头运动",
        "dialogue": "",
        "notes": "AI补充画面，可替换为实拍素材"
      }
    ]
  }
}]

【分镜生成规则】
1. 每个方案4-6个场景，总时长30-60秒
2. 第一个场景必须对应新闻最核心事实（通常是第一段导语）
3. sourceRef必须引用原稿原文，不能改写；若为AI补充则注明"AI补充场景"
4. isAISupplemented: false = 内容直接源自原稿；true = AI添加的视觉演绎
5. narration中的核心事实必须与原稿保持一致，禁止添加未经核实的数字/人名/地名
6. 3个方案的叙事角度要有差异：如 事件经过型、人物聚焦型、背景解读型
7. 3个方案中，选择最适合快速发布的1个将 isRecommended 设为 true${isRefineMode ? '\n8. 精修交接模式：标注更多可替换为实拍的位置（notes中说明），roghScript场景可适当详细' : ''}`;

    const userMessage = `【新闻稿全文】
${newsArticle.trim()}

${userPrompt && userPrompt !== newsArticle ? `【附加要求】${userPrompt}` : ''}

请基于以上新闻稿生成3个融媒体短视频方案。每个场景必须注明对应原稿哪一段（sourceRef），旁白必须基于原稿事实，不得虚构。`;

    console.log('[InspirationController] 📤 新闻稿模式：调用AI生成方案...');

    const callAI = async (temperature = 0.5) => {
      const response = await arkPost(ARK_API_URL, {
        model: ARK_MODEL_ID,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature,
        max_tokens: 8000
      }, apiKey, 120000);
      return response.choices[0].message.content;
    };

    const maxRetries = 2;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const content = await callAI(attempt === 1 ? 0.5 : 0.3);
        console.log(`[InspirationController] 📥 新闻模式第${attempt}次尝试，AI返回长度:`, content.length);
        const proposals = extractJSONArray(content);
        if (!Array.isArray(proposals) || proposals.length === 0) {
          throw new Error('AI返回的方案格式不正确');
        }
        const trimmed = proposals.slice(0, 3);
        console.log('[InspirationController] ✅ 新闻模式解析成功，方案数:', trimmed.length);
        return trimmed;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          console.warn(`[InspirationController] ⚠️ 新闻模式第${attempt}次解析失败，重试...`, err.message);
        }
      }
    }
    throw lastError;
  }

  // ── 常规创意模式 ─────────────────────────────────────────────
  let systemPrompt;
  let userMessage;

  if (isAiPlusReal && hasAssets) {
    // AI+实拍模式：将每个实拍素材作为独立分镜纳入创意方案
    const assetCount = assets.length;
    const selectedAssets = assets.filter(a => a.selected !== false);
    const unselectedAssets = assets.filter(a => a.selected === false);

    let assetsList = '';
    selectedAssets.forEach((asset, index) => {
      const assetType = asset.file_type === 'video' ? '视频素材' : '图片素材';
      const desc = asset.description || `第${index + 1}个${assetType}`;
      assetsList += `【必用素材${index + 1}】（${assetType}）
  文件路径：${asset.file_path}
  内容描述：${desc}
  处理方式：${asset.file_type === 'video' ? '直接作为实拍分镜使用（type: "mixed_media"）' : '图生视频（type: "ai_generated"，reference_asset_path填写路径）'}
`;
    });

    let refAssetsList = '';
    unselectedAssets.forEach((asset, index) => {
      const assetType = asset.file_type === 'video' ? '视频' : '图片';
      const desc = asset.description || `参考${assetType}${index + 1}`;
      refAssetsList += `  - 参考${assetType}：${desc}\n`;
    });

    const totalSceneHint = selectedAssets.length > 0
      ? `${selectedAssets.length}个实拍分镜 + 1-3个AI补充分镜`
      : `3-5个AI生成分镜`;

    systemPrompt = `你是视频创意专家，严格生成恰好3个不同风格的创意方案，不能多也不能少。

【重要】当前为 AI+实拍 模式，用户上传了真实拍摄的素材，每个创意方案中必须把这些实拍素材全部作为独立的分镜场景，并在此基础上添加AI补充分镜。

JSON格式（只返回JSON）：
[{
  "title": "方案名称（中文）",
  "tags": ["标签1", "标签2"],
  "styleTags": ["风格标签，如：国风大气/青春快节奏/温暖纪实/商业大片/极简现代（选1-2个最贴切的）"],
  "paceTag": "节奏标签，从以下选一个：快 / 中速 / 舒缓",
  "scenarioTags": ["适用场景，如：节日宣发/社媒传播/城市温情表达/品牌推广/纪录片风（选1-2个）"],
  "isRecommended": false,
  "recommendationReason": "仅在isRecommended为true时填写，说明为何推荐此方案（1-2句话，结合用户需求）",
  "reasoning": "为什么选这个风格（1句话）",
  "visualStyle": "整体视觉风格描述（中文）",
  "bgmStyle": "配乐风格（中文）",
  "roughScript": {
    "scenes": [
      {
        "type": "mixed_media",
        "description": "该实拍素材的使用说明和场景描述（中文）",
        "narration": "该场景的旁白解说文案（中文，约7字/秒）",
        "duration": 5,
        "visualStyle": "该场景的视觉风格（与整体风格协调）",
        "assetPath": "实拍素材的文件路径（原样填写）",
        "isRealShot": true,
        "size": "景别，如：大远景/远景/中景/近景/特写/大特写（从这几个中选一个）",
        "perspective": "视角，如：平视/仰视/俯视/鸟瞰/荷兰角（从这几个中选一个）",
        "equipment": "拍摄设备，如：稳定器/三脚架/手持/摇臂/无人机（从这几个中选一个）",
        "focalLength": "焦距，如：24mm/35mm/50mm/85mm/135mm（从这几个中选一个）",
        "cameraMovement": "镜头运动，如：静止/推进/拉远/左摇/右摇/上摇/下摇/跟拍/升降（从这几个中选一个）",
        "dialogue": "该场景的对白台词（中文，如无对白则填空字符串）",
        "notes": "拍摄备注（中文，可为空字符串）"
      },
      {
        "type": "ai_generated",
        "description": "AI生成补充场景的描述（中文，画面、动作、情感等）",
        "narration": "该场景的旁白解说文案（中文，约7字/秒）",
        "duration": 5,
        "visualStyle": "该场景的特定视觉风格（中文）",
        "size": "景别，如：大远景/远景/中景/近景/特写/大特写（从这几个中选一个）",
        "perspective": "视角，如：平视/仰视/俯视/鸟瞰/荷兰角（从这几个中选一个）",
        "equipment": "拍摄设备，如：稳定器/三脚架/手持/摇臂/无人机（从这几个中选一个）",
        "focalLength": "焦距，如：24mm/35mm/50mm/85mm/135mm（从这几个中选一个）",
        "cameraMovement": "镜头运动，如：静止/推进/拉远/左摇/右摇/上摇/下摇/跟拍/升降（从这几个中选一个）",
        "dialogue": "该场景的对白台词（中文，如无对白则填空字符串）",
        "notes": "拍摄备注（中文，可为空字符串）"
      }
    ]
  }
}]

分镜要求：
1. 每个方案的分镜数量 = 全部必用实拍素材数量 + 1-3个AI补充分镜
2. 必用实拍素材必须全部出现，顺序可以调整以配合叙事
3. 图片素材用 type: "ai_generated" + assetPath 字段（图生视频）
4. 视频素材用 type: "mixed_media" + assetPath 字段（直接使用）
5. AI补充分镜用 type: "ai_generated"，不填 assetPath
6. 所有描述使用中文，visualStyle 要详细
7. 3个方案风格要有差异（如：情感叙事型、快节奏冲击型、沉浸氛围型）
8. size/perspective/equipment/focalLength/cameraMovement 必须根据场景内容专业选择，不能全部相同
9. 3个方案中，选择最贴合用户需求的1个方案将其 isRecommended 设为 true，填写 recommendationReason，其余设为 false`;

    userMessage = `需求：${userPrompt}

【必须包含在每个方案分镜中的实拍素材】（共${selectedAssets.length}个，必须全部作为独立分镜）：
${assetsList}
${unselectedAssets.length > 0 ? `【参考素材（可选用）】：\n${refAssetsList}` : ''}
请生成3个风格各异的创意方案，每个方案的分镜中必须包含以上所有必用实拍素材，并补充AI生成分镜以完善叙事。`;

  } else {
    // 纯AI生成模式
    let assetsDescription = '';
    if (hasAssets) {
      assetsDescription = '\n\n用户上传的参考素材：\n';
      assets.forEach((asset, index) => {
        assetsDescription += `${index + 1}. ${asset.description || '素材' + (index + 1)}\n`;
      });
    }

    systemPrompt = `你是视频创意专家，严格生成恰好3个不同风格的方案，不能多也不能少。

JSON格式（只返回JSON，数组长度必须为3）：
[{
  "title": "方案名称（中文）",
  "tags": ["标签1", "标签2"],
  "styleTags": ["风格标签，如：新闻快讯/融媒体/纪实温情/商业大片/极简现代/国风大气/青春快节奏（选1-2个最贴切的）"],
  "paceTag": "节奏标签，从以下选一个：快 / 中速 / 舒缓",
  "scenarioTags": ["适用场景，如：新闻发布/社媒传播/品牌推广/纪录片风/政务宣传（选1-2个）"],
  "isRecommended": false,
  "recommendationReason": "仅在isRecommended为true时填写，说明为何推荐此方案（1-2句话，结合用户需求）",
  "reasoning": "为什么选这个风格（1句话）",
  "visualStyle": "整体视觉风格描述（中文，用于图片和视频生成）",
  "bgmStyle": "配乐风格（中文）",
  "roughScript": {
    "scenes": [
      {
        "type": "ai_generated",
        "description": "场景详细描述（中文，包含画面、动作、情感等）",
        "narration": "该场景的旁白解说文案（中文，简洁有力，约7字/秒，与画面内容匹配）",
        "duration": 10,
        "visualStyle": "该场景的特定视觉风格（中文）",
        "bgmStyle": "该场景的配乐风格（中文，可选）",
        "sourceRef": "（如基于具体素材或需求文本，注明来源；否则填'创意设计'）",
        "isAISupplemented": true,
        "size": "景别，如：大远景/远景/中景/近景/特写/大特写（从这几个中选一个）",
        "perspective": "视角，如：平视/仰视/俯视/鸟瞰/荷兰角（从这几个中选一个）",
        "equipment": "拍摄设备，如：稳定器/三脚架/手持/摇臂/无人机（从这几个中选一个）",
        "focalLength": "焦距，如：24mm/35mm/50mm/85mm/135mm（从这几个中选一个）",
        "cameraMovement": "镜头运动，如：静止/推进/拉远/左摇/右摇/上摇/下摇/跟拍/升降（从这几个中选一个）",
        "dialogue": "该场景的对白台词（中文，如无对白则填空字符串）",
        "notes": "拍摄备注（中文，如特殊光线、道具、演员表演要点等，可为空字符串）"
      }
    ]
  }
}]

要求：
1. 每个方案生成4-6个场景，风格要有差异
2. 所有分镜的 duration 总和控制在40-60秒（每个场景5秒或10秒）
3. 所有描述都使用中文
4. visualStyle 要详细，适合直接用于 AI 图片/视频生成
5. description 要具体描述画面内容、氛围、情感等
6. narration 字段必须填写，字数约为 duration × 7 字，例如5秒场景约35字
7. size/perspective/equipment/focalLength/cameraMovement 必须根据场景内容专业选择，不能全部相同
8. 3个方案中，选择最贴合用户需求的1个方案将其 isRecommended 设为 true，填写 recommendationReason，其余设为 false`;

    userMessage = `需求：${userPrompt}${assetsDescription}

生成3个方案，每个方案包含4-6个分镜，总时长40-60秒。`;
  }

  console.log('[InspirationController] 📤 调用AI生成方案...');

  const callAI = async (temperature = 0.7) => {
    const response = await arkPost(ARK_API_URL, {
      model: ARK_MODEL_ID,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature,
      max_tokens: isAiPlusReal ? 8000 : 7000
    }, apiKey, 120000);
    return response.choices[0].message.content;
  };

  // 最多重试 2 次（temperature 降低减少乱码概率）
  const maxRetries = 2;
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const content = await callAI(attempt === 1 ? 0.7 : 0.3);
      console.log(`[InspirationController] 📥 第${attempt}次尝试，AI返回长度:`, content.length);

      const proposals = extractJSONArray(content);
      if (!Array.isArray(proposals) || proposals.length === 0) {
        throw new Error('AI返回的方案格式不正确');
      }

      // 严格截取前3个，防止AI多生成
      const trimmed = proposals.slice(0, 3);
      console.log('[InspirationController] ✅ 成功解析AI方案，方案数:', trimmed.length);
      return trimmed;
    } catch (err) {
      lastError = err;
      if (err.response) {
        console.error(`[InspirationController] Ark API 错误响应:`, JSON.stringify(err.response.data));
      }
      if (attempt < maxRetries) {
        console.warn(`[InspirationController] ⚠️ 第${attempt}次解析失败，正在重试...`, err.message);
      }
    }
  }

  console.error('[InspirationController] ❌ AI生成失败（已重试）:', lastError?.message);
  throw lastError;
}

// ==================== JSON 解析工具 ====================

/**
 * 从 AI 返回的文本中提取并修复 JSON 数组
 * 处理常见问题：单引号属性名、多余逗号、未转义换行、markdown代码块包裹等
 */
export function extractJSONArray(text) {
  const original = String(text || '').trim();
  const fencedBlocks = extractMarkdownJSONBlocks(original);

  if (fencedBlocks.length > 0) {
    const collected = [];
    for (const block of fencedBlocks) {
      const parsed = parseProposalCandidate(block);
      if (parsed) {
        collected.push(...parsed);
      }
    }
    if (collected.length > 0) {
      return collected;
    }
  }

  const candidates = [
    stripWrappingFence(original),
    ...extractBalancedJSONSnippets(original)
  ];

  for (const candidate of uniqueNonEmpty(candidates)) {
    const parsed = parseProposalCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  console.error('[InspirationController] ❌ JSON修复后仍然解析失败');
  console.error('[InspirationController] 原始内容片段(前500字):', text.slice(0, 500));
  throw new Error(`JSON解析失败: AI返回了格式不正确的内容，请重试`);
}

function parseProposalCandidate(candidate) {
  const raw = normalizeJSONCandidate(candidate);

  try {
    return coerceProposalArray(JSON.parse(raw));
  } catch {
    // Candidate probing is expected to fail for surrounding prose and nested arrays.
  }

  try {
    const truncated = truncateToValidArray(raw);
    if (truncated) {
      const parsed = coerceProposalArray(JSON.parse(truncated));
      if (parsed) {
        console.warn('[InspirationController] ⚠️ 使用截断后的JSON，方案数:', parsed.length);
        return parsed;
      }
    }
  } catch (e) {
    // ignore, try the next candidate
  }

  return null;
}

function normalizeJSONCandidate(text) {
  let raw = stripWrappingFence(String(text || '').trim());

  // 去掉对象/数组末尾的多余逗号
  raw = raw.replace(/,(\s*[}\]])/g, '$1');
  // 将单引号包裹的 key 改为双引号（仅处理属性名形式）
  raw = raw.replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3');
  // 将单引号包裹的字符串值改为双引号（简单情况）
  raw = raw.replace(/:\s*'([^']*)'/g, ': "$1"');

  return fixUnescapedControlChars(raw);
}

function coerceProposalArray(parsed) {
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isProposalObject)) {
    return parsed;
  }

  if (isProposalObject(parsed)) {
    return [parsed];
  }

  return null;
}

function isProposalObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return (
    typeof value.title === 'string' ||
    typeof value.visualStyle === 'string' ||
    typeof value.bgmStyle === 'string' ||
    Boolean(value.newsFacts) ||
    Boolean(value.roughScript?.scenes)
  );
}

function extractMarkdownJSONBlocks(text) {
  const blocks = [];
  const pattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]?.trim()) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

function stripWrappingFence(text) {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/g, '')
    .trim();
}

function uniqueNonEmpty(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function extractBalancedJSONSnippets(text) {
  const snippets = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '[' && text[i] !== '{') {
      continue;
    }

    const snippet = readBalancedJSONSnippet(text, i);
    if (snippet) {
      snippets.push(snippet);
      i += snippet.length - 1;
    }
  }

  return snippets;
}

function readBalancedJSONSnippet(text, start) {
  const opening = text[start];
  const closing = opening === '[' ? ']' : '}';
  const stack = [closing];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === '[') {
      stack.push(']');
    } else if (ch === '{') {
      stack.push('}');
    } else if (ch === ']' || ch === '}') {
      if (ch !== stack.pop()) {
        return null;
      }
      if (stack.length === 0) {
        return text.slice(start, i + 1);
      }
    } else if (ch === closing && stack.length === 1) {
      return text.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * 修复 JSON 字符串内部未转义的控制字符
 */
function fixUnescapedControlChars(str) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      // 字符串内部：转义危险控制字符
      const code = ch.charCodeAt(0);
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      if (code < 0x20) { result += `\\u${code.toString(16).padStart(4, '0')}`; continue; }
    }

    result += ch;
  }
  return result;
}

/**
 * 截断到最后一个完整的 JSON 对象，补全数组括号
 * 处理字符串在值中间被截断的情况
 */
function truncateToValidArray(str) {
  // 先尝试闭合可能未闭合的字符串：去掉最后一个不配对的双引号之后的内容
  const closedStr = closeOpenString(str);

  // 从候选字符串末尾向前找最后一个 }，逐步尝试解析
  for (const candidate of [closedStr, str]) {
    for (let i = candidate.length - 1; i >= 0; i--) {
      if (candidate[i] === '}') {
        // 尝试多种闭合方式：直接闭合、闭合嵌套结构
        const attempts = [
          candidate.slice(0, i + 1) + ']',
          candidate.slice(0, i + 1) + ']}]',
          candidate.slice(0, i + 1) + ']}]}]',
        ];
        for (const truncated of attempts) {
          try {
            const parsed = JSON.parse(truncated);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return truncated;
            }
          } catch (e) {
            // keep searching
          }
        }
      }
    }
  }
  return null;
}

/**
 * 尝试闭合末尾未配对的双引号字符串
 */
function closeOpenString(str) {
  let inString = false;
  let escaped = false;
  let lastStringStart = -1;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; lastStringStart = i; }
      else { inString = false; lastStringStart = -1; }
    }
  }

  // 如果字符串末尾仍处于未闭合的字符串中，截断到字符串开始处并闭合
  if (inString && lastStringStart !== -1) {
    return str.slice(0, lastStringStart) + '""';
  }
  return str;
}

// ==================== 辅助函数 ====================

/**
 * 检测情绪类型（降级函数，当AI分析失败时使用）
 */
function detectEmotion_DEPRECATED(userPrompt, assets) {
  const prompt = userPrompt.toLowerCase();
  
  // 情绪关键词映射
  const emotionKeywords = {
    professional: ['商务', '公司', '产品', '发布会', '会议', '演示', '专业', '正式', '企业', 'business', 'professional', 'corporate'],
    high_energy: ['欢快', '活力', '聚会', '派对', '庆祝', '运动', '激情', '兴奋', 'party', 'celebration', 'energetic', 'dynamic'],
    aesthetic: ['治愈', '美好', '温馨', '文艺', '风景', '自然', '夕阳', '海边', '浪漫', 'aesthetic', 'healing', 'peaceful', 'sunset'],
    dramatic: ['震撼', '史诗', '宏大', '戏剧', '冲突', '紧张', 'dramatic', 'epic', 'intense'],
    minimalist: ['简约', '极简', '干净', '现代', '简洁', 'minimalist', 'clean', 'modern', 'simple'],
    neutral: ['日常', '记录', '生活', '普通', 'daily', 'casual', 'normal']
  };
  
  // 计算每种情绪的匹配分数
  const scores = {};
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    scores[emotion] = keywords.filter(kw => prompt.includes(kw)).length;
  }
  
  // 找到最高分的情绪
  let detectedEmotion = 'neutral';
  let maxScore = 0;
  let detectedElements = [];
  
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedEmotion = emotion;
      detectedElements = emotionKeywords[emotion].filter(kw => prompt.includes(kw));
    }
  }
  
  // 情绪标签映射
  const emotionLabels = {
    professional: '专业商务',
    high_energy: '欢快活力',
    aesthetic: '治愈美学',
    dramatic: '戏剧震撼',
    minimalist: '极简现代',
    neutral: '中性平衡'
  };
  
  return {
    emotion: detectedEmotion,
    emotionLabel: emotionLabels[detectedEmotion],
    confidence: maxScore > 0 ? Math.min(0.7 + maxScore * 0.1, 0.95) : 0.5,
    detectedElements: detectedElements.length > 0 ? detectedElements : ['通用元素']
  };
}

/**
 * 旧函数：根据情绪生成创意方案（已废弃，使用AI生成）
 */
// function generateProposalsForEmotion(analysisResult, userPrompt, assets) {
//   const emotion = analysisResult?.emotion || 'neutral';
//   const templates = getProposalTemplates(emotion, userPrompt, assets);
//   return templates;
// }

/**
 * 旧函数：获取方案模板（已废弃，改用AI生成）
 */
function getProposalTemplates_DEPRECATED(emotion, userPrompt, assets) {
  const hasAssets = assets.length > 0;
  
  const templates = {
    professional: [
      {
        title: '商务精英风格',
        tags: ['专业', '简洁', '高效'],
        reasoning: '采用商务风格，突出专业形象，适合企业宣传和产品展示',
        visualStyle: 'professional corporate style, clean composition, business atmosphere',
        bgmStyle: 'corporate_inspiring',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '开场：企业Logo展示，配合动态图形', duration: 3, visual: 'corporate logo reveal with motion graphics' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '主题介绍，展示核心内容', duration: 6, visual: 'professional presentation of main content' },
            { type: 'ai_generated', description: '重点展示，数据可视化', duration: 5, visual: 'data visualization and key highlights' },
            { type: 'ai_generated', description: '收尾：总结与行动号召', duration: 4, visual: 'conclusion with call to action' }
          ]
        }
      },
      {
        title: '现代科技风',
        tags: ['科技', '创新', '未来'],
        reasoning: '强调科技感和创新性，使用动态视觉效果',
        visualStyle: 'modern technology style, futuristic elements, digital aesthetics',
        bgmStyle: 'tech_ambient',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '科技感开场动画', duration: 3, visual: 'futuristic tech opening animation' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '产品或概念展示', duration: 6, visual: 'product showcase with tech elements' },
            { type: 'ai_generated', description: '特性演示', duration: 5, visual: 'feature demonstration' },
            { type: 'ai_generated', description: '结束画面', duration: 4, visual: 'tech-style ending' }
          ]
        }
      },
      {
        title: '极简商务风',
        tags: ['极简', '高端', '品质'],
        reasoning: '极简设计，突出品质感和高端定位',
        visualStyle: 'minimalist professional style, clean lines, premium quality',
        bgmStyle: 'minimal_piano',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '简约开场', duration: 3, visual: 'minimalist opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '核心信息展示', duration: 7, visual: 'core message presentation' },
            { type: 'ai_generated', description: '品质细节', duration: 5, visual: 'quality details showcase' },
            { type: 'ai_generated', description: '品牌收尾', duration: 3, visual: 'brand ending' }
          ]
        }
      }
    ],
    high_energy: [
      {
        title: '动感快节奏',
        tags: ['活力', '动感', '激情'],
        reasoning: '快速剪辑，动感十足，适合表现欢乐和活力',
        visualStyle: 'high energy dynamic style, vibrant colors, fast-paced action',
        bgmStyle: 'upbeat_electronic',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '激情开场', duration: 2, visual: 'energetic opening with dynamic motion' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '欢乐时刻1', duration: 4, visual: 'joyful moments with vibrant colors' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '欢乐时刻2', duration: 4, visual: 'more happy scenes' },
            { type: 'ai_generated', description: '高潮结尾', duration: 4, visual: 'climax ending with celebration' }
          ]
        }
      },
      {
        title: '派对庆祝风',
        tags: ['庆祝', '欢乐', '多彩'],
        reasoning: '色彩丰富，充满庆祝氛围',
        visualStyle: 'celebration party style, colorful, festive atmosphere',
        bgmStyle: 'party_dance',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '欢庆开场', duration: 3, visual: 'festive opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '派对氛围', duration: 5, visual: 'party atmosphere' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '精彩瞬间', duration: 5, visual: 'highlight moments' },
            { type: 'ai_generated', description: '欢乐收尾', duration: 3, visual: 'happy ending' }
          ]
        }
      },
      {
        title: '运动激情风',
        tags: ['运动', '激情', '力量'],
        reasoning: '展现运动活力和激情能量',
        visualStyle: 'sports energetic style, dynamic movements, powerful visuals',
        bgmStyle: 'rock_energetic',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '动感开场', duration: 2, visual: 'dynamic sports opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '运动场景1', duration: 5, visual: 'sports action scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '运动场景2', duration: 5, visual: 'sports action scene 2' },
            { type: 'ai_generated', description: '激情收尾', duration: 4, visual: 'powerful ending' }
          ]
        }
      }
    ],
    aesthetic: [
      {
        title: '治愈系美学',
        tags: ['治愈', '温暖', '美好'],
        reasoning: '温馨治愈，唤起美好情感',
        visualStyle: 'healing aesthetic style, warm tones, peaceful atmosphere',
        bgmStyle: 'acoustic_warm',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '温馨开场', duration: 4, visual: 'warm peaceful opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '美好瞬间1', duration: 6, visual: 'beautiful healing moment 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '美好瞬间2', duration: 5, visual: 'beautiful healing moment 2' },
            { type: 'ai_generated', description: '治愈收尾', duration: 4, visual: 'peaceful ending' }
          ]
        }
      },
      {
        title: '浪漫电影感',
        tags: ['浪漫', '电影', '情感'],
        reasoning: '电影感十足，适合表达浪漫情感',
        visualStyle: 'cinematic romantic style, soft lighting, emotional atmosphere',
        bgmStyle: 'romantic_piano',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '浪漫开场', duration: 4, visual: 'romantic cinematic opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '情感场景1', duration: 6, visual: 'emotional romantic scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '情感场景2', duration: 5, visual: 'emotional romantic scene 2' },
            { type: 'ai_generated', description: '温情结尾', duration: 4, visual: 'tender ending' }
          ]
        }
      },
      {
        title: '自然风光',
        tags: ['自然', '风光', '宁静'],
        reasoning: '展现自然之美，营造宁静氛围',
        visualStyle: 'natural landscape style, beautiful scenery, serene mood',
        bgmStyle: 'nature_ambient',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '自然开场', duration: 4, visual: 'nature opening scene' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '风光展示1', duration: 6, visual: 'landscape showcase 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '风光展示2', duration: 5, visual: 'landscape showcase 2' },
            { type: 'ai_generated', description: '宁静收尾', duration: 4, visual: 'peaceful nature ending' }
          ]
        }
      }
    ],
    dramatic: [
      {
        title: '史诗震撼风',
        tags: ['史诗', '震撼', '宏大'],
        reasoning: '震撼的视觉效果，营造史诗感',
        visualStyle: 'epic dramatic style, grand scale, cinematic visuals',
        bgmStyle: 'epic_orchestral',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '震撼开场', duration: 4, visual: 'epic dramatic opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '宏大场景1', duration: 6, visual: 'grand epic scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '宏大场景2', duration: 5, visual: 'grand epic scene 2' },
            { type: 'ai_generated', description: '史诗结尾', duration: 5, visual: 'epic conclusion' }
          ]
        }
      },
      {
        title: '悬疑戏剧风',
        tags: ['悬疑', '戏剧', '紧张'],
        reasoning: '营造紧张悬疑氛围',
        visualStyle: 'suspenseful dramatic style, tense atmosphere, dark tones',
        bgmStyle: 'suspense_cinematic',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '悬疑开场', duration: 4, visual: 'suspenseful opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '紧张情节1', duration: 5, visual: 'tense dramatic scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '紧张情节2', duration: 5, visual: 'tense dramatic scene 2' },
            { type: 'ai_generated', description: '戏剧性结尾', duration: 4, visual: 'dramatic conclusion' }
          ]
        }
      },
      {
        title: '冲突对比风',
        tags: ['冲突', '对比', '张力'],
        reasoning: '通过强烈对比营造戏剧张力',
        visualStyle: 'contrasting dramatic style, strong visual contrast, tension',
        bgmStyle: 'intense_dramatic',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '对比开场', duration: 3, visual: 'contrasting opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '冲突场景1', duration: 6, visual: 'conflict scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '冲突场景2', duration: 5, visual: 'conflict scene 2' },
            { type: 'ai_generated', description: '张力结尾', duration: 4, visual: 'tension ending' }
          ]
        }
      }
    ],
    minimalist: [
      {
        title: '极简现代',
        tags: ['极简', '现代', '简洁'],
        reasoning: '极简设计，突出核心内容',
        visualStyle: 'minimalist modern style, clean design, simple elegance',
        bgmStyle: 'minimal_ambient',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '简约开场', duration: 3, visual: 'minimalist opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '核心内容展示', duration: 7, visual: 'core content showcase' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '重点信息', duration: 5, visual: 'key information' },
            { type: 'ai_generated', description: '简洁收尾', duration: 3, visual: 'clean ending' }
          ]
        }
      },
      {
        title: '黑白艺术风',
        tags: ['艺术', '黑白', '格调'],
        reasoning: '黑白色调，艺术感强',
        visualStyle: 'black and white artistic style, high contrast, artistic mood',
        bgmStyle: 'classical_minimal',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '黑白开场', duration: 4, visual: 'black and white opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '艺术场景1', duration: 6, visual: 'artistic scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '艺术场景2', duration: 5, visual: 'artistic scene 2' },
            { type: 'ai_generated', description: '格调收尾', duration: 3, visual: 'stylish ending' }
          ]
        }
      },
      {
        title: '线条几何风',
        tags: ['几何', '线条', '设计'],
        reasoning: '几何线条，设计感强',
        visualStyle: 'geometric line art style, design-oriented, structured',
        bgmStyle: 'electronic_minimal',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '几何开场', duration: 3, visual: 'geometric opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '线条设计1', duration: 6, visual: 'line art design 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '线条设计2', duration: 5, visual: 'line art design 2' },
            { type: 'ai_generated', description: '设计收尾', duration: 4, visual: 'design ending' }
          ]
        }
      }
    ],
    neutral: [
      {
        title: '平衡通用风格',
        tags: ['通用', '平衡', '适中'],
        reasoning: '中性平衡的风格，适合各种场景',
        visualStyle: 'balanced universal style, neutral mood, versatile',
        bgmStyle: 'ambient_neutral',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '开场介绍', duration: 4, visual: 'neutral opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '内容展示1', duration: 5, visual: 'content showcase 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '内容展示2', duration: 5, visual: 'content showcase 2' },
            { type: 'ai_generated', description: '结束画面', duration: 4, visual: 'neutral ending' }
          ]
        }
      },
      {
        title: '记录纪实风',
        tags: ['记录', '纪实', '真实'],
        reasoning: '纪实风格，真实记录',
        visualStyle: 'documentary style, realistic, authentic',
        bgmStyle: 'documentary_soft',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '纪实开场', duration: 4, visual: 'documentary opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '记录场景1', duration: 6, visual: 'documentary scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '记录场景2', duration: 5, visual: 'documentary scene 2' },
            { type: 'ai_generated', description: '纪实收尾', duration: 3, visual: 'documentary ending' }
          ]
        }
      },
      {
        title: '日常生活风',
        tags: ['日常', '生活', '自然'],
        reasoning: '展现日常生活的美好',
        visualStyle: 'daily life style, natural, casual',
        bgmStyle: 'acoustic_casual',
        roughScript: {
          scenes: [
            { type: 'ai_generated', description: '生活开场', duration: 4, visual: 'daily life opening' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '日常场景1', duration: 5, visual: 'daily scene 1' },
            { type: hasAssets ? 'mixed_media' : 'ai_generated', description: '日常场景2', duration: 5, visual: 'daily scene 2' },
            { type: 'ai_generated', description: '生活收尾', duration: 4, visual: 'casual ending' }
          ]
        }
      }
    ]
  };
  
  return templates[emotion] || templates.neutral;
}
// 注意：以上模板函数已废弃，现在使用AI真实生成方案
