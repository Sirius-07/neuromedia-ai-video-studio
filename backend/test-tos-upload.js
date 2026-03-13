/**
 * TOS上传测试脚本
 * 
 * 测试火山引擎TOS对象存储的上传功能
 * 
 * 使用方法：
 * 1. 确保 .env 中配置了 TOS_ACCESS_KEY_ID, TOS_SECRET_ACCESS_KEY, TOS_REGION, TOS_BUCKET
 * 2. 运行: node test-tos-upload.js
 */

import TOSService from './src/services/TOSService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testTOSUpload() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TOS上传功能测试');
  console.log('='.repeat(80) + '\n');

  try {
    // ============================================================
    // 测试1：检查TOS配置
    // ============================================================
    console.log('【测试1】检查TOS配置...\n');
    
    const isConfigured = await TOSService.checkConfiguration();
    
    if (!isConfigured) {
      console.error('❌ TOS配置无效，请检查以下环境变量：');
      console.error('   - TOS_ACCESS_KEY_ID');
      console.error('   - TOS_SECRET_ACCESS_KEY');
      console.error('   - TOS_REGION');
      console.error('   - TOS_BUCKET');
      console.error('\n请在 backend/.env 文件中配置这些变量\n');
      return;
    }
    
    console.log('✅ TOS配置有效\n');
    
    // ============================================================
    // 测试2：查找测试视频文件
    // ============================================================
    console.log('【测试2】查找测试视频文件...\n');
    
    // 尝试查找已存在的视频文件
    const possibleVideoPaths = [
      path.join(__dirname, 'uploads/video/music-creation'),
      path.join(__dirname, 'uploads/video'),
      path.join(__dirname, 'uploads/assets')
    ];
    
    let testVideoPath = null;
    
    for (const dir of possibleVideoPaths) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const mp4Files = files.filter(f => f.endsWith('.mp4'));
        
        if (mp4Files.length > 0) {
          testVideoPath = path.join(dir, mp4Files[0]);
          console.log(`✅ 找到测试视频: ${testVideoPath}`);
          break;
        }
      }
    }
    
    if (!testVideoPath) {
      console.error('❌ 未找到测试视频文件');
      console.error('   请确保以下目录中至少有一个 .mp4 文件：');
      possibleVideoPaths.forEach(p => console.error(`   - ${p}`));
      console.error('\n或者修改此脚本，指定一个有效的视频文件路径\n');
      return;
    }
    
    // 获取文件信息
    const stats = fs.statSync(testVideoPath);
    const fileSizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`📊 文件大小: ${fileSizeInMB} MB\n`);
    
    // ============================================================
    // 测试3：上传视频到TOS
    // ============================================================
    console.log('【测试3】上传视频到TOS...\n');
    
    const uploadResult = await TOSService.uploadVideo(testVideoPath, {
      folder: 'test-uploads/'
    });
    
    console.log('\n✅ 上传成功！');
    console.log('\n上传结果：');
    console.log('  - 公网URL:', uploadResult.url);
    console.log('  - 存储桶:', uploadResult.bucket);
    console.log('  - 对象键:', uploadResult.objectKey);
    console.log('  - 区域:', uploadResult.region);
    console.log('  - 文件大小:', uploadResult.fileSizeInMB, 'MB');
    console.log('  - 上传耗时:', uploadResult.uploadDuration, '秒');
    
    // ============================================================
    // 测试4：验证URL可访问性
    // ============================================================
    console.log('\n【测试4】验证URL可访问性...\n');
    
    console.log('🌐 请在浏览器中打开以下URL验证视频是否可访问：');
    console.log(`   ${uploadResult.url}\n`);
    
    // 尝试HEAD请求验证
    try {
      const axios = (await import('axios')).default;
      const headResponse = await axios.head(uploadResult.url, {
        timeout: 10000
      });
      
      if (headResponse.status === 200) {
        console.log('✅ URL可访问（HTTP 200）');
        console.log(`   Content-Type: ${headResponse.headers['content-type']}`);
        console.log(`   Content-Length: ${headResponse.headers['content-length']} bytes`);
      }
    } catch (error) {
      console.warn('⚠️ 无法验证URL可访问性:', error.message);
      console.warn('   这可能是因为网络问题或CORS限制');
      console.warn('   请手动在浏览器中验证URL是否可访问');
    }
    
    // ============================================================
    // 测试5：清理测试文件（可选）
    // ============================================================
    console.log('\n【测试5】清理测试文件...\n');
    
    console.log('是否要删除刚才上传的测试文件？');
    console.log('如果要删除，请取消注释下面的代码并重新运行\n');
    
    // 取消注释以下代码来删除测试文件
    /*
    try {
      await TOSService.deleteObject(uploadResult.objectKey);
      console.log('✅ 测试文件已删除');
    } catch (deleteError) {
      console.error('❌ 删除测试文件失败:', deleteError.message);
    }
    */
    
    console.log('⏭️  跳过删除（保留测试文件）\n');
    
    // ============================================================
    // 测试完成
    // ============================================================
    console.log('='.repeat(80));
    console.log('✅ 所有测试完成！');
    console.log('='.repeat(80) + '\n');
    
    console.log('📝 下一步：');
    console.log('   1. 在浏览器中验证上传的视频URL是否可访问');
    console.log('   2. 如果可以访问，说明TOS配置正确');
    console.log('   3. 现在可以在分镜页面点击"下一步：音频制作"按钮测试完整流程\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// 运行测试
testTOSUpload();

