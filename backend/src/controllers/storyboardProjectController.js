import StoryboardProjectService from '../services/StoryboardProjectService.js';

/**
 * 保存或更新分镜项目
 * POST /api/v1/storyboard/project/save
 */
export const saveProject = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('💾 [API] 保存分镜项目');
  console.log('='.repeat(80));
  
  try {
    const projectData = req.body;
    
    // 验证必填字段
    if (!projectData.title && !projectData.scenes) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: title 或 scenes'
      });
    }
    
    const savedProject = await StoryboardProjectService.saveProject(projectData);
    
    res.json({
      success: true,
      data: savedProject,
      message: '项目保存成功'
    });
  } catch (error) {
    console.error('❌ [API] 保存项目失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 获取项目详情
 * GET /api/v1/storyboard/project/:projectId
 */
export const getProject = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📖 [API] 获取分镜项目');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId'
      });
    }
    
    const project = await StoryboardProjectService.getProject(projectId);
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('❌ [API] 获取项目失败:', error);
    
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
 * GET /api/v1/storyboard/projects/recent
 */
export const getRecentProjects = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📚 [API] 获取最近项目列表');
  console.log('='.repeat(80));
  
  try {
    const limit = parseInt(req.query.limit) || 10;
    const projects = await StoryboardProjectService.getRecentProjects(limit);
    
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
 * DELETE /api/v1/storyboard/project/:projectId
 */
export const deleteProject = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('🗑️ [API] 删除分镜项目');
  console.log('='.repeat(80));
  
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: projectId'
      });
    }
    
    await StoryboardProjectService.deleteProject(projectId);
    
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

