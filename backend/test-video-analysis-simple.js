/**
 * 简单的视频分析测试
 */

import axios from 'axios';
import fs from 'fs';

const VIDEO_URL = 'https://1926289158.tos-cn-guangzhou.volces.com/a1.mp4';

console.log('\n🎬 开始测试视频分析...\n');
console.log(`视频 URL: ${VIDEO_URL}\n`);

async function test() {
  try {
    // 创建任务
    console.log('[1] 创建任务...');
    const createRes = await axios.post('http://localhost:3000/api/v1/soundtrack/create', {
      videoId: VIDEO_URL
    });
    
    const taskId = createRes.data.data.taskId;
    console.log(`✓ 任务创建成功: ${taskId}\n`);
    
    // 等待完成
    console.log('[2] 等待分析完成（可能需要 1-2 分钟）...');
    
    let count = 0;
    while (count < 60) {
      await new Promise(r => setTimeout(r, 5000));
      count++;
      
      const statusRes = await axios.get(`http://localhost:3000/api/v1/soundtrack/task/${taskId}`);
      const task = statusRes.data.data;
      
      process.stdout.write(`\r   进度: ${count}/60, 状态: ${task.status}    `);
      
      if (task.status === 'completed') {
        console.log('\n\n✓ 分析完成！\n');
        
        const result = JSON.parse(task.finalAssetMap);
        
        // 展示结果
        console.log('═'.repeat(80));
        console.log('📋 分析结果\n');
        
        // BGM
        console.log('🎵 背景音乐:');
        console.log(`   提示词: ${result.background_music.prompt}`);
        console.log(`   情绪: ${result.background_music.mood}`);
        console.log(`   类型: ${result.background_music.genre}\n`);
        
        // 音效
        console.log(`🔊 音效 (共 ${result.sound_effects.length} 个):\n`);
        result.sound_effects.forEach((sfx, i) => {
          console.log(`[${i+1}] ${sfx.timestamp}`);
          console.log(`    🎯 分类: ${sfx.category || '未分类'}`);
          console.log(`    📝 ${sfx.description}`);
          console.log(`    🎼 ${sfx.prompt}\n`);
        });
        
        console.log('═'.repeat(80));
        
        // 保存完整 JSON
        fs.writeFileSync('analysis-result.json', JSON.stringify(result, null, 2));
        console.log('\n💾 完整结果已保存到: analysis-result.json\n');
        
        return;
      }
      
      if (task.status === 'failed') {
        console.log(`\n\n✗ 分析失败: ${task.errorMessage}\n`);
        return;
      }
    }
    
    console.log('\n\n✗ 超时\n');
    
  } catch (error) {
    console.error('\n✗ 错误:', error.message);
    if (error.response) {
      console.error('响应:', error.response.data);
    }
  }
}

// 等待服务器启动后运行
setTimeout(test, 10000); // 等待10秒

