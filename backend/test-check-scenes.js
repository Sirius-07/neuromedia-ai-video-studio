/**
 * 测试脚本：检查数据库中最新项目的场景数据
 * 用于调试 AI+实拍模式视频不显示的问题
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLatestProject() {
  try {
    console.log('🔍 查询最新项目...\n');
    
    // 获取最新的项目
    const latestProject = await prisma.project.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestProject) {
      console.log('❌ 没有找到任何项目');
      return;
    }

    // 解析场景数据
    let scenes = [];
    let settings = {};
    try {
      if (latestProject.storyboardData) {
        const storyboard = JSON.parse(latestProject.storyboardData);
        scenes = storyboard.scenes || [];
      }
      if (latestProject.settings) {
        settings = JSON.parse(latestProject.settings);
      }
    } catch (e) {
      console.log('❌ 解析JSON数据失败:', e.message);
      return;
    }

    console.log('📋 项目信息:');
    console.log(`  标题: ${latestProject.title}`);
    console.log(`  ID: ${latestProject.id}`);
    console.log(`  生成模式: ${settings.generationMode || '未知'}`);
    console.log(`  创建时间: ${latestProject.createdAt}`);
    console.log(`  场景数量: ${scenes.length}\n`);

    console.log('📊 场景列表:\n');
    scenes.forEach((scene, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`场景 ${scene.scene_id}:`);
      console.log(`  类型 (type): ${scene.type}`);
      console.log(`  引用素材 (reference_asset_path): ${scene.reference_asset_path || '无'}`);
      console.log(`  脚本内容: ${scene.script_content?.substring(0, 50)}...`);
      console.log(`  画面描述: ${scene.visual_description?.substring(0, 50)}...`);
      console.log(`  时长: ${scene.estimated_duration}秒`);
      
      // 检查是否应该是实拍视频但类型错误
      if (scene.reference_asset_path && scene.reference_asset_path.includes('.mp4')) {
        if (scene.type === 'mixed_media') {
          console.log(`  ✅ 正确: 视频素材 + mixed_media 类型`);
        } else {
          console.log(`  ❌ 错误: 视频素材但类型是 "${scene.type}"，应该是 "mixed_media"`);
        }
      } else if (scene.reference_asset_path && (
        scene.reference_asset_path.includes('.jpg') || 
        scene.reference_asset_path.includes('.png') ||
        scene.reference_asset_path.includes('.jpeg')
      )) {
        if (scene.type === 'ai_generated') {
          console.log(`  ✅ 正确: 图片素材 + ai_generated 类型`);
        } else {
          console.log(`  ❌ 错误: 图片素材但类型是 "${scene.type}"，应该是 "ai_generated"`);
        }
      } else if (!scene.reference_asset_path) {
        if (scene.type === 'ai_generated') {
          console.log(`  ✅ 正确: 纯AI生成 + ai_generated 类型`);
        } else {
          console.log(`  ⚠️ 警告: 无素材但类型是 "${scene.type}"`);
        }
      }
    });
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 统计
    const mixedMediaCount = scenes.filter(s => s.type === 'mixed_media').length;
    const aiGeneratedCount = scenes.filter(s => s.type === 'ai_generated').length;
    const withVideoAsset = scenes.filter(s => 
      s.reference_asset_path && s.reference_asset_path.includes('.mp4')
    ).length;

    console.log('📈 统计:');
    console.log(`  mixed_media 场景: ${mixedMediaCount} 个`);
    console.log(`  ai_generated 场景: ${aiGeneratedCount} 个`);
    console.log(`  有视频素材的场景: ${withVideoAsset} 个`);
    
    if (withVideoAsset > 0 && mixedMediaCount === 0) {
      console.log('\n⚠️ 警告: 有视频素材但没有 mixed_media 类型的场景！');
      console.log('   这是导致实拍视频不显示的原因。');
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestProject();

