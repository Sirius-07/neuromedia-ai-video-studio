/**
 * Python 环境诊断脚本
 * 用于测试 Python 和 Stable Audio 环境是否正确配置
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(80));
console.log('🔍 Python 环境诊断');
console.log('='.repeat(80));
console.log('');

// 测试 1: Python 版本
console.log('[1/6] 检查 Python 版本...');
const pythonVersion = spawn('python', ['--version']);
pythonVersion.stdout.on('data', (data) => {
  console.log(`✅ ${data.toString().trim()}`);
});
pythonVersion.stderr.on('data', (data) => {
  console.log(`✅ ${data.toString().trim()}`);
});
pythonVersion.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Python 未安装或不在 PATH 中');
    process.exit(1);
  }
  
  // 测试 2: PyTorch
  console.log('\n[2/6] 检查 PyTorch...');
  const torchTest = spawn('python', ['-c', 'import torch; print("PyTorch版本:", torch.__version__)']);
  torchTest.stdout.on('data', (data) => {
    console.log(`✅ ${data.toString().trim()}`);
  });
  torchTest.stderr.on('data', (data) => {
    console.error(`❌ ${data.toString().trim()}`);
  });
  torchTest.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ PyTorch 未安装');
      console.error('   安装命令: pip install torch torchaudio');
      process.exit(1);
    }
    
    // 测试 3: Torchaudio
    console.log('\n[3/6] 检查 Torchaudio...');
    const torchaudioTest = spawn('python', ['-c', 'import torchaudio; print("Torchaudio版本:", torchaudio.__version__)']);
    torchaudioTest.stdout.on('data', (data) => {
      console.log(`✅ ${data.toString().trim()}`);
    });
    torchaudioTest.stderr.on('data', (data) => {
      console.error(`❌ ${data.toString().trim()}`);
    });
    torchaudioTest.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Torchaudio 未安装');
        process.exit(1);
      }
      
      // 测试 4: 检查模型文件
      console.log('\n[4/6] 检查模型文件...');
      const modelPath = path.join(__dirname, '../stable-audio/model.safetensors');
      const configPath = path.join(__dirname, '../stable-audio/model_config.json');
      
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        console.log(`✅ 模型文件存在: ${modelPath}`);
        console.log(`   大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.error(`❌ 模型文件不存在: ${modelPath}`);
        process.exit(1);
      }
      
      if (fs.existsSync(configPath)) {
        console.log(`✅ 配置文件存在: ${configPath}`);
      } else {
        console.error(`❌ 配置文件不存在: ${configPath}`);
        process.exit(1);
      }
      
      // 测试 5: 检查批量生成脚本
      console.log('\n[5/6] 检查批量生成脚本...');
      const scriptPath = path.join(__dirname, '../stable-audio/batch_generate_audio.py');
      
      if (fs.existsSync(scriptPath)) {
        console.log(`✅ 批量生成脚本存在: ${scriptPath}`);
      } else {
        console.error(`❌ 批量生成脚本不存在: ${scriptPath}`);
        process.exit(1);
      }
      
      // 测试 6: 尝试导入关键模块
      console.log('\n[6/6] 测试 Python 脚本导入...');
      const stableAudioDir = path.join(__dirname, '../stable-audio');
      const importTest = spawn('python', ['-c', 'import sys; sys.path.insert(0, "stable-audio-tools"); from stable_audio_tools import get_pretrained_model; print("导入成功")'], {
        cwd: stableAudioDir
      });
      
      importTest.stdout.on('data', (data) => {
        console.log(`✅ ${data.toString().trim()}`);
      });
      
      importTest.stderr.on('data', (data) => {
        const output = data.toString();
        if (!output.includes('FutureWarning') && !output.includes('DeprecationWarning')) {
          console.error(`⚠️  ${output.trim()}`);
        }
      });
      
      importTest.on('close', (code) => {
        if (code !== 0) {
          console.error('\n❌ 模块导入失败');
          console.error('   请检查 stable-audio-tools 是否正确安装');
          console.error('   安装命令: cd stable-audio/stable-audio-tools && pip install -e .');
          process.exit(1);
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('🎉 所有检查通过！Python 环境配置正确');
        console.log('='.repeat(80));
        console.log('\n现在可以运行音频生成任务了！');
        console.log('如果还有问题，请尝试简单生成测试：');
        console.log('cd stable-audio');
        console.log('python generate_audio_api.py --prompt "test" --duration 2 --steps 50 --output test.wav');
        process.exit(0);
      });
    });
  });
});





















