/**
 * 即梦 3.0 首尾帧视频生成测试脚本
 */

import axios from 'axios';

const API_URL = 'http://localhost:4300/api/v1/image';

async function testFirstTailVideo() {
  console.log('🧪 测试即梦 3.0 首尾帧视频生成...\n');

  try {
    // 测试参数
    const testParams = {
      model: 'jimeng-first-tail',
      firstImageUrl: 'https://picsum.photos/1280/720',  // 首帧图片
      lastImageUrl: 'https://picsum.photos/1280/720',   // 尾帧图片（需要相同比例）
      prompt: '场景从白天过渡到黄昏，天空颜色逐渐变化，云朵缓缓移动',
      frames: 121,  // 5秒
      seed: -1
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
      console.log('- Request ID:', response.data.data.requestId);
      console.log('- AIGC Meta Tagged:', response.data.data.aigcMetaTagged);
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
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('无响应，请检查:');
      console.error('1. 后端服务是否运行 (http://localhost:4300)');
      console.error('2. 火山引擎 AK/SK 是否配置正确');
    } else {
      console.error('错误:', error.message);
    }
  }
}

async function testFirstFrameVideo() {
  console.log('🧪 测试即梦 3.0 首帧 720P 视频生成...\n');

  try {
    const testParams = {
      model: 'jimeng-first',
      imageUrl: 'https://picsum.photos/1280/720',
      prompt: '镜头缓慢推进，展现场景细节，光影变化',  // 必填
      frames: 121,
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
      console.log('- AIGC Meta Tagged:', response.data.data.aigcMetaTagged);
    } else {
      console.error('❌ 测试失败:', response.data.error);
    }

  } catch (error) {
    console.error('❌ 测试出错:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误:', error.message);
    }
  }
}

async function testProVideo() {
  console.log('🧪 测试即梦 3.0 Pro 视频生成...\n');

  try {
    const testParams = {
      model: 'jimeng-pro',
      imageUrl: 'https://picsum.photos/1280/720',
      prompt: '镜头缓慢推进，展现细节',
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
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误:', error.message);
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'first';

  console.log('═══════════════════════════════════════════════');
  console.log('   即梦多模型视频生成测试');
  console.log('═══════════════════════════════════════════════\n');

  if (testType === 'first-tail') {
    await testFirstTailVideo();
  } else if (testType === 'first') {
    await testFirstFrameVideo();
  } else if (testType === 'pro') {
    await testProVideo();
  } else if (testType === 'all') {
    await testProVideo();
    console.log('\n');
    await testFirstFrameVideo();
    console.log('\n');
    await testFirstTailVideo();
  } else {
    console.log('用法: node test-jimeng-first-tail.js [pro|first|first-tail|all]');
    console.log('');
    console.log('示例:');
    console.log('  node test-jimeng-first-tail.js pro         # 测试 Pro 模型');
    console.log('  node test-jimeng-first-tail.js first       # 测试首帧720P模型');
    console.log('  node test-jimeng-first-tail.js first-tail  # 测试首尾帧模型');
    console.log('  node test-jimeng-first-tail.js all         # 测试所有模型');
  }
}

main();

