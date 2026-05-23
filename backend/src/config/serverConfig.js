import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function envFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function envList(name) {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4300';
export const PORT = process.env.PORT || 4300;
export const FRONTEND_URL = process.env.FRONTEND_URL || '';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || FRONTEND_URL;
export const CORS_ORIGINS = envList('CORS_ORIGIN');

export const ENABLE_TTS = envFlag('ENABLE_TTS', false);
export const ENABLE_COMFYUI = envFlag('ENABLE_COMFYUI', false);

export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads')
);

export const COMFYUI_API_URL = process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188';
export const COMFYUI_INPUT_DIR = process.env.COMFYUI_INPUT_DIR || '';
export const COMFYUI_OUTPUT_DIR = process.env.COMFYUI_OUTPUT_DIR || '';

export function toPublicUrl(assetPath) {
  if (!assetPath) return '';

  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }

  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${PUBLIC_URL}${normalizedPath}`;
}

console.log('[serverConfig] loaded', {
  publicUrl: PUBLIC_URL,
  port: PORT,
  frontendUrl: FRONTEND_URL || null,
  corsOrigins: CORS_ORIGINS.length ? CORS_ORIGINS : null,
  uploadsDir: UPLOADS_DIR,
  enableTts: ENABLE_TTS,
  enableComfyui: ENABLE_COMFYUI,
});
