const DEFAULT_API_BASE_URL = 'http://localhost:4300';

export function normalizeApiBaseUrl(baseUrl: string | undefined | null): string {
  return (baseUrl || '').trim().replace(/\/+$/, '');
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
);

export function apiUrl(path: string, baseUrl: string = API_BASE_URL): string {
  if (!path) return normalizeApiBaseUrl(baseUrl);
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return normalizedBaseUrl ? `${normalizedBaseUrl}${normalizedPath}` : normalizedPath;
}

export function assetUrl(path: string | undefined | null, baseUrl: string = API_BASE_URL): string {
  if (!path) return '';
  return apiUrl(path, baseUrl);
}

export function proxyImageUrl(originalUrl: string, baseUrl: string = API_BASE_URL): string {
  return apiUrl(`/api/v1/proxy/image?url=${encodeURIComponent(originalUrl)}`, baseUrl);
}

export function proxyVideoUrl(originalUrl: string, baseUrl: string = API_BASE_URL): string {
  return apiUrl(`/api/v1/proxy/video?url=${encodeURIComponent(originalUrl)}`, baseUrl);
}
