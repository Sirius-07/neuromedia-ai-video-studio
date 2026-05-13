import type { AssetInfo } from '../api/scriptApi';
import type { InspirationProposal } from '../components/InspirationModal';
import type { CreationIntent } from './creationIntent';

export type HandoffSourceType = 'uploaded_asset' | 'ai_reference' | 'placeholder';
export type HandoffAssetReferenceRole = 'storyboard_frame' | 'style_reference' | 'source_video';
export type HandoffAgentRole = 'agent' | 'user' | 'system';
export type HandoffPatchStatus = 'preview' | 'applied' | 'cancelled';

export interface HandoffSource {
  type: HandoffSourceType;
  label: '现场素材' | 'AI参考画面' | '待制作';
  assetId?: string;
  assetUrl?: string;
  assetName?: string;
}

export interface HandoffAssetRef {
  id: string;
  assetId: string;
  fileName: string;
  fileType: AssetInfo['file_type'];
  url?: string;
  originalPath: string;
  referenceRole: HandoffAssetReferenceRole;
  includedInStoryboard: boolean;
  sourceLabel: '现场素材' | '风格参考素材';
}

export interface HandoffShot {
  id: string;
  index: number;
  durationSeconds: number;
  visualIntent: string;
  captionOrVoiceover: string;
  source: HandoffSource;
  assetRefs: HandoffAssetRef[];
  productionNote: string;
  visualPrompt: string;
}

export interface HandoffExportPackage {
  sampleVideoUrl?: string;
  shotTablePdfUrl?: string;
  filenameBase: string;
  status: 'not_started' | 'generating' | 'ready' | 'error';
}

export interface AgentPatch {
  id: string;
  status: HandoffPatchStatus;
  summary: string;
  affectedShotIds: string[];
  affectedAssetIds: string[];
  patch: Partial<Pick<HandoffShot, 'durationSeconds' | 'visualIntent' | 'captionOrVoiceover' | 'source' | 'productionNote'>>;
}

export interface AgentMessage {
  id: string;
  role: HandoffAgentRole;
  content: string;
  createdAt: string;
  patchId?: string;
}

export interface VideoHandoffSample {
  id: string;
  title: string;
  projectTitle?: string;
  reportText: string;
  summary: string;
  positioningLabel: '制作沟通样片，非发布成片';
  creationIntent?: CreationIntent;
  proposal?: InspirationProposal;
  assets: HandoffAssetRef[];
  shots: HandoffShot[];
  exportPackage: HandoffExportPackage;
  agentMessages: AgentMessage[];
  emptyState: boolean;
  previewVideoUrl?: string;
}
