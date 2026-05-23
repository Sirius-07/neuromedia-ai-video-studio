import { describe, expect, it } from 'vitest';
import { shouldShowAdvancedSceneParameters } from './advancedSceneExpansion';

describe('shouldShowAdvancedSceneParameters', () => {
  it('shows parameters when advanced mode is enabled', () => {
    expect(shouldShowAdvancedSceneParameters(true)).toBe(true);
  });

  it('hides parameters when advanced mode is disabled', () => {
    expect(shouldShowAdvancedSceneParameters(false)).toBe(false);
  });
});
