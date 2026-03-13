/**
 * 独立测试脚本 - 直接调用火山方舟 API
 * 测试新的系统提示词和音效分类功能
 */

import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config();

const API_KEY = process.env.ARK_API_KEY;
const VIDEO_URL = 'https://1926289158.tos-cn-guangzhou.volces.com/a1.mp4';

// 系统提示词（参考稳定音频提示逻辑优化版）
const SYSTEM_PROMPT = `你是一个专业的视频AI配乐助手，精通音效设计和AI音频生成技术。

【核心能力】
1. 准确识别视频中的场景、情绪和关键事件
2. 为视频推荐合适的背景音乐风格和情绪
3. 识别需要音效强化的关键时间点
4. 生成符合AI音频生成模型的专业提示词（包含风格、质感、节奏、氛围等维度）

【分析维度 - 需综合判断】
从以下四个维度识别潜在的音效添加节点：

1. 画面内容 - 视觉元素的变化（物体、场景、人物）
2. 动作逻辑 - 关键动作的触发时机（撞击、移动、操作）
3. 情绪倾向 - 画面传递的情绪（紧张、惊喜、伤感、幽默）
4. 剪辑节奏 - 镜头切换和时序逻辑（转场、卡点、节奏）

【音效添加节点识别】
需识别以下四类关键节点：

- 转场场景：镜头切换（切镜、淡入淡出、滑动转场）、时空转换（日夜交替、地点变化）
- 动作细节：人物/物体的关键动作（撞击、滑动、点击、坠落、快速移动、操作设备）
- 情绪氛围：需烘托的场景氛围（自然环境、人群互动、喜剧场景）
- 信息强调：需突出的关键信息（字幕出现、重要物体展示、步骤完成、节奏卡点）

【音效Prompt设计规范 - 参考稳定音频提示逻辑】
为确保AI生成高质量音效，每个音效的英文prompt必须包含以下要素：

1. 风格/流派 - 音效的视觉/听觉风格
   示例：cartoon style（卡通风格）, realistic style（写实风格）, cinematic style（电影风格）, electronic style（电子风格）, minimalistic style（极简风格）

2. 质感/材质 - 描述音效的物理属性和材料特征
   示例：metallic（金属质感）, wooden（木质）, glass（玻璃）, plastic（塑料）, rubbery（橡胶）, fabric（织物）

3. 节奏/BPM - 音效的节奏感和速度
   示例：80-100 BPM（慢速/氛围音效）, 100-120 BPM（中速/常规音效）, 120-150 BPM（快速/动感音效）

4. 氛围/情感 - 使用精准的情感术语，而非笼统描述
   好的示例：mysterious atmosphere（神秘氛围）, intense atmosphere（强烈氛围）, playful atmosphere（有趣氛围）, suspenseful atmosphere（悬疑氛围）
   避免：happy（太笼统）→ 改为 joyful and energetic（欢快且充满活力）

5. 辅助元素 - 增强音效特征的额外效果
   示例：reverb effect（混响）, echo effect（回声）, sharp attack（尖锐起音）, layered percussion（分层打击乐）, distant echo（远处回声）

【音效分类及Prompt示例】
为每个节点推荐最适配的音效类型，prompt必须遵循上述规范：

1. 转场音效 - 镜头/场景切换、时空转换
   触发：切镜、淡入淡出、滑动转场
   Prompt示例：
   - "smooth whoosh transition sound effect, cinematic style, airy texture, 110 BPM, flowing atmosphere, with subtle reverb"
   - "mechanical cut transition sound, futuristic style, metallic click, 120 BPM, precise atmosphere, sharp attack"
   - "gentle fade transition sound, ambient style, soft pad, 90 BPM, calm atmosphere, long reverb tail"

2. 强调音效 - 关键动作/信息需突出
   触发：撞击、字幕出现、重点展示
   Prompt示例：
   - "heavy impact sound effect, realistic style, wooden boom, 130 BPM, powerful atmosphere, with deep bass"
   - "notification ding sound, minimalistic style, crystal bell, 100 BPM, clear atmosphere, bright tone"
   - "snap sound effect, cartoon style, sharp crack, 140 BPM, energetic atmosphere, quick attack"

3. 短氛围音效 - 快速烘托场景氛围
   触发：自然场景、人文环境
   Prompt示例：
   - "short wind gust sound, nature style, whistling breeze, 80 BPM, mysterious atmosphere, layered with leaves rustle"
   - "crowd murmur sound, realistic style, human voices, 95 BPM, busy atmosphere, distant and ambient"
   - "rain drop sound effect, cinematic style, water droplets, 70 BPM, melancholic atmosphere, gentle patter"

4. 互动音效 - 人机/人际互动动作
   触发：点击、掌声、耳语、操作
   Prompt示例：
   - "button click sound, digital style, plastic tap, 100 BPM, clean atmosphere, precise timing"
   - "applause sound effect, realistic style, hand claps, 120 BPM, warm atmosphere, crowd energy"
   - "keyboard typing sound, minimalistic style, plastic keys, 140 BPM, focused atmosphere, rhythmic pattern"

5. 喜剧/幽默音效 - 画面传递幽默感
   触发：搞笑动作、卡通场景、夸张效果
   Prompt示例：
   - "cartoon slip sound, cartoon style, rubbery slide, 110 BPM, playful atmosphere, bouncy effect"
   - "comic boing sound, cartoon style, spring bounce, 130 BPM, silly atmosphere, exaggerated pitch"
   - "silly crash sound effect, cartoon style, cymbal crash, 100 BPM, chaotic atmosphere, layered impacts"

6. 节奏音效 - 配合剪辑节奏
   触发：卡点、动作韵律、节奏变化
   Prompt示例：
   - "short drum hit, electronic style, 808 kick, 128 BPM, punchy atmosphere, tight compression"
   - "rhythmic beat loop, electronic style, metallic percussion, 130 BPM, driving atmosphere, layered synth"
   - "snap rhythm pattern, minimal style, finger snap, 120 BPM, precise atmosphere, syncopated timing"

7. 情绪触发音效 - 强化画面情绪
   触发：紧张、惊喜、伤感等情绪
   Prompt示例：
   - "tense heartbeat sound, cinematic style, thumping pulse, 150 BPM, suspenseful atmosphere, with echo"
   - "surprise chime sound, magical style, bell sparkle, 100 BPM, wonder atmosphere, shimmer effect"
   - "emotional swell sound, orchestral style, string crescendo, 80 BPM, touching atmosphere, gradual buildup"

8. 拟物简化音效 - 还原物体动态
   触发：坠落、快速移动、物理碰撞
   Prompt示例：
   - "object drop sound, realistic style, glass shatter, 90 BPM, dramatic atmosphere, sharp impact"
   - "fast whoosh sound, cinematic style, air rush, 140 BPM, dynamic atmosphere, doppler effect"
   - "door creak sound, realistic style, wooden squeak, 60 BPM, eerie atmosphere, slow movement"

【输出规则】
- 严格按照JSON格式返回数据，不添加任何额外的解释、注释或markdown格式
- 所有音效提示词（prompt）必须使用英文，并遵循上述五要素规范（风格、质感、节奏、氛围、辅助元素）
- 时间戳必须精确到毫秒（格式：HH:MM:SS.mmm）
- 音效时长通常在 0.5-3.0 秒之间
- 每个音效必须标注其所属分类（从上述8种分类中选择）
- 确保音效与视频内容、节奏、情绪高度匹配`;

