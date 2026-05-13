import type { VideoHandoffSample } from '../types/videoHandoff';

const API_BASE_URL = 'http://localhost:4300';

function getFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function exportHandoffPackage(sample: VideoHandoffSample): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/handoff/export-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || '交接包导出失败，请稍后重试');
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fallbackName = `${sample.exportPackage.filenameBase || sample.title || 'handoff-package'}.zip`;

  link.href = downloadUrl;
  link.download = getFilenameFromDisposition(response.headers.get('Content-Disposition')) || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
