/**
 * 快速测试 Python 脚本是否能正常调用
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 测试 Python 环境...\n');

// 测试 1: Python 版本
console.log('[1/3] 检查 Python 版本...');
const pythonVersion = spawn('python', ['--version']);

pythonVersion.stdout.on('data', (data) => {
  console.log(`✓ ${data.toString().trim()}`);
});

pythonVersion.stderr.on('data', (data) => {
  console.log(`✓ ${data.toString().trim()}`);
});

pythonVersion.on('close', (code) => {
  if (code === 0) {
    console.log('');
    
    // 测试 2: 检查 Python 脚本是否存在
    console.log('[2/3] 检查 Python 脚本...');
    const pythonScript = path.join(__dirname, '..', 'stable-audio', 'generate_audio_api.py');
    const fs = await import('fs');
    
    if (fs.existsSync(pythonScript)) {
      console.log(`✓ 脚本存在: ${pythonScript}\n`);
      
      // 测试 3: 尝试运行脚本（查看帮助信息）
      console.log('[3/3] 测试 Python 脚本...');
      console.log('执行: python generate_audio_api.py --help\n');
      
      const stableAudioDir = path.join(__dirname, '..', 'stable-audio');
      const testProcess = spawn('python', [pythonScript, '--help'], {
        cwd: stableAudioDir,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      
      testProcess.stdout.on('data', (data) => {
        console.log(data.toString());
      });
      
      testProcess.stderr.on('data', (data) => {
        console.error('错误:', data.toString());
      });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Python 环境测试通过！');
          console.log('\n现在可以运行完整测试：');
          console.log('  node test-direct-api.js\n');
        } else {
          console.error(`\n❌ Python 脚本执行失败 (退出码: ${code})`);
          console.error('\n可能的原因：');
          console.error('1. Python 依赖未安装');
          console.error('2. 模型文件缺失');
          console.error('3. 环境变量配置问题\n');
        }
      });
      
      testProcess.on('error', (error) => {
        console.error(`\n❌ 无法启动 Python 进程: ${error.message}`);
        console.error('\n请检查：');
        console.error('1. Python 是否已安装');
        console.error('2. Python 是否已添加到 PATH');
        console.error('3. 是否有权限执行 Python\n');
      });
      
    } else {
      console.error(`❌ 脚本不存在: ${pythonScript}\n`);
    }
    
  } else {
    console.error('❌ Python 未安装或未添加到 PATH\n');
  }
});

pythonVersion.on('error', (error) => {
  console.error(`❌ 无法运行 Python: ${error.message}`);
  console.error('\n请确保：');
  console.error('1. 已安装 Python 3.x');
  console.error('2. Python 已添加到系统 PATH');
  console.error('3. 在命令行中可以运行 "python --version"\n');
});


















