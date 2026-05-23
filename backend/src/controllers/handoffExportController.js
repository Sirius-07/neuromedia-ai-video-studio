import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandoffPackage } from '../services/HandoffPackageService.js';
import { normalizeHandoffSample } from '../services/HandoffSampleExportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function exportHandoffPackage(req, res) {
  try {
    const sample = normalizeHandoffSample(req.body);
    const folderName = `handoff_${Date.now()}`;
    const outputDir = path.join(__dirname, '../../uploads/handoff', folderName);
    const packageResult = await createHandoffPackage({ outputDir, sample });
    const stat = fs.statSync(packageResult.zipPath);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${packageResult.filename}"`);
    res.setHeader('X-Handoff-Package-Files', packageResult.files.join(','));

    fs.createReadStream(packageResult.zipPath).pipe(res);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error('Handoff package export failed:', error);
    }
    res.status(statusCode).json({
      success: false,
      error: error.message || 'handoff package export failed',
    });
  }
}
