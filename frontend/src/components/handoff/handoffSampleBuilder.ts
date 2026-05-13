import type { AssetInfo } from '../../api/scriptApi';
import type { InspirationProposal } from '../InspirationModal';
import type { CreationIntent } from '../../types/creationIntent';
import type {
  HandoffAssetRef,
  HandoffAssetReferenceRole,
  HandoffShot,
  HandoffSource,
  VideoHandoffSample,
} from '../../types/videoHandoff';

type HandoffSceneInput = Record<string, unknown>;

export interface BuildInitialHandoffSampleParams {
  creationIntent?: CreationIntent;
  reportText?: string;
  proposal?: InspirationProposal;
  scenes?: HandoffSceneInput[];
  assets?: AssetInfo[];
  selectedAssetIds?: string[];
  projectTitle?: string;
  previewVideoUrl?: string;
}

const POSITIONING_LABEL = '制作沟通样片，非发布成片' as const;

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function getAssetUrl(asset: AssetInfo): string {
  return asset.url || asset.file_path;
}

function fileNameFromPath(path: string): string {
  const normalized = path.split(/[?#]/)[0];
  const fileName = normalized.split(/[\\/]/).filter(Boolean).pop();
  return fileName ? decodeURIComponent(fileName) : normalized;
}

function assetIdentityValues(asset: AssetInfo): string[] {
  return [asset.file_path, asset.url, asset.name].filter((value): value is string => Boolean(value));
}

function isAssetSelected(asset: AssetInfo, selectedAssetIds?: string[]): boolean {
  if (selectedAssetIds) {
    const assetValues = assetIdentityValues(asset);
    return selectedAssetIds.some(selectedId => assetValues.includes(selectedId));
  }
  return asset.selected !== false;
}

function roleForAsset(asset: AssetInfo, selected: boolean): HandoffAssetReferenceRole {
  if (!selected) return 'style_reference';
  return asset.file_type === 'video' ? 'source_video' : 'storyboard_frame';
}

function buildAssetRefs(assets: AssetInfo[], selectedAssetIds?: string[]): HandoffAssetRef[] {
  return assets.map((asset, index) => {
    const selected = isAssetSelected(asset, selectedAssetIds);
    const originalPath = getAssetUrl(asset);
    const fileName = asset.name || fileNameFromPath(originalPath);

    return {
      id: `asset-${index + 1}`,
      assetId: asset.file_path || asset.url || fileName,
      fileName,
      fileType: asset.file_type,
      url: asset.url || asset.file_path,
      originalPath,
      referenceRole: roleForAsset(asset, selected),
      includedInStoryboard: selected,
      sourceLabel: selected ? '现场素材' : '风格参考素材',
    };
  });
}

function findAssetRefForPath(assetRefs: HandoffAssetRef[], path: string): HandoffAssetRef | undefined {
  return assetRefs.find(assetRef =>
    [assetRef.assetId, assetRef.url, assetRef.originalPath, assetRef.fileName].some(value => value === path)
  );
}

function sceneAssetPath(scene: HandoffSceneInput): string {
  return firstText(
    scene.assetUrl,
    scene.videoUrl,
    scene.reference_asset_path,
    scene.assetPath,
    scene.imagePromptUrl
  );
}

function sourceFromAssetRef(assetRef: HandoffAssetRef): HandoffSource {
  return {
    type: 'uploaded_asset',
    label: '现场素材',
    assetId: assetRef.assetId,
    assetUrl: assetRef.url,
    assetName: assetRef.fileName,
  };
}

function sourceFromScene(
  scene: HandoffSceneInput,
  assetRefs: HandoffAssetRef[],
  fallbackAssetRef?: HandoffAssetRef
): HandoffSource {
  const assetPath = sceneAssetPath(scene);
  const assetRef = assetPath ? findAssetRefForPath(assetRefs, assetPath) : undefined;

  if (assetRef?.includedInStoryboard) {
    return sourceFromAssetRef(assetRef);
  }

  if (!assetPath && fallbackAssetRef) {
    return sourceFromAssetRef(fallbackAssetRef);
  }

  if (assetPath) {
    return {
      type: 'uploaded_asset',
      label: '现场素材',
      assetUrl: assetPath,
      assetName: assetRef?.fileName || fileNameFromPath(assetPath),
    };
  }

  const hasVisualPlan = Boolean(firstText(scene.visualPrompt, scene.visual, scene.description, scene.visual_description));
  return hasVisualPlan
    ? { type: 'ai_reference', label: 'AI参考画面' }
    : { type: 'placeholder', label: '待制作' };
}

function assetRefsForScene(
  scene: HandoffSceneInput,
  assetRefs: HandoffAssetRef[],
  fallbackAssetRef?: HandoffAssetRef
): HandoffAssetRef[] {
  const assetPath = sceneAssetPath(scene);
  const assetRef = assetPath ? findAssetRefForPath(assetRefs, assetPath) : undefined;
  if (!assetPath && fallbackAssetRef) return [fallbackAssetRef];
  return assetRef?.includedInStoryboard ? [assetRef] : [];
}

function productionNoteForSource(source: HandoffSource): string {
  if (source.type === 'uploaded_asset') {
    return source.assetName
      ? `优先保留现场素材「${source.assetName}」，后续制作可精修运动和节奏。`
      : '优先保留现场素材，后续制作可精修运动和节奏。';
  }

  if (source.type === 'ai_reference') {
    return '该镜头为AI参考画面方向，制作时需明确标注，避免被误认为真实现场素材。';
  }

  return '缺少可用素材，建议后续补充现场图片或视频。';
}

function buildShot(
  scene: HandoffSceneInput,
  index: number,
  assetRefs: HandoffAssetRef[],
  fallbackAssetRef?: HandoffAssetRef
): HandoffShot {
  const source = sourceFromScene(scene, assetRefs, fallbackAssetRef);
  const visualIntent = firstText(
    scene.description,
    scene.visual_description,
    scene.visual,
    scene.script,
    scene.script_content,
    scene.visualPrompt
  ) || '补充这一段报道的关键画面';

  return {
    id: `shot-${index + 1}`,
    index: index + 1,
    durationSeconds: firstNumber(scene.duration, scene.estimated_duration) || 5,
    visualIntent,
    captionOrVoiceover: firstText(scene.narration, scene.caption, scene.subtitle, scene.script, scene.script_content),
    source,
    assetRefs: assetRefsForScene(scene, assetRefs, fallbackAssetRef),
    productionNote: productionNoteForSource(source),
    visualPrompt: firstText(scene.visualPrompt, scene.visual, scene.visual_description, scene.description),
  };
}

function buildAssetShot(assetRef: HandoffAssetRef, index: number): HandoffShot {
  const source = sourceFromAssetRef(assetRef);
  const fileTypeText = assetRef.fileType === 'video' ? '视频素材' : '图片素材';

  return {
    id: `shot-${index + 1}`,
    index: index + 1,
    durationSeconds: assetRef.fileType === 'video' ? 6 : 5,
    visualIntent: `使用「${assetRef.fileName}」作为一个关键分镜，表达报道现场、人物或氛围。`,
    captionOrVoiceover: '',
    source,
    assetRefs: [assetRef],
    productionNote: `该${fileTypeText}已被勾选，应进入分镜；后续可基于它做图生视频或视频精修。`,
    visualPrompt: `基于现场素材「${assetRef.fileName}」延展新闻短视频画面。`,
  };
}

function getScenes(params: BuildInitialHandoffSampleParams, proposal?: InspirationProposal): HandoffSceneInput[] {
  if (params.scenes?.length) return params.scenes;
  return proposal?.roughScript?.scenes || [];
}

function buildFallbackShot(reportText: string): HandoffShot {
  return {
    id: 'shot-1',
    index: 1,
    durationSeconds: 5,
    visualIntent: reportText ? '提炼报道主线，形成第一版视频表达方向。' : '等待输入报道与素材后生成视频表达方向。',
    captionOrVoiceover: reportText.slice(0, 80),
    source: { type: 'placeholder', label: '待制作' },
    assetRefs: [],
    productionNote: '当前还没有可用分镜，后续生成样片时会同步整理分镜表。',
    visualPrompt: reportText,
  };
}

export function buildInitialHandoffSample(params: BuildInitialHandoffSampleParams = {}): VideoHandoffSample {
  const proposal = params.proposal || params.creationIntent?.selectedProposal;
  const assets = params.assets || params.creationIntent?.uploadedAssets || [];
  const assetRefs = buildAssetRefs(assets, params.selectedAssetIds);
  const storyboardAssetRefs = assetRefs.filter(assetRef => assetRef.includedInStoryboard);
  const reportText = firstText(params.reportText, params.creationIntent?.prompt);
  const scenes = getScenes(params, proposal);
  const emptyState = !reportText && assets.length === 0 && scenes.length === 0 && !proposal;
  const usedAssetRefIds = new Set<string>();
  const shots = scenes.length > 0
    ? scenes.map((scene, index) => {
        const hasSceneAsset = Boolean(sceneAssetPath(scene));
        const fallbackAssetRef = hasSceneAsset ? undefined : storyboardAssetRefs.find(assetRef => !usedAssetRefIds.has(assetRef.id));
        const shot = buildShot(scene, index, assetRefs, fallbackAssetRef);
        shot.assetRefs.forEach(assetRef => usedAssetRefIds.add(assetRef.id));
        return shot;
      })
    : [];

  storyboardAssetRefs
    .filter(assetRef => !usedAssetRefIds.has(assetRef.id))
    .forEach(assetRef => {
      shots.push(buildAssetShot(assetRef, shots.length));
      usedAssetRefIds.add(assetRef.id);
    });

  if (shots.length === 0) {
    shots.push(buildFallbackShot(reportText));
  }
  const projectTitle = firstText(params.projectTitle);
  const title = projectTitle || firstText(proposal?.title) || '视频交接样片';
  const summary = firstText((proposal as { summary?: string } | undefined)?.summary, proposal?.reasoning, reportText)
    || '根据报道和素材生成的视频制作沟通样片。';

  return {
    id: 'handoff-sample-draft',
    title,
    projectTitle: projectTitle || undefined,
    reportText,
    summary,
    positioningLabel: POSITIONING_LABEL,
    creationIntent: params.creationIntent,
    proposal,
    assets: assetRefs,
    shots,
    exportPackage: {
      filenameBase: title,
      status: 'not_started',
    },
    agentMessages: [
      {
        id: 'agent-message-1',
        role: 'agent',
        content: emptyState
          ? '输入报道和素材后，我会生成视频样片和结构化分镜表。'
          : shots.length > 0
          ? `已生成 ${shots.length} 个镜头的交接样片草案，可继续用自然语言调整表达意图。`
          : '输入报道和素材后，我会生成视频样片和结构化分镜表。',
        createdAt: new Date(0).toISOString(),
      },
    ],
    emptyState,
    previewVideoUrl: params.previewVideoUrl,
  };
}
