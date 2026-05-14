import { describe, expect, it } from 'vitest';
import {
  apiUrl,
  assetUrl,
  getDefaultApiBaseUrl,
  normalizeApiBaseUrl,
  proxyImageUrl,
  proxyVideoUrl,
} from './api';

describe('api URL helpers', () => {
  it('uses same-origin URLs in production and localhost in development by default', () => {
    expect(getDefaultApiBaseUrl(false)).toBe('');
    expect(getDefaultApiBaseUrl(true)).toBe('http://localhost:4300');
  });

  it('normalizes API origins and joins request paths', () => {
    expect(normalizeApiBaseUrl('https://api.example.com/')).toBe('https://api.example.com');
    expect(apiUrl('/api/v1/project', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/v1/project'
    );
    expect(apiUrl('api/v1/project', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/v1/project'
    );
  });

  it('keeps absolute URLs unchanged and expands backend asset paths', () => {
    expect(apiUrl('https://cdn.example.com/file.mp4', 'https://api.example.com')).toBe(
      'https://cdn.example.com/file.mp4'
    );
    expect(assetUrl('/uploads/file.mp4', 'https://api.example.com/')).toBe(
      'https://api.example.com/uploads/file.mp4'
    );
  });

  it('builds encoded proxy URLs through the configured API origin', () => {
    expect(proxyImageUrl('https://cdn.example.com/a b.png', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/v1/proxy/image?url=https%3A%2F%2Fcdn.example.com%2Fa%20b.png'
    );
    expect(proxyVideoUrl('https://cdn.example.com/a b.mp4', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/v1/proxy/video?url=https%3A%2F%2Fcdn.example.com%2Fa%20b.mp4'
    );
  });
});
