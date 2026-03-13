/**
 * 图片生成API测试脚本
 * 使用方法：node test-image-generation.js
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: './backend/.env' });

const API_KEY = process.env.ARK_API_KEY;
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

// 测试用例
const testCases = [
  {
    name: '测试1：文生图 - doubao-seedream-4.5',
    params: {
      model: 'doubao-seedream-4.5',
      prompt: '广州塔夜景，塔身灯光变幻色彩，珠江水面倒映光影，现代都市氛围，高质量摄影作品',
      size: '2K',
      sequential_image_generation: 'auto',
      sequential_image_generation_options: {
        max_images: 4
      },
      response_format: 'url',
      watermark: true
    }
  },
  {
    name: '测试2：文生图 - doubao-seedream-4.0',
    params: {
      model: 'doubao-seedream-4.0',
      prompt: '广州早茶店内景，蒸笼升腾热气，食客用筷子夹起虾饺，温馨市井氛围',
      size: '2K',
      sequential_image_generation: 'auto',
      sequential_image_generation_options: {
        max_images: 4
      },
      response_format: 'url',
      watermark: true
    }
  },
  {
    name: '测试3：文生图 - doubao-seedream-3.0-t2i',
    params: {
      model: 'doubao-seedream-3.0-t2i',
      prompt: '珠江夜游，游船驶过，两岸高楼灯光璀璨',
      size: '1024x1024',
      seed: -1,
      response_format: 'url',
      watermark: true
    }
  }
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// 测试单个用例
async function testCase(testCase) {
  log(colors.cyan, '\n' + '='.repeat(80));
  log(colors.bright + colors.cyan, `📋 ${testCase.name}`);
  log(colors.cyan, '='.repeat(80));
  
  try {
    log(colors.blue, '\n📤 请求参数:');
    console.log(JSON.stringify(testCase.params, null, 2));

    log(colors.yellow, '\n⏳ 发送请求...');
    const startTime = Date.now();

    const response = await axios.post(API_URL, testCase.params, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3分钟超时
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log(colors.green, `\n✅ 请求成功！耗时: ${duration}秒`);
    
    const result = response.data;
    log(colors.green, '\n📊 响应数据:');
    console.log(JSON.stringify({
      model: result.model,
      created: result.created,
      imageCount: result.data?.length || 0,
      usage: result.usage
    }, null, 2));

    // 显示生成的图片URL
    if (result.data && result.data.length > 0) {
      log(colors.green, '\n🖼️ 生成的图片:');
      result.data.forEach((img, index) => {
        if (img.url) {
          console.log(`  ${index + 1}. ${img.url.substring(0, 100)}...`);
        } else if (img.error) {
          log(colors.red, `  ${index + 1}. 错误: ${img.error.message}`);
        }
      });
    }

    return { success: true, result };

  } catch (error) {
    log(colors.red, '\n❌ 请求失败!');
    
    if (error.response) {
      const { status, data } = error.response;
      log(colors.red, `\n🔴 HTTP状态码: ${status}`);
      log(colors.red, '\n错误详情:');
      console.log(JSON.stringify(data, null, 2));

      // 解析常见错误
      if (status === 403) {
        log(colors.yellow, '\n💡 解决方案: 账户余额不足或欠费，请登录火山方舟控制台充值');
        log(colors.yellow, '   https://console.volcengine.com/ark');
      } else if (status === 404) {
        log(colors.yellow, '\n💡 解决方案: 模型不存在或无权限，请检查：');
        log(colors.yellow, '   1. 模型名称是否正确');
        log(colors.yellow, '   2. 是否已在控制台开通该模型权限');
        log(colors.yellow, '   https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement');
      } else if (status === 401) {
        log(colors.yellow, '\n💡 解决方案: API Key无效，请检查 .env 文件中的 ARK_API_KEY');
      } else if (status === 400) {
        log(colors.yellow, '\n💡 解决方案: 请求参数错误，请检查参数格式是否符合API文档');
      }
    } else if (error.code === 'ECONNABORTED') {
      log(colors.red, '\n🔴 请求超时（180秒）');
    } else {
      log(colors.red, '\n🔴 网络错误:', error.message);
    }

    return { success: false, error };
  }
}

// 主函数
async function main() {
  log(colors.bright + colors.cyan, '\n' + '🚀 图片生成API测试工具\n');

  // 检查API Key
  if (!API_KEY) {
    log(colors.red, '❌ 错误：未找到 ARK_API_KEY');
    log(colors.yellow, '请在 backend/.env 文件中配置：');
    log(colors.yellow, 'ARK_API_KEY=你的API密钥\n');
    process.exit(1);
  }

  log(colors.green, '✅ API Key已配置');
  log(colors.blue, `📍 API地址: ${API_URL}`);
  log(colors.blue, `🔑 API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);

  // 运行测试用例
  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const result = await testCase(testCase);
    results.push({ name: testCase.name, ...result });
    
    // 测试间隔（避免频率限制）
    if (i < testCases.length - 1) {
      log(colors.yellow, '\n⏸️ 等待5秒后继续下一个测试...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // 测试总结
  log(colors.cyan, '\n' + '='.repeat(80));
  log(colors.bright + colors.cyan, '📊 测试总结');
  log(colors.cyan, '='.repeat(80) + '\n');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? colors.green : colors.red;
    log(color, `${icon} ${result.name}`);
  });

  log(colors.cyan, '\n' + '-'.repeat(80));
  log(colors.bright, `总计: ${results.length} 个测试`);
  log(colors.green, `成功: ${successCount} 个`);
  if (failCount > 0) {
    log(colors.red, `失败: ${failCount} 个`);
  }

  // 根据结果给出建议
  if (successCount > 0) {
    log(colors.green, '\n🎉 至少有一个模型可用！');
    log(colors.green, '建议使用成功的模型配置到您的应用中。');
  } else {
    log(colors.red, '\n😞 所有测试都失败了');
    log(colors.yellow, '\n请按照以下步骤排查：');
    log(colors.yellow, '1. 检查账户余额是否充足');
    log(colors.yellow, '2. 检查是否已开通相关模型权限');
    log(colors.yellow, '3. 检查 API Key 是否有效');
    log(colors.yellow, '4. 查看详细错误信息，访问火山方舟文档');
  }

  log(colors.cyan, '\n' + '='.repeat(80) + '\n');
}

// 运行测试
main().catch(error => {
  log(colors.red, '\n❌ 测试程序异常:', error);
  process.exit(1);
});

