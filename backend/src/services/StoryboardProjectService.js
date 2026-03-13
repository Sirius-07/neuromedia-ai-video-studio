import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * StoryboardProjectService - 分镜项目持久化服务
 * 
 * 负责将分镜项目数据保存到数据库，解决 localStorage 不可靠的问题
 */
class StoryboardProjectService {
  
  /**
   * 保存或更新分镜项目
   * @param {Object} projectData - 项目数据
   * @returns {Promise<Object>} 保存后的项目
   */
  static async saveProject(projectData) {
    const { projectId, title, userPrompt, scenes } = projectData;
    
    try {
      console.log(`💾 [StoryboardProject] 保存项目: ${title || '未命名项目'}`);
      
      // 计算项目统计
      const totalScenes = scenes?.length || 0;
      const completedScenes = scenes?.filter(s => s.generationStatus === 'completed').length || 0;
      
      // 判断项目状态
      let status = 'draft';
      if (completedScenes > 0 && completedScenes < totalScenes) {
        status = 'in_progress';
      } else if (completedScenes === totalScenes && totalScenes > 0) {
        status = 'completed';
      }
      
      // 如果有 projectId，则更新；否则创建新项目
      if (projectId && projectId !== 'local_project') {
        const project = await prisma.storyboardProject.update({
          where: { id: projectId },
          data: {
            title: title || '未命名项目',
            userPrompt: userPrompt || null,
            scenesData: JSON.stringify(scenes),
            totalScenes,
            completedScenes,
            status,
            updatedAt: new Date()
          }
        });
        
        console.log(`✅ [StoryboardProject] 项目已更新: ${project.id}`);
        return this._formatProject(project);
      } else {
        const project = await prisma.storyboardProject.create({
          data: {
            title: title || '未命名项目',
            userPrompt: userPrompt || null,
            scenesData: JSON.stringify(scenes),
            totalScenes,
            completedScenes,
            status
          }
        });
        
        console.log(`✅ [StoryboardProject] 新项目已创建: ${project.id}`);
        return this._formatProject(project);
      }
    } catch (error) {
      console.error('❌ [StoryboardProject] 保存项目失败:', error);
      throw new Error(`保存项目失败: ${error.message}`);
    }
  }
  
  /**
   * 根据 ID 获取项目
   * @param {string} projectId - 项目ID
   * @returns {Promise<Object>} 项目数据
   */
  static async getProject(projectId) {
    try {
      console.log(`📖 [StoryboardProject] 读取项目: ${projectId}`);
      
      const project = await prisma.storyboardProject.findUnique({
        where: { id: projectId }
      });
      
      if (!project) {
        throw new Error('项目不存在');
      }
      
      console.log(`✅ [StoryboardProject] 项目读取成功: ${project.title}`);
      return this._formatProject(project);
    } catch (error) {
      console.error('❌ [StoryboardProject] 读取项目失败:', error);
      throw new Error(`读取项目失败: ${error.message}`);
    }
  }
  
  /**
   * 获取项目列表（最近的项目）
   * @param {number} limit - 返回数量限制
   * @returns {Promise<Array>} 项目列表
   */
  static async getRecentProjects(limit = 10) {
    try {
      console.log(`📚 [StoryboardProject] 获取最近的 ${limit} 个项目`);
      
      const projects = await prisma.storyboardProject.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit
      });
      
      console.log(`✅ [StoryboardProject] 找到 ${projects.length} 个项目`);
      
      return projects.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        totalScenes: p.totalScenes,
        completedScenes: p.completedScenes,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));
    } catch (error) {
      console.error('❌ [StoryboardProject] 获取项目列表失败:', error);
      throw new Error(`获取项目列表失败: ${error.message}`);
    }
  }
  
  /**
   * 删除项目
   * @param {string} projectId - 项目ID
   * @returns {Promise<void>}
   */
  static async deleteProject(projectId) {
    try {
      console.log(`🗑️ [StoryboardProject] 删除项目: ${projectId}`);
      
      await prisma.storyboardProject.delete({
        where: { id: projectId }
      });
      
      console.log(`✅ [StoryboardProject] 项目已删除`);
    } catch (error) {
      console.error('❌ [StoryboardProject] 删除项目失败:', error);
      throw new Error(`删除项目失败: ${error.message}`);
    }
  }
  
  /**
   * 格式化项目数据
   * @private
   */
  static _formatProject(project) {
    return {
      projectId: project.id,
      title: project.title,
      userPrompt: project.userPrompt,
      scenes: JSON.parse(project.scenesData),
      totalScenes: project.totalScenes,
      completedScenes: project.completedScenes,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      lastModified: project.updatedAt.toISOString()
    };
  }
}

export default StoryboardProjectService;

