/**
 * 批量音频生成脚本
 * 读取视频分析结果，批量生成所有音效和背景音乐
 */

import axios from 'axios';
import fs from 'fs';

const API_BASE = 'http://localhost:3000/api/v1/audio';
const INPUT_FILE = 'direct-api-result.json';

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

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForCompletion(taskId, name) {
  let attempts = 0;
  const maxAttempts = 120; // 最多等待 10 分钟
  
  while (attempts < maxAttempts) {
    attempts++;
    await sleep(5000); // 每 5 秒查询一次
    
    try {
      const res = await axios.get(`${API_BASE}/task/${taskId}`);
      const task = res.data.data;
      
      process.stdout.write(`\r  ${name}: ${task.status} (${attempts * 5}秒)    `);
      
      if (task.status === 'completed') {
        return task;
      }
      
      if (task.status === 'failed') {
        throw new Error(task.errorMessage);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // 任务可能还没创建完成，继续等待
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('任务超时');
}

async function generateAudio(prompt, duration, name) {
  try {
    log(`\n[创建] ${name}`, 'yellow');
    log(`  Prompt: ${prompt}`, 'cyan');
    log(`  Duration: ${duration}s`, 'cyan');
    
    const createRes = await axios.post(`${API_BASE}/quick-generate`, {
      prompt,
      duration
    });
    
    const taskId = createRes.data.data.taskId;
    log(`  ✓ 任务已创建: ${taskId}`, 'green');
    
    // 等待完成
    process.stdout.write(`  等待生成...`);
    const completedTask = await waitForCompletion(taskId, name);
    
    console.log(''); // 换行
    log(`  ✓ 生成完成: ${completedTask.outputFileUrl}`, 'green');
    
    return {
      success: true,
      taskId,
      url: completedTask.outputFileUrl,
      filePath: completedTask.outputFilePath
    };
    
  } catch (error) {
    log(`  ✗ 生成失败: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message
    };
  }
}

async function batchGenerate() {
  log('='.repeat(100), 'cyan');
  log('🎵 批量音频生成 - 基于视频分析结果', 'cyan');
  log('='.repeat(100), 'cyan');
  
  // 读取分析结果
  log('\n[1/4] 读取视频分析结果...', 'yellow');
  
  if (!fs.existsSync(INPUT_FILE)) {
    log(`✗ 文件不存在: ${INPUT_FILE}`, 'red');
    log('请先运行 test-direct-api.js 生成分析结果', 'yellow');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const result = data.result;
  
  log(`✓ 已读取分析结果`, 'green');
  log(`  BGM: 1 个`, 'cyan');
  log(`  音效: ${result.sound_effects.length} 个`, 'cyan');
  
  // 准备生成任务
  log('\n[2/4] 准备生成任务列表...', 'yellow');
  
  const tasks = [];
  
  // BGM
  if (result.background_music) {
    tasks.push({
      type: 'bgm',
      name: '背景音乐 (BGM)',
      prompt: result.background_music.prompt,
      duration: result.background_music.duration,
      originalData: result.background_music
    });
  }
  
  // 音效
  result.sound_effects.forEach((sfx, index) => {
    tasks.push({
      type: 'sfx',
      name: `音效 ${index + 1} - ${sfx.category}`,
      prompt: sfx.prompt,
      duration: sfx.duration,
      originalData: sfx
    });
  });
  
  log(`✓ 共 ${tasks.length} 个生成任务`, 'green');
  
  // 开始生成
  log('\n[3/4] 开始批量生成音频...', 'yellow');
  log('  注意：音频生成是串行的，请耐心等待\n', 'cyan');
  
  const results = [];
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    log(`[${i + 1}/${tasks.length}] ` + '─'.repeat(80), 'cyan');
    
    const result = await generateAudio(task.prompt, task.duration, task.name);
    
    results.push({
      ...task,
      ...result
    });
    
    // 短暂延迟，避免请求过快
    if (i < tasks.length - 1) {
      await sleep(2000);
    }
  }
  
  // 汇总结果
  log('\n[4/4] 生成结果汇总', 'yellow');
  log('='.repeat(100), 'cyan');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  log(`\n📊 统计:`, 'magenta');
  log(`  ✓ 成功: ${successCount} 个`, 'green');
  log(`  ✗ 失败: ${failCount} 个`, failCount > 0 ? 'red' : 'green');
  
  log(`\n📁 生成的文件:`, 'magenta');
  results.forEach((r, i) => {
    if (r.success) {
      log(`  [${i + 1}] ${r.name}`, 'cyan');
      log(`      URL: ${r.url}`, 'blue');
    } else {
      log(`  [${i + 1}] ${r.name} - 失败: ${r.error}`, 'red');
    }
  });
  
  // 保存结果映射
  const outputMapping = {
    background_music: null,
    sound_effects: []
  };
  
  results.forEach(r => {
    if (r.type === 'bgm' && r.success) {
      outputMapping.background_music = {
        ...r.originalData,
        generatedFile: r.url,
        taskId: r.taskId
      };
    } else if (r.type === 'sfx' && r.success) {
      outputMapping.sound_effects.push({
        ...r.originalData,
        generatedFile: r.url,
        taskId: r.taskId
      });
    }
  });
  
  const mappingFile = 'audio-generation-mapping.json';
  fs.writeFileSync(mappingFile, JSON.stringify(outputMapping, null, 2), 'utf-8');
  
  log(`\n💾 音频映射已保存到: ${mappingFile}`, 'blue');
  log('   这个文件包含了每个音效的生成结果和原始分析数据', 'cyan');
  
  log('\n' + '='.repeat(100), 'cyan');
  log('✨ 批量生成完成！', 'green');
  log('='.repeat(100), 'cyan');
  
  if (successCount === results.length) {
    log('\n🎉 所有音频生成成功！你现在可以：', 'green');
    log('   1. 在 backend/uploads/audio/ 目录查看生成的音频文件', 'cyan');
    log('   2. 通过浏览器访问 URL 播放音频', 'cyan');
    log('   3. 使用 audio-generation-mapping.json 获取完整的映射关系\n', 'cyan');
  } else {
    log(`\n⚠️  有 ${failCount} 个音频生成失败，请检查错误信息\n`, 'yellow');
  }
}

// 运行批量生成
batchGenerate().catch(error => {
  log('\n✗ 批量生成失败', 'red');
  console.error(error);
  process.exit(1);
});















