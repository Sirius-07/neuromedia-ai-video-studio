/**
 * TTS 服务管理器
 * 
 * 在 Node.js 后端启动时自动启动 IndexTTS2 服务
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TTSServiceManager {
  constructor() {
    this.ttsProcess = null;
    this.isStarting = false;
    this.isRunning = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    
    // IndexTTS2 服务配置
    this.ttsHost = process.env.INDEXTTS2_HOST || '127.0.0.1';
    this.ttsPort = process.env.INDEXTTS2_PORT || '6006';
    this.ttsApiUrl = `http://${this.ttsHost}:${this.ttsPort}`;
    
    // IndexTTS2 项目路径
    this.indexTtsPath = path.resolve(__dirname, '../../../index-tts');
  }

  /**
   * 检查 IndexTTS2 服务是否已在运行
   */
  async checkServiceRunning() {
    try {
      const response = await axios.get(`${this.ttsApiUrl}/health`, {
        timeout: 3000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * 启动 IndexTTS2 服务
   */
  async startService() {
    if (this.isStarting || this.isRunning) {
      console.log('⚠️ IndexTTS2 服务已在启动中或已运行');
      return false;
    }

    // 先检查是否已有服务在运行
    console.log('🔍 检查 IndexTTS2 服务状态...');
    const isRunning = await this.checkServiceRunning();
    
    if (isRunning) {
      console.log('✅ IndexTTS2 服务已在运行');
      this.isRunning = true;
      return true;
    }

    console.log('🚀 启动 IndexTTS2 服务...');
    this.isStarting = true;

    try {
      // 检查 index-tts 目录是否存在
      const fs = await import('fs');
      if (!fs.existsSync(this.indexTtsPath)) {
        console.error(`❌ IndexTTS2 目录不存在: ${this.indexTtsPath}`);
        console.log('请先克隆 IndexTTS2 仓库:');
        console.log('  cd F:\\AIEditing');
        console.log('  git clone https://github.com/index-tts/index-tts.git');
        this.isStarting = false;
        return false;
      }

      // 启动 IndexTTS2 服务（Python脚本）
      const pythonPath = process.env.PYTHON_PATH || 'python';
      const scriptPath = path.join(this.indexTtsPath, 'api_server_v2.py');

      console.log(`📍 IndexTTS2 路径: ${this.indexTtsPath}`);
      console.log(`🐍 Python: ${pythonPath}`);
      console.log(`📜 脚本: ${scriptPath}`);
      console.log(`🌐 端口: ${this.ttsPort}`);

      this.ttsProcess = spawn(pythonPath, [
        scriptPath,
        '--host', this.ttsHost,
        '--port', this.ttsPort
      ], {
        cwd: this.indexTtsPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // 监听标准输出
      this.ttsProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[IndexTTS2] ${output.trim()}`);
        
        // 检测服务启动成功的标志
        if (output.includes('Uvicorn running on') || output.includes('Application startup complete')) {
          this.isRunning = true;
          this.isStarting = false;
          console.log('✅ IndexTTS2 服务启动成功！');
        }
      });

      // 监听标准错误
      this.ttsProcess.stderr.on('data', (data) => {
        const error = data.toString();
        
        // 检测服务启动成功的标志(Uvicorn日志输出到stderr)
        if (error.includes('Uvicorn running on') || error.includes('Application startup complete')) {
          this.isRunning = true;
          this.isStarting = false;
          console.log('✅ IndexTTS2 服务启动成功！');
        }
        
        // 过滤掉一些无关紧要的警告
        if (!error.includes('Trying to detect encoding') && 
            !error.includes('UserWarning') &&
            error.trim()) {
          console.error(`[IndexTTS2 Error] ${error.trim()}`);
        }
      });

      // 监听进程退出
      this.ttsProcess.on('close', (code) => {
        console.log(`⚠️ IndexTTS2 服务进程退出，代码: ${code}`);
        this.isRunning = false;
        this.isStarting = false;
        this.ttsProcess = null;

        // 如果异常退出且未超过重试次数，尝试重启
        if (code !== 0 && this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`🔄 尝试重启 IndexTTS2 (${this.retryCount}/${this.maxRetries})...`);
          setTimeout(() => this.startService(), 5000);
        }
      });

      this.ttsProcess.on('error', (error) => {
        console.error('❌ IndexTTS2 启动失败:', error.message);
        this.isRunning = false;
        this.isStarting = false;
      });

      // 等待5秒，让服务有时间启动
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 再次检查服务是否成功启动
      const started = await this.checkServiceRunning();
      if (started) {
        console.log('✅ IndexTTS2 服务已就绪！');
        this.isRunning = true;
        this.isStarting = false;
        return true;
      } else {
        console.log('⏳ IndexTTS2 服务正在初始化，请稍候...');
        this.isStarting = false;
        return false;
      }

    } catch (error) {
      console.error('❌ 启动 IndexTTS2 服务时出错:', error);
      this.isRunning = false;
      this.isStarting = false;
      return false;
    }
  }

  /**
   * 停止 IndexTTS2 服务
   */
  stopService() {
    if (this.ttsProcess) {
      console.log('🛑 停止 IndexTTS2 服务...');
      this.ttsProcess.kill();
      this.ttsProcess = null;
      this.isRunning = false;
      this.isStarting = false;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isStarting: this.isStarting,
      apiUrl: this.ttsApiUrl,
      processId: this.ttsProcess?.pid
    };
  }
}

// 创建全局实例
const ttsServiceManager = new TTSServiceManager();

// 导出实例和辅助函数
export default ttsServiceManager;

export const startTTSService = () => ttsServiceManager.startService();
export const stopTTSService = () => ttsServiceManager.stopService();
export const getTTSServiceStatus = () => ttsServiceManager.getStatus();

