/**
 * Storyboard Assistant Controller
 * 处理 POST /api/storyboard-assistant/chat 请求
 *
 * 响应约定（与前端 storyboardAssistantApi.ts 契约对齐）：
 *   成功 200 → Content-Type: text/plain，body 为 LLM 原始文本
 *   失败 4xx/5xx → Content-Type: application/json，body 为 { message: string }
 */

import StoryboardAssistantService from '../services/StoryboardAssistantService.js';

/**
 * POST /api/storyboard-assistant/chat
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function chat(req, res) {
  const { message, context } = req.body;

  // ── 参数校验 ──────────────────────────────────────────────
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({
      message: '缺少必填参数：message（非空字符串）',
    });
  }

  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return res.status(400).json({
      message: '缺少必填参数：context（对象）',
    });
  }

  if (context.mode !== 'image' && context.mode !== 'video') {
    return res.status(400).json({
      message: `context.mode 不合法：收到 "${context.mode}"，必须为 "image" 或 "video"`,
    });
  }

  // ── 调用 Service ──────────────────────────────────────────
  console.log(`🎬 [StoryboardAssistant] chat | mode=${context.mode} | shots=${context.totalShots ?? '?'}`);

  try {
    const rawText = await StoryboardAssistantService.chat(message.trim(), context);

    // 成功：直接返回 LLM 原始文本，前端 parseStoryboardResponse 负责解析
    return res.type('text').send(rawText);

  } catch (error) {
    console.error('❌ [StoryboardAssistant] chat 失败:', error.message);

    // 不向前端泄漏内部堆栈，仅在开发环境附加 stack
    return res.status(500).json({
      message: error.message || '分镜 AI 服务异常，请稍后重试',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}

export { chat };
