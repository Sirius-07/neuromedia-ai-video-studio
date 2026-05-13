import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import PDFDocument from 'pdfkit';
import {
  buildSampleVideoNotice,
  normalizeHandoffSample,
} from './HandoffSampleExportService.js';

const CJK_FONT_CANDIDATES = [
  process.env.PDF_CJK_FONT,
  'C:/Windows/Fonts/NotoSansSC-VF.ttf',
  'C:/Windows/Fonts/simhei.ttf',
  'C:/Windows/Fonts/Deng.ttf',
  'C:/Windows/Fonts/simfang.ttf',
  'C:/Windows/Fonts/msyh.ttc',
  'C:/Windows/Fonts/simsun.ttc',
  'C:/Windows/Fonts/msyh.ttf',
  '/System/Library/Fonts/PingFang.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
].filter(Boolean);

function createTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function configurePdfFont(doc) {
  for (const candidate of CJK_FONT_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        doc.registerFont('handoff-cjk', candidate);
        doc.font('handoff-cjk');
        return { supportsUnicode: true, fontName: candidate };
      }
    } catch (error) {
      console.warn(`Unable to load PDF font ${candidate}: ${error.message}`);
    }
  }

  doc.font('Helvetica');
  return { supportsUnicode: false, fontName: 'Helvetica' };
}

function safePdfText(value, supportsUnicode) {
  const text = String(value ?? '');
  if (supportsUnicode) {
    return text;
  }
  return text.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?');
}

function sourceLabel(source) {
  if (!source) return '待制作';
  const label = source.label || source.type || '待制作';
  const asset = source.assetName || source.assetUrl;
  return asset ? `${label} (${asset})` : label;
}

function writeField(doc, label, value, fontState) {
  doc
    .fontSize(9)
    .fillColor('#222222')
    .text(safePdfText(`${label}: ${value || '-'}`, fontState.supportsUnicode), {
      width: 520,
      lineGap: 2,
    });
}

export async function generateStoryboardPdfBuffer({ sample }) {
  const normalizedSample = normalizeHandoffSample({ sample });
  const chunks = [];

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: false });
    const fontState = configurePdfFont(doc);

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', resolve);
    doc.on('error', reject);

    doc
      .fontSize(18)
      .fillColor('#111111')
      .text(safePdfText(normalizedSample.title, fontState.supportsUnicode), { lineGap: 4 });
    doc
      .moveDown(0.4)
      .fontSize(10)
      .fillColor('#555555')
      .text(safePdfText(normalizedSample.positioningLabel, fontState.supportsUnicode));
    doc
      .moveDown(0.4)
      .fontSize(9)
      .fillColor('#666666')
      .text(safePdfText(`导出时间: ${new Date(normalizedSample.exportTime).toLocaleString('zh-CN')}`, fontState.supportsUnicode));

    if (normalizedSample.summary) {
      doc.moveDown(0.8);
      writeField(doc, '项目说明', normalizedSample.summary, fontState);
    }

    doc.moveDown(1);
    doc.fontSize(13).fillColor('#111111').text(safePdfText('结构化分镜表', fontState.supportsUnicode));
    doc.moveDown(0.6);

    normalizedSample.shots.forEach((shot) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc
        .roundedRect(34, doc.y - 4, 526, 112, 4)
        .strokeColor('#dddddd')
        .lineWidth(0.5)
        .stroke();

      doc
        .fontSize(11)
        .fillColor('#111111')
        .text(
          safePdfText(`镜号 ${shot.index}  |  时长 ${shot.durationSeconds}s  |  ${sourceLabel(shot.source)}`, fontState.supportsUnicode),
          44,
          doc.y + 4,
          { width: 500 },
        );
      doc.moveDown(0.35);
      writeField(doc, '画面', shot.visualIntent, fontState);
      writeField(doc, '旁白/字幕', shot.captionOrVoiceover, fontState);
      writeField(doc, '素材引用', sourceLabel(shot.source), fontState);
      writeField(doc, 'AI 生成/素材参考标签', shot.source?.label || shot.source?.type || '待制作', fontState);
      writeField(doc, '制作备注', shot.productionNote, fontState);
      doc.moveDown(1.4);
    });

    doc.end();
  });

  return Buffer.concat(chunks);
}

export async function createHandoffPackage({ outputDir, sample }) {
  const normalizedSample = normalizeHandoffSample({ sample });
  const timestamp = createTimestamp();
  const packageName = `handoff-package-${timestamp}.zip`;
  const zipPath = path.join(outputDir, packageName);
  const files = [];

  fs.mkdirSync(outputDir, { recursive: true });

  const pdfBuffer = await generateStoryboardPdfBuffer({ sample: normalizedSample });
  const videoNotice = buildSampleVideoNotice(normalizedSample);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(pdfBuffer, { name: 'storyboard.pdf' });
    files.push('storyboard.pdf');

    archive.append(Buffer.from(JSON.stringify(normalizedSample, null, 2), 'utf8'), { name: 'sample.json' });
    files.push('sample.json');

    if (videoNotice.generated && videoNotice.videoFile) {
      archive.file(videoNotice.videoFile.path, { name: videoNotice.videoFile.filename });
      files.push(videoNotice.videoFile.filename);
    } else {
      archive.append(videoNotice.message, { name: 'sample-video-status.txt' });
      files.push('sample-video-status.txt');
    }

    archive.finalize();
  });

  return {
    zipPath,
    filename: packageName,
    files,
    videoIncluded: videoNotice.generated,
  };
}
