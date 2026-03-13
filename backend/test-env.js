/**
 * 环境变量测试脚本
 * 用于检查 .env 文件是否正确加载
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件
dotenv.config();

console.log('\n' + '='.repeat(60));
console.log('🔍 环境变量检查');
console.log('='.repeat(60) + '\n');

// 检查TOS配置
const tosConfig = {
  'TOS_ACCESS_KEY_ID': process.env.TOS_ACCESS_KEY_ID,
  'TOS_SECRET_ACCESS_KEY': process.env.TOS_SECRET_ACCESS_KEY,
  'TOS_REGION': process.env.TOS_REGION,
  'TOS_BUCKET': process.env.TOS_BUCKET
};

console.log('【TOS配置】\n');

let allConfigured = true;

for (const [key, value] of Object.entries(tosConfig)) {
  if (value) {
    // 对于密钥类型，只显示前后几位
    if (key.includes('SECRET') || key.includes('KEY_ID')) {
      const masked = value.substring(0, 8) + '***' + value.substring(value.length - 4);
      console.log(`  ✅ ${key}: ${masked}`);
    } else {
      console.log(`  ✅ ${key}: ${value}`);
    }
  } else {
    console.log(`  ❌ ${key}: 未设置`);
    allConfigured = false;
  }
}

console.log('\n' + '='.repeat(60));

if (allConfigured) {
  console.log('✅ 所有TOS配置项都已设置！');
  console.log('\n下一步：');
  console.log('  1. 确保后端服务已重启');
  console.log('  2. 运行: node test-tos-upload.js');
} else {
  console.log('❌ TOS配置不完整！');
  console.log('\n请检查 backend/.env 文件，确保包含：');
  console.log('  - TOS_ACCESS_KEY_ID=xxx');
  console.log('  - TOS_SECRET_ACCESS_KEY=xxx');
  console.log('  - TOS_REGION=cn-beijing');
  console.log('  - TOS_BUCKET=xxx');
  console.log('\n注意：');
  console.log('  - 不要在值周围加引号');
  console.log('  - 不要在行尾添加注释');
  console.log('  - 等号前后不要有空格');
}

console.log('='.repeat(60) + '\n');

// 额外检查：是否有常见错误
console.log('【常见问题检查】\n');

// 检查是否有多余的空格
Object.entries(tosConfig).forEach(([key, value]) => {
  if (value && (value.startsWith(' ') || value.endsWith(' '))) {
    console.log(`  ⚠️  ${key} 的值包含多余的空格`);
  }
});

// 检查region格式
if (tosConfig.TOS_REGION && tosConfig.TOS_REGION.includes('#')) {
  console.log('  ⚠️  TOS_REGION 包含注释符号 #，请删除行尾的注释');
}

console.log('  ✅ 格式检查完成\n');

