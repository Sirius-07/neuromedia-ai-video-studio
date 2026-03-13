/**
 * 实际测试火山方舟视频分析
 * 测试新的系统提示词和音效分类功能
 */

import axios from 'axios';
import fs from 'fs';

const VIDEO_URL = 'https://1926289158.tos-cn-guangzhou.volces.com/a1.mp4';
const API_BASE = 'http://localhost:3000/api/v1/soundtrack';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testVideoAnalysis() {
  log('\n' + '='.repeat(100), 'cyan');
  log('🎬 火山方舟视频分析实测 - 测试新的系统提示词和音效分类', 'bright');
  log('='.repeat(100), 'cyan');
  
  log(`\n📹 测试视频: ${VIDEO_URL}`, 'blue');
  log(`🔗 API 地址: ${API_BASE}\n`, 'blue');
  
  try {
    // 步骤 1: 创建分析任务
    log('[步骤 1/4] 创建分析任务...', 'yellow');
    
    const createRes = await axios.post(`${API_BASE}/create`, {
      videoId: VIDEO_URL
    });
    
    if (!createRes.data.success) {
      throw new Error('任务创建失败');
    }
    
    const taskId = createRes.data.data.taskId;
    log(`✓ 任务创建成功`, 'green');
    log(`  任务ID: ${taskId}`, 'cyan');
    
    // 步骤 2: 等待分析完成
    log('\n[步骤 2/4] 等待火山方舟 AI 分析视频...', 'yellow');
    log('  这可能需要 30-120 秒，取决于视频长度和内容复杂度', 'cyan');
    
    let attempts = 0;
    const maxAttempts = 60; // 最多等待 5 分钟
    let finalTask = null;
    
    process.stdout.write('\n  ');
    
    while (attempts < maxAttempts) {
      attempts++;
      await sleep(5000); // 每 5 秒查询一次
      
      const statusRes = await axios.get(`${API_BASE}/status/${taskId}`);
      const task = statusRes.data.data;
      
      // 显示进度条
      const progress = Math.floor((attempts / maxAttempts) * 20);
      const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);
      process.stdout.write(`\r  进度: [${bar}] ${task.status} (${attempts * 5}秒)    `);
      
      if (task.status === 'completed') {
        finalTask = task;
        log('\n\n✓ 分析完成！', 'green');
        break;
      }
      
      if (task.status === 'failed') {
        log(`\n\n✗ 分析失败: ${task.errorMessage}`, 'red');
        return;
      }
    }
    
    if (!finalTask) {
      log('\n\n✗ 分析超时（超过5分钟）', 'red');
      return;
    }
    
    // 步骤 3: 解析结果
    log('\n[步骤 3/4] 解析分析结果...', 'yellow');
    
    const result = JSON.parse(finalTask.finalAssetMap);
    log('✓ 结果已解析', 'green');
    
    // 步骤 4: 展示结果
    log('\n[步骤 4/4] 展示分析结果', 'yellow');
    log('='.repeat(100), 'cyan');
    
    // 背景音乐
    log('\n🎵 背景音乐 (Background Music)', 'magenta');
    log('─'.repeat(100), 'cyan');
    const bgm = result.background_music;
    log(`  📝 提示词 (Prompt):`, 'cyan');
    log(`     ${bgm.prompt}`, 'blue');
    log(`  😊 情绪 (Mood): ${bgm.mood}`);
    log(`  🎸 类型 (Genre): ${bgm.genre}`);
    log(`  ⏱️  时长 (Duration): ${bgm.duration} 秒`);
    log(`  🔉 音量 (Volume): ${bgm.volume}`);
    log(`  ⏰ 开始时间: ${bgm.startTime}`);
    
    // 音效列表
    log('\n🔊 音效列表 (Sound Effects)', 'magenta');
    log('─'.repeat(100), 'cyan');
    
    const sfxList = result.sound_effects || [];
    
    if (sfxList.length === 0) {
      log('  ⚠️  未识别到需要添加的音效', 'yellow');
    } else {
      log(`  共识别到 ${sfxList.length} 个音效节点\n`, 'green');
      
      sfxList.forEach((sfx, index) => {
        log(`  ┌─ [${index + 1}/${sfxList.length}] ────────────────────────────`, 'cyan');
        log(`  │ ⏰ 时间戳: ${sfx.timestamp}`, 'yellow');
        log(`  │ 🎯 分类: ${sfx.category || '❌ 未分类'}`, sfx.category ? 'green' : 'red');
        log(`  │ 📝 场景描述:`);
        log(`  │    ${sfx.description}`, 'blue');
        log(`  │ 🎼 提示词 (Prompt):`);
        log(`  │    ${sfx.prompt}`, 'cyan');
        log(`  │ ⏱️  时长: ${sfx.duration} 秒`);
        log(`  │ 🔉 音量: ${sfx.volume}`);
        log(`  └${'─'.repeat(70)}`, 'cyan');
        log('');
      });
    }
    
    // 音效分类统计
    log('📊 音效分类统计', 'magenta');
    log('─'.repeat(100), 'cyan');
    
    const categoryStats = {};
    sfxList.forEach(sfx => {
      const cat = sfx.category || '未分类';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });
    
    if (Object.keys(categoryStats).length === 0) {
      log('  无音效数据', 'yellow');
    } else {
      const maxCount = Math.max(...Object.values(categoryStats));
      
      Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
          const percentage = ((count / sfxList.length) * 100).toFixed(1);
          const barLength = Math.ceil((count / maxCount) * 30);
          const bar = '█'.repeat(barLength) + '░'.repeat(30 - barLength);
          log(`  ${category.padEnd(20)} ${bar} ${count} 个 (${percentage}%)`, 'green');
        });
    }
    
    // 检查是否符合新的输出格式
    log('\n✅ 格式验证', 'magenta');
    log('─'.repeat(100), 'cyan');
    
    const checks = [
      { name: '是否有 background_music', pass: !!result.background_music },
      { name: '是否有 sound_effects 数组', pass: Array.isArray(result.sound_effects) },
      { name: '音效是否包含 category 字段', pass: sfxList.length > 0 && sfxList.every(s => s.category) },
      { name: '提示词是否使用英文', pass: bgm.prompt && /^[a-zA-Z0-9\s,.-]+$/.test(bgm.prompt) },
      { name: '音效提示词是否使用英文', pass: sfxList.length === 0 || sfxList.every(s => /^[a-zA-Z0-9\s,.-]+$/.test(s.prompt)) },
      { name: '是否有中文描述', pass: sfxList.length === 0 || sfxList.some(s => /[\u4e00-\u9fa5]/.test(s.description)) }
    ];
    
    checks.forEach(check => {
      const icon = check.pass ? '✓' : '✗';
      const color = check.pass ? 'green' : 'red';
      log(`  ${icon} ${check.name}`, color);
    });
    
    const allPass = checks.every(c => c.pass);
    
    if (allPass) {
      log('\n🎉 恭喜！所有格式检查都通过了！', 'green');
      log('   新的系统提示词和音效分类功能运行正常！', 'green');
    } else {
      log('\n⚠️  部分格式检查未通过，可能需要调整系统提示词', 'yellow');
    }
    
    // 保存完整结果
    const outputFile = 'real-analysis-result.json';
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
    
    log('\n' + '='.repeat(100), 'cyan');
    log(`💾 完整结果已保存到: ${outputFile}`, 'blue');
    log('='.repeat(100), 'cyan');
    
    log('\n✨ 测试完成！', 'green');
    log('   你可以查看 real-analysis-result.json 获取完整的 JSON 输出\n', 'cyan');
    
  } catch (error) {
    log('\n✗ 测试失败', 'red');
    
    if (error.code === 'ECONNREFUSED') {
      log('  错误: 无法连接到服务器', 'red');
      log('  请确保后端服务正在运行: cd backend && npm run dev', 'yellow');
    } else if (error.response) {
      log(`  HTTP 错误: ${error.response.status}`, 'red');
      log(`  消息:`, 'red');
      console.error(error.response.data);
    } else {
      log(`  错误: ${error.message}`, 'red');
      console.error(error.stack);
    }
  }
}

// 运行测试
testVideoAnalysis();