// 用户提示词
const USER_PROMPT = `请按照【分析维度】、【音效分类规则】和【Prompt设计规范】（已在系统提示词中说明），分析这个视频并返回JSON格式的"指令蓝图"。

【JSON输出格式】

必须包含以下键：

background_music: 一个对象，包含：
- prompt: (string) 描述视频整体情绪、风格、场景的详细BGM提示词（英文），应包含流派、BPM、氛围等要素
  示例："upbeat cinematic orchestral music, 120 BPM, hopeful and inspiring atmosphere, with strings and piano, for travel vlog"
- mood: (string) 情绪标签（如 "upbeat", "calm", "dramatic", "tense"）
- genre: (string) 音乐类型（如 "pop", "orchestral", "electronic", "ambient"）
- duration: (number) 时长（秒），设为视频总时长
- startTime: (string) 开始时间，固定为 "00:00:00.000"
- volume: (number) 音量（0-1），推荐 0.5-0.7

sound_effects: 一个对象数组，数组中每个对象代表一个音效，包含：
- prompt: (string) 描述这个音效的英文提示词，必须遵循五要素规范：
  
  格式模板：【音效类型】sound effect, 【风格】style, 【质感】texture, 【节奏】BPM, 【氛围】atmosphere, 【辅助元素】
  
  五要素说明：
  1. 风格：cartoon style / realistic style / cinematic style / electronic style / minimalistic style
  2. 质感：metallic / wooden / glass / plastic / rubbery / fabric / airy
  3. 节奏：80-100 BPM（慢）/ 100-120 BPM（中）/ 120-150 BPM（快）
  4. 氛围：mysterious / intense / playful / suspenseful / calm / energetic / dramatic
  5. 辅助元素：with reverb / echo effect / sharp attack / layered percussion / doppler effect
  
  优质示例：
  - "smooth whoosh transition sound effect, cinematic style, airy texture, 110 BPM, flowing atmosphere, with subtle reverb"
  - "heavy impact sound, realistic style, wooden boom, 130 BPM, powerful atmosphere, with deep bass"
  - "button click sound, minimalistic style, plastic tap, 100 BPM, clean atmosphere, precise timing"
  
  避免简单描述（如 "whoosh sound"），必须包含完整的五要素

- timestamp: (string) 音效开始播放的精确时间戳，格式为 "HH:MM:SS.mmm"
  示例："00:00:15.033", "00:01:23.500"

- description: (string) 音效的场景描述（中文，说明为什么需要此音效）
  示例："镜头快速切换到新场景", "字幕标题出现", "人物点击按钮"

- category: (string) 音效分类（必填，从以下8种中选择一种）：
  "转场音效", "强调音效", "短氛围音效", "互动音效", "喜剧/幽默音效", "节奏音效", "情绪触发音效", "拟物简化音效"

- duration: (number) 音效时长（秒），通常为 0.5-3.0

- volume: (number) 音量（0-1），推荐 0.7-0.9

【分析要求】

1. 综合运用四个维度（画面内容、动作逻辑、情绪倾向、剪辑节奏）识别关键节点

2. 为每个音效选择最匹配的分类（category），确保符合触发条件和场景合理性

3. 时间戳必须精确，与视频中的实际事件时刻对应

4. 音效数量适中（3-10个），避免过度堆砌

5. 【重要】所有 prompt 必须严格遵循五要素规范（风格、质感、节奏、氛围、辅助元素），不得使用简单描述
   - ✓ 正确："smooth whoosh transition sound effect, cinematic style, airy texture, 110 BPM, flowing atmosphere, with subtle reverb"
   - ✗ 错误："whoosh sound effect" 或 "transition sound"（缺少风格、质感、节奏等要素）

6. description 和 category 使用中文，prompt 使用英文

【Prompt质量检查标准】

每个音效的 prompt 必须能回答以下问题：
- 是什么风格？（cartoon / realistic / cinematic 等）
- 什么质感/材质？（metallic / wooden / airy 等）
- 什么节奏？（BPM 数值）
- 什么氛围？（mysterious / intense / playful 等）
- 有什么辅助效果？（reverb / echo / sharp attack 等）

如果无法回答以上任何一项，则 prompt 不合格。

请只返回JSON对象，不要包含markdown代码块标记或其他说明文字。`;

