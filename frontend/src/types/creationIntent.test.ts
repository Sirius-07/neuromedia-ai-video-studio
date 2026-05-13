import { describe, expect, it } from 'vitest';
import { createCreationIntent, shouldSkipLegacyAutoScriptGeneration, withCreationVisualSelection } from './creationIntent';

describe('shouldSkipLegacyAutoScriptGeneration', () => {
  it('skips the legacy script generator when the workbench is expanding a selected proposal', () => {
    expect(
      shouldSkipLegacyAutoScriptGeneration({
        hasInspirationProposal: true,
        needExpandScript: true,
        shouldGenerate: true,
      })
    ).toBe(true);
  });

  it('allows legacy script generation when there is no proposal expansion flow', () => {
    expect(
      shouldSkipLegacyAutoScriptGeneration({
        hasInspirationProposal: false,
        needExpandScript: false,
        shouldGenerate: true,
      })
    ).toBe(false);
  });
});

describe('withCreationVisualSelection', () => {
  it('keeps the original intent but applies the selected ratio and style', () => {
    const intent = createCreationIntent({
      inputMode: 'assets',
      publishGoal: 'fast_publish',
      prompt: '广州记忆',
      uploadedAssets: [],
      generationMode: 'ai_plus_real',
    });

    const next = withCreationVisualSelection(intent, '9:16', 'retro');

    expect(next).toMatchObject({
      inputMode: 'assets',
      publishGoal: 'fast_publish',
      prompt: '广州记忆',
      aspectRatio: '9:16',
      artStyle: 'retro',
    });
    expect(intent.aspectRatio).toBe('16:9');
    expect(intent.artStyle).toBe('realistic');
  });
});
