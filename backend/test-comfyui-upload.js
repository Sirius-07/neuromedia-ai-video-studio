/**
 * 测试上传图片到 ComfyUI
 * 用于诊断上传问题
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

// 配置 axios 跳过代理（解决代理导致的 503 错误）
const axiosConfig = {
  proxy: false,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
};

console.log('🧪 测试 ComfyUI 图片上传');
console.log('📍 ComfyUI 地址:', COMFYUI_URL);
console.log('');

async function testUpload() {
  try {
    // 1. 检查 ComfyUI 是否可访问
    console.log('1️⃣ 检查 ComfyUI 服务...');
    try {
      const healthCheck = await axios.get(`${COMFYUI_URL}/system_stats`, {
        ...axiosConfig,
        timeout: 5000
      });
      console.log('✅ ComfyUI 服务正常');
    } catch (error) {
      console.error('❌ 无法访问 ComfyUI 服务');
      console.error('   错误:', error.message);
      console.error('');
      console.error('💡 请确认:');
      console.error('   1. ComfyUI 是否真的在运行？');
      console.error('   2. 地址是否正确？', COMFYUI_URL);
      console.error('   3. 能否在浏览器中打开？', COMFYUI_URL);
      return;
    }
    console.log('');

    // 2. 查找一个测试图片
    console.log('2️⃣ 查找测试图片...');
    const uploadsDir = path.join(__dirname, 'uploads/assets');
    let testImagePath = null;
    
    try {
      const files = await fs.readdir(uploadsDir);
      const imageFiles = files.filter(f => 
        f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
      );
      
      if (imageFiles.length > 0) {
        testImagePath = path.join(uploadsDir, imageFiles[0]);
        console.log('✅ 找到测试图片:', imageFiles[0]);
      } else {
        console.log('❌ uploads/assets 目录中没有图片文件');
        return;
      }
    } catch (error) {
      console.error('❌ 无法读取 uploads/assets 目录:', error.message);
      return;
    }
    console.log('');

    // 3. 读取图片文件
    console.log('3️⃣ 读取图片文件...');
    let imageBuffer;
    try {
      const stat = await fs.stat(testImagePath);
      console.log('   文件大小:', (stat.size / 1024).toFixed(2), 'KB');
      imageBuffer = await fs.readFile(testImagePath);
      console.log('✅ 文件读取成功');
    } catch (error) {
      console.error('❌ 读取文件失败:', error.message);
      return;
    }
    console.log('');

    // 4. 上传到 ComfyUI
    console.log('4️⃣ 上传到 ComfyUI...');
    console.log('   上传地址:', `${COMFYUI_URL}/upload/image`);
    
    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename: path.basename(testImagePath),
        contentType: 'image/png'
      });

      console.log('   开始上传...');
      const uploadResponse = await axios.post(
        `${COMFYUI_URL}/upload/image`,
        formData,
        {
          ...axiosConfig,
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\r   上传进度: ${percentCompleted}%`);
          }
        }
      );

      console.log('\n✅ 上传成功！');
      console.log('   响应数据:', JSON.stringify(uploadResponse.data, null, 2));
      console.log('');
      console.log('🎉 测试通过！ComfyUI 图片上传功能正常。');

    } catch (error) {
      console.error('\n❌ 上传失败！');
      console.error('   错误代码:', error.code);
      console.error('   错误消息:', error.message);
      
      if (error.response) {
        console.error('   HTTP 状态:', error.response.status);
        console.error('   响应头:', error.response.headers);
        console.error('   响应数据:', error.response.data);
      }
      
      console.error('');
      console.error('💡 可能的原因:');
      
      if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
        console.error('   - ComfyUI 服务在处理请求时断开了连接');
        console.error('   - 可能是 ComfyUI 内部错误或配置问题');
        console.error('   - 请查看 ComfyUI 控制台的错误日志');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('   - 上传超时，ComfyUI 响应太慢');
        console.error('   - 可能是服务器负载过高');
      } else if (error.response && error.response.status === 404) {
        console.error('   - ComfyUI 的上传接口不存在');
        console.error('   - 可能是 ComfyUI 版本不兼容');
      } else {
        console.error('   - 未知错误，请检查 ComfyUI 日志');
      }
      
      console.error('');
      console.error('🔧 建议检查:');
      console.error('   1. ComfyUI 控制台是否有错误信息');
      console.error('   2. ComfyUI 版本是否支持图片上传接口');
      console.error('   3. 尝试在 ComfyUI 界面中手动上传图片测试');
      console.error('   4. 检查防火墙或安全软件是否阻止连接');
    }

  } catch (error) {
    console.error('❌ 测试过程出错:', error.message);
  }
}

// 运行测试
testUpload();


