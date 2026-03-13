/**
 * TTS 控制器 - 语音合成
 * 
 * 对接 Python IndexTTS2 服务
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 调用 Python TTS 服务
 */
async function callPythonTTS(method, params = {}) {
  return new Promise((resolve, reject) => {
    const pythonPath = 'python';
    const scriptPath = path.join(__dirname, '../../python/services/indextts_service.py');
    
    const args = [
      scriptPath,
      method,
      JSON.stringify(params)
    ];
    
    console.log('调用 Python TTS:', method, params);
    
    // 设置环境变量，确保 Python 使用 UTF-8 编码
    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1'
    };
    
    const pythonProcess = spawn(pythonPath, args, { env });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      // 明确使用 UTF-8 解码
      stdout += data.toString('utf-8');
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`解析 Python 输出失败: ${stdout}`));
        }
      } else {
        reject(new Error(`Python 进程错误 (code ${code}): ${stderr}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 生成单个配音
 */
export async function generateVoiceover(req, res) {
  try {
    const { text, voice = 'stable-male', speed = 1.0, emotion = 'neutral' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: text'
      });
    }
    
    console.log('🎤 生成配音:', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      voice,
      speed,
      emotion
    });
    
    // 调用 Python TTS 服务
    const result = await callPythonTTS('generate', {
      text,
      voice,
      speed,
      emotion
    });
    
    if (result.success) {
      console.log('✅ 配音生成成功:', result.audio_url);
      return res.json(result);
    } else {
      console.error('❌ 配音生成失败:', result.message);
      return res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('❌ 生成配音异常:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * 批量生成配音
 */
export async function batchGenerateVoiceovers(req, res) {
  try {
    const { texts, voice = 'stable-male', speed = 1.0, emotion = 'neutral' } = req.body;
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: texts (数组)'
      });
    }
    
    console.log(`🎤 批量生成 ${texts.length} 个配音`, { voice, speed, emotion });
    
    // 调用 Python TTS 服务
    const result = await callPythonTTS('batch_generate', {
      texts,
      voice,
      speed,
      emotion
    });
    
    if (result.success) {
      console.log(`✅ 批量生成完成: ${result.success_count}/${result.total} 成功`);
      return res.json(result);
    } else {
      console.error('❌ 批量生成失败:', result.message);
      return res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('❌ 批量生成配音异常:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * 为分镜列表生成配音
 */
export async function generateSceneVoiceovers(req, res) {
  try {
    const { scenes, voice = 'stable-male', speed = 1.0, emotion = 'neutral' } = req.body;
    
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: scenes (数组)'
      });
    }
    
    console.log(`🎬 为 ${scenes.length} 个分镜生成配音`);
    
    // 提取旁白文案
    const narrations = scenes.map((scene, index) => {
      const narration = scene.narration || scene.script || '';
      if (!narration) {
        console.warn(`⚠️ 分镜 #${index + 1} 缺少旁白文案`);
      }
      return narration;
    });
    
    // 批量生成
    const result = await callPythonTTS('batch_generate', {
      texts: narrations,
      voice,
      speed,
      emotion
    });
    
    if (result.success) {
      // 将生成结果映射回分镜
      const scenesWithVoiceovers = scenes.map((scene, index) => ({
        ...scene,
        voiceover: result.results[index]
      }));
      
      console.log(`✅ 分镜配音生成完成: ${result.success_count}/${result.total}`);
      
      return res.json({
        success: true,
        scenes: scenesWithVoiceovers,
        summary: {
          total: result.total,
          success_count: result.success_count,
          failed_count: result.failed_count
        },
        message: result.message
      });
    } else {
      console.error('❌ 分镜配音生成失败:', result.message);
      return res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('❌ 生成分镜配音异常:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * 获取可用的语音列表
 */
export async function getVoices(req, res) {
  try {
    const result = await callPythonTTS('get_voices', {});
    
    return res.json({
      success: true,
      voices: result
    });
    
  } catch (error) {
    console.error('❌ 获取语音列表失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * 健康检查 - 检查 IndexTTS2 服务是否可用
 */
export async function healthCheck(req, res) {
  try {
    const result = await callPythonTTS('health_check', {});
    
    return res.json({
      success: true,
      status: 'ok',
      ...result
    });
    
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'unavailable',
      message: 'IndexTTS2 服务不可用。请确保已启动: python api_server_v2.py',
      error: error.message
    });
  }
}

