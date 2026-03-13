import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * BatchAudioService - 批量音频生成服务
 * 
 * 使用 Stable Audio 批量生成音频（只加载一次模型，提高效率）
 * 参考 test-direct-api.js 中的批量生成逻辑
 */
class BatchAudioService {
  /**
   * 批量生成音频文件
   * @param {Array} audioTasks - 音频任务列表
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 生成结果 { results: [], errors: [], outputDir: '' }
   */
  static async batchGenerate(audioTasks, options = {}) {
    const {
      steps = 50,        // 推理步数（50步对音效来说足够）
      cfg_scale = 7,     // CFG引导强度
      batchName = null   // 批次名称
    } = options;

    console.log('\n' + '='.repeat(100));
    console.log('🎼 开始批量生成音频（优化版 - 只加载一次模型）');
    console.log('='.repeat(100));
    console.log(`共有 ${audioTasks.length} 个音频需要生成\n`);

    return new Promise((resolve, reject) => {
      try {
        // 创建带时间戳的输出文件夹
        const now = new Date();
        const dateStr = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
        const folderName = batchName || `batch_${dateStr}`;
        const outputDir = path.join(__dirname, '../../uploads/audio', folderName);

        // 创建文件夹
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`📁 输出文件夹: ${folderName}`);
        console.log(`📂 完整路径: ${outputDir}\n`);

        // 准备任务列表
        const tasks = audioTasks.map((audio, index) => {
          const sanitizedPrompt = audio.prompt
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .substring(0, 30);
          const audioType = audio.type || 'audio';
          const outputFilename = `${audioType}_${index + 1}_${sanitizedPrompt}.wav`;
          const outputPath = path.join(outputDir, outputFilename);

          return {
            prompt: audio.prompt,
            duration: audio.duration,
            output: outputPath,
            metadata: {
              index: index + 1,
              type: audio.type,
              timestamp: audio.timestamp,
              category: audio.category,
              description: audio.description,
              filename: outputFilename
            }
          };
        });

        // 保存任务文件
        const tasksFile = path.join(__dirname, '../../audio-generation-tasks.json');
        fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf-8');
        console.log(`✓ 任务文件已创建: ${tasksFile}\n`);

        // 调用批量生成脚本
        const pythonScript = path.join(__dirname, '../../../stable-audio/batch_generate_audio.py');
        const stableAudioDir = path.join(__dirname, '../../../stable-audio');

        // 检查 Python 脚本是否存在
        if (!fs.existsSync(pythonScript)) {
          throw new Error(`Python 脚本不存在: ${pythonScript}`);
        }

        const args = [
          pythonScript,
          '--tasks', tasksFile,
          '--steps', steps.toString(),
          '--cfg-scale', cfg_scale.toString()
        ];

        console.log('🚀 启动批量生成进程...');
        console.log(`   Python 脚本: ${pythonScript}`);
        console.log(`   任务数量: ${tasks.length}`);
        console.log('\n⏳ 正在加载 Stable Audio 模型，请稍候...');
        console.log('   （首次加载约需 15-30 秒，请耐心等待）\n');

        const batchProcess = spawn('python', args, {
          cwd: stableAudioDir,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let stdout = '';
        let stderr = '';
        let hasOutput = false;

        // 设置一个检测超时 - 如果 60 秒内没有任何输出，说明进程卡住了
        // 注意：模型加载通常需要 15-30 秒，所以超时时间设置为 60 秒
        const outputTimeout = setTimeout(() => {
          if (!hasOutput) {
            console.error('⚠️  Python 进程 60 秒内无输出，可能卡住了');
            console.error('   请检查：');
            console.error('   1. Python 环境是否正确');
            console.error('   2. 模型文件是否存在');
            console.error('   3. 依赖是否安装完整');
            console.log('   尝试手动运行：');
            console.log(`   cd ${stableAudioDir}`);
            console.log(`   python ${args.join(' ')}`);
          }
        }, 60000);

        batchProcess.stdout.on('data', (data) => {
          hasOutput = true;
          clearTimeout(outputTimeout);
          const output = data.toString();
          stdout += output;
          console.log(output.trim());
        });

        batchProcess.stderr.on('data', (data) => {
          hasOutput = true;
          clearTimeout(outputTimeout);
          const output = data.toString();
          stderr += output;
          
          // 过滤掉不重要的警告信息，只显示进度条和真正的错误
          if (
            output.includes('%|') ||  // 进度条
            output.includes('Error') || 
            output.includes('Traceback') ||
            output.includes('Failed')
          ) {
            // 进度条信息美化显示
            if (output.includes('%|')) {
              // 只显示进度，不显示完整的 stderr 前缀
              process.stdout.write(`\r   生成进度: ${output.trim()}`);
            } else {
              console.error(`   ❌ ${output.trim()}`);
            }
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
                    type: task.metadata.type,
                    audioData: audioTasks[index],
                    outputPath: result.output,
                    outputFilename: task.metadata.filename,
                    // 生成可访问的 URL
                    fileUrl: `/uploads/audio/${folderName}/${task.metadata.filename}`
                  });
                } else {
                  errors.push({
                    index: task.metadata.index,
                    type: task.metadata.type,
                    audioData: audioTasks[index],
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
                console.log('\n✅ 成功生成的音频:');
                results.forEach(r => {
                  console.log(`   [${r.index}] ${r.outputFilename}`);
                  if (r.audioData.timestamp) {
                    console.log(`       时间戳: ${r.audioData.timestamp}`);
                  }
                  if (r.audioData.category) {
                    console.log(`       分类: ${r.audioData.category}`);
                  }
                });
              }

              if (errors.length > 0) {
                console.log('\n❌ 失败的音频:');
                errors.forEach(e => {
                  console.log(`   [${e.index}] ${e.audioData.prompt}`);
                  console.log(`       错误: ${e.error}`);
                });
              }

              // 保存生成映射文件（在批次文件夹中）
              const mappingFile = path.join(outputDir, 'generation-mapping.json');
              const mappingData = {
                generatedAt: new Date().toISOString(),
                batchFolder: folderName,
                outputDirectory: outputDir,
                successCount: results.length,
                failCount: errors.length,
                audioFiles: results.map(r => ({
                  index: r.index,
                  type: r.type,
                  timestamp: r.audioData.timestamp,
                  category: r.audioData.category,
                  description: r.audioData.description,
                  prompt: r.audioData.prompt,
                  duration: r.audioData.duration,
                  outputFile: r.outputFilename,
                  outputPath: r.outputPath,
                  fileUrl: r.fileUrl
                })),
                errors: errors.map(e => ({
                  index: e.index,
                  type: e.type,
                  prompt: e.audioData.prompt,
                  error: e.error
                }))
              };

              fs.writeFileSync(mappingFile, JSON.stringify(mappingData, null, 2), 'utf-8');
              console.log(`\n💾 音频映射文件已保存: ${path.relative(process.cwd(), mappingFile)}`);
              console.log('='.repeat(100));

              // 清理临时文件
              if (fs.existsSync(tasksFile)) {
                fs.unlinkSync(tasksFile);
              }
              if (fs.existsSync(resultsFile)) {
                fs.unlinkSync(resultsFile);
              }

              resolve({
                results,
                errors,
                outputDir,
                folderName,
                mappingFile
              });
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
          console.error('   可能的原因：');
          console.error('   1. Python 未安装或不在 PATH 中');
          console.error('   2. Python 版本不正确（需要 3.8+）');
          console.error('   请运行: python --version');
          reject(error);
        });

        // 设置超时（30分钟）
        const timeout = setTimeout(() => {
          console.error('⏱️  批量生成超时（超过30分钟），终止进程...');
          batchProcess.kill();
          reject(new Error('批量生成超时（超过30分钟）'));
        }, 30 * 60 * 1000);

        batchProcess.on('close', () => {
          clearTimeout(timeout);
        });

      } catch (error) {
        console.error('❌ 批量生成准备阶段出错:', error);
        reject(error);
      }
    });
  }
}

export default BatchAudioService;