console.log('='.repeat(100));
console.log('🎬 独立测试：直接调用火山方舟 API');
console.log('='.repeat(100));
console.log(`\n📹 视频 URL: ${VIDEO_URL}`);
console.log(`🔑 API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : '❌ 未配置'}\n`);

if (!API_KEY) {
  console.error('❌ 错误：未找到 ARK_API_KEY');
  console.error('请在 backend/.env 文件中配置：ARK_API_KEY=你的密钥\n');
  process.exit(1);
}

async function testAPI() {
  try {
    console.log('[1/3] 准备请求数据...');
    
    const requestData = {
      model: 'ep-m-20251107114928-w8j8v',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: VIDEO_URL
              }
            },
            {
              type: 'text',
              text: USER_PROMPT
            }
          ]
        }
      ],
      response_format: {
        type: 'json_object'
      }
    };
    
    console.log('✓ 请求数据已准备\n');
    
    console.log('[2/3] 调用火山方舟 API...');
    console.log('  这可能需要 30-120 秒，请耐心等待...\n');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000  // 3分钟超时
      }
    );
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log(`✓ API 调用成功！耗时: ${duration} 秒\n`);
    
    console.log('[3/3] 解析返回结果...\n');
    
    // 获取返回的内容
    const aiResponse = response.data;
    const content = aiResponse.choices[0].message.content;
    
    // 解析 JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('❌ JSON 解析失败');
      console.log('原始返回内容：');
      console.log(content);
      throw e;
    }
    
    console.log('='.repeat(100));
    console.log('📊 分析结果');
    console.log('='.repeat(100));
    
    // 显示背景音乐
    console.log('\n🎵 背景音乐 (Background Music)');
    console.log('-'.repeat(100));
    const bgm = result.background_music;
    console.log(`  📝 提示词: ${bgm.prompt}`);
    console.log(`  😊 情绪: ${bgm.mood}`);
    console.log(`  🎸 类型: ${bgm.genre}`);
    console.log(`  ⏱️  时长: ${bgm.duration} 秒`);
    console.log(`  🔉 音量: ${bgm.volume}`);
    
    // 显示音效列表
    console.log('\n🔊 音效列表 (Sound Effects)');
    console.log('-'.repeat(100));
    
    const sfxList = result.sound_effects || [];
    
    if (sfxList.length === 0) {
      console.log('  ⚠️  未识别到音效\n');
    } else {
      console.log(`  共识别到 ${sfxList.length} 个音效\n`);
      
      sfxList.forEach((sfx, index) => {
        console.log(`  ┌─ [${index + 1}/${sfxList.length}] ────────────────────────────`);
        console.log(`  │ ⏰ 时间戳: ${sfx.timestamp}`);
        console.log(`  │ 🎯 分类: ${sfx.category || '❌ 未分类'}`);
        console.log(`  │ 📝 场景描述: ${sfx.description}`);
        console.log(`  │ 🎼 提示词: ${sfx.prompt}`);
        console.log(`  │ ⏱️  时长: ${sfx.duration} 秒`);
        console.log(`  │ 🔉 音量: ${sfx.volume}`);
        console.log(`  └${'─'.repeat(70)}\n`);
      });
    }
    
    // 音效分类统计
    console.log('📊 音效分类统计');
    console.log('-'.repeat(100));
    
    const categoryStats = {};
    sfxList.forEach(sfx => {
      const cat = sfx.category || '未分类';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });
    
    if (Object.keys(categoryStats).length === 0) {
      console.log('  无音效数据\n');
    } else {
      Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
          const percentage = ((count / sfxList.length) * 100).toFixed(1);
          const barLength = Math.ceil((count / Math.max(...Object.values(categoryStats))) * 30);
          const bar = '█'.repeat(barLength) + '░'.repeat(30 - barLength);
          console.log(`  ${category.padEnd(15)} ${bar} ${count} 个 (${percentage}%)`);
        });
      console.log('');
    }
    
    // 格式验证
    console.log('✅ 格式验证');
    console.log('-'.repeat(100));
    
    const checks = [
      { name: '是否有 background_music', pass: !!result.background_music },
      { name: '是否有 sound_effects 数组', pass: Array.isArray(result.sound_effects) },
      { name: '音效是否包含 category 字段', pass: sfxList.length > 0 && sfxList.every(s => s.category) },
      { name: 'BGM 提示词是否使用英文', pass: bgm.prompt && /^[a-zA-Z0-9\s,.-]+$/.test(bgm.prompt) },
      { name: '音效提示词是否使用英文', pass: sfxList.length === 0 || sfxList.every(s => /^[a-zA-Z0-9\s,.-]+$/.test(s.prompt)) },
      { name: '音效描述是否有中文', pass: sfxList.length === 0 || sfxList.some(s => /[\u4e00-\u9fa5]/.test(s.description)) }
    ];
    
    checks.forEach(check => {
      const icon = check.pass ? '✓' : '✗';
      console.log(`  ${icon} ${check.name}`);
    });
    
    const allPass = checks.every(c => c.pass);
    
    if (allPass) {
      console.log('\n🎉 恭喜！所有格式检查都通过了！');
      console.log('   新的系统提示词和音效分类功能运行正常！\n');
    } else {
      console.log('\n⚠️  部分格式检查未通过\n');
    }
    
    // 保存完整结果
    const outputFile = 'direct-api-result.json';
    const outputData = {
      result,
      metadata: {
        videoUrl: VIDEO_URL,
        model: requestData.model,
        timestamp: new Date().toISOString(),
        duration: `${duration}秒`
      }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf-8');
    
    console.log('='.repeat(100));
    console.log(`💾 完整结果已保存到: ${outputFile}`);
    console.log('='.repeat(100));
    
    console.log('\n✨ 测试完成！\n');
    
    // 显示完整 JSON
    console.log('\n📄 完整 JSON 输出：');
    console.log('-'.repeat(100));
    console.log(JSON.stringify(result, null, 2));
    console.log('-'.repeat(100));
    
  } catch (error) {
    console.error('\n❌ 测试失败');
    
    if (error.response) {
      console.error(`HTTP 错误: ${error.response.status}`);
      console.error('响应数据：');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('请求超时或无响应');
      console.error(error.message);
    } else {
      console.error('错误:', error.message);
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

/**
 * 调用 Stable Audio API 生成单个音效
 * @param {Object} soundEffect - 音效对象
 * @param {number} index - 音效索引
 * @returns {Promise<Object>} 生成结果
 */
async function generateSoundEffect(soundEffect, index) {
  return new Promise((resolve, reject) => {
    console.log(`\n🎵 [${index}] 开始生成音效...`);
    console.log(`   提示词: ${soundEffect.prompt}`);
    console.log(`   时长: ${soundEffect.duration}秒`);
    
    // 生成输出文件名（基于时间戳和索引）
    const timestamp = Date.now();
    const sanitizedPrompt = soundEffect.prompt
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .substring(0, 30);
    const outputFilename = `sfx_${index}_${sanitizedPrompt}_${timestamp}.wav`;
    const outputPath = path.join(__dirname, 'uploads', 'audio', outputFilename);
    
    // Python 脚本路径
    const pythonScript = path.join(__dirname, '..', 'stable-audio', 'generate_audio_api.py');
    const stableAudioDir = path.join(__dirname, '..', 'stable-audio');
    
    // 准备参数（使用较少的 steps 加快生成速度）
    const args = [
      pythonScript,
      '--prompt', soundEffect.prompt,
      '--duration', soundEffect.duration.toString(),
      '--steps', '50',  // 减少步数以加快生成（50 步对音效来说足够了）
      '--cfg-scale', '7',
      '--output', outputPath
    ];
    
    console.log(`   Python 脚本: ${pythonScript}`);
    console.log(`   工作目录: ${stableAudioDir}`);
    console.log(`   输出路径: ${outputPath}`);
    
    // 启动 Python 进程
    const pythonProcess = spawn('python', args, {
      cwd: stableAudioDir,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // 实时显示所有输出，帮助调试
      console.log(`   [Python] ${output.trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // 也显示 stderr（可能包含警告和进度信息）
      console.error(`   [Python Error] ${output.trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`   ✅ 音效 ${index} 生成完成: ${outputFilename}`);
        resolve({
          success: true,
          index,
          soundEffect,
          outputPath,
          outputFilename
        });
      } else {
        console.error(`   ❌ 音效 ${index} 生成失败 (退出码: ${code})`);
        if (stderr) console.error(`   错误信息: ${stderr}`);
        reject(new Error(`音效生成失败: ${stderr}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`   ❌ 无法启动 Python 进程: ${error.message}`);
      reject(error);
    });
    
    // 设置超时（5分钟）
    const timeout = setTimeout(() => {
      console.error(`   ⏱️  音效 ${index} 生成超时（超过5分钟），终止进程...`);
      pythonProcess.kill();
      reject(new Error('音频生成超时（超过5分钟）'));
    }, 5 * 60 * 1000);
    
    pythonProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * 批量生成所有音效（使用批量脚本，只加载一次模型）
 * @param {Array} soundEffects - 音效列表
 * @returns {Promise<Array>} 生成结果列表
 */
async function generateAllSoundEffects(soundEffects) {
  console.log('\n' + '='.repeat(100));
  console.log('🎼 开始批量生成音效（优化版 - 只加载一次模型）');
  console.log('='.repeat(100));
  console.log(`共有 ${soundEffects.length} 个音效需要生成\n`);
  
  return new Promise((resolve, reject) => {
    // 创建带时间戳的输出文件夹
    const now = new Date();
    const dateStr = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
    const timestamp = Date.now();
    const batchFolder = `batch_${dateStr}`;
    const outputDir = path.join(__dirname, 'uploads', 'audio', batchFolder);
    
    // 创建文件夹
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`📁 输出文件夹: ${batchFolder}`);
    console.log(`📂 完整路径: ${outputDir}\n`);
    
    // 准备任务列表
    const tasks = soundEffects.map((sfx, index) => {
      const sanitizedPrompt = sfx.prompt
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .substring(0, 30);
      const outputFilename = `sfx_${index + 1}_${sanitizedPrompt}.wav`;
      const outputPath = path.join(outputDir, outputFilename);
      
      return {
        prompt: sfx.prompt,
        duration: sfx.duration,
        output: outputPath,
        metadata: {
          index: index + 1,
          timestamp: sfx.timestamp,
          category: sfx.category,
          description: sfx.description,
          filename: outputFilename
        }
      };
    });
    
    // 保存任务文件
    const tasksFile = path.join(__dirname, 'audio-generation-tasks.json');
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf-8');
    console.log(`✓ 任务文件已创建: ${tasksFile}\n`);
    
    // 调用批量生成脚本
    const pythonScript = path.join(__dirname, '..', 'stable-audio', 'batch_generate_audio.py');
    const stableAudioDir = path.join(__dirname, '..', 'stable-audio');
    
    const args = [
      pythonScript,
      '--tasks', tasksFile,
      '--steps', '50',
      '--cfg-scale', '7'
    ];
    
    console.log('🚀 启动批量生成进程...');
    console.log(`   Python 脚本: ${pythonScript}`);
    console.log(`   任务数量: ${tasks.length}\n`);
    
    const batchProcess = spawn('python', args, {
      cwd: stableAudioDir,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    
    let stdout = '';
    let stderr = '';
    
    batchProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());
    });
    
    batchProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // 只显示错误，不显示警告
      if (output.includes('Error') || output.includes('Traceback')) {
        console.error(output.trim());
      }
    });
    
    batchProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ 批量生成完成！');
        
        // 读取结果
        const resultsFile = tasksFile.replace('.json', '_results.json');
        if (fs.existsSync(resultsFile)) {
          const batchResults = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
          
          // 转换为原格式
          const results = [];
          const errors = [];
          
          tasks.forEach((task, index) => {
            const result = batchResults.results[index];
            if (result.success) {
              results.push({
                success: true,
                index: task.metadata.index,
                soundEffect: soundEffects[index],
                outputPath: result.output,
                outputFilename: task.metadata.filename
              });
            } else {
              errors.push({
                index: task.metadata.index,
                soundEffect: soundEffects[index],
                error: result.error
              });
            }
          });
          
          // 显示汇总
          console.log('\n' + '='.repeat(100));
          console.log('📊 生成汇总');
          console.log('='.repeat(100));
          console.log(`✅ 成功: ${results.length} 个`);
          console.log(`❌ 失败: ${errors.length} 个`);
          
          if (results.length > 0) {
            console.log('\n✅ 成功生成的音效:');
            results.forEach(r => {
              console.log(`   [${r.index}] ${r.outputFilename}`);
              console.log(`       时间戳: ${r.soundEffect.timestamp}`);
              console.log(`       分类: ${r.soundEffect.category}`);
            });
          }
          
          if (errors.length > 0) {
            console.log('\n❌ 失败的音效:');
            errors.forEach(e => {
              console.log(`   [${e.index}] ${e.soundEffect.prompt}`);
              console.log(`       错误: ${e.error}`);
            });
          }
          
          // 保存生成映射文件（在批次文件夹中）
          const mappingFile = path.join(outputDir, 'generation-mapping.json');
          const mappingData = {
            videoUrl: VIDEO_URL,
            generatedAt: new Date().toISOString(),
            batchFolder: batchFolder,
            outputDirectory: outputDir,
            successCount: results.length,
            failCount: errors.length,
            audioFiles: results.map(r => ({
              index: r.index,
              timestamp: r.soundEffect.timestamp,
              category: r.soundEffect.category,
              description: r.soundEffect.description,
              prompt: r.soundEffect.prompt,
              duration: r.soundEffect.duration,
              outputFile: r.outputFilename,
              outputPath: r.outputPath
            })),
            errors: errors.map(e => ({
              index: e.index,
              prompt: e.soundEffect.prompt,
              error: e.error
            }))
          };
          
          fs.writeFileSync(mappingFile, JSON.stringify(mappingData, null, 2), 'utf-8');
          console.log(`\n💾 音效映射文件已保存: ${path.relative(__dirname, mappingFile)}`);
          
          // 同时在 backend 目录保存一份快捷链接文件
          const quickLinkFile = path.join(__dirname, 'latest-audio-generation.json');
          fs.writeFileSync(quickLinkFile, JSON.stringify({
            batchFolder: batchFolder,
            outputDirectory: outputDir,
            mappingFile: mappingFile,
            generatedAt: new Date().toISOString(),
            successCount: results.length
          }, null, 2), 'utf-8');
          console.log(`📋 快捷链接已保存: latest-audio-generation.json`);
          console.log('='.repeat(100));
          
          // 清理临时文件
          fs.unlinkSync(tasksFile);
          fs.unlinkSync(resultsFile);
          
          resolve({ results, errors });
        } else {
          reject(new Error('未找到结果文件'));
        }
      } else {
        console.error(`\n❌ 批量生成失败 (退出码: ${code})`);
        reject(new Error(`批量生成失败: ${stderr}`));
      }
    });
    
    batchProcess.on('error', (error) => {
      console.error(`\n❌ 无法启动批量生成进程: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * 逐个生成音效（旧版本，保留作为备用）
 */
async function generateAllSoundEffectsOneByOne(soundEffects) {
  console.log('\n' + '='.repeat(100));
  console.log('🎼 开始逐个生成音效（旧版 - 每次重新加载模型）');
  console.log('='.repeat(100));
  console.log(`共有 ${soundEffects.length} 个音效需要生成\n`);
  
  const results = [];
  const errors = [];
  
  // 逐个生成（避免并发导致显存不足）
  for (let i = 0; i < soundEffects.length; i++) {
    try {
      const result = await generateSoundEffect(soundEffects[i], i + 1);
      results.push(result);
    } catch (error) {
      errors.push({
        index: i + 1,
        soundEffect: soundEffects[i],
        error: error.message
      });
    }
  }
  
  // 显示汇总
  console.log('\n' + '='.repeat(100));
  console.log('📊 生成汇总');
  console.log('='.repeat(100));
  console.log(`✅ 成功: ${results.length} 个`);
  console.log(`❌ 失败: ${errors.length} 个`);
  
  if (results.length > 0) {
    console.log('\n✅ 成功生成的音效:');
    results.forEach(r => {
      console.log(`   [${r.index}] ${r.outputFilename}`);
      console.log(`       时间戳: ${r.soundEffect.timestamp}`);
      console.log(`       分类: ${r.soundEffect.category}`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n❌ 失败的音效:');
    errors.forEach(e => {
      console.log(`   [${e.index}] ${e.soundEffect.prompt}`);
      console.log(`       错误: ${e.error}`);
    });
  }
  
  // 保存生成映射文件
  const mappingFile = 'audio-generation-mapping.json';
  const mappingData = {
    videoUrl: VIDEO_URL,
    generatedAt: new Date().toISOString(),
    successCount: results.length,
    failCount: errors.length,
    audioFiles: results.map(r => ({
      index: r.index,
      timestamp: r.soundEffect.timestamp,
      category: r.soundEffect.category,
      description: r.soundEffect.description,
      prompt: r.soundEffect.prompt,
      duration: r.soundEffect.duration,
      outputFile: r.outputFilename,
      outputPath: r.outputPath
    })),
    errors: errors.map(e => ({
      index: e.index,
      prompt: e.soundEffect.prompt,
      error: e.error
    }))
  };
  
  fs.writeFileSync(mappingFile, JSON.stringify(mappingData, null, 2), 'utf-8');
  console.log(`\n💾 音效映射文件已保存: ${mappingFile}`);
  console.log('='.repeat(100));
  
  return { results, errors };
}

/**
 * 将时间戳转换为秒数
 * @param {string} timestamp - 格式 HH:MM:SS.mmm
 * @returns {number} 秒数
 */
function timestampToSeconds(timestamp) {
  const parts = timestamp.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * 检查 FFmpeg 是否可用
 * @returns {Promise<boolean>}
 */
async function checkFFmpeg() {
  return new Promise((resolve) => {
    const checkProcess = spawn('ffmpeg', ['-version']);
    
    checkProcess.on('close', (code) => {
      resolve(code === 0);
    });
    
    checkProcess.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * 合成音效到视频
 * @param {string} videoUrl - 原视频 URL
 * @param {Array} audioFiles - 音效文件列表
 * @param {string} outputDir - 输出目录
 * @returns {Promise<string>} 合成后的视频路径
 */
async function mergeAudioToVideo(videoUrl, audioFiles, outputDir) {
  console.log('\n' + '='.repeat(100));
  console.log('🎬 开始合成音效到视频');
  console.log('='.repeat(100));
  
  return new Promise(async (resolve, reject) => {
    try {
      // 检查 FFmpeg
      console.log('[1/5] 检查 FFmpeg...');
      const hasFFmpeg = await checkFFmpeg();
      if (!hasFFmpeg) {
        throw new Error('未找到 FFmpeg，请先安装 FFmpeg');
      }
      console.log('✓ FFmpeg 可用\n');
      
      // 下载视频到本地
      console.log('[2/5] 下载原视频...');
      const videoPath = path.join(outputDir, 'original_video.mp4');
      
      // 使用 axios 下载视频
      const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream'
      });
      
      const writer = fs.createWriteStream(videoPath);
      response.data.pipe(writer);
      
      await new Promise((resolveDownload, rejectDownload) => {
        writer.on('finish', resolveDownload);
        writer.on('error', rejectDownload);
      });
      
      console.log(`✓ 视频已下载: ${videoPath}\n`);
      
      // 准备 FFmpeg 命令
      console.log('[3/5] 准备 FFmpeg 合成命令...');
      
      const outputVideoPath = path.join(outputDir, 'video_with_sound_effects.mp4');
      
      // 构建复杂的 FFmpeg 过滤器
      // 为每个音效添加 adelay（延迟）和 volume（音量）
      const filterComplex = [];
      const audioInputs = ['-i', videoPath];
      
      audioFiles.forEach((audioFile, index) => {
        audioInputs.push('-i', audioFile.outputPath);
        
        // 计算延迟时间（毫秒）
        const delayMs = Math.round(timestampToSeconds(audioFile.timestamp) * 1000);
        
        // 为每个音效添加延迟和音量控制
        filterComplex.push(
          `[${index + 1}:a]adelay=${delayMs}|${delayMs},volume=${audioFile.volume || 0.8}[a${index}]`
        );
      });
      
      // 混合所有音频轨道
      const audioStreams = audioFiles.map((_, index) => `[a${index}]`).join('');
      filterComplex.push(
        `[0:a]${audioStreams}amix=inputs=${audioFiles.length + 1}:duration=first:dropout_transition=2[aout]`
      );
      
      console.log(`✓ 将合成 ${audioFiles.length} 个音效到视频\n`);
      
      // 构建完整的 FFmpeg 命令
      const ffmpegArgs = [
        ...audioInputs,
        '-filter_complex', filterComplex.join(';'),
        '-map', '0:v',  // 使用原视频的视频流
        '-map', '[aout]',  // 使用混合后的音频流
        '-c:v', 'copy',  // 视频流不重新编码（快速）
        '-c:a', 'aac',  // 音频编码为 AAC
        '-b:a', '192k',  // 音频比特率
        '-y',  // 覆盖输出文件
        outputVideoPath
      ];
      
      console.log('[4/5] 执行 FFmpeg 合成...');
      console.log('   这可能需要一些时间，请耐心等待...\n');
      
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        cwd: outputDir
      });
      
      let stderr = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // 显示进度信息
        const progressMatch = stderr.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (progressMatch) {
          process.stdout.write(`\r   进度: ${progressMatch[1]}`);
        }
      });
      
      ffmpegProcess.on('close', (code) => {
        console.log('\n');
        
        if (code === 0) {
          console.log('[5/5] 合成完成！\n');
          console.log('='.repeat(100));
          console.log('✅ 视频合成成功');
          console.log('='.repeat(100));
          console.log(`📹 输出文件: ${path.basename(outputVideoPath)}`);
          console.log(`📂 完整路径: ${outputVideoPath}`);
          console.log(`📊 包含音效: ${audioFiles.length} 个`);
          console.log('='.repeat(100));
          
          // 清理临时视频文件
          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
          }
          
          resolve(outputVideoPath);
        } else {
          console.error('❌ FFmpeg 合成失败');
          console.error('错误信息:', stderr);
          reject(new Error(`FFmpeg 退出码: ${code}`));
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error('❌ 无法启动 FFmpeg:', error.message);
        reject(error);
      });
      
    } catch (error) {
      console.error('❌ 合成过程出错:', error.message);
      reject(error);
    }
  });
}

/**
 * 主测试流程
 */
async function runFullTest() {
  try {
    // 第一步：调用火山方舟 API 分析视频
    await testAPI();
    
    // 第二步：读取分析结果
    console.log('\n' + '='.repeat(100));
    console.log('📂 读取分析结果...');
    console.log('='.repeat(100));
    
    const resultFile = 'direct-api-result.json';
    if (!fs.existsSync(resultFile)) {
      console.error('❌ 未找到分析结果文件');
      return;
    }
    
    const resultData = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
    const soundEffects = resultData.result.sound_effects || [];
    
    if (soundEffects.length === 0) {
      console.log('⚠️  没有音效需要生成');
      return;
    }
    
    console.log(`✓ 已读取 ${soundEffects.length} 个音效`);
    
    // 第三步：批量生成音效
    const { results, errors } = await generateAllSoundEffects(soundEffects);
    
    if (results.length === 0) {
      console.error('\n❌ 没有成功生成的音效，无法进行视频合成');
      return;
    }
    
    // 第四步：合成音效到视频
    const latestGeneration = JSON.parse(fs.readFileSync('latest-audio-generation.json', 'utf-8'));
    const outputDir = latestGeneration.outputDirectory;
    
    // 准备音效文件列表
    const audioFilesForMerge = results.map(r => ({
      outputPath: r.outputPath,
      timestamp: r.soundEffect.timestamp,
      volume: r.soundEffect.volume || 0.8
    }));
    
    const finalVideoPath = await mergeAudioToVideo(VIDEO_URL, audioFilesForMerge, outputDir);
    
    // 更新映射文件，添加最终视频信息
    const mappingFile = path.join(outputDir, 'generation-mapping.json');
    const mappingData = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    mappingData.finalVideo = {
      path: finalVideoPath,
      filename: path.basename(finalVideoPath),
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(mappingFile, JSON.stringify(mappingData, null, 2), 'utf-8');
    
    console.log('\n🎉 完整流程测试完成！');
    console.log('   1. ✅ 视频分析完成');
    console.log('   2. ✅ 音效生成完成');
    console.log('   3. ✅ 视频合成完成');
    console.log(`\n🎬 最终视频: ${finalVideoPath}\n`);
    
  } catch (error) {
    console.error('\n❌ 测试流程失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行完整测试流程
runFullTest();

