import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📦 测试 Base64 视频编码功能\n');

// 查找上传目录中的视频文件
const uploadsDir = path.join(__dirname, 'uploads/videos');

if (!fs.existsSync(uploadsDir)) {
  console.log('❌ uploads/videos 目录不存在');
  console.log('💡 请先上传一个视频文件，或者创建一个测试视频');
  process.exit(1);
}

const files = fs.readdirSync(uploadsDir);
const videoFiles = files.filter(file => 
  file.endsWith('.mp4') || 
  file.endsWith('.mov') || 
  file.endsWith('.avi')
);

if (videoFiles.length === 0) {
  console.log('❌ uploads/videos 目录中没有视频文件');
  console.log('💡 请先上传一个视频文件');
  process.exit(1);
}

// 使用第一个视频文件进行测试
const testVideoFile = videoFiles[0];
const testVideoPath = path.join(uploadsDir, testVideoFile);

console.log(`✅ 找到测试视频: ${testVideoFile}`);
console.log(`📁 完整路径: ${testVideoPath}\n`);

// 读取文件信息
const stats = fs.statSync(testVideoPath);
const fileSizeInMB = (stats.size / 1024 / 1024).toFixed(2);

console.log(`📊 文件信息:`);
console.log(`   大小: ${fileSizeInMB} MB`);
console.log(`   修改时间: ${stats.mtime}\n`);

// 转换为 Base64
console.log(`🔄 正在转换为 Base64...`);
const startTime = Date.now();

const videoBuffer = fs.readFileSync(testVideoPath);
const base64Video = videoBuffer.toString('base64');
const fileExt = path.extname(testVideoPath).slice(1);

const endTime = Date.now();
const conversionTime = ((endTime - startTime) / 1000).toFixed(2);

console.log(`✅ Base64 转换完成！`);
console.log(`   耗时: ${conversionTime} 秒`);
console.log(`   Base64 长度: ${base64Video.length.toLocaleString()} 字符`);
console.log(`   数据URI格式: data:video/${fileExt};base64,<BASE64_STRING>\n`);

// 显示 Base64 的前后部分
console.log(`📋 Base64 预览:`);
console.log(`   前100字符: ${base64Video.substring(0, 100)}...`);
console.log(`   后100字符: ...${base64Video.substring(base64Video.length - 100)}\n`);

// 估算发送到 API 的数据大小
const dataUriSize = `data:video/${fileExt};base64,${base64Video}`.length;
const dataUriSizeInMB = (dataUriSize / 1024 / 1024).toFixed(2);

console.log(`📦 API 请求数据大小估算:`);
console.log(`   原始视频: ${fileSizeInMB} MB`);
console.log(`   Base64 编码后: ${dataUriSizeInMB} MB (约为原始的 ${(dataUriSizeInMB / fileSizeInMB).toFixed(1)}x)`);

if (parseFloat(fileSizeInMB) > 20) {
  console.log(`\n⚠️  警告: 视频文件较大 (${fileSizeInMB} MB)`);
  console.log(`   建议使用小于 20MB 的视频以获得更好的性能`);
  console.log(`   Base64 编码会增加约 33% 的数据大小`);
}

console.log(`\n✨ 测试完成！`);
console.log(`\n💡 提示:`);
console.log(`   - 系统会自动检测输入是 URL 还是本地文件`);
console.log(`   - 本地文件会自动转换为 Base64 编码`);
console.log(`   - 公网 URL 会直接传递给 API`);





