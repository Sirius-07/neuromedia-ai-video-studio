import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ???
app.use(cors());
// ??????????????base64??????????AI????????????
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ?????? - ?????????
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ComfyUI???? - ???????????
const COMFYUI_OUTPUT_DIR = 'F:/ComfyUI_windows_portable/ComfyUI/output';
app.use('/comfyui/output', express.static(COMFYUI_OUTPUT_DIR));

// ??
app.use('/api/v1/soundtrack', soundtrackRoutes);
app.use('/api/v1/video', videoRoutes);
app.use('/api/v1/script', scriptRoutes);
app.use('/api/v1/audio', audioRoutes);
app.use('/api/v1/image', imageRoutes);
app.use('/api/v1/image-gen', imageGenRoutes);
app.use('/api/v1/script-sync', scriptSyncRoutes);
app.use('/api/v1/proxy', proxyRoutes);
app.use('/api/v1/video-export', videoExportRoutes);
app.use('/api/v1/comfyui', comfyuiRoutes);
app.use('/api/v1/transition', transitionRoutes);
app.use('/api/v1/music-creation', musicCreationRoutes);
app.use('/api/v1/storyboard', storyboardProjectRoutes);
app.use('/api/v1/project', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/inspiration', inspirationRoutes);
app.use('/api/script-edit', scriptEditRoutes);
app.use('/api/storyboard-assistant', storyboardAssistantRoutes);
app.use('/api/handoff', handoffExportRoutes);

// ????
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI?????????' });
});

app.listen(PORT, async () => {
  console.log(`?? ?????? http://localhost:${PORT}`);
  
  // ???? IndexTTS2 ??
  console.log('\n===============================================');
  console.log('?? ???? IndexTTS2 ??????...');
  console.log('===============================================\n');
  
  try {
    await ttsServiceManager.startService();
  } catch (error) {
    console.error('?? IndexTTS2 ???????????????', error.message);
    console.log('\n??????:');
    console.log('  cd F:\\AIEditing\\index-tts');
    console.log('  python api_server_v2.py');
    console.log('');
  }
});

// ???? - ?? IndexTTS2 ??
process.on('SIGINT', () => {
  console.log('\n?? ???????...');
  ttsServiceManager.stopService();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n?? ???????...');
  ttsServiceManager.stopService();
  process.exit(0);
});
