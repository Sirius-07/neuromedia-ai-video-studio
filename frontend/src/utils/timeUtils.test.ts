import { describe, expect, it, vi } from 'vitest';
import {
  convertSecondsToTimestamp,
  convertTimestampToSeconds,
  formatDuration,
} from './timeUtils';

describe('timeUtils', () => {
  describe('convertTimestampToSeconds', () => {
    it.each([
      ['00:00:00.000', 0],
      ['00:00:15.033', 15.033],
      ['00:00:30.500', 30.5],
      ['00:01:30.500', 90.5],
      ['01:23:45.678', 5025.678],
    ])('converts %s to seconds', (timestamp, expected) => {
      expect(convertTimestampToSeconds(timestamp)).toBeCloseTo(expected, 3);
    });

    it('returns 0 for invalid timestamp formats', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(convertTimestampToSeconds('00:15')).toBe(0);

      expect(errorSpy).toHaveBeenCalledOnce();
      errorSpy.mockRestore();
    });
  });

  describe('convertSecondsToTimestamp', () => {
    it.each([
      [15.033, '00:00:15.033'],
      [90.5, '00:01:30.500'],
      [5025.678, '01:23:45.678'],
    ])('converts %s seconds to timestamp', (seconds, expected) => {
      expect(convertSecondsToTimestamp(seconds)).toBe(expected);
    });
  });

  describe('formatDuration', () => {
    it.each([
      [15.033, '15.0秒'],
      [90.5, '1分30.5秒'],
      [5025.678, '83分45.7秒'],
    ])('formats %s seconds for display', (seconds, expected) => {
      expect(formatDuration(seconds)).toBe(expected);
    });
  });
});
