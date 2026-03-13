/**
 * 标签精炼控制器
 * 处理前端的标签生成和修订请求
 */

import TagRefinementService from '../services/TagRefinementService.js';

/**
 * POST /api/ai/refine-tags
 * 智能标签生成与修订
 */
async function refineTags(req, res) {
  try {
    const { scriptContent, currentTags, userInstruction } = req.body;

    // 参数验证
    if (!scriptContent || typeof scriptContent !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '缺少必填参数: scriptContent（分镜剧本内容）'
      });
    }

    console.log('🎨 [API] 收到标签精炼请求');
    console.log('📄 剧本长度:', scriptContent.length);
    console.log('🏷️  当前标签:', currentTags ? '存在' : '不存在');
    console.log('💬 用户指令:', userInstruction || '（初始化模式）');

    let result;

    // 分支逻辑：初始化 vs 修订
    if (!currentTags || Object.keys(currentTags).length === 0 || !userInstruction) {
      // 初始化模式（冷启动）
      console.log('🌱 执行：初始化模式');
      result = await TagRefinementService.initializeTags(scriptContent);
    } else {
      // 修订模式（热更新）
      console.log('🔧 执行：修订模式');
      
      // 验证 currentTags 格式
      if (!TagRefinementService.validateTags(currentTags)) {
        return res.status(400).json({
          code: 400,
          message: 'currentTags 格式不正确，需要包含 subjects, environment, style, action 四个数组字段'
        });
      }

      result = await TagRefinementService.refineTags(
        scriptContent,
        currentTags,
        userInstruction
      );
    }

    // 成功响应
    console.log('✅ [API] 标签精炼成功');
    return res.json({
      code: 200,
      data: {
        tags: result.tags,
        message: result.message
      }
    });

  } catch (error) {
    console.error('❌ [API] 标签精炼失败:', error);
    
    return res.status(500).json({
      code: 500,
      message: error.message || '标签精炼服务异常',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

export { refineTags };

