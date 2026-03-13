import ProjectService from '../services/ProjectService.js';

/**
 * 创建新项目
 * POST /api/v1/project/create
 */
export const createProject = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📁 [API] 创建新项目');
  console.log('='.repeat(80));
  
  try {
    const { title, description, userPrompt, settings } = req.body;
    
    const project = await ProjectService.createProject({
      title,
      description,
      userPrompt,
      settings
    });
    
    res.json({
      success: true,
      data: project,
      message: '项目创建成功'
    });
  } catch (error) {
    console.error('❌ [API] 创建项目失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 更新项目
 * PUT /api/v1/project/:projectId
 */
export const updateProject = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📝 [API] 更新项目');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    const updateData = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId'
      });
    }
    
    const project = await ProjectService.updateProject(projectId, updateData);
    
    res.json({
      success: true,
      data: project,
      message: '项目更新成功'
    });
  } catch (error) {
    console.error('❌ [API] 更新项目失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 保存分镜数据
 * POST /api/v1/project/:projectId/storyboard
 */
export const saveStoryboard = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('🎬 [API] 保存分镜数据');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    const storyboardData = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId'
      });
    }
    
    const project = await ProjectService.saveStoryboard(projectId, storyboardData);
    
    res.json({
      success: true,
      data: project,
      message: '分镜数据保存成功'
    });
  } catch (error) {
    console.error('❌ [API] 保存分镜数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 关联配乐任务
 * POST /api/v1/project/:projectId/soundtrack
 */
export const linkSoundtrackTask = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('🎵 [API] 关联配乐任务');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    const { soundtrackTaskId } = req.body;
    
    if (!projectId || !soundtrackTaskId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId 或 soundtrackTaskId'
      });
    }
    
    const project = await ProjectService.linkSoundtrackTask(projectId, soundtrackTaskId);
    
    res.json({
      success: true,
      data: project,
      message: '配乐任务关联成功'
    });
  } catch (error) {
    console.error('❌ [API] 关联配乐任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 保存导出视频
 * POST /api/v1/project/:projectId/export
 */
export const saveExportedVideo = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📹 [API] 保存导出视频');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    const { roughCutVideoUrl, finalVideoUrl } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId'
      });
    }
    
    const project = await ProjectService.saveExportedVideo(projectId, {
      roughCutVideoUrl,
      finalVideoUrl
    });
    
    res.json({
      success: true,
      data: project,
      message: '导出视频保存成功'
    });
  } catch (error) {
    console.error('❌ [API] 保存导出视频失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 获取项目详情
 * GET /api/v1/project/:projectId
 */
export const getProject = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📖 [API] 获取项目详情');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId'
      });
    }
    
    const project = await ProjectService.getProject(projectId);
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('❌ [API] 获取项目详情失败:', error);
    
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

/**
 * 获取最近的项目列表
 * GET /api/v1/project/list/recent
 */
export const getRecentProjects = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📚 [API] 获取最近项目列表');
  console.log('='.repeat(80));
  
  try {
    const limit = parseInt(req.query.limit) || 20;
    const projects = await ProjectService.getRecentProjects(limit);
    
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('❌ [API] 获取项目列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 删除项目
 * DELETE /api/v1/project/:projectId
 */
export const deleteProject = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('🗑️ [API] 删除项目');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId'
      });
    }
    
    await ProjectService.deleteProject(projectId);
    
    res.json({
      success: true,
      message: '项目删除成功'
    });
  } catch (error) {
    console.error('❌ [API] 删除项目失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

