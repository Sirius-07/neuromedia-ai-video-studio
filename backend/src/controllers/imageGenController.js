/**
 * 图片生成控制器 - 火山方舟 Seedream API
 * 处理文生图和图生图请求
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 生成图片（文生图或图生图）
 * POST /api/v1/image-gen/generate
 */
export const generateImage = async (req, res) => {
  try {
    const apiKey = process.env.ARK_API_KEY;
    
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: '服务未配置：缺少 ARK_API_KEY'
      });
    }

    const {
      model = 'doubao-seedream-4-5-251128', // 改用4.5模型（更稳定）
      prompt,
      image, // 单个URL或URL数组（图生图）
      size = '2K',
      seed,
      sequential_image_generation = 'disabled',
      sequential_image_generation_options,
      response_format = 'url',
      watermark = true
    } = req.body;

    console.log('🎨 [图片生成] 收到请求:', {
      model,
      prompt: prompt?.substring(0, 50),
      hasImage: !!image,
      imageCount: Array.isArray(image) ? image.length : (image ? 1 : 0),
      size,
      sequential_image_generation,
      sequential_image_generation_options
    });

    // 验证必填参数
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: prompt'
      });
    }

    // 构建请求体
    const requestBody = {
      model,
      prompt,
      size,
      response_format,
      watermark,
      sequential_image_generation
    };

    // 如果有参考图片（图生图）
    if (image) {
      requestBody.image = image;
    }

    // 如果指定了seed（仅部分模型支持）
    if (seed !== undefined && seed !== -1) {
      requestBody.seed = seed;
    }

    // 如果启用了组图功能
    if (sequential_image_generation === 'auto' && sequential_image_generation_options) {
      requestBody.sequential_image_generation_options = sequential_image_generation_options;
      console.log('✅ [后端] 组图功能已启用:', sequential_image_generation_options);
    } else {
      console.log('⚠️ [后端] 组图功能未启用:', {
        sequential_image_generation,
        has_options: !!sequential_image_generation_options
      });
    }

    console.log('📤 [图片生成] 调用火山方舟API:', {
      url: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      model: requestBody.model,
      hasImage: !!requestBody.image,
      size: requestBody.size,
      sequential_image_generation: requestBody.sequential_image_generation,
      sequential_image_generation_options: requestBody.sequential_image_generation_options
    });

    // 如果是文生图且启用了组图功能，连续调用多次API
    let result;
    if (sequential_image_generation === 'auto' && sequential_image_generation_options?.max_images && !image) {
      const maxImages = sequential_image_generation_options.max_images;
      console.log(`🔄 [图片生成] 由于模型不支持组图，将连续调用${maxImages}次API`);
      
      const allImages = [];
      let totalUsage = {
        generated_images: 0,
        output_tokens: 0,
        total_tokens: 0
      };

      // 移除组图参数，每次生成1张
      const singleRequestBody = { ...requestBody };
      delete singleRequestBody.sequential_image_generation_options;
      
      for (let i = 0; i < maxImages; i++) {
        try {
          console.log(`   [${i + 1}/${maxImages}] 生成第${i + 1}张图片...`);
          
          const response = await axios.post(
            'https://ark.cn-beijing.volces.com/api/v3/images/generations',
            singleRequestBody,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 180000
            }
          );

          const singleResult = response.data;
          if (singleResult.data && singleResult.data.length > 0) {
            allImages.push(...singleResult.data);
            totalUsage.generated_images += singleResult.usage.generated_images;
            totalUsage.output_tokens += singleResult.usage.output_tokens;
            totalUsage.total_tokens += singleResult.usage.total_tokens;
            console.log(`   ✓ 第${i + 1}张图片生成成功`);
          }

          // 避免请求过快，等待500ms
          if (i < maxImages - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`   ✗ 第${i + 1}张图片生成失败:`, error.message);
          // 继续生成下一张
        }
      }

      result = {
        model: requestBody.model,
        created: Math.floor(Date.now() / 1000),
        data: allImages,
        usage: totalUsage
      };

      console.log(`✅ [图片生成] 批量生成完成: ${allImages.length}/${maxImages} 张`);
    } else {
      // 单张图片生成（原有逻辑）
      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 180000 // 3分钟超时
        }
      );

      result = response.data;
    }
    
    console.log('✅ [图片生成] 生成成功:', {
      model: result.model,
      imageCount: result.data?.length || 0,
      usage: result.usage
    });

    // 返回标准格式
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [图片生成] 生成失败:', error.message);
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.error('API错误响应:', {
        status,
        data
      });
      
      if (status === 401) {
        return res.status(401).json({
          success: false,
          error: 'API认证失败：请检查 ARK_API_KEY 是否正确'
        });
      } else if (status === 429) {
        return res.status(429).json({
          success: false,
          error: 'API请求频率超限：请稍后再试'
        });
      } else if (status === 400) {
        return res.status(400).json({
          success: false,
          error: `API请求参数错误: ${data?.error?.message || JSON.stringify(data)}`
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || '图片生成失败'
    });
  }
};

