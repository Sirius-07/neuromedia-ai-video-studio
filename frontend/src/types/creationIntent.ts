import type { InspirationProposal } from '../components/InspirationModal';
import type { AssetInfo } from '../api/scriptApi';

export type CreationInputMode = 'article' | 'assets';
export type CreationPublishGoal = 'fast_publish' | 'refine_handoff';
export type CreationGenerationMode = 'ai_generated' | 'ai_plus_real' | 'pure_real';
export type CreationAspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

export interface CreationIntent {
  inputMode: CreationInputMode;
  publishGoal: CreationPublishGoal;
  prompt: string;
  assetTheme?: string;
  uploadedAssets: AssetInfo[];
  generationMode: CreationGenerationMode;
  selectedProposal?: InspirationProposal;
  proposalAlternatives: InspirationProposal[];
  aspectRatio: CreationAspectRatio;
  artStyle: string;
  flowVersion: 'workbench_v1';
}

export const DEFAULT_CREATION_ASPECT_RATIO: CreationAspectRatio = '16:9';
export const DEFAULT_CREATION_ART_STYLE = 'realistic';

export function shouldSkipLegacyAutoScriptGeneration(params: {
  hasInspirationProposal: boolean;
  needExpandScript?: boolean;
  shouldGenerate?: boolean;
}): boolean {
  return Boolean(
    params.shouldGenerate &&
    params.hasInspirationProposal &&
    params.needExpandScript
  );
}

export function buildAssetPrompt(uploadedAssets: AssetInfo[], assetTheme?: string): string {
  const selectedAssets = uploadedAssets.filter(asset => asset.selected !== false);
  const theme = assetTheme?.trim();
  const assetCountText = selectedAssets.length > 0
    ? `包含 ${selectedAssets.length} 个现场素材的短视频`
    : '';

  if (theme && assetCountText) return `${theme}。${assetCountText}`;
  if (theme) return theme;
  return assetCountText;
}

export function selectRecommendedProposal(proposals: InspirationProposal[]): InspirationProposal | undefined {
  return proposals.find(proposal => proposal.isRecommended) || proposals[0];
}

export function getDefaultArtStyle(proposal?: InspirationProposal): string {
  const visualStyle = proposal?.visualStyle?.trim();
  if (!visualStyle) return DEFAULT_CREATION_ART_STYLE;
  if (/真实|纪实|real/i.test(visualStyle)) return DEFAULT_CREATION_ART_STYLE;
  return visualStyle;
}

export function createCreationIntent(params: {
  inputMode: CreationInputMode;
  publishGoal: CreationPublishGoal;
  prompt: string;
  assetTheme?: string;
  uploadedAssets: AssetInfo[];
  generationMode: CreationGenerationMode;
  proposals?: InspirationProposal[];
  selectedProposal?: InspirationProposal;
  aspectRatio?: CreationAspectRatio;
  artStyle?: string;
}): CreationIntent {
  const selectedProposal = params.selectedProposal || selectRecommendedProposal(params.proposals || []);

  return {
    inputMode: params.inputMode,
    publishGoal: params.publishGoal,
    prompt: params.prompt.trim(),
    assetTheme: params.assetTheme?.trim() || undefined,
    uploadedAssets: params.uploadedAssets,
    generationMode: params.generationMode,
    selectedProposal,
    proposalAlternatives: params.proposals || [],
    aspectRatio: params.aspectRatio || DEFAULT_CREATION_ASPECT_RATIO,
    artStyle: params.artStyle || getDefaultArtStyle(selectedProposal),
    flowVersion: 'workbench_v1',
  };
}

export function withCreationVisualSelection(
  intent: CreationIntent,
  aspectRatio: CreationAspectRatio,
  artStyle: string
): CreationIntent {
  return {
    ...intent,
    aspectRatio,
    artStyle,
  };
}

export function mergeCreationIntentFromProject(project: {
  userPrompt?: string | null;
  description?: string | null;
  settings?: Record<string, any> | null;
}): CreationIntent | null {
  const settings = project.settings || {};
  const savedIntent = settings.creationIntent as CreationIntent | undefined;
  const prompt = savedIntent?.prompt || project.userPrompt || project.description || '';
  const uploadedAssets = savedIntent?.uploadedAssets || settings.uploadedAssets || [];
  const selectedProposal = savedIntent?.selectedProposal || settings.selectedProposal || settings.inspirationProposal;
  const proposalAlternatives = savedIntent?.proposalAlternatives || settings.proposalAlternatives || [];

  if (!prompt && uploadedAssets.length === 0 && !selectedProposal) return null;

  return createCreationIntent({
    inputMode: savedIntent?.inputMode || (uploadedAssets.length > 0 ? 'assets' : 'article'),
    publishGoal: savedIntent?.publishGoal || settings.publishGoal || 'refine_handoff',
    prompt,
    assetTheme: savedIntent?.assetTheme || settings.assetTheme,
    uploadedAssets,
    generationMode: savedIntent?.generationMode || settings.generationMode || 'ai_generated',
    proposals: proposalAlternatives,
    selectedProposal,
    aspectRatio: savedIntent?.aspectRatio || settings.aspectRatio || DEFAULT_CREATION_ASPECT_RATIO,
    artStyle: savedIntent?.artStyle || settings.artStyle || getDefaultArtStyle(selectedProposal),
  });
}

export function buildCreationSettings(intent: CreationIntent) {
  return {
    creationIntent: intent,
    flowVersion: intent.flowVersion,
    inputMode: intent.inputMode,
    publishGoal: intent.publishGoal,
    assetTheme: intent.assetTheme,
    uploadedAssets: intent.uploadedAssets,
    generationMode: intent.generationMode,
    selectedProposal: intent.selectedProposal,
    inspirationProposal: intent.selectedProposal,
    proposalAlternatives: intent.proposalAlternatives,
    aspectRatio: intent.aspectRatio,
    artStyle: intent.artStyle,
    currentPage: 'storyboard',
  };
}
