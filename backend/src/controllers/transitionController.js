import TransitionService from '../services/TransitionService.js';

/**
 * 生成AI转场提示词
 * POST /api/v1/transition/generate-prompt
 */
export const generateTransitionPrompt = async (req, res) => {
  try {
    const { 
      prev_scene_script, 
      next_scene_script, 
      video_theme,
      first_frame_base64,
      last_frame_base64
    } = req.body;
    
    // 验证输入
    if (!prev_scene_script && !next_scene_script) {
      return res.status(400).json({
        success: false,
        error: '至少需要提供一个场景的脚本内容'
      });
    }
    
    console.log('[TransitionController] 收到转场提示词生成请求');
    console.log('[TransitionController] 上一个场景脚本:', prev_scene_script?.substring(0, 50) + '...');
    console.log('[TransitionController] 下一个场景脚本:', next_scene_script?.substring(0, 50) + '...');
    console.log('[TransitionController] 视频主题:', video_theme);
    
    // 调用 AI 生成转场提示词
    const prompt = await TransitionService.generateTransitionPrompt(
      prev_scene_script,
      next_scene_script,
      video_theme,
      first_frame_base64,
      last_frame_base64
    );
    
    console.log('[TransitionController] 转场提示词生成成功:', prompt);
    
    res.json({
      success: true,
      prompt: prompt
    });
    
  } catch (error) {
    console.error('[TransitionController] 生成失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '转场提示词生成失败'
    });
  }
};

