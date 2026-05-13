/**
 * ComfyUI 图生视频测试脚本
 * 用于测试 wan2.2 模型的图生视频功能
 */

import axios from 'axios';

const API_URL = 'http://localhost:4300/api/v1/image';

async function testComfyUIImageToVideo() {
  console.log('🧪 测试 ComfyUI wan2.2 图生视频...\n');

  try {
    // 测试参数
    const testParams = {
      imageUrl: 'https://picsum.photos/640/640',  // 使用随机测试图片
      prompt: 'The character slowly turns their head, eyes full of determination and strength. The camera gently moves closer, highlighting the powerful presence.',
      model: 'wan2.2',
      frames: 81,
      width: 640,
      height: 640,
      fps: 16,
      seed: -1,
      negativePrompt: '色调艳丽，过曝，静态，细节模糊不清，字幕，最差质量，低质量'
    };

    console.log('📤 发送请求...');
    console.log('参数:', JSON.stringify(testParams, null, 2));
    console.log('');

    const startTime = Date.now();

    const response = await axios.post(`${API_URL}/image-to-video`, testParams, {
      timeout: 600000  // 10分钟超时
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (response.data.success) {
      console.log('✅ 测试成功！');
      console.log('耗时:', duration, '秒');
      console.log('');
      console.log('结果:');
      console.log('- Task ID:', response.data.data.taskId);
      console.log('- Video URL:', response.data.data.videoUrl);
      console.log('- Model:', response.data.data.model);
      console.log('');
      console.log('🎬 视频已生成，可以通过以下 URL 访问:');
      console.log(response.data.data.videoUrl);
    } else {
      console.error('❌ 测试失败:', response.data.error);
    }

  } catch (error) {
    console.error('❌ 测试出错:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else if (error.request) {
      console.error('无响应，请检查:');
      console.error('1. 后端服务是否运行 (http://localhost:4300)');
      console.error('2. ComfyUI 是否运行 (http://127.0.0.1:8188)');
      console.error('3. COMFYUI_API_URL 环境变量是否正确');
    } else {
      console.error('错误:', error.message);
    }
  }
}

async function testJimengImageToVideo() {
  console.log('🧪 测试即梦 API 图生视频...\n');

  try {
    const testParams = {
      imageUrl: 'https://picsum.photos/640/640',
      prompt: '一个人在跑步',
      model: 'jimeng',
      frames: 121,
      aspectRatio: '16:9',
      seed: -1
    };

    console.log('📤 发送请求...');
    console.log('参数:', JSON.stringify(testParams, null, 2));
    console.log('');

    const startTime = Date.now();

    const response = await axios.post(`${API_URL}/image-to-video`, testParams, {
      timeout: 600000
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (response.data.success) {
      console.log('✅ 测试成功！');
      console.log('耗时:', duration, '秒');
      console.log('');
      console.log('结果:');
      console.log('- Task ID:', response.data.data.taskId);
      console.log('- Video URL:', response.data.data.videoUrl);
      console.log('- Model:', response.data.data.model);
      console.log('- Request ID:', response.data.data.requestId);
    } else {
      console.error('❌ 测试失败:', response.data.error);
    }

  } catch (error) {
    console.error('❌ 测试出错:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'comfyui';

  console.log('═══════════════════════════════════════════════');
  console.log('   ComfyUI 图生视频集成测试');
  console.log('═══════════════════════════════════════════════\n');

  if (testType === 'comfyui' || testType === 'wan2.2') {
    await testComfyUIImageToVideo();
  } else if (testType === 'jimeng') {
    await testJimengImageToVideo();
  } else if (testType === 'both') {
    await testJimengImageToVideo();
    console.log('\n');
    await testComfyUIImageToVideo();
  } else {
    console.log('用法: node test-comfyui-i2v.js [comfyui|jimeng|both]');
    console.log('');
    console.log('示例:');
    console.log('  node test-comfyui-i2v.js comfyui  # 测试 ComfyUI wan2.2');
    console.log('  node test-comfyui-i2v.js jimeng   # 测试即梦 API');
    console.log('  node test-comfyui-i2v.js both     # 测试两者');
  }
}

main();





