import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ComfyUI 服务
 * 用于调用ComfyUI的工作流，特别是wan2.2首尾帧生成视频
 */
class ComfyUIService {
  // ComfyUI API 配置
  static COMFYUI_API_URL = 'http://localhost:8188';
  
  // 工作流配置文件路径
  static WORKFLOW_PATH = path.join(__dirname, '../../../video_wan2_2_14B_i2v (2).json');
    
  // ComfyUI输入目录
  static COMFYUI_INPUT_DIR = 'F:/ComfyUI_windows_portable/ComfyUI/input';
  
  // ComfyUI输出目录
  static COMFYUI_OUTPUT_DIR = 'F:/ComfyUI_windows_portable/ComfyUI/output';

  /**
   * 生成首尾帧转场视频
   * @param {Object} params - 转场参数
   * @param {string} params.firstFrameUrl - 首帧图片URL（base64或URL）
   * @param {string} params.lastFrameUrl - 尾帧图片URL（base64或URL）
   * @param {string} params.prompt - 提示词
   * @param {string} params.negativePrompt - 负面提示词
   * @param {number} params.duration - 视频时长（秒）
   * @param {number} params.width - 视频宽度
   * @param {number} params.height - 视频高度
   * @returns {Promise<{videoUrl: string}>}
   */
  static async generateTransitionVideo({
    firstFrameUrl,
    lastFrameUrl,
    prompt,
    negativePrompt,
    duration = 2,
    width = 640,
    height = 640,
  }) {
    try {
      console.log('[ComfyUI Service] 开始生成转场视频...');

      // 1. 保存首帧图片到ComfyUI input目录
      const firstFrameFilename = `transition_first_${Date.now()}.jpg`;
      await this.saveImageToComfyUI(firstFrameUrl, firstFrameFilename);
      console.log('[ComfyUI Service] 首帧已保存:', firstFrameFilename);

      // 2. 读取工作流配置
      const workflowConfig = await this.loadWorkflowConfig();
      console.log('[ComfyUI Service] 工作流配置已加载');

      // 3. 修改工作流配置
      this.updateWorkflowConfig(workflowConfig, {
        firstFrameFilename,
        prompt,
        negativePrompt,
        width,
        height,
        duration,
      });
      console.log('[ComfyUI Service] 工作流配置已更新');

      // 4. 调用ComfyUI API执行工作流
      const promptId = await this.queuePrompt(workflowConfig);
      console.log('[ComfyUI Service] 工作流已加入队列，Prompt ID:', promptId);

      // 5. 等待生成完成
      const videoFilename = await this.waitForCompletion(promptId);
      console.log('[ComfyUI Service] 视频生成完成:', videoFilename);

      // 6. 返回视频URL
      const videoUrl = `http://localhost:4300/comfyui/output/${videoFilename}`;
      return { videoUrl };
    } catch (error) {
      console.error('[ComfyUI Service] 生成失败:', error);
      throw new Error(`ComfyUI生成失败: ${error.message}`);
    }
  }

  /**
   * 保存图片到ComfyUI input目录
   * @param {string} imageUrl - 图片URL或base64
   * @param {string} filename - 文件名
   */
  static async saveImageToComfyUI(imageUrl, filename) {
    try {
      let imageBuffer;

      if (imageUrl.startsWith('data:image/')) {
        // Base64图片
        const base64Data = imageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // URL图片
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
        });
        imageBuffer = Buffer.from(response.data);
      }

      const filePath = path.join(this.COMFYUI_INPUT_DIR, filename);
      await fs.writeFile(filePath, imageBuffer);
      console.log('[ComfyUI Service] 图片已保存:', filePath);
    } catch (error) {
      console.error('[ComfyUI Service] 保存图片失败:', error);
      throw new Error(`保存图片失败: ${error.message}`);
    }
  }

  /**
   * 加载工作流配置
   */
  static async loadWorkflowConfig() {
    try {
      const configData = await fs.readFile(this.WORKFLOW_PATH, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('[ComfyUI Service] 加载工作流配置失败:', error);
      throw new Error(`加载工作流配置失败: ${error.message}`);
    }
  }

  /**
   * 更新工作流配置
   * @param {Object} config - 工作流配置对象
   * @param {Object} params - 更新参数
   */
  static updateWorkflowConfig(config, params) {
    const {
      firstFrameFilename,
      prompt,
      negativePrompt,
      width,
      height,
      duration,
    } = params;

    // 更新图片加载节点（节点62）
    if (config['62']) {
      config['62'].inputs.image = firstFrameFilename;
    }

    // 更新正面提示词（节点6）
    if (config['6']) {
      config['6'].inputs.text = prompt || 'smooth transition between scenes';
    }

    // 更新负面提示词（节点7）
    if (config['7'] && negativePrompt) {
      config['7'].inputs.text = negativePrompt;
    }

    // 更新图像到视频配置（节点63）
    if (config['63']) {
      config['63'].inputs.width = width;
      config['63'].inputs.height = height;
      // 计算帧数：duration(秒) * fps(16) + 1
      config['63'].inputs.length = Math.floor(duration * 16) + 1;
          }

    // 更新视频创建节点（节点109）
    if (config['109']) {
      config['109'].inputs.fps = 16; // 保持16fps
      }

    // 生成随机种子
    if (config['57']) {
      config['57'].inputs.noise_seed = Math.floor(Math.random() * 1000000000000000);
    }
  }

  /**
   * 将工作流加入ComfyUI队列
   * @param {Object} workflow - 工作流配置
   * @returns {Promise<string>} Prompt ID
   */
  static async queuePrompt(workflow) {
    try {
      const response = await axios.post(`${this.COMFYUI_API_URL}/prompt`, {
        prompt: workflow,
      });

      if (response.data && response.data.prompt_id) {
        return response.data.prompt_id;
      } else {
        throw new Error('未能获取Prompt ID');
      }
    } catch (error) {
      console.error('[ComfyUI Service] 加入队列失败:', error);
      throw new Error(`加入队列失败: ${error.message}`);
    }
  }

  /**
   * 等待生成完成
   * @param {string} promptId - Prompt ID
   * @returns {Promise<string>} 视频文件名
   */
  static async waitForCompletion(promptId) {
    console.log('[ComfyUI Service] 等待生成完成...');
    
    // 轮询历史记录
    const maxAttempts = 120; // 最多等待2分钟（120次 * 1秒）
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${this.COMFYUI_API_URL}/history/${promptId}`);
        const history = response.data[promptId];
          
        if (history && history.status && history.status.completed) {
          console.log('[ComfyUI Service] 生成完成！');
          
          // 从输出中提取视频文件名
          const outputs = history.outputs;
          
          // 查找保存视频节点的输出（节点61）
          if (outputs['61'] && outputs['61'].gifs && outputs['61'].gifs.length > 0) {
            const videoInfo = outputs['61'].gifs[0];
            return videoInfo.filename;
          }

          throw new Error('未能从输出中找到视频文件');
        }

        // 检查是否有错误
        if (history && history.status && history.status.status_str === 'error') {
          throw new Error('ComfyUI生成出错');
        }

        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        if (attempts % 10 === 0) {
          console.log(`[ComfyUI Service] 已等待 ${attempts} 秒...`);
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // 历史记录还不存在，继续等待
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          continue;
        }
        throw error;
        }
    }

    throw new Error('等待超时，生成可能失败');
    }
  }

export default ComfyUIService;
