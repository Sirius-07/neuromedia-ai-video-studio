import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('测试数据库连接...\n');

async function test() {
  try {
    // 测试查询
    const tasks = await prisma.audioGenerationTask.findMany();
    console.log('✓ 数据库连接成功');
    console.log(`找到 ${tasks.length} 个任务\n`);
    
    // 测试创建
    const task = await prisma.audioGenerationTask.create({
      data: {
        prompt: 'test',
        duration: 1,
        status: 'pending'
      }
    });
    
    console.log('✓ 创建任务成功');
    console.log('任务ID:', task.id);
    
    // 删除测试任务
    await prisma.audioGenerationTask.delete({
      where: { id: task.id }
    });
    
    console.log('✓ 删除任务成功\n');
    console.log('数据库操作正常！');
    
  } catch (error) {
    console.error('✗ 数据库错误:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

test();















