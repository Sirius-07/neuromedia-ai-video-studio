import { apiUrl } from '../config/api';

/**
 * 灵感激发模式 API 模块
 * 
 * 调用 Node.js 后端的灵感分析和方案生成服务
 */

// API 基础地址（Node.js 后端）
const API_BASE_URL = apiUrl('');

// ============================================================
// 类型定义
// ============================================================

/** 情绪类型 */
export type EmotionType = 'professional' | 'high_energy' | 'aesthetic' | 'dramatic' | 'minimalist' | 'neutral';

/** 情绪分析结果 */
export interface EmotionAnalysis {
  emotion: EmotionType;
  emotionLabel: string;
  confidence: number;
  detectedElements: string[];
}

/** 粗略脚本场景 */
export interface RoughScriptScene {
  type: string;
  description: string;
  script?: string;
  duration: number;
  visual?: string;
  assetPath?: string | null;
  sourceRef?: string;
  isAISupplemented?: boolean;
}

/** 粗略脚本 */
export interface RoughScript {
  scenes: RoughScriptScene[];
}

/** 新闻事实提炼 */
export interface NewsFacts {
  headline?: string;
  who?: string;
  what?: string;
  when?: string;
  where?: string;
  why?: string;
  keyQuotes?: string[];
  mustRetain?: string[];
}

/** 创意方案 */
export interface InspirationProposal {
  title: string;
  tags: string[];
  styleTags?: string[];
  paceTag?: string;
  scenarioTags?: string[];
  isRecommended?: boolean;
  recommendationReason?: string;
  reasoning: string;
  visualStyle: string;
  bgmStyle: string;
  newsFacts?: NewsFacts;
  roughScript: RoughScript;
}

/** 素材信息（与 scriptApi 保持一致）*/
export interface AssetInfo {
  file_path: string;
  name?: string;
  url?: string;
  file_type: 'image' | 'video';
  description: string | null;
  duration?: number;
  selected?: boolean;
}

/** 详细分镜场景 */
export interface DetailedScene {
  scene_id: number;
  type: string;
  script_content: string;
  narration?: string;
  visual_description: string;
  estimated_duration: number;
  reference_asset_path: string | null;
  bgm_style?: string;
  transition?: string | null;
}

/** 扩展脚本响应 */
export interface ExpandedScriptResponse {
  project_id: string;
  title: string;
  scenes: DetailedScene[];
  total_duration: number;
  visual_style?: string;
  bgm_style?: string;
  tags?: string[];
}

// ============================================================
// API 函数
// ============================================================

/**
 * 分析内容情绪
 * @param assets 素材列表
 * @param userPrompt 用户提示词
 * @returns 情绪分析结果
 */
export async function analyzeContent(
  assets: AssetInfo[],
  userPrompt: string
): Promise<{ success: boolean; data?: EmotionAnalysis; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/inspiration/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assets,
        userPrompt
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '分析失败' }));
      return {
        success: false,
        error: error.error || '情绪分析失败'
      };
    }

    const data = await response.json();
    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('[InspirationAPI] 分析失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误'
    };
  }
}

/**
 * 生成创意方案
 * @param analysisResult 情绪分析结果
 * @param assets 素材列表
 * @param userPrompt 用户提示词
 * @param generationMode 生成模式
 * @returns 创意方案列表
 */
export async function generateProposals(
  analysisResult: EmotionAnalysis,
  assets: AssetInfo[],
  userPrompt: string,
  generationMode?: string,
  newsArticle?: string,
  publishGoal?: string
): Promise<{ success: boolean; data?: { proposals: InspirationProposal[] }; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/inspiration/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisResult,
        assets,
        userPrompt,
        generationMode,
        newsArticle,
        publishGoal,
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '生成失败' }));
      return {
        success: false,
        error: error.error || '方案生成失败'
      };
    }

    const data = await response.json();
    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('[InspirationAPI] 生成方案失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误'
    };
  }
}

/**
 * 转换方案为分镜脚本（简单转换，已废弃）
 * @param proposal 创意方案
 * @returns 分镜场景列表
 */
export async function convertToScenes(
  proposal: InspirationProposal
): Promise<{ success: boolean; data?: { scenes: DetailedScene[] }; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/inspiration/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proposal
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '转换失败' }));
      return {
        success: false,
        error: error.error || '方案转换失败'
      };
    }

    const data = await response.json();
    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('[InspirationAPI] 转换失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误'
    };
  }
}

/**
 * 扩展方案为详细脚本（新接口）
 * @param params 包含 proposal、userPrompt 和 assets 的参数对象
 * @returns 详细脚本响应
 */
export async function expandProposalToScript(params: {
  proposal: InspirationProposal;
  userPrompt: string;
  assets: AssetInfo[];
  projectTitle?: string;
}): Promise<{ success: boolean; data?: ExpandedScriptResponse; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/inspiration/expand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proposal: params.proposal,
        projectTitle: params.projectTitle || params.proposal.title
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '扩展失败' }));
      return {
        success: false,
        error: error.error || '脚本扩展失败'
      };
    }

    const data = await response.json();
    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('[InspirationAPI] 扩展脚本失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误'
    };
  }
}
