import { v4 as uuidv4 } from 'uuid';
import ScriptService from '../services/ScriptService.js';
import AssetAnalysisService from '../services/AssetAnalysisService.js';
import ScriptTaskService from '../services/ScriptTaskService.js';

/**
 * 异步生成视频脚本（返回taskId）
 * POST /api/v1/script/generate-async
 */
export const generateScriptAsync = async (req, res) => {
  try {
    const { user_prompt, uploaded_assets = [], project_title, generation_mode = 'ai_generated', art_style, aspect_ratio } = req.body;
    
    // 验证输入
    if (!user_prompt || !user_prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: '用户提示词不能为空'
      });
    }
    
    // 创建任务
    const task = ScriptTaskService.createTask();
    
    console.log(`[ScriptController] 创建异步脚本生成任务: ${task.id}`);
    console.log(`[ScriptController] 艺术风格: ${art_style || '未指定'}, 画幅比例: ${aspect_ratio || '未指定'}`);
    
    // 异步启动生成流程
    ScriptService.generateScriptAsync(
      task.id,
      user_prompt,
      uploaded_assets,
      project_title,
      generation_mode,
      art_style || null,
      aspect_ratio || null
    ).catch(err => {
      console.error(`[ScriptController] 异步任务启动失败:`, err);
    });
    
    res.json({
      success: true,
      data: { taskId: task.id }
    });
    
  } catch (error) {
    console.error('[ScriptController] 创建任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '创建任务失败'
    });
  }
};

/**
 * 获取脚本生成任务状态
 * GET /api/v1/script/task/:taskId
 */
export const getScriptTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const task = ScriptTaskService.getTask(taskId);
  
  if (!task) {
    return res.status(404).json({
      success: false,
      error: '任务不存在'
    });
  }
  
  // 如果任务已完成，格式化结果以匹配前端预期
  if (task.status === 'completed' && task.result && !task.result.project_id) {
    const projectId = `proj_${uuidv4().substring(0, 8)}-${uuidv4().substring(0, 4)}`;
    const totalDuration = task.result.scenes?.reduce(
      (sum, scene) => sum + (scene.estimated_duration || 0), 
      0
    ) || 0;
    
    task.result = {
      project_id: projectId,
      title: task.result.title || 'AI 生成视频',
      scenes: task.result.scenes || [],
      total_duration: totalDuration
    };
  }
  
  res.json({
    success: true,
    data: task
  });
};

/**
 * 生成视频脚本
 * POST /api/v1/script/generate
 */
export const generateScript = async (req, res) => {
  try {
    const { user_prompt, uploaded_assets = [], project_title, generation_mode = 'ai_generated' } = req.body;
    
    // 验证输入
    if (!user_prompt || !user_prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: '用户提示词不能为空'
      });
    }
    
    console.log('[ScriptController] 收到脚本生成请求');
    console.log('[ScriptController] 提示词:', user_prompt.substring(0, 50) + '...');
    console.log('[ScriptController] 素材数量:', uploaded_assets.length);
    console.log('[ScriptController] 生成模式:', generation_mode);
    
    // 真实分析素材（使用火山方舟多模态AI）
    let analyzedAssets = uploaded_assets;
    if (uploaded_assets.length > 0) {
      console.log('[ScriptController] 开始分析上传的素材...');
      analyzedAssets = await AssetAnalysisService.analyzeAssets(uploaded_assets);
      console.log('[ScriptController] 素材分析完成');
    }
    
    // 调用 AI 生成脚本
    const scriptData = await ScriptService.generateScript(
      user_prompt,
      analyzedAssets,
      project_title,
      generation_mode
    );
    
    // 生成项目 ID
    const projectId = `proj_${uuidv4().substring(0, 8)}-${uuidv4().substring(0, 4)}`;
    
    // 计算总时长
    const totalDuration = scriptData.scenes?.reduce(
      (sum, scene) => sum + (scene.estimated_duration || 0), 
      0
    ) || 0;
    
    // 构建响应
    const response = {
      project_id: projectId,
      title: scriptData.title || project_title || 'AI 生成视频',
      scenes: scriptData.scenes || [],
      total_duration: totalDuration
    };
    
    console.log('[ScriptController] 脚本生成成功，共', response.scenes.length, '个分镜');
    
    res.json(response);
    
  } catch (error) {
    console.error('[ScriptController] 生成失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '脚本生成失败'
    });
  }
};

/**
 * 使用 Mock 数据生成脚本（调试用）
 * POST /api/v1/script/generate-mock
 */
export const generateScriptMock = async (req, res) => {
  try {
    const { user_prompt, uploaded_assets = [], project_title } = req.body;
    
    // 验证输入
    if (!user_prompt || !user_prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: '用户提示词不能为空'
      });
    }
    
    console.log('[ScriptController] 使用 Mock 数据生成脚本');
    
    // 生成项目 ID
    const projectId = `proj_${uuidv4().substring(0, 8)}-${uuidv4().substring(0, 4)}`;
    
    // Mock 分镜数据（保持视觉风格一致）
    const mockScenes = [
      {
        scene_id: 1,
        type: 'ai_generated',
        script_content: '欢迎收看本期节目。今天我们将为您带来一段精彩的内容。',
        visual_description: 'professional photography, photorealistic, 专业演播室场景，虚拟主持人面对镜头微笑，背景为动态科技感图形，cinematic lighting, 8k',
        estimated_duration: 4,
        reference_asset_path: null
      },
      {
        scene_id: 2,
        type: uploaded_assets.length > 0 ? 'mixed_media' : 'ai_generated',
        script_content: '接下来，让我们深入了解今天的主题内容。',
        visual_description: 'professional photography, photorealistic, 信息图表动画，数据可视化展示，配合动态转场效果，cinematic lighting, 8k',
        estimated_duration: 5,
        reference_asset_path: uploaded_assets[0]?.file_path || null
      },
      {
        scene_id: 3,
        type: 'ai_generated',
        script_content: '通过以上内容，我们可以看到这个领域正在发生深刻的变化。',
        visual_description: 'professional photography, photorealistic, 分屏展示多个相关画面，数据图表与概念动画结合，cinematic lighting, 8k',
        estimated_duration: 4,
        reference_asset_path: null
      },
      {
        scene_id: 4,
        type: 'ai_generated',
        script_content: '感谢您的观看，我们下期再见！',
        visual_description: 'professional photography, photorealistic, 演播室场景，主持人挥手告别，Logo 动画淡出，cinematic lighting, 8k',
        estimated_duration: 3,
        reference_asset_path: null
      }
    ];
    
    const response = {
      project_id: projectId,
      title: project_title || 'AI 生成视频',
      scenes: mockScenes,
      total_duration: mockScenes.reduce((sum, s) => sum + s.estimated_duration, 0)
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('[ScriptController] Mock 生成失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '脚本生成失败'
    });
  }
};



