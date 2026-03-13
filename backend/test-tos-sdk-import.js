/**
 * 测试 TOS SDK 导入是否正确
 */

import TOS from '@volcengine/tos-sdk';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n🧪 测试 TOS SDK 导入...\n');

// 检查 SDK 导出内容
console.log('1️⃣  检查 SDK 导出：');
console.log('   TOS 对象:', typeof TOS);
console.log('   TOS.TosClient:', typeof TOS.TosClient);

// 尝试创建客户端
console.log('\n2️⃣  尝试创建 TOS 客户端：');

try {
  const TosClient = TOS.TosClient;
  
  if (!TosClient) {
    console.error('   ❌ TOS.TosClient 不存在');
    console.log('\n可用的属性：', Object.keys(TOS));
    process.exit(1);
  }
  
  console.log('   ✅ TosClient 类已找到');
  
  // 尝试实例化（使用环境变量）
  const accessKeyId = process.env.TOS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.TOS_SECRET_ACCESS_KEY;
  const region = process.env.TOS_REGION || 'cn-guangzhou';
  
  if (!accessKeyId || !accessKeySecret) {
    console.log('   ⚠️  环境变量未配置，跳过实例化测试');
  } else {
    const client = new TosClient({
      accessKeyId: accessKeyId,
      accessKeySecret: accessKeySecret,
      region: region
    });
    
    console.log('   ✅ TOS 客户端实例化成功！');
    console.log('   区域:', region);
  }
  
  console.log('\n✅ TOS SDK 导入测试通过！\n');
  
} catch (error) {
  console.error('   ❌ 错误:', error.message);
  console.error('\n错误详情:', error);
  process.exit(1);
}

