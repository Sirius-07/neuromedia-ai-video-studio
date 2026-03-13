/**
 * 测试视频分析功能
 * 使用火山引擎对象存储的视频 URL
 */

import axios from 'axios';

const VIDEO_URL = 'https://1926289158.tos-cn-guangzhou.volces.com/a1.mp4';
const API_BASE = 'http://localhost:3000/api/v1/soundtrack';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 延迟函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function analyzeVideo() {
  log('\n' + '='.repeat(80), 'cyan');
  log('🎬 开始测试视频分析系统（带音效分类功能）', 'cyan');
  log('='.repeat(80), 'cyan');
  
  log(`\n📹 视频 URL: ${VIDEO_URL}`, 'blue');
  
  try {
    // 1. 创建配乐任务
    log('\n[步骤 1/4] 创建配乐任务...', 'yellow');
    
    const createResponse = await axios.post(`${API_BASE}/create`, {
      videoId: VIDEO_URL
    });
    
    if (!createResponse.data.success) {
      throw new Error('任务创建失败');
    }
    
    const taskId = createResponse.data.data.taskId;
    log(`✓ 任务已创建，ID: ${taskId}`, 'green');
    
    // 2. 等待任务完成
    log('\n[步骤 2/4] 等待 AI 分析视频（这可能需要 30-120 秒）...', 'yellow');
    
    let attempts = 0;
    const maxAttempts = 60; // 最多等待 5 分钟
    let taskStatus = null;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      await sleep(5000); // 每 5 秒查询一次
      
      const statusResponse = await axios.get(`${API_BASE}/task/${taskId}`);
      taskStatus = statusResponse.data.data;
      
      process.stdout.write(`\r   [${attempts}/${maxAttempts}] 当前状态: ${taskStatus.status}    `);
      
      if (taskStatus.status === 'completed') {
        log('\n✓ 任务完成！', 'green');
        break;
      } else if (taskStatus.status === 'failed') {
        log(`\n✗ 任务失败: ${taskStatus.errorMessage}`, 'red');
        process.exit(1);
      }
    }
    
    if (taskStatus.status !== 'completed') {
      log('\n✗ 任务超时', 'red');
      process.exit(1);
    }
    
    // 3. 解析结果
    log('\n\n[步骤 3/4] 解析分析结果...', 'yellow');
    
    const finalAssetMap = JSON.parse(taskStatus.finalAssetMap);
    
    log('✓ 结果已解析', 'green');
    
    // 4. 展示结果
    log('\n[步骤 4/4] 展示分析结果', 'yellow');
    log('='.repeat(80), 'cyan');
    
    // 背景音乐
    log('\n🎵 背景音乐 (Background Music):', 'magenta');
    log('-'.repeat(80), 'cyan');
    const bgm = finalAssetMap.background_music;
    log(`  提示词 (Prompt): ${bgm.prompt}`, 'blue');
    log(`  情绪 (Mood): ${bgm.mood}`);
    log(`  类型 (Genre): ${bgm.genre}`);
    log(`  时长 (Duration): ${bgm.duration} 秒`);
    log(`  音量 (Volume): ${bgm.volume}`);
    
    // 音效列表
    log('\n🔊 音效列表 (Sound Effects):', 'magenta');
    log('-'.repeat(80), 'cyan');
    
    const soundEffects = finalAssetMap.sound_effects || [];
    
    if (soundEffects.length === 0) {
      log('  ⚠️  未识别到需要添加的音效', 'yellow');
    } else {
      log(`  共识别到 ${soundEffects.length} 个音效节点\n`);
      
      soundEffects.forEach((sfx, index) => {
        log(`  [${index + 1}] ${sfx.timestamp}`, 'cyan');
        log(`      🎯 分类: ${sfx.category || '未分类'}`, 'yellow');
        log(`      📝 描述: ${sfx.description}`);
        log(`      🎼 提示词: ${sfx.prompt}`, 'blue');
        log(`      ⏱️  时长: ${sfx.duration} 秒`);
        log(`      🔉 音量: ${sfx.volume}`);
        log('');
      });
    }
    
    // 统计音效分类
    log('\n📊 音效分类统计:', 'magenta');
    log('-'.repeat(80), 'cyan');
    
    const categoryCount = {};
    soundEffects.forEach(sfx => {
      const category = sfx.category || '未分类';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, 10 - count));
        log(`  ${category.padEnd(15)} ${bar} ${count} 个`, 'green');
      });
    
    // 完整 JSON
    log('\n\n📄 完整 JSON 输出:', 'magenta');
    log('-'.repeat(80), 'cyan');
    console.log(JSON.stringify(finalAssetMap, null, 2));
    
    log('\n' + '='.repeat(80), 'cyan');
    log('✅ 测试完成！新的音效分类功能运行正常', 'green');
    log('='.repeat(80), 'cyan');
    
    // 保存结果到文件
    const fs = await import('fs');
    const outputFile = 'video-analysis-result.json';
    fs.writeFileSync(outputFile, JSON.stringify(finalAssetMap, null, 2));
    log(`\n💾 结果已保存到: ${outputFile}`, 'blue');
    
  } catch (error) {
    log('\n✗ 测试失败', 'red');
    
    if (error.code === 'ECONNREFUSED') {
      log('   错误: 无法连接到服务器', 'red');
      log('   请确保后端服务正在运行: cd backend && npm run dev', 'yellow');
    } else if (error.response) {
      log(`   HTTP 错误: ${error.response.status}`, 'red');
      log(`   消息: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    } else {
      log(`   错误: ${error.message}`, 'red');
      if (error.stack) {
        console.error(error.stack);
      }
    }
    
    process.exit(1);
  }
}

// 运行测试
log('\n⏳ 等待服务器启动...', 'yellow');
setTimeout(() => {
  analyzeVideo();
}, 5000); // 等待 5 秒让服务器启动















