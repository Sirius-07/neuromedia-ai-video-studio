/**
 * 快速查看数据库内容
 * 
 * 使用方法：
 * cd backend
 * node view-database.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function viewDatabase() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 数据库内容查看器');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. 查看 Project 表
    console.log('📁 项目列表 (Project)');
    console.log('-'.repeat(80));
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    if (projects.length === 0) {
      console.log('  暂无项目\n');
    } else {
      projects.forEach((p, i) => {
        console.log(`  ${i + 1}. [${p.status}] ${p.title}`);
        console.log(`     ID: ${p.id}`);
        console.log(`     场景: ${p.completedScenes}/${p.totalScenes}`);
        console.log(`     配乐: ${p.soundtrackTaskId || '无'}`);
        console.log(`     创建: ${p.createdAt.toLocaleString('zh-CN')}`);
        console.log(`     更新: ${p.updatedAt.toLocaleString('zh-CN')}`);
        console.log('');
      });
    }
    console.log(`  总计: ${projects.length} 个项目\n`);

    // 2. 查看 SoundtrackTask 表
    console.log('🎵 配乐任务 (SoundtrackTask)');
    console.log('-'.repeat(80));
    const tasks = await prisma.soundtrackTask.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    if (tasks.length === 0) {
      console.log('  暂无配乐任务\n');
    } else {
      tasks.forEach((t, i) => {
        console.log(`  ${i + 1}. [${t.status}] ${t.videoId}`);
        console.log(`     ID: ${t.id}`);
        console.log(`     项目ID: ${t.projectId || '未关联'}`);
        console.log(`     创建: ${t.createdAt.toLocaleString('zh-CN')}`);
        console.log('');
      });
    }
    console.log(`  总计: ${tasks.length} 个配乐任务\n`);

    // 3. 查看 StoryboardProject 表（旧）
    console.log('🎬 分镜项目 (StoryboardProject - 旧表)');
    console.log('-'.repeat(80));
    const storyboards = await prisma.storyboardProject.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    if (storyboards.length === 0) {
      console.log('  暂无分镜项目\n');
    } else {
      storyboards.forEach((s, i) => {
        console.log(`  ${i + 1}. [${s.status}] ${s.title}`);
        console.log(`     ID: ${s.id}`);
        console.log(`     场景: ${s.completedScenes}/${s.totalScenes}`);
        console.log(`     创建: ${s.createdAt.toLocaleString('zh-CN')}`);
        console.log('');
      });
    }
    console.log(`  总计: ${storyboards.length} 个分镜项目\n`);

    // 4. 统计信息
    console.log('📈 统计信息');
    console.log('-'.repeat(80));
    const projectCount = await prisma.project.count();
    const taskCount = await prisma.soundtrackTask.count();
    const storyboardCount = await prisma.storyboardProject.count();
    const audioCount = await prisma.audioGenerationTask.count();
    
    console.log(`  📁 项目总数: ${projectCount}`);
    console.log(`  🎵 配乐任务: ${taskCount}`);
    console.log(`  🎬 分镜项目(旧): ${storyboardCount}`);
    console.log(`  🎼 音频生成任务: ${audioCount}`);
    console.log('');

    // 5. 项目状态分布
    console.log('📊 项目状态分布');
    console.log('-'.repeat(80));
    const draftCount = await prisma.project.count({ where: { status: 'draft' } });
    const storyboardStatusCount = await prisma.project.count({ where: { status: 'storyboard' } });
    const soundtrackCount = await prisma.project.count({ where: { status: 'soundtrack' } });
    const completedCount = await prisma.project.count({ where: { status: 'completed' } });
    
    console.log(`  📝 草稿: ${draftCount}`);
    console.log(`  🎬 分镜中: ${storyboardStatusCount}`);
    console.log(`  🎵 配乐中: ${soundtrackCount}`);
    console.log(`  ✅ 已完成: ${completedCount}`);
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ 查看完成！\n');
    console.log('💡 提示：使用 Prisma Studio 可以获得更好的可视化体验');
    console.log('   运行命令：npx prisma studio\n');

  } catch (error) {
    console.error('❌ 查看数据库失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

viewDatabase();







