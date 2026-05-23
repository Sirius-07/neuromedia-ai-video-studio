import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');

const SOURCE_LABEL_BY_TYPE = {
  uploaded_asset: '现场素材',
  ai_reference: 'AI 参考画面',
  placeholder: '待制作',
};

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function firstString(...values) {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value ? value.trim() : '';
}

function normalizeDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 5;
}

function normalizeSource(source = {}, shot = {}) {
  const type = source.type || shot.sourceType || (source.assetUrl || shot.assetUrl ? 'uploaded_asset' : 'placeholder');
  const normalizedType = SOURCE_LABEL_BY_TYPE[type] ? type : 'placeholder';
  const assetUrl = firstString(source.assetUrl, source.url, shot.assetUrl, shot.referenceAssetUrl);
  const assetName = firstString(source.assetName, source.name, shot.assetName, assetUrl ? path.basename(assetUrl) : '');

  return {
    type: normalizedType,
    label: firstString(source.label, SOURCE_LABEL_BY_TYPE[normalizedType]),
    assetUrl: assetUrl || undefined,
    assetName: assetName || undefined,
  };
}

function normalizeShot(shot, position) {
  const source = normalizeSource(shot.source, shot);

  return {
    id: firstString(shot.id, `shot-${position + 1}`),
    index: Number.isFinite(Number(shot.index)) ? Number(shot.index) : position + 1,
    durationSeconds: normalizeDuration(shot.durationSeconds ?? shot.duration),
    visualIntent: firstString(shot.visualIntent, shot.visual, shot.description, shot.visualPrompt, '待补充画面意图'),
    captionOrVoiceover: firstString(
      shot.captionOrVoiceover,
      shot.voiceover,
      shot.narration,
      shot.subtitle,
      shot.caption,
      '',
    ),
    source,
    productionNote: firstString(shot.productionNote, shot.note, shot.remark, ''),
    visualPrompt: firstString(shot.visualPrompt, ''),
    videoUrl: firstString(shot.videoUrl, shot.previewVideoUrl, ''),
    videoPath: firstString(shot.videoPath, ''),
  };
}

export function normalizeHandoffSample(payload = {}) {
  const sample = payload.sample || (Array.isArray(payload.shots) ? payload : null);

  if (!sample || typeof sample !== 'object') {
    throw createBadRequest('handoff sample is required');
  }

  if (!Array.isArray(sample.shots) || sample.shots.length === 0) {
    throw createBadRequest('sample.shots is required and must contain at least one shot');
  }

  return {
    ...sample,
    title: firstString(sample.title, sample.projectTitle, '新闻视频交接样片'),
    summary: firstString(sample.summary, sample.description, ''),
    positioningLabel: firstString(sample.positioningLabel, '制作沟通样片，非发布成片'),
    exportTime: sample.exportTime || new Date().toISOString(),
    shots: sample.shots.map(normalizeShot),
  };
}

export function resolveLocalVideoFile(sample) {
  const candidates = [
    sample.sampleVideoPath,
    sample.previewVideoPath,
    sample.videoPath,
    sample.sampleVideoUrl,
    sample.previewVideoUrl,
    sample.videoUrl,
    ...sample.shots.flatMap((shot) => [shot.videoPath, shot.videoUrl]),
  ].filter((value) => typeof value === 'string' && value.trim());

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    const localPath = resolveLocalPath(trimmed);
    if (localPath && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      return {
        source: trimmed,
        path: localPath,
        filename: `sample-video${path.extname(localPath) || '.mp4'}`,
      };
    }
  }

  return null;
}

export function buildSampleVideoNotice(sample) {
  const videoFile = resolveLocalVideoFile(sample);

  if (videoFile) {
    return {
      generated: true,
      message: `样片视频已随交接包附带：${videoFile.filename}`,
      videoFile,
    };
  }

  return {
    generated: false,
    message:
      '样片视频尚未生成或未提供可读取的视频文件。本交接包已包含 storyboard.pdf 和 sample.json，制作人员可先根据分镜表继续制作；生成 MP4 后可重新导出交接包。',
  };
}

function resolveLocalPath(value) {
  if (/^https?:\/\//i.test(value)) {
    return null;
  }

  if (path.isAbsolute(value) && fs.existsSync(value)) {
    return value;
  }

  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('/uploads/')) {
    return path.join(backendRoot, normalized.slice(1));
  }

  if (normalized.startsWith('uploads/')) {
    return path.join(backendRoot, normalized);
  }

  const relativePath = path.resolve(backendRoot, normalized);
  return relativePath.startsWith(backendRoot) ? relativePath : null;
}
