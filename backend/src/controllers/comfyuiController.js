import ComfyUIService from '../services/ComfyUIService.js';

/**
 * 生成首尾帧转场视频
 * POST /api/v1/comfyui/transition
 */
export const generateTransition = async (req, res) => {
  try {
    const {
      first_frame_url,
      last_frame_url,
      prompt,
      negative_prompt,
      duration = 2,
      width = 640,
      height = 640,
    } = req.body;

    // 验证必填参数
    if (!first_frame_url || !last_frame_url) {
      return res.status(400).json({
        success: false,
        error: '缺少首帧或尾帧图片',
      });
    }

    console.log('[ComfyUI Controller] 收到转场视频生成请求');
    console.log('[ComfyUI Controller] 首帧URL:', first_frame_url.substring(0, 50) + '...');
    console.log('[ComfyUI Controller] 尾帧URL:', last_frame_url.substring(0, 50) + '...');
    console.log('[ComfyUI Controller] 提示词:', prompt);

    // 调用ComfyUI服务
    const result = await ComfyUIService.generateTransitionVideo({
      firstFrameUrl: first_frame_url,
      lastFrameUrl: last_frame_url,
      prompt: prompt || 'smooth transition',
      negativePrompt: negative_prompt,
      duration,
      width,
      height,
    });

    console.log('[ComfyUI Controller] 转场视频生成成功');

    res.json({
      success: true,
      video_url: result.videoUrl,
    });
  } catch (error) {
    console.error('[ComfyUI Controller] 生成失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '转场视频生成失败',
    });
  }
};

