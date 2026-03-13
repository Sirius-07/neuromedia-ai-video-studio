/**
 * 测试素材分析功能
 * 
 * 这个测试脚本验证：
 * 1. 图片素材分析
 * 2. 视频素材分析
 * 3. 批量素材分析
 */

import AssetAnalysisService from './src/services/AssetAnalysisService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 开始测试素材分析功能\n');

async function testImageAnalysis() {
  console.log('='.repeat(60));
  console.log('📸 测试 1: 图片素材分析');
  console.log('='.repeat(60));
  
  // 你需要有一个测试图片，这里使用示例路径
  // 请根据实际情况修改路径
  const testImagePath = path.join(__dirname, 'uploads', 'assets', 'test-image.jpg');
  
  try {
    const description = await AssetAnalysisService.analyzeImage(testImagePath);
    console.log('\n✅ 图片分析成功！');
    console.log('📝 分析结果:');
    console.log(description);
    console.log('\n');
  } catch (error) {
    console.error('\n❌ 图片分析失败:', error.message);
    console.log('💡 提示: 请确保测试图片存在，或修改 testImagePath 路径\n');
  }
}

async function testVideoAnalysis() {
  console.log('='.repeat(60));
  console.log('🎬 测试 2: 视频素材分析');
  console.log('='.repeat(60));
  
  // 使用现有的测试视频
  const testVideoPath = path.join(__dirname, 'a1.mp4');
  
  try {
    const description = await AssetAnalysisService.analyzeVideo(testVideoPath);
    console.log('\n✅ 视频分析成功！');
    console.log('📝 分析结果:');
    console.log(description);
    console.log('\n');
  } catch (error) {
    console.error('\n❌ 视频分析失败:', error.message);
    console.log('💡 提示: 请确保视频文件存在\n');
  }
}

async function testBatchAnalysis() {
  console.log('='.repeat(60));
  console.log('📦 测试 3: 批量素材分析');
  console.log('='.repeat(60));
  
  // 模拟上传的素材列表
  const mockAssets = [
    {
      file_path: '/uploads/assets/test-video.mp4',
      file_type: 'video',
      description: null
    },
    {
      file_path: '/uploads/assets/test-image.jpg',
      file_type: 'image',
      description: null
    }
  ];
  
  try {
    console.log(`\n准备分析 ${mockAssets.length} 个素材...\n`);
    const analyzedAssets = await AssetAnalysisService.analyzeAssets(mockAssets);
    
    console.log('✅ 批量分析完成！');
    console.log('\n📊 分析结果汇总:');
    analyzedAssets.forEach((asset, i) => {
      console.log(`\n素材 ${i + 1} [${asset.file_type}]:`);
      console.log(`  路径: ${asset.file_path}`);
      console.log(`  描述: ${asset.description}`);
    });
    console.log('\n');
  } catch (error) {
    console.error('\n❌ 批量分析失败:', error.message);
    console.log('💡 提示: 请确保测试素材存在\n');
  }
}

async function runTests() {
  try {
    // 测试 1: 图片分析
    // await testImageAnalysis();
    
    // 测试 2: 视频分析（使用现有的 a1.mp4）
    await testVideoAnalysis();
    
    // 测试 3: 批量分析（需要准备测试素材）
    // await testBatchAnalysis();
    
    console.log('='.repeat(60));
    console.log('🎉 测试完成！');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
runTests();


