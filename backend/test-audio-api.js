/**
 * Stable Audio API 测试脚本
 * 用于测试音频生成 API 是否正常工作
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/v1/audio';

// 测试配置
const TEST_CONFIG = {
  prompt: 'Thunder and rain sound effect, ambient weather',
  duration: 3.5
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 延迟函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testAPI() {
  log('\n='.repeat(60), 'cyan');
  log('🧪 开始测试 Stable Audio API', 'cyan');
  log('='.repeat(60), 'cyan');

  try {
    // 1. 测试服务器健康检查
    log('\n[1/5] 测试服务器健康状态...', 'blue');
    const healthResponse = await axios.get('http://localhost:3000/health');
    if (healthResponse.data.status === 'ok') {
      log('✓ 服务器运行正常', 'green');
    }

    // 2. 创建音频生成任务
    log('\n[2/5] 创建音频生成任务...', 'blue');
    log(`   提示词: "${TEST_CONFIG.prompt}"`, 'yellow');
    log(`   时长: ${TEST_CONFIG.duration} 秒`, 'yellow');

    const createResponse = await axios.post(`${API_BASE_URL}/quick-generate`, TEST_CONFIG);
    
    if (!createResponse.data.success) {
      throw new Error('任务创建失败');
    }

    const taskId = createResponse.data.data.taskId;
    log(`✓ 任务已创建: ${taskId}`, 'green');

    // 3. 轮询任务状态
    log('\n[3/5] 等待任务完成（可能需要 1-3 分钟）...', 'blue');
    
    let attempts = 0;
    const maxAttempts = 60; // 最多等待 5 分钟
    let taskStatus = null;

    while (attempts < maxAttempts) {
      attempts++;
      
      const statusResponse = await axios.get(`${API_BASE_URL}/task/${taskId}`);
      taskStatus = statusResponse.data.data;

      if (taskStatus.status === 'completed') {
        log('✓ 任务完成！', 'green');
        break;
      } else if (taskStatus.status === 'failed') {
        log(`✗ 任务失败: ${taskStatus.errorMessage}`, 'red');
        process.exit(1);
      }

      process.stdout.write(`\r   状态: ${taskStatus.status} (尝试 ${attempts}/${maxAttempts})`);
      await sleep(5000); // 等待 5 秒
    }

    if (taskStatus.status !== 'completed') {
      log('\n✗ 任务超时', 'red');
      process.exit(1);
    }

    // 4. 检查输出文件
    log('\n\n[4/5] 检查生成的音频文件...', 'blue');
    log(`   文件 URL: ${taskStatus.outputFileUrl}`, 'yellow');
    log(`   文件路径: ${taskStatus.outputFilePath}`, 'yellow');

    if (taskStatus.outputFileUrl) {
      log('✓ 音频文件已生成', 'green');
    }

    // 5. 获取任务列表
    log('\n[5/5] 获取任务列表...', 'blue');
    const tasksResponse = await axios.get(`${API_BASE_URL}/tasks?limit=5`);
    const tasksCount = tasksResponse.data.data.count;
    log(`✓ 找到 ${tasksCount} 个任务`, 'green');

    // 测试完成
    log('\n' + '='.repeat(60), 'cyan');
    log('✅ 所有测试通过！Stable Audio API 运行正常', 'green');
    log('='.repeat(60), 'cyan');

    log('\n📊 测试结果汇总:', 'cyan');
    log(`   - 任务ID: ${taskId}`);
    log(`   - 提示词: "${TEST_CONFIG.prompt}"`);
    log(`   - 时长: ${TEST_CONFIG.duration} 秒`);
    log(`   - 音频文件: http://localhost:3000${taskStatus.outputFileUrl}`);
    log(`   - 总耗时: ${attempts * 5} 秒`);

    log('\n🎉 你可以通过以下命令下载音频:', 'yellow');
    log(`   curl -O http://localhost:3000${taskStatus.outputFileUrl}\n`);

  } catch (error) {
    log('\n✗ 测试失败', 'red');
    
    if (error.code === 'ECONNREFUSED') {
      log('   错误: 无法连接到服务器', 'red');
      log('   请确保后端服务正在运行: npm run dev', 'yellow');
    } else if (error.response) {
      log(`   HTTP 错误: ${error.response.status}`, 'red');
      log(`   消息: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    } else {
      log(`   错误: ${error.message}`, 'red');
    }
    
    process.exit(1);
  }
}

// 运行测试
testAPI();















