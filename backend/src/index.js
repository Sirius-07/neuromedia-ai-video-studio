import express from 'express';
import cors from 'cors';
import fs from 'fs';
import soundtrackRoutes from './routes/soundtrackRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import scriptRoutes from './routes/scriptRoutes.js';
import audioRoutes from './routes/audioRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import imageGenRoutes from './routes/imageGenRoutes.js';
import scriptSyncRoutes from './routes/scriptSyncRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
import videoExportRoutes from './routes/videoExportRoutes.js';
import comfyuiRoutes from './routes/comfyuiRoutes.js';
import transitionRoutes from './routes/transitionRoutes.js';
import musicCreationRoutes from './routes/musicCreationRoutes.js';
import storyboardProjectRoutes from './routes/storyboardProjectRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import ttsRoutes from './routes/ttsRoutes.js';
import ttsServiceManager from './services/ttsServiceManager.js';
import inspirationRoutes from './routes/inspirationRoutes.js';
import scriptEditRoutes from './routes/scriptEditRoutes.js';
import storyboardAssistantRoutes from './routes/storyboardAssistantRoutes.js';
import handoffExportRoutes from './routes/handoffExportRoutes.js';
import {
  COMFYUI_OUTPUT_DIR,
  CORS_ORIGIN,
  CORS_ORIGINS,
  ENABLE_COMFYUI,
  ENABLE_TTS,
  PORT,
  PUBLIC_URL,
  UPLOADS_DIR,
} from './config/serverConfig.js';

const app = express();

const corsOrigins = CORS_ORIGINS.length ? CORS_ORIGINS : CORS_ORIGIN ? [CORS_ORIGIN] : [];
app.use(
  cors(
    corsOrigins.length
      ? {
          origin: corsOrigins,
          credentials: true,
        }
      : undefined
  )
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

if (ENABLE_COMFYUI && COMFYUI_OUTPUT_DIR) {
  app.use('/comfyui/output', express.static(COMFYUI_OUTPUT_DIR));
}

function disabledService(serviceName, envName) {
  return (_req, res) => {
    res.status(503).json({
      success: false,
      error: `${serviceName} is disabled`,
      message: `Set ${envName}=true and configure the service URL/path to enable it.`,
    });
  };
}

app.use('/api/v1/soundtrack', soundtrackRoutes);
app.use('/api/v1/video', videoRoutes);
app.use('/api/v1/script', scriptRoutes);
app.use('/api/v1/audio', audioRoutes);
app.use('/api/v1/image', imageRoutes);
app.use('/api/v1/image-gen', imageGenRoutes);
app.use('/api/v1/script-sync', scriptSyncRoutes);
app.use('/api/v1/proxy', proxyRoutes);
app.use('/api/v1/video-export', videoExportRoutes);
app.use(
  '/api/v1/comfyui',
  ENABLE_COMFYUI ? comfyuiRoutes : disabledService('ComfyUI', 'ENABLE_COMFYUI')
);
app.use('/api/v1/transition', transitionRoutes);
app.use('/api/v1/music-creation', musicCreationRoutes);
app.use('/api/v1/storyboard', storyboardProjectRoutes);
app.use('/api/v1/project', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tts', ENABLE_TTS ? ttsRoutes : disabledService('TTS', 'ENABLE_TTS'));
app.use('/api/inspiration', inspirationRoutes);
app.use('/api/script-edit', scriptEditRoutes);
app.use('/api/storyboard-assistant', storyboardAssistantRoutes);
app.use('/api/handoff', handoffExportRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    publicUrl: PUBLIC_URL,
    uploadsDir: UPLOADS_DIR,
    features: {
      tts: ENABLE_TTS,
      comfyui: ENABLE_COMFYUI,
    },
  });
});

app.listen(PORT, async () => {
  console.log(`[server] listening on http://localhost:${PORT}`);

  if (!ENABLE_TTS) {
    console.log('[server] TTS disabled. Skipping IndexTTS2 startup.');
    return;
  }

  try {
    await ttsServiceManager.startService();
  } catch (error) {
    console.error('[server] Failed to start IndexTTS2:', error.message);
  }
});

function shutdown() {
  if (ENABLE_TTS) {
    ttsServiceManager.stopService();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
