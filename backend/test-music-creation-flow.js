/**
 * 音频创作完整流程测试
 * 
 * 测试从视频拼接到AI分析的完整流程
 * 
 * 使用方法：
 * node test-music-creation-flow.js
 */

import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:3000/api/v1';

async function testMusicCreationFlow() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 音频创作完整流程测试');
  console.log('='.repeat(80) + '\n');

  try {
    // ============================================================
    // 测试1：检查后端服务
    // ============================================================
    console.log('【测试1】检查后端服务...\n');
    
    try {
      const healthResponse = await axios.get('http://localhost:3000/health', {
        timeout: 5000
      });
      console.log('✅ 后端服务运行正常:', healthResponse.data.message);
    } catch (error) {
      console.error('❌ 后端服务未运行或无法访问');
      console.error('   请先启动后端服务: cd backend && npm run dev');
      return;
    }
    
    console.log();
    
    // ============================================================
    // 测试2：检查TOS配置
    // ============================================================
    console.log('【测试2】检查TOS配置...\n');
    
    try {
      const tosCheckResponse = await axios.get(`${API_BASE_URL}/music-creation/check-tos`);
      const tosStatus = tosCheckResponse.data.data;
      
      if (tosStatus.configured) {
        console.log('✅ TOS配置有效');
        console.log(`   区域: ${tosStatus.region}`);
        console.log(`   存储桶: ${tosStatus.bucket}`);
      } else {
        console.warn('⚠️ TOS未配置或配置无效');
        console.warn('   消息:', tosStatus.message);
        console.warn('   将使用本地URL进行测试（仅开发环境）');
      }
    } catch (error) {
      console.error('❌ 检查TOS配置失败:', error.message);
      return;
    }
    
    console.log();
    
    // ============================================================
    // 测试3：准备测试数据
    // ============================================================
    console.log('【测试3】准备测试数据...\n');
    
    // 查找测试视频
    const possibleVideoDirs = [
      path.join(__dirname, 'uploads/video'),
      path.join(__dirname, 'uploads/assets')
    ];
    
    const testScenes = [];
    
    for (const dir of possibleVideoDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const mp4Files = files.filter(f => f.endsWith('.mp4')).slice(0, 2); // 最多取2个视频
        
        for (const file of mp4Files) {
          const videoUrl = `http://localhost:3000/uploads/${path.relative(path.join(__dirname, 'uploads'), path.join(dir, file)).replace(/\\/g, '/')}`;
          testScenes.push({
            videoUrl: videoUrl
          });
        }
        
        if (testScenes.length >= 2) break;
      }
    }
    
    if (testScenes.length === 0) {
      console.error('❌ 未找到测试视频文件');
      console.error('   请确保 uploads/video 或 uploads/assets 目录中有 .mp4 文件');
      return;
    }
    
    console.log(`✅ 找到 ${testScenes.length} 个测试视频`);
    testScenes.forEach((scene, i) => {
      console.log(`   ${i + 1}. ${scene.videoUrl}`);
    });
    
    console.log();
    
    // ============================================================
    // 测试4：调用音频创作API
    // ============================================================
    console.log('【测试4】调用音频创作API...\n');
    console.log('这可能需要几分钟时间，请耐心等待...\n');
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/music-creation/create`,
        { scenes: testScenes },
        {
          timeout: 300000, // 5分钟超时
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ 音频创作任务创建成功！（耗时: ${duration}秒）\n`);
      
      const result = response.data;
      
      // 显示结果
      console.log('📋 任务结果：');
      console.log('  - 成功:', result.success);
      console.log('  - 部分成功:', result.partial || false);
      
      if (result.data) {
        console.log('\n📹 视频信息：');
        console.log('  - 视频URL:', result.data.videoUrl);
        console.log('  - 本地路径:', result.data.localVideoPath);
        console.log('  - 文件名:', result.data.videoFilename);
        
        if (result.data.uploadResult) {
          console.log('\n☁️  上传信息：');
          console.log('  - 存储桶:', result.data.uploadResult.bucket);
          console.log('  - 对象键:', result.data.uploadResult.objectKey);
          console.log('  - 区域:', result.data.uploadResult.region);
          console.log('  - 文件大小:', result.data.uploadResult.fileSizeInMB, 'MB');
          console.log('  - 上传耗时:', result.data.uploadResult.uploadDuration, '秒');
        }
        
        if (result.data.instructionBlueprint) {
          console.log('\n🎵 AI分析结果：');
          
          const blueprint = result.data.instructionBlueprint;
          
          if (blueprint.background_music) {
            console.log('  背景音乐：');
            console.log('    - 提示词:', blueprint.background_music.prompt);
            console.log('    - 情绪:', blueprint.background_music.mood);
            console.log('    - 类型:', blueprint.background_music.genre);
            console.log('    - 时长:', blueprint.background_music.duration, '秒');
          }
          
          if (blueprint.sound_effects && blueprint.sound_effects.length > 0) {
            console.log(`  音效（共${blueprint.sound_effects.length}个）：`);
            blueprint.sound_effects.forEach((sfx, i) => {
              console.log(`    ${i + 1}. [${sfx.timestamp}] ${sfx.description}`);
              console.log(`       分类: ${sfx.category}`);
              console.log(`       提示词: ${sfx.prompt.substring(0, 60)}...`);
            });
          }
        }
        
        if (result.data.stats) {
          console.log('\n📊 统计信息：');
          console.log('  - 分镜数量:', result.data.stats.scenesCount);
          console.log('  - 视频片段数:', result.data.stats.videoCount);
        }
        
        if (result.data.error) {
          console.log('\n⚠️  错误信息:', result.data.error);
        }
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('✅ 测试完成！');
      console.log('='.repeat(80) + '\n');
      
      console.log('📝 下一步：');
      console.log('   1. 在浏览器中访问视频URL验证是否可播放');
      console.log('   2. 检查AI生成的音频指令蓝图是否合理');
      console.log('   3. 在前端分镜页面点击"下一步：音频制作"测试完整用户流程\n');
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.error(`\n❌ 音频创作任务失败（耗时: ${duration}秒）\n`);
      
      if (error.response) {
        console.error('错误响应:', error.response.status);
        console.error('错误信息:', error.response.data);
      } else if (error.request) {
        console.error('请求超时或无响应');
      } else {
        console.error('错误:', error.message);
      }
      
      console.log('\n可能的原因：');
      console.log('  1. TOS配置不正确（检查 .env 文件）');
      console.log('  2. 视频文件无法访问');
      console.log('  3. AI服务（火山方舟）配置不正确');
      console.log('  4. 网络连接问题');
      console.log('  5. FFmpeg未安装或不可用\n');
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// 运行测试
testMusicCreationFlow();

