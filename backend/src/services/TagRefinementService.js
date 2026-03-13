/**
 * 标签精炼服务
 * 基于 LLM 实现意图驱动的视频生成标签维护
 * 支持：冷启动（自动初始化）、热更新（指令修改）
 */

import MultimodalAIService from './MultimodalAIService.js';

class TagRefinementService {
  /**
   * 系统角色定义
   */
  static SYSTEM_PROMPT = `你是 AI 视频创作系统的核心指令分析师。你的任务是将"剧本"或"用户口语指令"转化为结构化的视频生成标签 (Tags)。

【输出格式要求】
严格返回 JSON 格式，包含以下字段：
{
  "tags": {
    "subjects": ["主体元素1", "主体元素2"],
    "environment": ["环境元素1", "环境元素2"],
    "style": ["风格元素1", "风格元素2"],
    "action": ["动作元素1", "动作元素2"]
  },
  "message": "对本次修改的简短说明"
}

【分类规则】
- subjects（主体）：核心人物、物体、建筑（如：广州塔、女孩、游船）
- environment（环境）：天气、时间、地点、氛围（如：清晨、大雾、CBD、霓虹灯）
- style（风格）：艺术风格、画质、色调（如：电影感、8K、赛博朋克、暖色调）
- action（动态）：运镜、动作、节奏（如：推进、奔跑、慢镜头）

【核心原则】
1. 标签使用简洁的中文词汇，每个标签 2-6 字
2. 充分联想画面细节（光影、材质、情绪）
3. 避免重复和冗余
4. 保持标签之间的语义独立性`;

  /**
   * 初始化模式：从剧本生成初始标签
   * @param {string} scriptContent - 分镜剧本内容
   * @returns {Promise<{tags: Object, message: string}>}
   */
  static async initializeTags(scriptContent) {
    console.log('🌱 [TagRefinement] 初始化模式：从剧本生成标签...');
    
    const userPrompt = `【任务】阅读以下分镜剧本，提取视觉标签。

【剧本内容】
${scriptContent}

【要求】
1. 充分联想画面细节（如光影、材质、氛围）
2. 为每个分类至少生成 2-5 个标签
3. 标签应具体且富有画面感
4. 输出标准的 JSON 格式

请开始分析并生成标签：`;

    try {
      const response = await MultimodalAIService.chatWithAI(
        this.SYSTEM_PROMPT,
        userPrompt
      );

      // 解析 AI 返回的 JSON
      const parsed = this._parseAIResponse(response);
      
      console.log('✅ [TagRefinement] 初始化完成：', {
        subjects: parsed.tags.subjects.length,
        environment: parsed.tags.environment.length,
        style: parsed.tags.style.length,
        action: parsed.tags.action.length
      });

      return parsed;
    } catch (error) {
      console.error('❌ [TagRefinement] 初始化失败:', error);
      throw new Error(`标签初始化失败: ${error.message}`);
    }
  }

  /**
   * 修订模式：根据用户指令修改现有标签
   * @param {string} scriptContent - 原始剧本（作为上下文）
   * @param {Object} currentTags - 当前标签数据
   * @param {string} userInstruction - 用户的修改指令
   * @returns {Promise<{tags: Object, message: string}>}
   */
  static async refineTags(scriptContent, currentTags, userInstruction) {
    console.log('🔧 [TagRefinement] 修订模式：根据指令更新标签...');
    console.log('📝 用户指令:', userInstruction);
    
    const userPrompt = `【任务】基于当前标签和用户指令，进行增量修改。

【原始剧本（上下文参考）】
${scriptContent}

【当前标签】
${JSON.stringify(currentTags, null, 2)}

【用户修改指令】
${userInstruction}

【修改规则】
1. **增**：识别指令中的新元素并添加到对应分类
2. **删**：严格检测冲突。例如：
   - 用户说"变成晚上" → 删除 ["白天", "阳光", "蓝天"] 等日间相关标签
   - 用户说"去掉人物" → 删除 subjects 中的所有人物标签
   - 用户说"改成赛博朋克" → 删除 style 中的自然、田园等冲突风格
3. **留**：保留与指令无关的标签（如只改环境，不动主体）

【示例】
指令："加点雨"
→ 在 environment 中添加 ["雨", "水滴", "湿润"]

指令："去掉赛博朋克风格"
→ 从 style 中删除 ["赛博朋克", "霓虹灯", "未来感"] 等相关标签

指令："让主角变成机器人"
→ subjects: 删除 ["女孩", "人类"]，添加 ["机器人"]

请根据上述规则，输出修改后的完整标签（JSON 格式）：`;

    try {
      const response = await MultimodalAIService.chatWithAI(
        this.SYSTEM_PROMPT,
        userPrompt
      );

      const parsed = this._parseAIResponse(response);
      
      console.log('✅ [TagRefinement] 修订完成');
      console.log('💬 AI 说明:', parsed.message);

      return parsed;
    } catch (error) {
      console.error('❌ [TagRefinement] 修订失败:', error);
      throw new Error(`标签修订失败: ${error.message}`);
    }
  }

  /**
   * 解析 AI 返回的响应
   * @private
   */
  static _parseAIResponse(response) {
    try {
      // 尝试直接解析
      const parsed = JSON.parse(response);
      
      // 验证结构
      if (!parsed.tags || !parsed.tags.subjects || !parsed.tags.environment || 
          !parsed.tags.style || !parsed.tags.action) {
        throw new Error('返回的 JSON 结构不完整');
      }

      // 确保所有字段都是数组
      const normalized = {
        tags: {
          subjects: Array.isArray(parsed.tags.subjects) ? parsed.tags.subjects : [],
          environment: Array.isArray(parsed.tags.environment) ? parsed.tags.environment : [],
          style: Array.isArray(parsed.tags.style) ? parsed.tags.style : [],
          action: Array.isArray(parsed.tags.action) ? parsed.tags.action : []
        },
        message: parsed.message || '标签更新完成'
      };

      return normalized;
    } catch (error) {
      // 尝试提取 JSON（防止 AI 返回额外文本）
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return this._parseAIResponse(jsonMatch[0]);
        } catch (e) {
          // 继续抛出原始错误
        }
      }

      console.error('❌ [TagRefinement] AI 返回格式错误:', response);
      throw new Error('AI 返回的内容不是有效的 JSON 格式');
    }
  }

  /**
   * 验证标签数据格式
   * @param {Object} tags - 待验证的标签对象
   * @returns {boolean}
   */
  static validateTags(tags) {
    if (!tags || typeof tags !== 'object') return false;
    
    const requiredKeys = ['subjects', 'environment', 'style', 'action'];
    for (const key of requiredKeys) {
      if (!Array.isArray(tags[key])) return false;
    }
    
    return true;
  }

  /**
   * 合并标签（去重）
   * @param {Object} tags1 
   * @param {Object} tags2 
   * @returns {Object}
   */
  static mergeTags(tags1, tags2) {
    return {
      subjects: [...new Set([...tags1.subjects, ...tags2.subjects])],
      environment: [...new Set([...tags1.environment, ...tags2.environment])],
      style: [...new Set([...tags1.style, ...tags2.style])],
      action: [...new Set([...tags1.action, ...tags2.action])]
    };
  }
}

export default TagRefinementService;

