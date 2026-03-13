import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const projects = await prisma.project.findMany({orderBy:{updatedAt:'desc'},take:2,select:{id:true,title:true,storyboardData:true}});
for(const p of projects) {
  console.log(`\n项目: ${p.title} (${p.id})`);
  if(p.storyboardData) {
    const d = JSON.parse(p.storyboardData);
    // 数据是以数字为键的对象
    const scenes = Object.values(d);
    console.log(`  场景数: ${scenes.length}`);
    scenes.forEach((s,i)=>{
      if(s && typeof s === 'object') {
        console.log(`\n  场景 ${i+1}: ${s.id||'?'}`);
        console.log(`    type: ${s.type}`);
        console.log(`    generationStatus: ${s.generationStatus||'无'}`);
        console.log(`    videoUrl: ${(s.videoUrl||'无').substring(0,100)}`);
        console.log(`    assetUrl: ${(s.assetUrl||'无').substring(0,80)}`);
      }
    });
  }
}
await prisma.$disconnect();
