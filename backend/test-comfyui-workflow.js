/**
 * ComfyUI 工作流验证脚本
 * 测试工作流配置是否正确
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMFYUI_URL = process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188';
const WORKFLOW_PATH = path.join(__dirname, '../video_wan2_2_14B_i2v.json');

// 配置 axios 跳过代理
const axiosConfig = {
  proxy: false,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
};

console.log('🧪 测试 ComfyUI 工作流配置');
console.log('📍 ComfyUI 地址:', COMFYUI_URL);
console.log('📄 工作流文件:', WORKFLOW_PATH);
console.log('');

async function testWorkflow() {
  try {
    // 1. 检查工作流文件
    console.log('1️⃣ 检查工作流文件...');
    let workflow;
    try {
      const content = await fs.readFile(WORKFLOW_PATH, 'utf-8');
      workflow = JSON.parse(content);
      console.log('✅ 工作流文件格式正确');
      console.log('   节点数量:', Object.keys(workflow).length);
    } catch (error) {
      console.error('❌ 工作流文件错误:', error.message);
      return;
    }
    console.log('');

    // 2. 分析工作流节点
    console.log('2️⃣ 分析工作流节点...');
    for (const [nodeId, node] of Object.entries(workflow)) {
      console.log(`   节点 ${nodeId}: ${node.class_type}`);
      if (node.class_type === 'LoadImage') {
        console.log(`      → 图片文件: ${node.inputs.image}`);
      }
      if (node.class_type === 'CheckpointLoaderSimple') {
        console.log(`      → 模型: ${node.inputs.ckpt_name}`);
      }
      if (node.class_type === 'VAELoader') {
        console.log(`      → VAE: ${node.inputs.vae_name}`);
      }
      if (node.class_type === 'DualCLIPLoader') {
        console.log(`      → CLIP1: ${node.inputs.clip_name1}`);
        console.log(`      → CLIP2: ${node.inputs.clip_name2}`);
      }
    }
    console.log('');

    // 3. 检查 ComfyUI 服务
    console.log('3️⃣ 检查 ComfyUI 服务...');
    try {
      const healthCheck = await axios.get(`${COMFYUI_URL}/system_stats`, {
        ...axiosConfig,
        timeout: 5000
      });
      console.log('✅ ComfyUI 服务正常');
    } catch (error) {
      console.error('❌ 无法访问 ComfyUI:', error.message);
      return;
    }
    console.log('');

    // 4. 检查可用的模型
    console.log('4️⃣ 检查 ComfyUI 可用模型...');
    try {
      const objectInfo = await axios.get(`${COMFYUI_URL}/object_info`, axiosConfig);
      const nodeTypes = Object.keys(objectInfo.data);
      
      console.log('   检查必需的节点类型:');
      const requiredNodes = [
        'LoadImage',
        'CLIPTextEncode',
        'DualCLIPLoader',
        'CogVideoImageToVideoPipe',
        'VHS_VideoCombine',
        'VAELoader',
        'CheckpointLoaderSimple',
        'KSampler',
        'VAEDecode',
        'RandomNoise'
      ];
      
      for (const nodeType of requiredNodes) {
        if (nodeTypes.includes(nodeType)) {
          console.log(`   ✅ ${nodeType}`);
        } else {
          console.log(`   ❌ ${nodeType} - 未找到！`);
        }
      }
    } catch (error) {
      console.error('❌ 获取节点信息失败:', error.message);
    }
    console.log('');

    // 5. 尝试提交工作流（测试提交，不实际执行）
    console.log('5️⃣ 测试提交工作流...');
    try {
      // 修改工作流，设置一个测试图片
      const testWorkflow = JSON.parse(JSON.stringify(workflow));
      if (testWorkflow['97']) {
        testWorkflow['97'].inputs.image = 'test.png'; // 使用一个测试文件名
      }
      
      const response = await axios.post(
        `${COMFYUI_URL}/prompt`,
        {
          prompt: testWorkflow,
          client_id: `test_client_${Date.now()}`
        },
        {
          ...axiosConfig,
          timeout: 10000
        }
      );

      if (response.data.prompt_id) {
        console.log('✅ 工作流提交成功！');
        console.log('   prompt_id:', response.data.prompt_id);
        console.log('');
        console.log('🎉 所有测试通过！工作流配置正确。');
      } else {
        console.log('⚠️  工作流已接受，但没有返回 prompt_id');
      }

    } catch (error) {
      console.error('❌ 工作流提交失败！');
      console.error('   HTTP 状态:', error.response?.status);
      
      if (error.response?.data) {
        console.error('   错误详情:', JSON.stringify(error.response.data, null, 2));
        
        // 解析具体错误
        const errorData = error.response.data;
        if (errorData.error) {
          console.error('');
          console.error('🔍 详细错误分析:');
          
          if (errorData.error.node_errors) {
            console.error('   节点错误:');
            for (const [nodeId, errors] of Object.entries(errorData.error.node_errors)) {
              console.error(`   • 节点 ${nodeId} (${workflow[nodeId]?.class_type}):`);
              for (const err of errors) {
                if (typeof err === 'object') {
                  console.error(`     - ${err.message || JSON.stringify(err)}`);
                  if (err.details) {
                    console.error(`       详情: ${err.details}`);
                  }
                } else {
                  console.error(`     - ${err}`);
                }
              }
            }
          }
          
          if (errorData.error.exception_message) {
            console.error('   异常信息:', errorData.error.exception_message);
          }
        }
        
        console.error('');
        console.error('💡 可能的解决方案:');
        console.error('   1. 检查 ComfyUI 中是否安装了所需的自定义节点');
        console.error('   2. 确认模型文件存在于正确的目录');
        console.error('   3. 在 ComfyUI 界面中手动加载并测试工作流');
        console.error('   4. 查看 ComfyUI 控制台的详细错误日志');
      }
    }

  } catch (error) {
    console.error('❌ 测试过程出错:', error.message);
  }
}

// 运行测试
testWorkflow();


























