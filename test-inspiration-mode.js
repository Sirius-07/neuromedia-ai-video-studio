/**
 * 灵感激发模式测试脚本
 * 用于测试情绪识别和方案生成API
 */

const API_BASE = 'http://localhost:4300';

// 测试数据
const testCases = [
  {
    name: '商务场景测试',
    userPrompt: '制作一个关于公司产品发布会的宣传视频',
    assets: [
      { file_type: 'image', file_path: '/uploads/office.jpg' },
      { file_type: 'image', file_path: '/uploads/product.jpg' }
    ],
    expectedEmotion: 'professional'
  },
  {
    name: '欢快场景测试',
    userPrompt: '记录朋友聚会的欢乐时光',
    assets: [
      { file_type: 'video', file_path: '/uploads/party.mp4' },
      { file_type: 'image', file_path: '/uploads/friends.jpg' }
    ],
    expectedEmotion: 'high_energy'
  },
  {
    name: '治愈场景测试',
    userPrompt: '拍摄夕阳下的海边风景',
    assets: [
      { file_type: 'image', file_path: '/uploads/sunset.jpg' },
      { file_type: 'video', file_path: '/uploads/beach.mp4' }
    ],
    expectedEmotion: 'aesthetic'
  },
  {
    name: '通用场景测试',
    userPrompt: '日常生活记录',
    assets: [
      { file_type: 'video', file_path: '/uploads/daily.mp4' }
    ],
    expectedEmotion: 'neutral'
  }
];

/**
 * 测试情绪分析API
 */
async function testAnalyze(testCase) {
  console.log(`\n📊 测试: ${testCase.name}`);
  console.log('=' .repeat(50));
  
  try {
    const response = await fetch(`${API_BASE}/api/inspiration/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assets: testCase.assets,
        userPrompt: testCase.userPrompt
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ 分析结果:');
    console.log(`   情绪: ${result.emotionLabel} (${result.emotion})`);
    console.log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   识别元素: ${result.detectedElements.join(', ')}`);
    
    if (result.emotion === testCase.expectedEmotion) {
      console.log('✅ 情绪识别正确!');
    } else {
      console.log(`⚠️ 预期情绪: ${testCase.expectedEmotion}, 实际: ${result.emotion}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return null;
  }
}

/**
 * 测试方案生成API
 */
async function testGenerate(analysisResult, testCase) {
  console.log('\n💡 测试方案生成...');
  console.log('-'.repeat(50));
  
  try {
    const response = await fetch(`${API_BASE}/api/inspiration/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisResult: analysisResult,
        assets: testCase.assets,
        userPrompt: testCase.userPrompt
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ 方案生成成功:');
    console.log(`   生成方案数: ${result.proposals.length}`);
    
    result.proposals.forEach((proposal, index) => {
      console.log(`\n   方案 ${index + 1}: ${proposal.title}`);
      console.log(`   - 标签: ${proposal.tags.join(', ')}`);
      console.log(`   - 推荐理由: ${proposal.reasoning}`);
      console.log(`   - 场景数: ${proposal.roughScript.scenes.length}`);
      console.log(`   - 视觉风格: ${proposal.visualStyle}`);
      console.log(`   - BGM风格: ${proposal.bgmStyle}`);
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return null;
  }
}

/**
 * 测试方案转换API
 */
async function testConvert(proposal) {
  console.log('\n🎬 测试方案转换...');
  console.log('-'.repeat(50));
  
  try {
    const response = await fetch(`${API_BASE}/api/inspiration/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proposal: proposal
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ 转换成功:');
    console.log(`   分镜场景数: ${result.scenes.length}`);
    
    result.scenes.forEach((scene, index) => {
      console.log(`\n   场景 ${index + 1}:`);
      console.log(`   - 类型: ${scene.type}`);
      console.log(`   - 时长: ${scene.duration}`);
      console.log(`   - 脚本: ${scene.script}`);
      console.log(`   - 视觉提示词: ${scene.visualPrompt.substring(0, 50)}...`);
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return null;
  }
}

/**
 * 运行完整测试流程
 */
async function runFullTest(testCase) {
  console.log('\n\n');
  console.log('🚀 开始测试: ' + testCase.name);
  console.log('='.repeat(70));
  
  // 步骤1: 测试情绪分析
  const analysisResult = await testAnalyze(testCase);
  if (!analysisResult) {
    console.log('❌ 情绪分析失败，跳过后续测试');
    return;
  }
  
  // 步骤2: 测试方案生成
  const generateResult = await testGenerate(analysisResult, testCase);
  if (!generateResult || generateResult.proposals.length === 0) {
    console.log('❌ 方案生成失败，跳过转换测试');
    return;
  }
  
  // 步骤3: 测试方案转换（使用第一个方案）
  const convertResult = await testConvert(generateResult.proposals[0]);
  if (!convertResult) {
    console.log('❌ 方案转换失败');
    return;
  }
  
  console.log('\n✅ 完整流程测试通过!');
  console.log('='.repeat(70));
}

/**
 * 主函数
 */
async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           灵感激发模式 API 测试                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  // 检查服务器连接
  try {
    const healthCheck = await fetch(`${API_BASE}/health`);
    if (!healthCheck.ok) {
      throw new Error('服务器健康检查失败');
    }
    console.log('✅ 服务器连接正常\n');
  } catch (error) {
    console.error('❌ 无法连接到服务器:', API_BASE);
    console.error('请确保后端服务正在运行 (npm run dev)');
    process.exit(1);
  }
  
  // 运行所有测试用例
  for (const testCase of testCases) {
    await runFullTest(testCase);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
  }
  
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           所有测试完成                                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

// 运行测试
main().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
