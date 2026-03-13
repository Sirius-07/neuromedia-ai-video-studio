/**
 * ComfyUI 服务健康检查脚本
 * 用于快速检查 ComfyUI 服务是否正常运行
 */

import axios from 'axios';

const COMFYUI_URL = process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188';

console.log('🔍 开始检查 ComfyUI 服务状态...');
console.log('📍 检查地址:', COMFYUI_URL);
console.log('');

async function checkComfyUI() {
  try {
    // 1. 检查系统状态
    console.log('1️⃣ 检查系统状态...');
    const statsResponse = await axios.get(`${COMFYUI_URL}/system_stats`, {
      timeout: 5000
    });
    console.log('✅ 系统状态正常');
    console.log('   设备信息:', JSON.stringify(statsResponse.data, null, 2));
    console.log('');

    // 2. 检查队列状态
    console.log('2️⃣ 检查任务队列...');
    const queueResponse = await axios.get(`${COMFYUI_URL}/queue`, {
      timeout: 5000
    });
    console.log('✅ 队列状态正常');
    console.log('   运行中任务:', queueResponse.data.queue_running.length);
    console.log('   等待中任务:', queueResponse.data.queue_pending.length);
    console.log('');

    // 3. 检查历史记录
    console.log('3️⃣ 检查历史记录接口...');
    const historyResponse = await axios.get(`${COMFYUI_URL}/history`, {
      timeout: 5000
    });
    console.log('✅ 历史记录接口正常');
    console.log('');

    console.log('🎉 ComfyUI 服务完全正常！可以开始使用图生视频功能。');
    return true;

  } catch (error) {
    console.error('❌ ComfyUI 服务检查失败！');
    console.error('');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔴 错误原因: 连接被拒绝');
      console.error('💡 解决方案:');
      console.error('   1. 确认 ComfyUI 是否已启动');
      console.error('   2. 检查 ComfyUI 是否运行在', COMFYUI_URL);
      console.error('   3. 如果 ComfyUI 运行在其他地址，请设置环境变量 COMFYUI_API_URL');
      console.error('');
      console.error('启动 ComfyUI 的方法：');
      console.error('   cd <ComfyUI目录>');
      console.error('   python main.py');
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.error('🔴 错误原因: 连接超时');
      console.error('💡 解决方案:');
      console.error('   1. 检查 ComfyUI 服务是否响应缓慢');
      console.error('   2. 检查网络连接');
      console.error('   3. 尝试重启 ComfyUI 服务');
    } else if (error.message.includes('socket hang up')) {
      console.error('🔴 错误原因: 连接中断');
      console.error('💡 解决方案:');
      console.error('   1. 确认 ComfyUI 服务正在运行');
      console.error('   2. 检查是否有防火墙阻止连接');
      console.error('   3. 尝试重启 ComfyUI 服务');
    } else {
      console.error('🔴 错误详情:', error.message);
    }
    
    console.error('');
    console.error('📚 更多帮助，请查看: backend/COMFYUI_I2V_GUIDE.md');
    
    return false;
  }
}

// 运行检查
checkComfyUI().then(success => {
  process.exit(success ? 0 : 1);
});



























