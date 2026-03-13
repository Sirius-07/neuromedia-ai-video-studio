/**
 * 脚本编辑控制器
 * 处理脚本编辑页面的AI交互逻辑
 */

import ScriptEditService from '../services/ScriptEditService.js';

class ScriptEditController {
  /**
   * AI对话 - 根据用户输入优化脚本
   */
  async chatWithAI(req, res) {
    try {
      const { userInput, currentScenes, conversationHistory, proposal, userPrompt } = req.body;
      // #region agent log
      console.log('[AI-Director-DEBUG] chatWithAI received', { userInput: userInput?.substring(0,50), scenesCount: currentScenes?.length, hasHistory: !!conversationHistory?.length });
      // #endregion

      if (!userInput || !currentScenes) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数：userInput 或 currentScenes'
        });
      }

      // chatWithAI 直接返回结构化 JSON {message, action, changes[]}
      const result = await ScriptEditService.chatWithAI({
        userInput,
        currentScenes,
        conversationHistory: conversationHistory || [],
        proposal,
        userPrompt
      });

      // #region agent log
      console.log('[AI-Director-DEBUG] chatWithAI result', { action: result?.action, changesCount: result?.changes?.length, message: result?.message?.substring(0,60) });
      // #endregion
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('[AI-Director-DEBUG] chatWithAI ERROR:', error.message);
      console.error('AI对话失败:', error);
      res.status(500).json({ success: false, error: error.message || 'AI对话失败' });
    }
  }

  /**
   * 批量优化场景
   */
  async optimizeScenes(req, res) {
    try {
      const { scenes, optimizationType, userDirection } = req.body;

      if (!scenes || !Array.isArray(scenes)) {
        return res.status(400).json({
          success: false,
          error: '缺少或无效的scenes参数'
        });
      }

      const result = await ScriptEditService.optimizeScenes(scenes, optimizationType, userDirection);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('场景优化失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '场景优化失败'
      });
    }
  }

  /**
   * 插入新场景
   */
  async insertScene(req, res) {
    try {
      const { scenes, insertPosition, sceneDescription } = req.body;

      if (!scenes || !Array.isArray(scenes)) {
        return res.status(400).json({
          success: false,
          error: '缺少或无效的scenes参数'
        });
      }

      const result = await ScriptEditService.insertScene({
        scenes,
        insertPosition: insertPosition || scenes.length,
        sceneDescription: sceneDescription || '新场景'
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('插入场景失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '插入场景失败'
      });
    }
  }

  /**
   * 调整节奏
   */
  async adjustPacing(req, res) {
    try {
      const { scenes, pacingType } = req.body;

      if (!scenes || !Array.isArray(scenes)) {
        return res.status(400).json({
          success: false,
          error: '缺少或无效的scenes参数'
        });
      }

      const result = await ScriptEditService.adjustPacing(scenes, pacingType);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('节奏调整失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '节奏调整失败'
      });
    }
  }
  /**
   * AI润色单条自定义场景
   */
  async enhanceScene(req, res) {
    try {
      const { scene, surroundingScenes, allScenes, proposal, userPrompt } = req.body;

      if (!scene) {
        return res.status(400).json({ success: false, error: '缺少scene参数' });
      }

      const enhancedScene = await ScriptEditService.enhanceScene({
        scene,
        surroundingScenes,
        allScenes,
        proposal,
        userPrompt
      });

      res.json({ success: true, data: { scene: enhancedScene } });
    } catch (error) {
      console.error('场景润色失败:', error);
      res.status(500).json({ success: false, error: error.message || '场景润色失败' });
    }
  }
}

export default new ScriptEditController();
