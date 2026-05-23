import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ProjectService - 完整项目管理服务
 * 
 * 管理项目的完整生命周期：
 * 1. 创建项目
 * 2. 分镜编辑
 * 3. 配乐创作
 * 4. 视频导出
 */
class ProjectService {
  
  /**
   * 创建新项目
   * @param {Object} data - 项目数据
   * @returns {Promise<Object>} 创建的项目
   */
  static async createProject(data) {
    const { title, description, userPrompt, settings } = data;
    
    try {
      console.log(`📁 [Project] 创建新项目: ${title || '未命名项目'}`);
      
      const project = await prisma.project.create({
        data: {
          title: title || '未命名项目',
          description: description || null,
          userPrompt: userPrompt || null,
          settings: settings ? JSON.stringify(settings) : null,
          status: 'draft'
        }
      });
      
      console.log(`✅ [Project] 项目已创建: ${project.id}`);
      return this._formatProject(project);
    } catch (error) {
      console.error('❌ [Project] 创建项目失败:', error);
      throw new Error(`创建项目失败: ${error.message}`);
    }
  }
  
  /**
   * 更新项目
   * @param {string} projectId - 项目ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>} 更新后的项目
   */
  static async updateProject(projectId, data) {
    try {
      console.log(`📝 [Project] 更新项目: ${projectId}`);
      
      const updateData = {};
      
      // 基本信息
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.userPrompt !== undefined) updateData.userPrompt = data.userPrompt;
      if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail;
      if (data.status !== undefined) updateData.status = data.status;
      
      // 分镜数据
      if (data.storyboardData !== undefined) {
        updateData.storyboardData = typeof data.storyboardData === 'string' 
          ? data.storyboardData 
          : JSON.stringify(data.storyboardData);
      }
      if (data.totalScenes !== undefined) updateData.totalScenes = data.totalScenes;
      if (data.completedScenes !== undefined) updateData.completedScenes = data.completedScenes;
      
      // 配乐数据
      if (data.soundtrackTaskId !== undefined) updateData.soundtrackTaskId = data.soundtrackTaskId;
      
      // 导出数据
      if (data.roughCutVideoUrl !== undefined) updateData.roughCutVideoUrl = data.roughCutVideoUrl;
      if (data.finalVideoUrl !== undefined) updateData.finalVideoUrl = data.finalVideoUrl;
      
      // 设置
      if (data.settings !== undefined) {
        updateData.settings = typeof data.settings === 'string'
          ? data.settings
          : JSON.stringify(data.settings);
      }
      
      updateData.updatedAt = new Date();
      
      const project = await prisma.project.update({
        where: { id: projectId },
        data: updateData
      });
      
      console.log(`✅ [Project] 项目已更新: ${project.id}`);
      return this._formatProject(project);
    } catch (error) {
      console.error('❌ [Project] 更新项目失败:', error);
      throw new Error(`更新项目失败: ${error.message}`);
    }
  }
  
  /**
   * 保存分镜数据到项目
   * @param {string} projectId - 项目ID
   * @param {Object} storyboardData - 分镜数据
   * @returns {Promise<Object>} 更新后的项目
   */
  static async saveStoryboard(projectId, storyboardData) {
    const {
      scenes,
      title,
      userPrompt,
      uploadedAssets,
      generationMode,
      assetTheme,
      selectedProposal,
      proposalAlternatives,
      publishGoal,
      inputMode,
      aspectRatio,
      artStyle,
      flowVersion,
      creationIntent
    } = storyboardData;
    
    try {
      console.log(`🎬 [Project] 保存分镜数据: ${projectId}`);
      
      const totalScenes = scenes?.length || 0;
      const completedScenes = scenes?.filter(s => s.generationStatus === 'completed').length || 0;
      
      // 自动更新项目状态
      let status = 'draft';
      if (totalScenes > 0 && completedScenes === 0) {
        status = 'storyboard';
      } else if (completedScenes > 0 && completedScenes < totalScenes) {
        status = 'storyboard';
      } else if (completedScenes === totalScenes && totalScenes > 0) {
        status = 'storyboard';  // 分镜完成，但还没有配乐
      }
      
      // 准备更新数据
      const updateData = {
        storyboardData: scenes,
        totalScenes,
        completedScenes,
        status,
        title: title || undefined
      };
      
      // 保存生成参数
      if (userPrompt !== undefined) {
        updateData.userPrompt = userPrompt;
      }
      
      // 将工作台创建上下文保存到 settings，确保刷新后可恢复
      if (
        uploadedAssets !== undefined ||
        generationMode !== undefined ||
        assetTheme !== undefined ||
        selectedProposal !== undefined ||
        proposalAlternatives !== undefined ||
        publishGoal !== undefined ||
        inputMode !== undefined ||
        aspectRatio !== undefined ||
        artStyle !== undefined ||
        flowVersion !== undefined ||
        creationIntent !== undefined
      ) {
        // 先读取现有的 settings
        const currentProject = await prisma.project.findUnique({
          where: { id: projectId },
          select: { settings: true }
        });
        
        let settings = {};
        if (currentProject?.settings) {
          try {
            settings = JSON.parse(currentProject.settings);
          } catch (e) {
            console.warn('[Project] 解析现有 settings 失败，使用空对象');
          }
        }
        
        // 更新生成参数
        if (uploadedAssets !== undefined) {
          settings.uploadedAssets = uploadedAssets;
        }
        if (generationMode !== undefined) {
          settings.generationMode = generationMode;
        }
        if (assetTheme !== undefined) {
          settings.assetTheme = assetTheme;
        }
        if (selectedProposal !== undefined) {
          settings.selectedProposal = selectedProposal;
          settings.inspirationProposal = selectedProposal;
        }
        if (proposalAlternatives !== undefined) {
          settings.proposalAlternatives = proposalAlternatives;
        }
        if (publishGoal !== undefined) {
          settings.publishGoal = publishGoal;
        }
        if (inputMode !== undefined) {
          settings.inputMode = inputMode;
        }
        if (aspectRatio !== undefined) {
          settings.aspectRatio = aspectRatio;
        }
        if (artStyle !== undefined) {
          settings.artStyle = artStyle;
        }
        if (flowVersion !== undefined) {
          settings.flowVersion = flowVersion;
        }
        if (creationIntent !== undefined) {
          settings.creationIntent = creationIntent;
        }
        settings.currentPage = 'storyboard';
        
        updateData.settings = JSON.stringify(settings);
      }
      
      return await this.updateProject(projectId, updateData);
    } catch (error) {
      console.error('❌ [Project] 保存分镜数据失败:', error);
      throw new Error(`保存分镜数据失败: ${error.message}`);
    }
  }
  
  /**
   * 关联配乐任务到项目
   * @param {string} projectId - 项目ID
   * @param {string} soundtrackTaskId - 配乐任务ID
   * @returns {Promise<Object>} 更新后的项目
   */
  static async linkSoundtrackTask(projectId, soundtrackTaskId) {
    try {
      console.log(`🎵 [Project] 关联配乐任务: ${projectId} -> ${soundtrackTaskId}`);
      
      return await this.updateProject(projectId, {
        soundtrackTaskId,
        status: 'soundtrack'
      });
    } catch (error) {
      console.error('❌ [Project] 关联配乐任务失败:', error);
      throw new Error(`关联配乐任务失败: ${error.message}`);
    }
  }
  
  /**
   * 保存导出的视频URL到项目
   * @param {string} projectId - 项目ID
   * @param {Object} videoData - 视频数据
   * @returns {Promise<Object>} 更新后的项目
   */
  static async saveExportedVideo(projectId, videoData) {
    const { roughCutVideoUrl, finalVideoUrl } = videoData;
    
    try {
      console.log(`📹 [Project] 保存导出视频: ${projectId}`);
      
      const updateData = {};
      if (roughCutVideoUrl) updateData.roughCutVideoUrl = roughCutVideoUrl;
      if (finalVideoUrl) {
        updateData.finalVideoUrl = finalVideoUrl;
        updateData.status = 'completed';  // 最终视频完成
      }
      
      return await this.updateProject(projectId, updateData);
    } catch (error) {
      console.error('❌ [Project] 保存导出视频失败:', error);
      throw new Error(`保存导出视频失败: ${error.message}`);
    }
  }
  
  /**
   * 获取项目详情（包含关联的配乐任务）
   * @param {string} projectId - 项目ID
   * @returns {Promise<Object>} 项目详情
   */
  static async getProject(projectId) {
    try {
      console.log(`📖 [Project] 读取项目: ${projectId}`);
      
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      });
      
      if (!project) {
        throw new Error('项目不存在');
      }
      
      // 如果有关联的配乐任务，一起查询
      let soundtrackTask = null;
      if (project.soundtrackTaskId) {
        try {
          soundtrackTask = await prisma.soundtrackTask.findUnique({
            where: { id: project.soundtrackTaskId }
          });
        } catch (err) {
          console.warn('⚠️ [Project] 配乐任务不存在或已删除');
        }
      }
      
      console.log(`✅ [Project] 项目读取成功: ${project.title}`);
      
      const formattedProject = this._formatProject(project);
      if (soundtrackTask) {
        formattedProject.soundtrackTask = {
          id: soundtrackTask.id,
          status: soundtrackTask.status,
          finalAssetMap: soundtrackTask.finalAssetMap ? JSON.parse(soundtrackTask.finalAssetMap) : null
        };
      }
      
      return formattedProject;
    } catch (error) {
      console.error('❌ [Project] 读取项目失败:', error);
      throw new Error(`读取项目失败: ${error.message}`);
    }
  }
  
  /**
   * 获取项目列表（最近的项目）
   * @param {number} limit - 返回数量限制
   * @returns {Promise<Array>} 项目列表
   */
  static async getRecentProjects(limit = 20) {
    try {
      console.log(`📚 [Project] 获取最近的 ${limit} 个项目`);
      
      const projects = await prisma.project.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit
      });
      
      console.log(`✅ [Project] 找到 ${projects.length} 个项目`);
      
      return projects.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        thumbnail: p.thumbnail,
        status: p.status,
        totalScenes: p.totalScenes,
        completedScenes: p.completedScenes,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));
    } catch (error) {
      console.error('❌ [Project] 获取项目列表失败:', error);
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
      console.log(`🗑️ [Project] 删除项目: ${projectId}`);
      
      await prisma.project.delete({
        where: { id: projectId }
      });
      
      console.log(`✅ [Project] 项目已删除`);
    } catch (error) {
      console.error('❌ [Project] 删除项目失败:', error);
      throw new Error(`删除项目失败: ${error.message}`);
    }
  }
  
  /**
   * 格式化项目数据
   * @private
   */
  static _formatProject(project) {
    // 解析 settings
    const settings = project.settings ? JSON.parse(project.settings) : null;
    
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      userPrompt: project.userPrompt,
      thumbnail: project.thumbnail,
      status: project.status,
      
      // 生成参数（从 settings 中提取）
      uploadedAssets: settings?.uploadedAssets || null,
      generationMode: settings?.generationMode || null,
      
      // 分镜数据
      storyboardData: project.storyboardData ? JSON.parse(project.storyboardData) : null,
      totalScenes: project.totalScenes,
      completedScenes: project.completedScenes,
      
      // 配乐数据
      soundtrackTaskId: project.soundtrackTaskId,
      
      // 导出数据
      roughCutVideoUrl: project.roughCutVideoUrl,
      finalVideoUrl: project.finalVideoUrl,
      
      // 设置
      settings: settings,
      
      // 时间
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      lastModified: project.updatedAt.toISOString()
    };
  }
}

export default ProjectService;

