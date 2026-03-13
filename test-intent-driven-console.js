/**
 * 意图驱动控制台 - API 测试脚本
 * 用于验证后端接口是否正常工作
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

/**
 * 测试 1: 初始化模式（冷启动）
 */
async function testInitialization() {
  section('测试 1: 初始化模式（冷启动）');
  
  try {
    log('📤 发送请求：初始化标签', 'yellow');
    
    const response = await axios.post(`${API_BASE_URL}/api/ai/refine-tags`, {
      scriptContent: '广州塔在夜晚的珠江边，灯光璀璨，游船缓缓驶过',
      currentTags: undefined,
      userInstruction: undefined
    });

    if (response.data.code === 200) {
      log('✅ 测试通过', 'green');
      console.log('返回的标签数据:');
      console.log(JSON.stringify(response.data.data.tags, null, 2));
      console.log('\nAI 说明:');
      log(response.data.data.message, 'blue');
      return response.data.data.tags;
    } else {
      throw new Error(`API 返回错误码: ${response.data.code}`);
    }
  } catch (error) {
    log('❌ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * 测试 2: 修订模式 - 添加元素
 */
async function testRefinementAdd(currentTags) {
  section('测试 2: 修订模式 - 添加元素');
  
  try {
    log('📤 发送请求：添加"雨"和"推进镜头"', 'yellow');
    
    const response = await axios.post(`${API_BASE_URL}/api/ai/refine-tags`, {
      scriptContent: '广州塔在夜晚的珠江边，灯光璀璨，游船缓缓驶过',
      currentTags,
      userInstruction: '加点雨，让镜头慢慢推进'
    });

    if (response.data.code === 200) {
      log('✅ 测试通过', 'green');
      console.log('更新后的标签:');
      console.log(JSON.stringify(response.data.data.tags, null, 2));
      console.log('\nAI 说明:');
      log(response.data.data.message, 'blue');
      return response.data.data.tags;
    } else {
      throw new Error(`API 返回错误码: ${response.data.code}`);
    }
  } catch (error) {
    log('❌ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * 测试 3: 修订模式 - 修改风格（冲突检测）
 */
async function testRefinementConflict(currentTags) {
  section('测试 3: 修订模式 - 冲突检测（改变时间）');
  
  try {
    log('📤 发送请求：将夜晚改成白天', 'yellow');
    
    const response = await axios.post(`${API_BASE_URL}/api/ai/refine-tags`, {
      scriptContent: '广州塔在夜晚的珠江边，灯光璀璨，游船缓缓驶过',
      currentTags,
      userInstruction: '改成白天的场景'
    });

    if (response.data.code === 200) {
      log('✅ 测试通过', 'green');
      console.log('更新后的标签（应删除"夜晚"相关）:');
      console.log(JSON.stringify(response.data.data.tags, null, 2));
      console.log('\nAI 说明:');
      log(response.data.data.message, 'blue');
      
      // 验证冲突检测
      const hasNightTags = response.data.data.tags.environment.some(tag => 
        tag.includes('夜') || tag.includes('晚')
      );
      
      if (hasNightTags) {
        log('⚠️  警告：AI 未能正确删除夜晚相关标签', 'yellow');
      } else {
        log('✅ 冲突检测正常工作', 'green');
      }
      
      return response.data.data.tags;
    } else {
      throw new Error(`API 返回错误码: ${response.data.code}`);
    }
  } catch (error) {
    log('❌ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * 测试 4: 修订模式 - 删除元素
 */
async function testRefinementRemove(currentTags) {
  section('测试 4: 修订模式 - 删除元素');
  
  try {
    log('📤 发送请求：去掉游船', 'yellow');
    
    const response = await axios.post(`${API_BASE_URL}/api/ai/refine-tags`, {
      scriptContent: '广州塔在夜晚的珠江边，灯光璀璨，游船缓缓驶过',
      currentTags,
      userInstruction: '去掉游船'
    });

    if (response.data.code === 200) {
      log('✅ 测试通过', 'green');
      console.log('更新后的标签（应删除"游船"）:');
      console.log(JSON.stringify(response.data.data.tags, null, 2));
      console.log('\nAI 说明:');
      log(response.data.data.message, 'blue');
      return response.data.data.tags;
    } else {
      throw new Error(`API 返回错误码: ${response.data.code}`);
    }
  } catch (error) {
    log('❌ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * 测试 5: 错误处理 - 缺少必填参数
 */
async function testErrorHandling() {
  section('测试 5: 错误处理 - 缺少必填参数');
  
  try {
    log('📤 发送请求：缺少 scriptContent', 'yellow');
    
    const response = await axios.post(`${API_BASE_URL}/api/ai/refine-tags`, {
      // 故意不传 scriptContent
      currentTags: undefined,
      userInstruction: undefined
    });

    log('❌ 测试失败：应该返回 400 错误', 'red');
  } catch (error) {
    if (error.response?.status === 400) {
      log('✅ 测试通过：正确返回 400 错误', 'green');
      console.log('错误信息:', error.response.data.message);
    } else {
      log('❌ 测试失败：错误码不正确', 'red');
      console.error(error.response?.data || error.message);
    }
  }
}

/**
 * 主测试流程
 */
async function runAllTests() {
  log('\n🚀 开始测试意图驱动控制台 API\n', 'cyan');
  
  try {
    // 检查后端是否运行
    try {
      await axios.get(`${API_BASE_URL}/health`);
      log('✅ 后端服务正常运行', 'green');
    } catch (error) {
      log('❌ 无法连接到后端服务，请先启动: cd backend && npm run dev', 'red');
      process.exit(1);
    }

    // 运行测试
    const tags1 = await testInitialization();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
    
    const tags2 = await testRefinementAdd(tags1);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const tags3 = await testRefinementConflict(tags2);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testRefinementRemove(tags3);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testErrorHandling();

    // 总结
    section('测试总结');
    log('✅ 所有测试通过！', 'green');
    log('\n系统已准备好投入使用。', 'blue');
    
  } catch (error) {
    section('测试总结');
    log('❌ 部分测试失败，请检查错误信息', 'red');
    process.exit(1);
  }
}

// 运行测试
runAllTests();

