import fs from 'fs';
import path from 'path';
import { arkPost } from '../utils/arkClient.js';

/**
 * AssetAnalysisService - 素材分析服务
 *
 * 使用火山方舟的多模态 AI 模型分析用户上传的图片和视频素材
 *
 * 素材用途说明：
 * - 视频素材：分析后作为 mixed_media 类型的实拍分镜使用
 * - 图片素材：分析后作为图生视频（I2V）的参考素材
 *
 * 注意：改用原生 https（arkPost），避免 axios 与 ARK API 兼容性问题导致的 503 空响应。
 */
class AssetAnalysisService {

  // API 配置
  static API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  static MODEL_ID = 'ep-m-20251107114928-w8j8v';

  static cleanDescription(text) {
    return String(text || '').trim().replace(/^[`'""“”]+|[`'""“”]+$/g, '');
  }
  
  /**
   * 分析视频素材
   * @param {string} videoPath - 视频文件路径
   * @returns {Promise<string>} 视频内容描述
   */
  static async analyzeVideo(videoPath) {
    console.log(`🎬 [素材分析] 开始分析视频: ${videoPath}`);
    
    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      throw new Error('缺少环境变量 ARK_API_KEY，请在 .env 文件中配置火山方舟API密钥');
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(videoPath)) {
      throw new Error(`视频文件不存在: ${videoPath}`);
    }
    
    // 读取视频文件并转换为 Base64
    const videoBuffer = fs.readFileSync(videoPath);
    const base64Video = videoBuffer.toString('base64');
    const fileExt = path.extname(videoPath).slice(1).toLowerCase() || 'mp4';
    
    console.log(`📊 [素材分析] 视频文件大小: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    
    // 构建请求体
    const requestBody = {
      model: this.MODEL_ID,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的视频内容分析专家。你的任务是分析实拍视频素材，为后续的脚本编排提供准确的内容描述。

【核心任务】
分析视频内容，描述其场景、人物、动作和氛围，以便AI编剧决定将其编排到脚本的哪个部分。

【分析维度】
1. 场景环境：室内/室外、具体地点、环境特征
2. 主要内容：人物活动、物体、关键动作、核心事件
3. 视觉风格：拍摄角度、运镜方式、光照、色调
4. 情绪氛围：画面传递的情绪和感受
5. 适用场景：这段素材适合用在什么类型的视频中

【输出格式】
用简洁专业的语言描述，格式如下：
"[场景类型]，[主要内容]，[视觉特点]，适合用于[应用场景]"

【示例】
- "办公室会议室场景，多人围坐讨论，光线明亮，专业商务氛围，适合用于企业宣传或商务类视频的会议场景"
- "城市街道实拍，人流车流穿梭，快节奏运镜，繁华都市氛围，适合用于城市生活、节奏感强的视频开场"
- "自然户外场景，阳光明媚，人物进行户外活动，轻松愉悦氛围，适合用于生活方式类视频"

【输出要求】
- 描述长度控制在80-150字
- 全部使用中文
- 重点描述场景特征和适用类型
- 保持描述客观准确
- 只返回描述文本，不要其他说明

【用途说明】
这个视频将作为"实拍分镜"直接插入到最终视频中，AI编剧会根据你的描述决定将其放在脚本的哪个位置。`
        },
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: `data:video/${fileExt};base64,${base64Video}`
              }
            },
            {
              type: 'text',
              text: '请分析这个实拍视频素材的内容，描述其场景、内容和适用场景，以便编排到视频脚本中。'
            }
          ]
        }
      ],
      temperature: 0.5,
      max_tokens: 500
    };
    
    try {
      const result = await arkPost(this.API_URL, requestBody, apiKey, 120000);

      if (!result.choices || !result.choices[0]) {
        throw new Error('API响应格式错误：缺少 choices 字段');
      }

      const description = this.cleanDescription(result.choices[0].message.content);
      console.log(`✅ [素材分析] 视频分析完成: ${description.substring(0, 50)}...`);

      return description;

    } catch (error) {
      console.error(`❌ [素材分析] 视频分析失败:`, error.message);

      if (error.status) {
        if (error.status === 401) throw new Error('API认证失败：请检查 ARK_API_KEY 是否正确');
        if (error.status === 429) throw new Error('API请求频率超限：请稍后再试');
        if (error.status === 503) throw new Error('AI 视觉服务暂时不可用，将跳过素材分析');
      }

      throw error;
    }
  }
  
  /**
   * 分析图片素材
   * @param {string} imagePath - 图片文件路径
   * @returns {Promise<string>} 图片内容描述
   */
  static async analyzeImage(imagePath) {
    console.log(`🖼️ [素材分析] 开始分析图片: ${imagePath}`);
    
    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      throw new Error('缺少环境变量 ARK_API_KEY，请在 .env 文件中配置火山方舟API密钥');
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在: ${imagePath}`);
    }
    
    // 读取图片文件并转换为 Base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const fileExt = path.extname(imagePath).slice(1).toLowerCase() || 'jpeg';
    
    console.log(`📊 [素材分析] 图片文件大小: ${(imageBuffer.length / 1024).toFixed(2)}KB`);
    
    // 构建请求体
    const requestBody = {
      model: this.MODEL_ID,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的AI图生视频提示词专家。你的任务是为图片生成高质量的中文提示词，用于图生视频（Image-to-Video, I2V）功能。

【核心任务】
分析图片内容，直接生成一个适合图生视频的中文提示词。

【提示词要素】
1. 场景主体：清晰描述画面中的核心元素（人物/物体/场景）
2. 动态效果：建议适合的动态变化（镜头移动、物体运动、环境变化）
3. 视觉风格：保持原图的风格特征（真实/艺术/动画等）
4. 氛围情绪：描述画面的情绪和氛围

【输出格式】
直接返回一个中文提示词，格式如下：
"[主体描述]，[动态效果描述]，[风格和氛围]"

【示例】
- 输入：城市夜景图片
  输出："城市夜景，高楼林立，车流穿梭，霓虹灯光闪烁，镜头缓慢推进，展现都市繁华夜色，氛围感十足"

- 输入：自然风景图片
  输出："山间湖泊，湖面波光粼粼，微风吹拂，云雾缭绕山间，镜头从远景推至近景，宁静祥和的自然氛围"

- 输入：人物肖像图片  
  输出："人物特写，表情自然生动，轻微的头部运动，背景虚化效果，柔和的光线勾勒轮廓，温馨的人文氛围"

【输出要求】
- 长度控制在60-100字
- 全部使用中文
- 重点描述适合的动态效果
- 保持描述流畅自然
- 只返回提示词文本，不要其他说明`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/${fileExt};base64,${base64Image}`
              }
            },
            {
              type: 'text',
              text: '请为这张图片生成一个适合图生视频的中文提示词。'
            }
          ]
        }
      ],
      temperature: 0.5,
      max_tokens: 400
    };
    
    try {
      const result = await arkPost(this.API_URL, requestBody, apiKey, 60000);

      if (!result.choices || !result.choices[0]) {
        throw new Error('API响应格式错误：缺少 choices 字段');
      }

      const description = this.cleanDescription(result.choices[0].message.content);
      console.log(`✅ [素材分析] 图片分析完成: ${description.substring(0, 50)}...`);

      return description;

    } catch (error) {
      console.error(`❌ [素材分析] 图片分析失败:`, error.message);

      if (error.status) {
        if (error.status === 401) throw new Error('API认证失败：请检查 ARK_API_KEY 是否正确');
        if (error.status === 429) throw new Error('API请求频率超限：请稍后再试');
        if (error.status === 503) throw new Error('AI 视觉服务暂时不可用，将跳过素材分析');
      }

      throw error;
    }
  }
  
  /**
   * 批量分析素材
   * @param {Array<{file_path: string, file_type: string}>} assets - 素材列表
   * @returns {Promise<Array>} 包含分析结果的素材列表
   */
  static async analyzeAssets(assets) {
    console.log(`📦 [素材分析] 开始批量分析 ${assets.length} 个素材`);
    
    // 使用 Promise.all 并发执行分析
    const analysisPromises = assets.map(async (asset) => {
      try {
        // 解析文件路径（移除 /uploads/ 前缀）
        const relativePath = asset.file_path.replace(/^\/uploads\//, '');
        const fullPath = path.join(process.cwd(), 'uploads', relativePath);
        
        let description;
        
        if (asset.file_type === 'video') {
          description = await this.analyzeVideo(fullPath);
        } else if (asset.file_type === 'image') {
          description = await this.analyzeImage(fullPath);
        } else {
          console.warn(`⚠️ [素材分析] 不支持的文件类型: ${asset.file_type}`);
          description = '未知素材类型';
        }
        
        return {
          ...asset,
          description
        };
        
      } catch (error) {
        console.error(`❌ [素材分析] 素材分析失败: ${asset.file_path}`, error.message);
        
        // 分析失败时，使用降级描述
        return {
          ...asset,
          description: `${asset.file_type === 'video' ? '视频' : '图片'}素材（分析失败：${error.message}）`
        };
      }
    });

    // 等待所有分析完成
    const analyzedAssets = await Promise.all(analysisPromises);
    
    console.log(`✅ [素材分析] 批量分析完成，成功 ${analyzedAssets.filter(a => !a.description.includes('分析失败')).length}/${assets.length} 个`);
    
    return analyzedAssets;
  }
}

export default AssetAnalysisService;
