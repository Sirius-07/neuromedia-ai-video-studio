import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, Film,
  Upload, ScanEye, Copy, Trash2, Download,
  Clock, Sparkles, Zap, ChevronDown, ArrowLeftRight,
  AlertCircle, CheckCircle2, Edit3, X, ZoomIn,
  Volume2, Pause
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Scene, Asset } from './types';
import * as imageApi from '../../api/imageApi';
import { uploadFile } from '../../api/scriptApi';
import * as imageGenApi from '../../api/imageGenerationApi';
import { getRecommendedSize } from '../../api/imageGenerationApi';
import { getProxiedImageUrl, getProxiedImageUrls, extractOriginalUrl } from '../../utils/imageProxy';
import * as sceneRegenerateApi from '../../api/sceneRegenerateApi';
import { addStyleToPrompt } from '../../utils/stylePrompts';
import { buildCinematicPrompt } from './promptUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SceneCardProps {
  scene: Scene;
  isSelected: boolean;
  onClick: () => void;
  onUpdate: (updates: Partial<Scene>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAssetDrop?: (asset: Asset) => void;
  assets?: Asset[];
  isCompareMode?: boolean; // 对比模式
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  // 重新生成相关
  projectTitle?: string;
  userPrompt?: string;
  allScenes?: Scene[];
  // 画幅比例和艺术风格
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  artStyle?: string;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  isSelected,
  onClick,
  onUpdate,
  onDuplicate,
  onDelete,
  onAssetDrop,
  isCompareMode = false,
  onMouseEnter,
  onMouseLeave,
  projectTitle,
  userPrompt,
  allScenes,
  aspectRatio = '16:9',
  artStyle
}) => {
  const {
    id,
    type,
    script,
    visualPrompt = '',
    motionPrompt = '',
    generationStatus = 'idle',
    assetUrl,
    matchReason,
    generationMode = 'text_to_image'
  } = scene;

  // ==================== State ====================
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegeneratingScene, setIsRegeneratingScene] = useState(false); // AI重新生成分镜状态
  const [showResolutionPicker, setShowResolutionPicker] = useState(false);
  const [showAspectRatioPicker, setShowAspectRatioPicker] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<'1K' | '2K' | '4K'>('2K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<'1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | '21:9'>(aspectRatio || '16:9');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(visualPrompt);
  const [showVideoView, setShowVideoView] = useState(false); // 控制是否显示视频视图
  const [activeTab, setActiveTab] = useState<'generation' | 'creative'>('generation'); // 控制显示生成控制还是创意说明
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aspectRatioPickerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null); // 配音音频引用
  const [isPlayingVoiceover, setIsPlayingVoiceover] = useState(false); // 配音播放状态
  
  // 视频裁剪相关（暂未实现）
  // const [showVideoTrimmer, setShowVideoTrimmer] = useState(false);
  // const [trimRange, setTrimRange] = useState<[number, number]>([0, 100]); // 百分比
  
  // 代理URL获取
  const getProxiedVideoUrl = (originalUrl: string) => {
    console.log('[SceneCard] 原始视频URL:', originalUrl);
    
    // 如果是本地路径，直接使用（不通过代理）
    if (originalUrl.startsWith('/uploads/') || originalUrl.startsWith('uploads/')) {
      const directUrl = originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
      console.log('[SceneCard] 使用直接URL:', `http://localhost:4300${directUrl}`);
      return `http://localhost:4300${directUrl}`;
    }
    
    // 远程URL通过代理
    const proxiedUrl = `http://localhost:4300/api/v1/proxy/video?url=${encodeURIComponent(originalUrl)}`;
    console.log('[SceneCard] 使用代理URL:', proxiedUrl);
    return proxiedUrl;
  };

  // 生成视频CSS滤镜样式
  const getVideoFilterStyle = (): React.CSSProperties => {
    if (!scene.postProcessing) return {};
    
    const { brightness = 0, contrast = 0, saturation = 0, colorTone, sharpness } = scene.postProcessing;
    
    // 构建CSS filter字符串
    const filters: string[] = [];
    
    // 亮度 (-100 to 100 映射到 0 to 2)
    if (brightness !== 0) {
      const brightnessValue = 1 + (brightness / 100);
      filters.push(`brightness(${brightnessValue})`);
    }
    
    // 对比度 (-100 to 100 映射到 0 to 2)
    if (contrast !== 0) {
      const contrastValue = 1 + (contrast / 100);
      filters.push(`contrast(${contrastValue})`);
    }
    
    // 饱和度 (-100 to 100 映射到 0 to 2)
    if (saturation !== 0) {
      const saturationValue = 1 + (saturation / 100);
      filters.push(`saturate(${saturationValue})`);
    }
    
    // 色调
    if (colorTone === '暖色调') {
      filters.push('sepia(0.2)');
    } else if (colorTone === '冷色调') {
      filters.push('hue-rotate(200deg)');
    }
    
    // 锐度（使用SVG滤镜）
    let svgFilter = '';
    if (sharpness === '锐利') {
      svgFilter = 'url(#filter-sharp)';
    } else if (sharpness === '柔和') {
      filters.push('blur(0.5px)');
    }
    
    const style: React.CSSProperties = {};
    
    if (filters.length > 0) {
      style.filter = filters.join(' ');
    }
    
    if (svgFilter) {
      style.filter = (style.filter || '') + ' ' + svgFilter;
    }
    
    return style;
  };
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5); // 视频时长：5秒或10秒
  const [videoModel, setVideoModel] = useState<'jimeng-pro' | 'jimeng-first' | 'jimeng-first-tail' | 'wan2.2'>('jimeng-pro'); // 视频生成模型
  const [tailFrameImage, setTailFrameImage] = useState<string | null>(null); // 尾帧图片（首尾帧模式）
  const [showModelDropdown, setShowModelDropdown] = useState(false); // 模型下拉框显示状态
  const [showImageEditDialog, setShowImageEditDialog] = useState(false); // 是否显示图片编辑对话框
  const [imageEditPrompt, setImageEditPrompt] = useState(''); // 图片编辑提示词
  const [isEditingImage, setIsEditingImage] = useState(false); // 是否正在编辑图片
  const resolutionPickerRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  
  // 实拍视频裁剪相关状态
  const [showRealVideoTrimmer, setShowRealVideoTrimmer] = useState(false);
  const [realVideoTrimRange, setRealVideoTrimRange] = useState<[number, number]>(scene.clipRange || [0, 100]);
  const [realVideoDuration, setRealVideoDuration] = useState<number>(0); // 实际视频时长（秒）
  const realVideoRef = useRef<HTMLVideoElement>(null);

  // localStorage 键名（使用场景ID，统一格式）
  const storageKey = `scene-${id}-generated`;

  // ==================== Effects ====================
  
  // 禁用localStorage恢复，改为从数据库还原
  // useEffect(() => {
  //   try {
  //     const saved = localStorage.getItem(storageKey);
  //     if (saved) {
  //       const data = JSON.parse(saved);
  //       console.log(`[SceneCard ${id}] 从localStorage恢复数据:`, data);
  //       
  //       if (data.generatedImages) setGeneratedImages(data.generatedImages);
  //       if (data.generatedVideoUrl) setGeneratedVideoUrl(data.generatedVideoUrl);
  //       if (data.assetUrl && !assetUrl) onUpdate({ assetUrl: data.assetUrl });
  //       if (data.videoDuration) setVideoDuration(data.videoDuration);
  //       if (data.tailFrameImage) setTailFrameImage(data.tailFrameImage);
  //       if (data.videoModel) setVideoModel(data.videoModel);
  //       if (data.generationStatus) onUpdate({ generationStatus: data.generationStatus });
  //     }
  //   } catch (error) {
  //     console.error(`[SceneCard ${id}] 从localStorage恢复失败:`, error);
  //   }
  // }, [id]);

  // 禁用localStorage保存，改为仅使用数据库
  // useEffect(() => {
  //   try {
  //     const dataToSave = {
  //       generatedImages,
  //       assetUrl,
  //       generatedVideoUrl,
  //       videoDuration,
  //       tailFrameImage,
  //       videoModel,
  //       generationStatus
  //     };
  //     localStorage.setItem(storageKey, JSON.stringify(dataToSave));
  //     console.log(`[SceneCard ${id}] 数据已保存到localStorage`);
  //   } catch (error) {
  //     console.error(`[SceneCard ${id}] 保存到localStorage失败:`, error);
  //   }
  // }, [generatedImages, assetUrl, generatedVideoUrl, videoDuration, tailFrameImage, videoModel, generationStatus, id]);

  // 当 assetUrl 变化时，恢复生成的图片列表
  useEffect(() => {
    if (assetUrl && generatedImages.length === 0 && type === 'ai') {
      console.log('[SceneCard] 设置图片到generatedImages:', assetUrl);
      setGeneratedImages([assetUrl]);
    }
  }, [assetUrl, generatedImages.length, type]);
  
  // 确保从API返回的图片素材正确显示
  useEffect(() => {
    if (generationStatus === 'image_selected' && assetUrl) {
      // 检查assetUrl是否已经在generatedImages中
      if (!generatedImages.includes(assetUrl)) {
        console.log('[SceneCard] 图片已选中状态，设置generatedImages:', assetUrl);
        setGeneratedImages([assetUrl]);
      }
    }
  }, [generationStatus, assetUrl, generatedImages]);
  
  // 确保AI生成场景中，如果有assetUrl但还没有图片数组，就初始化
  useEffect(() => {
    if (type === 'ai' && assetUrl && generatedImages.length === 0 && (generationStatus === 'image_selected' || generationStatus === 'completed')) {
      console.log('[SceneCard] AI场景初始化generatedImages:', assetUrl);
      setGeneratedImages([assetUrl]);
    }
  }, [type, assetUrl, generatedImages.length, generationStatus]);

  // 🔥 修复刷新后视频消失的问题：同步 scene.videoUrl 到本地状态
  useEffect(() => {
    if (type === 'ai' && scene.videoUrl && !generatedVideoUrl) {
      console.log('[SceneCard] 从数据库恢复视频URL:', scene.videoUrl);
      setGeneratedVideoUrl(scene.videoUrl);
      setShowVideoView(true); // 同时显示视频视图
    }
  }, [type, scene.videoUrl, generatedVideoUrl]);

  // 点击外部关闭分辨率选择器、比例选择器和模型下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resolutionPickerRef.current && !resolutionPickerRef.current.contains(event.target as Node)) {
        setShowResolutionPicker(false);
      }
      if (aspectRatioPickerRef.current && !aspectRatioPickerRef.current.contains(event.target as Node)) {
        setShowAspectRatioPicker(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==================== Handlers ====================
  
  // 播放/暂停配音
  const handleToggleVoiceover = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    console.log('[SceneCard] 播放配音:', {
      hasAudioRef: !!audioRef.current,
      voiceoverUrl: scene.voiceoverUrl,
      isPlaying: isPlayingVoiceover
    });
    
    if (!audioRef.current || !scene.voiceoverUrl) {
      console.warn('[SceneCard] 无法播放配音 - 缺少音频元素或URL');
      return;
    }
    
    if (isPlayingVoiceover) {
      audioRef.current.pause();
      setIsPlayingVoiceover(false);
      console.log('[SceneCard] 暂停配音');
    } else {
      audioRef.current.play().catch(err => {
        console.error('[SceneCard] 播放配音失败:', err);
        alert(`播放配音失败: ${err.message}`);
      });
      setIsPlayingVoiceover(true);
      console.log('[SceneCard] 开始播放配音');
    }
  };
  
  // AI重新生成分镜内容
  const handleRegenerateScene = async () => {
    console.log('[SceneCard] 检查重新生成条件:');
    console.log('  projectTitle:', projectTitle);
    console.log('  userPrompt:', userPrompt);
    console.log('  allScenes:', allScenes?.length);
    
    // 如果没有userPrompt，使用projectTitle作为fallback
    const effectivePrompt = userPrompt || projectTitle || '';
    
    if (!projectTitle || !effectivePrompt || !allScenes || allScenes.length === 0) {
      const missingInfo = [];
      if (!projectTitle) missingInfo.push('项目标题');
      if (!effectivePrompt) missingInfo.push('用户提示词');
      if (!allScenes || allScenes.length === 0) missingInfo.push('场景数据');
      
      setGenerationError(`缺少信息：${missingInfo.join('、')}，无法重新生成`);
      console.error('[SceneCard] 缺少信息:', missingInfo);
      return;
    }
    
    console.log('[SceneCard] 使用的提示词:', effectivePrompt.substring(0, 50) + '...');

    try {
      setIsRegeneratingScene(true);
      setGenerationError(null);
      
      console.log('🔄 [SceneCard] 开始重新生成分镜:', id);
      
      // 找到当前场景的索引
      const targetIndex = allScenes.findIndex(s => s.id === id);
      if (targetIndex === -1) {
        throw new Error('找不到当前场景');
      }
      
      // 构建请求数据
      const request: sceneRegenerateApi.RegenerateSceneRequest = {
        project_title: projectTitle,
        user_prompt: effectivePrompt, // 使用带fallback的提示词
        all_scenes: allScenes.map(s => ({
          scene_id: s.id,
          script_content: s.script || s.narration || '',
          visual_description: s.visualPrompt || '',
          duration: parseInt(s.duration) || 5
        })),
        target_scene_index: targetIndex
      };
      
      // 调用API
      const result = await sceneRegenerateApi.regenerateScene(request, true);
      
      console.log('✅ [SceneCard] 重新生成成功:', result);
      
      // 更新场景内容（包括创意说明）
      onUpdate({
        script: result.script_content,
        narration: result.script_content,
        visualPrompt: result.visual_description,
        motionPrompt: result.motion_prompt || motionPrompt,
        duration: String(result.duration),
        designReason: result.regenerate_reason,
        creativeNotes: result.improvements || []
      });
      
      // 显示改进说明
      if (result.improvements && result.improvements.length > 0) {
        console.log('📝 [SceneCard] AI改进说明:');
        console.log('  理由:', result.regenerate_reason);
        result.improvements.forEach((imp, i) => {
          console.log(`  ${i + 1}. ${imp}`);
        });
      }
      
    } catch (error: any) {
      console.error('❌ [SceneCard] 重新生成失败:', error);
      setGenerationError(error.message || '重新生成失败');
    } finally {
      setIsRegeneratingScene(false);
    }
  };
  
  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setGenerationError(null);
    
    // 根据当前状态决定生成图片还是视频
    if (generationStatus === 'idle' || generationStatus === 'image_selected' || isRegenerating) {
      // 校验提示词不能为空
      const promptCheck = visualPrompt?.trim() || script?.trim();
      if (!promptCheck) {
        setGenerationError('请先填写场景描述或视觉提示词');
        return;
      }

      // 生成图片
      onUpdate({ generationStatus: 'generating_image' });
      
      try {
        const originalPrompt = promptCheck;
        // 融合摄影参数（景别/视角/焦距/设备/运镜）
        const cinematicPrompt = buildCinematicPrompt(scene, originalPrompt);
        // 添加艺术风格提示词
        const promptText = addStyleToPrompt(cinematicPrompt, artStyle);
        console.log('🎨 开始生成图片 (含摄影参数+风格):', promptText);
        
        let result;
        
        // 获取图片提示URL（如果是图生图模式）
        const imagePromptUrl = scene.assetUrl || (generationMode === 'image_to_image' && generatedImages[0]);
        
        if (generationMode === 'image_to_image' && imagePromptUrl) {
          // 图生图模式 - 使用 Seedream 4.5 模型
          console.log('🎨 使用图生图模式 (Seedream 4.5)');
          result = await imageGenApi.imageToImage(
            promptText,
            [imagePromptUrl],
            {
              size: 'adaptive',
              watermark: true,
              response_format: 'url',
            }
          );
        } else {
          // 文生图模式 - 使用 Seedream 4.5 API，生成1张图片
          // 根据分辨率和比例计算具体尺寸
          const sizeParam = getRecommendedSize(selectedAspectRatio, selectedResolution);
          
          console.log('🎨 使用文生图模式 (Seedream 4.5):', {
            resolution: selectedResolution,
            aspectRatio: selectedAspectRatio,
            size: sizeParam
          });
          
          result = await imageGenApi.textToImage(promptText, {
            size: sizeParam,
            watermark: true,
            response_format: 'url',
          });
        }

        console.log('✅ 图像生成成功:', result);
        // 转换为代理URL
        const proxiedUrls = getProxiedImageUrls(result.imageUrls);
        setGeneratedImages(proxiedUrls);
        
        // 自动选择第一张图片
        const firstImageUrl = proxiedUrls[0];
        onUpdate({ 
          assetUrl: firstImageUrl,
          generationStatus: 'image_selected' 
        });
        setIsRegenerating(false); // 重置重新生成标记
        
        // 禁用localStorage保存，仅使用数据库
        // 立即保存到 localStorage（不等待 useEffect）
        // const payload = {
        //   generatedImages: proxiedUrls,
        //   assetUrl: firstImageUrl,
        //   generatedVideoUrl: generatedVideoUrl || undefined,
        //   videoDuration,
        //   tailFrameImage: tailFrameImage || undefined,
        //   videoModel,
        //   generationStatus: 'image_selected'
        // };
        // localStorage.setItem(storageKey, JSON.stringify(payload));
        
      } catch (error) {
        console.error('❌ 图像生成失败:', error);
        setGenerationError(error instanceof Error ? error.message : '图像生成失败');
        onUpdate({ generationStatus: 'idle' });
      }
      return; // 图片生成完成后直接返回，不自动触发视频生成
    }
    
    // 只有在明确的状态下才生成视频（不是重新生图的情况）
    if (!isRegenerating && scene.generationStatus === 'image_selected' && scene.assetUrl) {
      // 生成视频
      await handleVideoGeneration(e);
    }
  };

  const handleVideoGeneration = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!scene.assetUrl) {
      setGenerationError('请先选择一张图片');
      return;
    }
    
    setGenerationError(null);
    onUpdate({ generationStatus: 'generating_video' });
    
    try {
      const originalPrompt = motionPrompt || visualPrompt || script || '';
      // 添加艺术风格提示词
      const promptText = addStyleToPrompt(originalPrompt, artStyle);
      console.log('🎬 开始生成视频 (添加风格后):', {
        imageUrl: scene.assetUrl,
        prompt: promptText,
        model: videoModel,
        duration: videoDuration,
        aspectRatio: aspectRatio,
        tailFrame: tailFrameImage
      });
      
      let result;
      const frames = videoDuration === 5 ? 121 : 241;
      
      // 根据不同模型调用不同的API
      if (videoModel === 'jimeng-first-tail' && tailFrameImage) {
        // 即梦3.0 首尾帧模式
        result = await imageApi.imageToVideo(scene.assetUrl, promptText, {
          frames,
          model: 'jimeng-first-tail',
          firstImageUrl: scene.assetUrl,
          lastImageUrl: tailFrameImage,
          aspectRatio: aspectRatio as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'
        });
      } else if (videoModel === 'jimeng-first') {
        // 即梦3.0 首帧模式
        result = await imageApi.imageToVideo(scene.assetUrl, promptText, {
          frames,
          model: 'jimeng-first',
          aspectRatio: aspectRatio as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'
        });
      } else if (videoModel === 'wan2.2') {
        // Wan2.2 模型（ComfyUI）
        result = await imageApi.imageToVideo(scene.assetUrl, promptText, {
          frames: 81, // Wan2.2 固定81帧
          model: 'wan2.2',
          width: 1280,
          height: 720,
          fps: 16
        });
      } else {
        // 即梦3.0 Pro 模式（默认）
        result = await imageApi.imageToVideo(scene.assetUrl, promptText, {
          frames,
          model: 'jimeng-pro',
          aspectRatio: aspectRatio as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'
        });
      }
      
      console.log('✅ 视频生成成功:', result);
      const proxiedVideoUrl = getProxiedVideoUrl(result.videoUrl);
      setGeneratedVideoUrl(proxiedVideoUrl);
      onUpdate({ 
        videoUrl: proxiedVideoUrl,
        generationStatus: 'completed'
      });
      setShowVideoView(true); // 视频生成完成后自动切换到视频视图
      
      // 禁用localStorage保存，仅使用数据库
      // 保存到 localStorage
      // const payload = {
      //   generatedImages,
      //   assetUrl: scene.assetUrl,
      //   generatedVideoUrl: proxiedVideoUrl,
      //   videoDuration,
      //   tailFrameImage: tailFrameImage || undefined,
      //   videoModel,
      //   generationStatus: 'completed'
      // };
      // localStorage.setItem(storageKey, JSON.stringify(payload));
      
    } catch (error) {
      console.error('❌ 视频生成失败:', error);
      setGenerationError(error instanceof Error ? error.message : '视频生成失败');
      onUpdate({ generationStatus: 'image_selected' });
    }
  };


  // 处理拖拽素材
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    const dataStr = e.dataTransfer.getData('application/json');
    if (dataStr) {
      try {
        const asset = JSON.parse(dataStr) as Asset;
        if (onAssetDrop) {
          onAssetDrop(asset);
        }
      } catch (error) {
        console.error('解析拖拽数据失败:', error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };


  // 触发文件选择
  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  // 处理上传实拍素材
  const handleUploadFootage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      const file = files[0];
      console.log('📤 上传实拍素材:', file.name);
      
      // 判断文件类型
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        setGenerationError('不支持的文件类型，请上传图片或视频');
        return;
      }
      
      setGenerationError(null);
      
      // 如果当前是AI场景且是图片，设置为图生图模式
      if (type === 'ai' && isImage) {
        onUpdate({ generationStatus: 'generating_image' });
      }
      
          // 上传文件
          const asset = await uploadFile(file);
          console.log('✅ 实拍素材上传成功:', asset);
          
          const fileUrl = asset.url || asset.file_path;
          
      // 更新场景
      if (isImage) {
        // 使用代理URL
        const proxiedUrl = getProxiedImageUrl(fileUrl);
        onUpdate({ 
          assetUrl: proxiedUrl,
          footageStatus: 'filled',
          generationStatus: 'image_selected',
          generationMode: 'image_to_image' // 设置为图生图模式
        });
        setGeneratedImages([proxiedUrl]);
        
        // 禁用localStorage保存，仅使用数据库
        // 立即保存到localStorage
        // const payload = {
        //   generatedImages: [proxiedUrl],
        //   assetUrl: proxiedUrl,
        //   generatedVideoUrl: generatedVideoUrl || undefined,
        //   videoDuration,
        //   tailFrameImage: tailFrameImage || undefined,
        //   videoModel,
        //   generationStatus: 'image_selected'
        // };
        // localStorage.setItem(storageKey, JSON.stringify(payload));
      } else if (isVideo) {
            onUpdate({ 
              videoUrl: fileUrl,
              assetUrl: fileUrl,
              footageStatus: 'filled',
              generationStatus: 'completed'
            });
            setGeneratedVideoUrl(fileUrl);
          }
      
      // 清空文件输入，允许重复上传
      e.target.value = '';
      
    } catch (error) {
      console.error('❌ 实拍素材上传失败:', error);
      setGenerationError(error instanceof Error ? error.message : '素材上传失败');
    }
  };


  // 处理图片编辑生成
  const handleImageEditGenerate = async () => {
    if (!scene.assetUrl || !imageEditPrompt.trim()) return;
    
    // 找到当前选中图片在数组中的索引
    const currentIndex = generatedImages.findIndex(url => url === scene.assetUrl);
    if (currentIndex === -1) {
      console.error('❌ 无法找到当前选中的图片');
      return;
    }
    
    setShowImageEditDialog(false);
    setGenerationError(null);
    setIsEditingImage(true);
    
    try {
      // 提取原始URL（如果是代理URL）
      const originalImageUrl = extractOriginalUrl(scene.assetUrl);
      
      console.log('🎨 开始图片编辑（图生图模式）:', {
        prompt: imageEditPrompt,
        referenceImage: originalImageUrl,
        editingIndex: currentIndex
      });
      
      // 使用图生图API（Seedream 4.5），以原图为参考生成新图
      const result = await imageGenApi.imageToImage(
        imageEditPrompt,
        [originalImageUrl], // 使用原始URL作为参考图
        {
          size: '2K', // 使用2K尺寸（与原始生成保持一致）
          watermark: true,
          response_format: 'url',
        }
      );

      console.log('✅ 图片编辑成功，生成了', result.imageUrls.length, '张图片');
      
      if (!result.imageUrls || result.imageUrls.length === 0) {
        throw new Error('图片生成失败，请重试');
      }
      
      // 转换为代理URL
      const proxiedUrls = getProxiedImageUrls(result.imageUrls);
      const newImageUrl = proxiedUrls[0];
      
      // 只替换被编辑的那一张图片，保留其他图片
      const updatedImages = [...generatedImages];
      updatedImages[currentIndex] = newImageUrl;
      
      // 更新场景，使用新图片
      onUpdate({
        assetUrl: newImageUrl,
        generationStatus: 'image_selected',
      });
      setGeneratedImages(updatedImages);

      // 禁用localStorage保存，仅使用数据库
      // 保存到localStorage
      // const payload = {
      //   generatedImages: updatedImages,
      //   assetUrl: newImageUrl,
      //   generatedVideoUrl: generatedVideoUrl || undefined,
      //   videoDuration,
      //   tailFrameImage: tailFrameImage || undefined,
      //   videoModel,
      //   generationStatus: 'image_selected'
      // };
      // localStorage.setItem(storageKey, JSON.stringify(payload));
      
    } catch (error) {
      console.error('❌ 图片编辑失败:', error);
      setGenerationError(error instanceof Error ? error.message : '图片编辑失败');
    } finally {
      setIsEditingImage(false);
    }
  };

  // ==================== Render ====================

  // 如果是实拍场景
  if (type === 'real') {
    return (
      <motion.div
        layout
        id={`scene-${id}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'group relative bg-card border-2 rounded-xl p-6 cursor-pointer transition-all duration-200',
          isSelected ? 'border-primary shadow-xl shadow-primary/20' : 'border-border hover:border-primary/50',
          isDraggingOver && 'border-primary border-dashed bg-primary/5'
        )}
        onClick={onClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* 顶部：场景编号 + 脚本标题 + 实拍标签 + 操作按钮 */}
        <div className="flex items-center justify-between mb-4 gap-3">
          {/* 左侧：场景编号 + 脚本标题 */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
              {id}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                {script || '未填写脚本内容...'}
              </h3>
            </div>
          </div>
          
          {/* 右侧：实拍标签 + 操作按钮 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-600 dark:text-blue-400">
              实拍素材
            </div>
            {/* 配音播放按钮 */}
            {scene.voiceoverUrl && (
              <button
                onClick={handleToggleVoiceover}
                className="p-1.5 rounded hover:bg-accent transition-colors"
                title={isPlayingVoiceover ? "暂停配音" : "播放配音"}
              >
                {isPlayingVoiceover ? (
                  <Pause size={14} className="text-blue-600" />
                ) : (
                  <Volume2 size={14} className="text-muted-foreground hover:text-blue-600" />
                )}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="复制场景"
            >
              <Copy size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
              title="删除场景"
            >
              <Trash2 size={14} className="text-destructive" />
            </button>
          </div>
        </div>

        {/* 视觉舞台 - 显示上传的素材 */}
        <div className="mb-4 aspect-video rounded-lg overflow-hidden bg-muted border-2 border-dashed border-border relative group/stage">
          {assetUrl ? (
            <>
              {/* 剪辑时间信息 - 显示在视频右上角（纯实拍模式） */}
              {scene.clipStartTime !== undefined && scene.clipEndTime !== undefined && (
                <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] text-white flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} />
                    <span className="font-medium">剪辑时间</span>
                  </div>
                  <div className="text-[9px] text-white/80">
                    {scene.clipStartTime.toFixed(1)}s - {scene.clipEndTime.toFixed(1)}s
                  </div>
                </div>
              )}

              {/* 判断是图片还是视频 */}
              {assetUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i) ? (
                <img 
                  src={getProxiedImageUrl(assetUrl)} 
                  alt="实拍素材" 
                  className="w-full h-full object-cover"
                />
              ) : isCompareMode && scene.postProcessing ? (
                /* 对比模式：显示优化前后对比 */
                <div className="w-full h-full grid grid-cols-2 gap-1">
                  {/* 优化前 */}
                  <div className="relative">
                    <video 
                      src={getProxiedVideoUrl(assetUrl)}
                      className="w-full h-full object-cover"
                      controls
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget;
                        setRealVideoDuration(video.duration);
                        if (scene.clipStartTime !== undefined && scene.clipEndTime !== undefined) {
                          const startPercent = (scene.clipStartTime / video.duration) * 100;
                          const endPercent = (scene.clipEndTime / video.duration) * 100;
                          setRealVideoTrimRange([startPercent, endPercent]);
                          video.currentTime = scene.clipStartTime;
                        }
                      }}
                      onError={(e) => {
                        const video = e.currentTarget;
                        console.error('[SceneCard] ❌ 对比模式-优化前视频加载失败:', video.src);
                      }}
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                      优化前
                    </div>
                  </div>
                  {/* 优化后 */}
                  <div className="relative">
                    <video 
                      ref={realVideoRef}
                      src={getProxiedVideoUrl(assetUrl)}
                      className="w-full h-full object-cover"
                      style={getVideoFilterStyle()}
                      controls
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget;
                        setRealVideoDuration(video.duration);
                        if (scene.clipStartTime !== undefined && scene.clipEndTime !== undefined) {
                          const startPercent = (scene.clipStartTime / video.duration) * 100;
                          const endPercent = (scene.clipEndTime / video.duration) * 100;
                          setRealVideoTrimRange([startPercent, endPercent]);
                          video.currentTime = scene.clipStartTime;
                        }
                      }}
                      onTimeUpdate={(e) => {
                        const video = e.currentTarget;
                        const currentPlayTime = video.currentTime;
                        const clipEnd = (realVideoDuration * realVideoTrimRange[1] / 100);
                        const clipStart = (realVideoDuration * realVideoTrimRange[0] / 100);
                        if (currentPlayTime >= clipEnd) {
                          video.pause();
                          video.currentTime = clipStart;
                        }
                      }}
                      onPlay={(e) => {
                        const video = e.currentTarget;
                        const clipStart = (realVideoDuration * realVideoTrimRange[0] / 100);
                        if (video.currentTime < clipStart || video.currentTime >= (realVideoDuration * realVideoTrimRange[1] / 100)) {
                          video.currentTime = clipStart;
                        }
                      }}
                      onError={(e) => {
                        const video = e.currentTarget;
                        console.error('[SceneCard] ❌ 对比模式-优化后视频加载失败:', video.src);
                      }}
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-primary/90 text-white text-xs rounded">
                      AI优化后
                    </div>
                  </div>
                </div>
              ) : (
                /* 正常模式 */
                <video 
                  ref={realVideoRef}
                  src={getProxiedVideoUrl(assetUrl)}
                  className="w-full h-full object-cover"
                  style={getVideoFilterStyle()}
                  controls
                  onLoadStart={() => {
                    console.log('[SceneCard] 视频开始加载:', assetUrl);
                  }}
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    setRealVideoDuration(video.duration);
                    console.log(`[SceneCard] 视频元数据加载成功，时长: ${video.duration}s`);
                    
                    // 如果有AI分析的剪辑时间，自动设置裁剪范围并设置播放区间
                    if (scene.clipStartTime !== undefined && scene.clipEndTime !== undefined) {
                      const startPercent = (scene.clipStartTime / video.duration) * 100;
                      const endPercent = (scene.clipEndTime / video.duration) * 100;
                      setRealVideoTrimRange([startPercent, endPercent]);
                      
                      // 设置视频的播放起点和终点
                      video.currentTime = scene.clipStartTime;
                      console.log(`[SceneCard] 自动设置裁剪范围: ${scene.clipStartTime}s - ${scene.clipEndTime}s`);
                    }
                  }}
                  onTimeUpdate={(e) => {
                    // 限制播放在裁剪范围内
                    const video = e.currentTarget;
                    if (scene.clipEndTime !== undefined && video.currentTime >= scene.clipEndTime) {
                      video.pause();
                      if (scene.clipStartTime !== undefined) {
                        video.currentTime = scene.clipStartTime;
                      }
                    }
                  }}
                  onPlay={(e) => {
                    // 播放时确保从裁剪开始位置播放
                    const video = e.currentTarget;
                    if (scene.clipStartTime !== undefined && video.currentTime < scene.clipStartTime) {
                      video.currentTime = scene.clipStartTime;
                    }
                  }}
                  onError={(e) => {
                    const video = e.currentTarget;
                    const error = video.error;
                    console.error('[SceneCard] ❌ 实拍视频加载失败:', {
                      assetUrl,
                      errorCode: error?.code,
                      errorMessage: error?.message,
                      src: video.src,
                      networkState: video.networkState,
                      readyState: video.readyState
                    });
                    setGenerationError(`视频加载失败 (错误代码: ${error?.code || '未知'})`);
                  }}
                  onCanPlay={() => {
                    console.log('[SceneCard] ✅ 视频可以播放');
                  }}
                />
              )}
              
              {/* 悬浮操作按钮 */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/stage:opacity-100 transition-opacity">
                {!assetUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRealVideoTrimmer(true);
                    }}
                    className="p-2 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
                    title="裁剪视频"
                  >
                    <ScanEye size={16} />
                  </button>
                )}
                <button
                  onClick={handleUploadClick}
                  className="p-2 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
                  title="更换素材"
                >
                  <Upload size={16} />
                </button>
              </div>
            </>
          ) : (
            <div 
              className="w-full h-full flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={handleUploadClick}
            >
              <Upload size={32} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">点击上传实拍素材</p>
              <p className="text-xs text-muted-foreground/60">或从左侧素材库拖拽到此处</p>
            </div>
          )}
        </div>

        {/* 实拍视频时间段裁剪控件 - 简化版 */}
        {type === 'real' && assetUrl && !assetUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i) && realVideoDuration > 0 && (
          <div className="mb-3 p-2.5 bg-muted/30 border border-border rounded-lg space-y-2">
            {/* 标题和时间信息 - 一行显示 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-muted-foreground" />
                <span className="text-[10px] font-medium text-foreground">裁剪</span>
                <span className="text-[10px] text-muted-foreground">
                  {(realVideoDuration * realVideoTrimRange[0] / 100).toFixed(1)}s - {(realVideoDuration * realVideoTrimRange[1] / 100).toFixed(1)}s
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground">
                片段 {((realVideoDuration * (realVideoTrimRange[1] - realVideoTrimRange[0]) / 100)).toFixed(1)}s / 总 {realVideoDuration.toFixed(1)}s
              </span>
            </div>

            {/* 双滑块控件 - 精简版 */}
            <div className="relative h-7 bg-muted rounded overflow-hidden">
              {/* 选中区域高亮 */}
              <div 
                className="absolute top-0 bottom-0 bg-primary/25 border-l border-r border-primary/50"
                style={{
                  left: `${realVideoTrimRange[0]}%`,
                  right: `${100 - realVideoTrimRange[1]}%`
                }}
              />
              
              {/* 开始滑块 */}
              <input
                type="range"
                min="0"
                max="100"
                value={realVideoTrimRange[0]}
                onChange={(e) => {
                  const start = Number(e.target.value);
                  if (start < realVideoTrimRange[1]) {
                    setRealVideoTrimRange([start, realVideoTrimRange[1]]);
                    // 实时更新场景的clipStartTime和clipEndTime
                    const startTime = (realVideoDuration * start / 100);
                    const endTime = (realVideoDuration * realVideoTrimRange[1] / 100);
                    onUpdate({ 
                      clipStartTime: startTime,
                      clipEndTime: endTime
                    });
                    
                    // 更新视频播放位置
                    if (realVideoRef.current) {
                      realVideoRef.current.currentTime = startTime;
                    }
                  }
                }}
                className="absolute top-0 left-0 w-full h-full appearance-none bg-transparent cursor-pointer z-10"
                style={{
                  pointerEvents: 'auto',
                }}
              />

              {/* 结束滑块 */}
              <input
                type="range"
                min="0"
                max="100"
                value={realVideoTrimRange[1]}
                onChange={(e) => {
                  const end = Number(e.target.value);
                  if (end > realVideoTrimRange[0]) {
                    setRealVideoTrimRange([realVideoTrimRange[0], end]);
                    // 实时更新场景的clipStartTime和clipEndTime
                    const startTime = (realVideoDuration * realVideoTrimRange[0] / 100);
                    const endTime = (realVideoDuration * end / 100);
                    onUpdate({ 
                      clipStartTime: startTime,
                      clipEndTime: endTime
                    });
                  }
                }}
                className="absolute top-0 left-0 w-full h-full appearance-none bg-transparent cursor-pointer z-20"
                style={{
                  pointerEvents: 'auto',
                }}
              />

              {/* 左右边界指示器 */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-sm z-30 pointer-events-none"
                style={{ left: `${realVideoTrimRange[0]}%` }}
              />
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-sm z-30 pointer-events-none"
                style={{ left: `${realVideoTrimRange[1]}%` }}
              />
            </div>

            {/* 操作按钮 - 精简 */}
            <div className="flex items-center justify-end">
              <button
                onClick={() => {
                  // 重置为全长
                  setRealVideoTrimRange([0, 100]);
                  onUpdate({ 
                    clipStartTime: 0,
                    clipEndTime: realVideoDuration
                  });
                  if (realVideoRef.current) {
                    realVideoRef.current.currentTime = 0;
                  }
                }}
                className="px-2.5 py-0.5 rounded text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                重置
              </button>
            </div>
          </div>
        )}

        {/* 匹配原因 - 已移除 */}

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleUploadFootage}
          className="hidden"
        />

        {/* 实拍视频裁剪器 */}
        {showRealVideoTrimmer && assetUrl && realVideoDuration > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">裁剪视频片段</h3>
                <button
                  onClick={() => setShowRealVideoTrimmer(false)}
                  className="p-1 rounded hover:bg-accent transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 视频预览 */}
              <div className="mb-4">
                <video
                  src={getProxiedVideoUrl(assetUrl)}
                  className="w-full rounded-lg"
                  controls
                  onError={(e) => {
                    const video = e.currentTarget;
                    console.error('[SceneCard] ❌ 裁剪弹窗-视频加载失败:', video.src);
                  }}
                />
              </div>

              {/* 裁剪范围滑块 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    开始: {(realVideoDuration * realVideoTrimRange[0] / 100).toFixed(1)}s
                  </span>
                  <span className="text-sm text-muted-foreground">
                    结束: {(realVideoDuration * realVideoTrimRange[1] / 100).toFixed(1)}s
                  </span>
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={realVideoTrimRange[0]}
                  onChange={(e) => {
                    const start = Number(e.target.value);
                    if (start < realVideoTrimRange[1]) {
                      setRealVideoTrimRange([start, realVideoTrimRange[1]]);
                    }
                  }}
                  className="w-full"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={realVideoTrimRange[1]}
                  onChange={(e) => {
                    const end = Number(e.target.value);
                    if (end > realVideoTrimRange[0]) {
                      setRealVideoTrimRange([realVideoTrimRange[0], end]);
                    }
                  }}
                  className="w-full"
                />
              </div>

              {/* 确认按钮 */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRealVideoTrimmer(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onUpdate({ clipRange: realVideoTrimRange });
                    setShowRealVideoTrimmer(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  确认裁剪
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    );
  }

  // AI 生成场景
  return (
    <motion.div
      layout
      id={`scene-${id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative bg-card border-2 rounded-xl overflow-hidden transition-all duration-200',
        isSelected ? 'border-primary shadow-xl shadow-primary/20' : 'border-border hover:border-primary/50'
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="p-6">
        {/* 顶部：场景编号 + 脚本标题 + AI标签 + 操作按钮 */}
        <div className="flex items-center justify-between mb-3 gap-3">
          {/* 左侧：场景编号 + 脚本标题 */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
              {id}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                {script || '未填写脚本内容...'}
              </h3>
            </div>
          </div>
          
          {/* 右侧：AI标签 + 操作按钮 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] font-bold text-purple-600 dark:text-purple-400">
              AI 生成
            </div>
            {/* 配音播放按钮 */}
            {scene.voiceoverUrl && (
              <button
                onClick={handleToggleVoiceover}
                className="p-1.5 rounded hover:bg-accent transition-colors"
                title={isPlayingVoiceover ? "暂停配音" : "播放配音"}
              >
                {isPlayingVoiceover ? (
                  <Pause size={14} className="text-blue-600" />
                ) : (
                  <Volume2 size={14} className="text-muted-foreground hover:text-blue-600" />
                )}
              </button>
            )}
            {/* 只在未完成视频状态显示重新生成分镜按钮,避免内容不匹配 */}
            {scene.generationStatus !== 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRegenerateScene(); }}
                className="p-1.5 rounded hover:bg-purple-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                title="AI重新生成此分镜内容"
                disabled={isRegeneratingScene}
              >
                <RefreshCw size={14} className={cn(
                  "text-purple-600 dark:text-purple-400 transition-transform duration-500",
                  isRegeneratingScene ? "animate-spin" : "group-hover:rotate-180"
                )} />
              </button>
            )}
            {/* 视频完成后的视图切换按钮 */}
            {scene.generationStatus === 'completed' && generatedVideoUrl && (
              <>
                {showVideoView ? (
                  /* 在视频播放视图显示"返回编辑"按钮 */
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowVideoView(false);
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                    title="返回创作面板,查看和编辑图片、视频选项"
                  >
                    <ArrowLeftRight size={14} className="text-white rotate-180" />
                    <span className="text-[10px] font-semibold text-white">返回编辑</span>
                  </button>
                ) : (
                  /* 在创作面板显示"查看视频"按钮 */
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowVideoView(true);
                    }}
                    className="px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-1.5"
                    title="查看已生成的视频"
                  >
                    <span className="text-[10px] font-semibold text-white">查看视频</span>
                    <ArrowLeftRight size={14} className="text-white" />
                  </button>
                )}
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="复制场景"
            >
              <Copy size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
              title="删除场景"
            >
              <Trash2 size={14} className="text-destructive" />
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 mb-4 bg-muted/30 p-1 rounded-lg">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab('generation'); }}
            className={cn(
              "flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all",
              activeTab === 'generation'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            生成控制
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab('creative'); }}
            className={cn(
              "flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all",
              activeTab === 'creative'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            创意说明
          </button>
        </div>

        {/* Tab 内容 */}
        {activeTab === 'generation' ? (
          <>
            {/* 错误提示 */}
            {generationError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-destructive mb-1">生成失败</p>
                  <p className="text-xs text-destructive/80">{generationError}</p>
                </div>
              </div>
            )}

            {/* 主内容区域 - 根据状态显示不同视图 */}
        {showVideoView && scene.generationStatus === 'completed' && generatedVideoUrl ? (
          /* ========== 视频完成视图（类似实拍分镜） ========== */
          <div className="mb-4">
            {/* 视频播放器 */}
            <div className="aspect-video rounded-lg overflow-hidden bg-muted border-2 border-border relative group/stage mb-4">
              {/* AI生成标签 */}
              <div className="absolute top-2 left-2 z-20 px-2 py-1 bg-purple-500/90 backdrop-blur-sm rounded text-[10px] font-bold text-white flex items-center gap-1.5 pointer-events-none">
                <Sparkles size={12} />
                AI生成
              </div>

              <video
                src={generatedVideoUrl}
                className="w-full h-full object-contain"
                controls
                playsInline
              />
            </div>

            {/* 视频提示词 */}
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground font-medium mb-2">视频提示词</label>
              <textarea
                value={motionPrompt || visualPrompt || script || ''}
                onChange={(e) => {
                  onUpdate({ motionPrompt: e.target.value });
                }}
                className="w-full p-2 bg-muted/30 rounded text-xs text-foreground leading-relaxed border border-border/30 min-h-[4rem] resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder="描述画面动作和镜头运动..."
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* 视频信息 */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock size={12} />
                <span>时长: {videoDuration}秒</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap size={12} />
                <span>模型: {videoModel === 'jimeng-pro' ? 'Pro' : videoModel === 'jimeng-first' ? '首帧' : videoModel === 'jimeng-first-tail' ? '首尾帧' : 'Wan2.2'}</span>
              </div>
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 size={12} />
                <span>已完成</span>
              </div>
            </div>
          </div>
        ) : (
          /* ========== 原有的两列布局（图片生成和视频生成） ========== */
          <div className="grid grid-cols-2 gap-4">
            {/* ========== 左列：生成图区域 ========== */}
            <div className="bg-card/50 rounded-lg border border-border/50 p-3 flex flex-col">
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                <Sparkles size={14} className="text-muted-foreground" />
                生成图区域
              </h4>
              
              {/* STEP 1 内容包装 - 始终显示 */}
              {(scene.generationStatus === 'idle' || scene.generationStatus === 'generating_image' || scene.generationStatus === 'image_selected' || scene.generationStatus === 'generating_video' || scene.generationStatus === 'completed') && (
                <div>
                  {scene.generationStatus === 'idle' || scene.generationStatus === 'generating_image' ? (
                  // 生成前/生成中
                  <div className="flex-1 bg-card/80 rounded-lg border border-border/60 p-3 flex flex-col justify-between group hover:border-primary/30 transition-all shadow-sm">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-primary border border-border">Step 1</span>
                            画面生成
                          </div>
                          <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
                            <button 
                              onClick={(e) => { e.stopPropagation(); onUpdate({ generationMode: 'text_to_image' }); }}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
                                generationMode === 'text_to_image' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              文生图
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onUpdate({ generationMode: 'image_to_image' }); }}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
                                generationMode === 'image_to_image' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              图生图
                            </button>
                          </div>
                        </div>
                        
                        {/* 视觉提示词 */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-muted-foreground">画面描述</label>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsEditingPrompt(!isEditingPrompt);
                                if (!isEditingPrompt) {
                                  setEditedPrompt(visualPrompt || script || '');
                                }
                              }}
                              className="text-[9px] text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              <Edit3 size={10} />
                              {isEditingPrompt ? '取消' : '编辑'}
                            </button>
                          </div>
                          {isEditingPrompt ? (
                            <div className="space-y-1">
                              <textarea
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                  // 按 Enter 键（不按 Shift）时保存
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (editedPrompt.trim()) {
                                      onUpdate({ visualPrompt: editedPrompt });
                                      setIsEditingPrompt(false);
                                    }
                                  }
                                }}
                                className="w-full p-1.5 bg-muted/30 rounded text-[10px] text-foreground leading-relaxed border border-border/30 min-h-[3.5rem] resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                placeholder="输入画面描述..."
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdate({ visualPrompt: editedPrompt });
                                  setIsEditingPrompt(false);
                                }}
                                className="w-full px-2 py-1 bg-primary text-primary-foreground rounded text-[9px] hover:bg-primary/90 transition-colors"
                              >
                                保存
                              </button>
                            </div>
                          ) : (
                            <div className="p-1.5 bg-muted/30 rounded text-[10px] text-foreground leading-relaxed border border-border/30 max-h-14 overflow-y-auto">
                              {visualPrompt || script || '未填写画面描述...'}
                            </div>
                          )}
                        </div>

                        {/* 图生图模式：上传/选择参考图片 */}
                        {generationMode === 'image_to_image' && (
                          <div className="mb-2">
                            <label className="block text-[10px] text-muted-foreground mb-1">参考图片</label>
                            {scene.assetUrl ? (
                              <div className="relative group/img">
                                <img 
                                  src={getProxiedImageUrl(scene.assetUrl)}
                                  alt="参考图片"
                                  className="w-full h-20 object-cover rounded border border-border"
                                />
                                <button
                                  onClick={handleUploadClick}
                                  className="absolute inset-0 bg-black/0 hover:bg-black/60 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100"
                                >
                                  <Upload size={18} className="text-white" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={handleUploadClick}
                                className="w-full h-20 border-2 border-dashed border-border hover:border-primary/50 rounded flex flex-col items-center justify-center gap-1 transition-colors group/upload"
                              >
                                <Upload size={18} className="text-muted-foreground group-hover/upload:text-primary transition-colors" />
                                <span className="text-[10px] text-muted-foreground group-hover/upload:text-primary transition-colors">
                                  点击上传参考图片
                                </span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* 图片尺寸信息 */}
                        <div className="mb-2">
                          <label className="block text-[10px] text-muted-foreground font-medium mb-1.5">图片尺寸信息</label>
                        </div>
                        
                        {/* 分辨率和比例选择 */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {/* 分辨率选择 */}
                          <div className="relative" ref={resolutionPickerRef}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowResolutionPicker(!showResolutionPicker);
                                setShowAspectRatioPicker(false);
                              }}
                              className="w-full flex items-center justify-between px-2 py-1.5 bg-muted/30 hover:bg-muted/50 rounded text-[10px] border border-border/30 transition-colors"
                            >
                              <span className="text-muted-foreground">分辨率: {selectedResolution}</span>
                              <ChevronDown size={12} className="text-muted-foreground" />
                            </button>

                            {showResolutionPicker && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[100]"
                              >
                                {(['1K', '2K', '4K'] as const).map((res) => (
                                  <button
                                    key={res}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedResolution(res);
                                      setShowResolutionPicker(false);
                                    }}
                                    className={cn(
                                      "w-full px-3 py-2 text-left text-[10px] transition-colors",
                                      selectedResolution === res
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-accent"
                                    )}
                                  >
                                    {res}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </div>

                          {/* 图片比例选择 */}
                          <div className="relative" ref={aspectRatioPickerRef}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAspectRatioPicker(!showAspectRatioPicker);
                                setShowResolutionPicker(false);
                              }}
                              className="w-full flex items-center justify-between px-2 py-1.5 bg-muted/30 hover:bg-muted/50 rounded text-[10px] border border-border/30 transition-colors"
                            >
                              <span className="text-muted-foreground">比例: {selectedAspectRatio}</span>
                              <ChevronDown size={12} className="text-muted-foreground" />
                            </button>

                            {showAspectRatioPicker && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[100] max-h-48 overflow-y-auto"
                              >
                                {(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'] as const).map((ratio) => (
                                  <button
                                    key={ratio}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAspectRatio(ratio);
                                      setShowAspectRatioPicker(false);
                                    }}
                                    className={cn(
                                      "w-full px-3 py-2 text-left text-[10px] transition-colors",
                                      selectedAspectRatio === ratio
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-accent"
                                    )}
                                  >
                                    {ratio}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 生成按钮 */}
                      {generationStatus === 'generating_image' ? (
                        <div className="flex items-center justify-center gap-2 py-2 text-primary">
                          <RefreshCw size={14} className="animate-spin" />
                          <span className="text-[10px] font-medium">生成中...</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleGenerate}
                          disabled={generationMode === 'image_to_image' && !scene.assetUrl}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-semibold transition-all",
                            generationMode === 'image_to_image' && !scene.assetUrl
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md"
                          )}
                        >
                          <Sparkles size={14} />
                          {generationMode === 'image_to_image' && !scene.assetUrl ? '请先上传参考图片' : '生成画面'}
                        </button>
                      )}
                    </div>
                ) : (
                  // 已生成图片 - Hero Mode布局
                  <div className="flex-1 flex flex-col">
                    {/* 顶部标题栏 */}
                    <div className="flex items-center justify-between mb-2 px-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                        <span className="bg-green-500/20 px-1.5 py-0.5 rounded text-green-500 border border-green-500/30">Step 1</span>
                        选择画面
                      </div>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setGeneratedVideoUrl(null);
                          setTailFrameImage(null);
                          setGeneratedImages([]);
                          setGenerationError(null);
                          setIsRegenerating(false);
                          onUpdate({ 
                            assetUrl: undefined, 
                            videoUrl: undefined,
                            generationStatus: 'idle'
                          });
                          // 禁用localStorage清除，改为仅使用数据库
                          // localStorage.removeItem(storageKey);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
                        title="重新生成"
                      >
                        <ArrowLeftRight size={10} className="rotate-180" />
                        重新生成
                      </button>
                    </div>
                    
                    {/* Hero 主视图 - 当前选中的图片（60%高度） */}
                    {(generatedImages.length > 0 || scene.assetUrl) && (
                      <div className="px-3 mb-2 flex-1" style={{ minHeight: '0' }}>
                        <div className="relative h-full rounded-lg overflow-hidden bg-muted border-2 border-green-500/50 group/hero">
                          <img
                            src={getProxiedImageUrl(scene.assetUrl || generatedImages[0])}
                            alt="当前选中"
                            className="w-full h-full object-contain"
                          />
                          
                          {/* 图片编辑中的等待标识 */}
                          {isEditingImage && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-10">
                              <RefreshCw size={28} className="text-white animate-spin" />
                              <span className="text-sm text-white font-medium">图片编辑中...</span>
                            </div>
                          )}
                          
                          {/* 悬停操作按钮组 */}
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/hero:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEnlargedImage(scene.assetUrl || generatedImages[0]);
                              }}
                              className="p-2 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
                              title="放大查看"
                            >
                              <ZoomIn size={14} />
                            </button>
                          </div>
                          
                          {/* 选中标记 */}
                          <div className="absolute bottom-2 left-2 text-[10px] text-white font-medium bg-green-500/90 px-2 py-1 rounded flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            当前选中
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 缩略图列 - 其他图片横向排列 */}
                    {generatedImages.length > 0 && (
                      <div className="px-3 mb-3">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {generatedImages.map((imageUrl, index) => {
                            const isSelected = scene.assetUrl === imageUrl;
                            return (
                              <div 
                                key={index}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdate({ assetUrl: imageUrl });
                                }}
                                className={cn(
                                  "relative flex-shrink-0 w-16 h-16 rounded overflow-hidden cursor-pointer transition-all",
                                  isSelected 
                                    ? 'border-2 border-green-500 ring-2 ring-green-500/20' 
                                    : 'border border-border hover:border-primary/50 opacity-60 hover:opacity-100'
                                )}
                              >
                                <img
                                  src={getProxiedImageUrl(imageUrl)}
                                  alt={`图片 ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                
                                {/* 选中标记 */}
                                {isSelected && (
                                  <div className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={8} className="text-white" />
                                  </div>
                                )}
                                
                                {/* 序号标记 */}
                                <div className="absolute bottom-0.5 left-0.5 text-[8px] text-white font-medium bg-black/60 px-1 py-0.5 rounded">
                                  {index + 1}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* 图片精修工具栏 */}
                    {scene.assetUrl && (
                      <div className="px-3 mb-3 pb-3 border-b border-border/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 编辑图片按钮 */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowImageEditDialog(true);
                              setImageEditPrompt(visualPrompt || '');
                            }}
                            disabled={isEditingImage}
                            className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="编辑图片"
                          >
                            <Edit3 size={10} />
                            局部重绘
                          </button>
                          
                          {/* 变体按钮（未来功能） */}
                          <button 
                            className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-medium text-muted-foreground/50 bg-muted/20 rounded cursor-not-allowed"
                            title="生成相似图（即将推出）"
                            disabled
                          >
                            <Sparkles size={10} />
                            变体
                          </button>
                          
                          {/* 放大按钮（未来功能） */}
                          <button 
                            className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-medium text-muted-foreground/50 bg-muted/20 rounded cursor-not-allowed"
                            title="高清放大（即将推出）"
                            disabled
                          >
                            <ZoomIn size={10} />
                            放大
                          </button>
                          
                          {/* 图片参数信息 */}
                          <div className="ml-auto text-[8px] text-muted-foreground/60 flex items-center gap-2">
                            <span>{selectedResolution}</span>
                            <span>•</span>
                            <span>{selectedAspectRatio}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 底部：画面描述输入框（固定在底部） */}
                    <div className="px-3 mt-auto">
                      <label className="block text-[10px] text-muted-foreground mb-1">画面描述</label>
                      <textarea
                        value={visualPrompt || script || ''}
                        onChange={(e) => {
                          onUpdate({ visualPrompt: e.target.value });
                        }}
                        onKeyDown={(e) => {
                          // 按 Enter 键（不按 Shift）时触发生成
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!(generationMode === 'image_to_image' && !scene.assetUrl)) {
                              handleGenerate(e as any);
                            }
                          }
                        }}
                        className="w-full p-1.5 bg-muted/30 rounded text-[10px] text-foreground leading-relaxed border border-border/30 min-h-[3rem] resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none mb-2"
                        placeholder="描述想要生成的画面..."
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      {/* 生成画面按钮 */}
                      <button
                        onClick={handleGenerate}
                        disabled={generationMode === 'image_to_image' && !scene.assetUrl}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-semibold transition-all",
                          generationMode === 'image_to_image' && !scene.assetUrl
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md"
                        )}
                      >
                        <Sparkles size={14} />
                        {generationMode === 'image_to_image' && !scene.assetUrl ? '请先上传参考图片' : '生成画面'}
                      </button>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
            {/* 左列结束 */}

            {/* ========== 右列：生成视频区域 ========== */}
            <div className="bg-card/50 rounded-lg border border-border/50 p-3 flex flex-col">
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                <Film size={14} className="text-muted-foreground" />
                生成视频区域
              </h4>
              
              {/* STEP 2 内容 - 在创作面板或未完成时显示控制面板 */}
              {(!showVideoView || scene.generationStatus !== 'completed' || !generatedVideoUrl) && (
              <div className="bg-card/80 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                    <span className="bg-muted px-1.5 py-0.5 rounded text-primary border border-border">Step 2</span>
                    视频生成
                  </div>
                </div>

                {/* 首图预览 - 只在图片生成完成且已选择图片时显示 */}
                {scene.assetUrl && scene.generationStatus !== 'idle' && scene.generationStatus !== 'generating_image' && (
                  <div className="mb-2">
                    <label className="block text-[10px] text-muted-foreground mb-1">首图预览</label>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border border-border group/preview">
                      <img 
                        src={getProxiedImageUrl(scene.assetUrl)}
                        alt="首图"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // 图片加载失败时隐藏图片
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute bottom-1 right-1 text-[9px] text-white font-medium bg-black/60 px-1.5 py-0.5 rounded">
                        已选中
                      </div>

                      {/* 视频生成中遮罩 */}
                      {scene.generationStatus === 'generating_video' && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                          <p className="text-[10px] font-medium text-white">视频生成中...</p>
                          <p className="text-[9px] text-white/70">预计 2-3 分钟</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 模型选择和视频时长 - 同一行 */}
                <div className="mb-2 grid grid-cols-2 gap-2">
                  {/* 模型选择 */}
                  <div className="relative" ref={modelDropdownRef}>
                    <label className="block text-[10px] text-muted-foreground mb-1">生成模型</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowModelDropdown(!showModelDropdown);
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 bg-muted/30 hover:bg-muted/50 rounded text-[10px] border border-border/30 transition-colors"
                    >
                      <span className="text-foreground">
                        {videoModel === 'jimeng-pro' && '即梦3.0 Pro'}
                        {videoModel === 'jimeng-first' && '即梦3.0 首帧'}
                        {videoModel === 'jimeng-first-tail' && '即梦3.0 首尾帧'}
                        {videoModel === 'wan2.2' && 'Wan2.2 (ComfyUI)'}
                      </span>
                      <ChevronDown size={12} className="text-muted-foreground" />
                    </button>

                    {showModelDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoModel('jimeng-pro');
                            setShowModelDropdown(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-[10px] transition-colors",
                            videoModel === 'jimeng-pro' ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          )}
                        >
                          即梦3.0 Pro (推荐)
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoModel('jimeng-first');
                            setShowModelDropdown(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-[10px] transition-colors",
                            videoModel === 'jimeng-first' ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          )}
                        >
                          即梦3.0 首帧
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoModel('jimeng-first-tail');
                            setShowModelDropdown(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-[10px] transition-colors",
                            videoModel === 'jimeng-first-tail' ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          )}
                        >
                          即梦3.0 首尾帧
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoModel('wan2.2');
                            setShowModelDropdown(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-[10px] transition-colors",
                            videoModel === 'wan2.2' ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          )}
                        >
                          Wan2.2 (ComfyUI)
                        </button>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* 视频时长选择 (仅非Wan2.2模型) */}
                  {videoModel !== 'wan2.2' ? (
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">视频时长</label>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoDuration(5);
                          }}
                          className={cn(
                            "flex-1 py-1.5 rounded text-[10px] font-medium transition-all",
                            videoDuration === 5
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          5秒
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoDuration(10);
                          }}
                          className={cn(
                            "flex-1 py-1.5 rounded text-[10px] font-medium transition-all",
                            videoDuration === 10
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          10秒
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div></div>
                  )}
                </div>

                {/* 首尾帧模式：上传尾帧图片 */}
                {videoModel === 'jimeng-first-tail' && (
                  <div className="mb-2">
                    <label className="block text-[10px] text-muted-foreground mb-1">尾帧图片</label>
                    {tailFrameImage ? (
                      <div className="relative group/tail">
                        <img 
                          src={getProxiedImageUrl(tailFrameImage)}
                          alt="尾帧"
                          className="w-full h-20 object-cover rounded border border-border"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="absolute inset-0 bg-black/0 hover:bg-black/60 transition-colors flex items-center justify-center opacity-0 group-hover/tail:opacity-100"
                        >
                          <Upload size={18} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="w-full h-20 border-2 border-dashed border-border hover:border-primary/50 rounded flex flex-col items-center justify-center gap-1 transition-colors group/upload"
                      >
                        <Upload size={18} className="text-muted-foreground group-hover/upload:text-primary transition-colors" />
                        <span className="text-[10px] text-muted-foreground group-hover/upload:text-primary transition-colors">
                          点击上传尾帧图片
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* 视频提示词 */}
                <div className="mb-2">
                  <label className="block text-[10px] text-muted-foreground mb-1">视频提示词</label>
                  <textarea
                    value={motionPrompt || visualPrompt || script || ''}
                    onChange={(e) => {
                      onUpdate({ motionPrompt: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      // 按 Enter 键（不按 Shift）时触发视频生成
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (scene.assetUrl && 
                            !(videoModel === 'jimeng-first-tail' && !tailFrameImage) &&
                            scene.generationStatus !== 'generating_video') {
                          handleVideoGeneration(e as any);
                        }
                      }
                    }}
                    rows={2}
                    className="w-full p-1.5 bg-muted/30 rounded text-[10px] text-foreground leading-relaxed border border-border/30 resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="描述画面动作和镜头运动..."
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* 生成按钮 */}
                {scene.generationStatus === 'generating_video' ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-primary">
                    <RefreshCw size={14} className="animate-spin" />
                    <span className="text-[10px] font-medium">视频生成中...</span>
                  </div>
                ) : (
                  <button
                    onClick={handleVideoGeneration}
                    disabled={!scene.assetUrl || (videoModel === 'jimeng-first-tail' && !tailFrameImage)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-semibold transition-all",
                      !scene.assetUrl || (videoModel === 'jimeng-first-tail' && !tailFrameImage)
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md"
                    )}
                  >
                    <Film size={14} />
                    {!scene.assetUrl 
                      ? '请先生成并选择图片' 
                      : videoModel === 'jimeng-first-tail' && !tailFrameImage 
                        ? '请先上传尾帧图片' 
                        : '生成视频'
                    }
                  </button>
                )}
              </div>
              )}

              {/* 视频生成中状态 - 已移至图片预览区域 */}


              {/* 视频已完成 - 只在视频播放视图显示预览,在创作面板显示控制面板 */}
              {scene.generationStatus === 'completed' && generatedVideoUrl && showVideoView && (
                <div className="border border-green-500/30 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 size={12} />
                      <span className="text-[10px] font-bold uppercase">视频已生成</span>
                    </div>
                  </div>

                  {/* 视频预览（和首图预览保持一致的比例） */}
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black mb-2 group/video">
                    <video
                      src={generatedVideoUrl}
                      className="w-full h-full object-contain"
                      controls
                      playsInline
                    />
                    
                    {/* 悬浮操作按钮 */}
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/video:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(generatedVideoUrl, '_blank');
                        }}
                        className="p-2 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
                        title="下载视频"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 视频信息 */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock size={10} />
                      <span>时长: {videoDuration}秒</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap size={10} />
                      <span>模型: {videoModel === 'jimeng-pro' ? 'Pro' : videoModel === 'jimeng-first' ? '首帧' : videoModel === 'jimeng-first-tail' ? '首尾帧' : 'Wan2.2'}</span>
                    </div>
                  </div>

                  {/* 重新生成视频按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 重置状态,返回到可以重新生成视频的状态
                      onUpdate({ generationStatus: 'image_selected' });
                      setGeneratedVideoUrl(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm hover:shadow-md"
                  >
                    <RefreshCw size={12} />
                    重新生成视频
                  </button>
                </div>
              )}
            </div>
            {/* 右列结束 */}
          </div>
        )}
        {/* 两列布局结束 */}

            {/* 隐藏的音频元素 - 用于播放配音 */}
            {scene.voiceoverUrl && (
              <audio
                ref={audioRef}
                src={scene.voiceoverUrl}
                onEnded={() => setIsPlayingVoiceover(false)}
                onPause={() => setIsPlayingVoiceover(false)}
                onPlay={() => setIsPlayingVoiceover(true)}
              />
            )}

            {/* 隐藏的文件输入 - 用于上传尾帧图片或参考图片 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                
                try {
                  const file = files[0];
                  const asset = await uploadFile(file);
                  const fileUrl = asset.url || asset.file_path;
                  
                  if (videoModel === 'jimeng-first-tail') {
                    // 首尾帧模式：设置为尾帧图片
                    setTailFrameImage(fileUrl);
                  } else {
                    // 图生图模式：设置为参考图片
                    const proxiedUrl = getProxiedImageUrl(fileUrl);
                    setGeneratedImages([proxiedUrl]);
                    onUpdate({ 
                      assetUrl: proxiedUrl,
                      generationStatus: 'image_selected',
                      generationMode: 'image_to_image'
                    });
                  }
                  
                  e.target.value = '';
                } catch (error) {
                  console.error('上传失败:', error);
                  setGenerationError(error instanceof Error ? error.message : '上传失败');
                }
              }}
              className="hidden"
            />
          </>
        ) : (
          // 创意说明 Tab
          <div className="space-y-4">
            {/* 创意理由 */}
            {scene.designReason ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles size={14} className="text-primary" />
                  AI改进说明
                </div>
                <div className="bg-accent/50 rounded-lg p-4 border border-border/50">
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {scene.designReason}
                  </p>
                </div>
              </div>
            ) : null}

            {/* 创意要点 */}
            {scene.creativeNotes && scene.creativeNotes.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Film size={14} className="text-primary" />
                  改进点
                </div>
                <div className="space-y-2">
                  {scene.creativeNotes.map((note, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 bg-muted/50 rounded-lg p-3 border border-border/30"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                        <span className="text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed flex-1">
                        {note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 如果没有任何创意说明 */}
            {!scene.designReason && (!scene.creativeNotes || scene.creativeNotes.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-2 font-medium">暂无创意说明</p>
                <p className="text-xs text-muted-foreground/60">
                  此分镜尚未生成AI创意说明
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 图片编辑对话框 */}
      <AnimatePresence>
        {showImageEditDialog && scene.assetUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowImageEditDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl"
            >
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-foreground">编辑图片</h3>
                
                <p className="text-sm text-muted-foreground">
                  输入新的描述，AI将根据原图和描述重新生成图片。
                </p>

                {/* 原图预览 */}
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted border border-border">
                  <img 
                    src={getProxiedImageUrl(scene.assetUrl)}
                    alt="Original"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm font-medium">
                    原图
                  </div>
                </div>

                {/* 提示词输入 */}
                <textarea
                  value={imageEditPrompt}
                  onChange={(e) => setImageEditPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    // 按 Enter 键（不按 Shift）时触发生成
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (imageEditPrompt.trim() && !isEditingImage) {
                        handleImageEditGenerate();
                      }
                    }
                  }}
                  placeholder="输入新的图片描述..."
                  className="w-full h-24 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                  autoFocus
                />

                {/* 按钮 */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowImageEditDialog(false)}
                    disabled={isEditingImage}
                    className="px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImageEditGenerate}
                    disabled={!imageEditPrompt.trim() || isEditingImage}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isEditingImage ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        重新编辑
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图片放大查看弹窗 */}
      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-8"
            onClick={() => setEnlargedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-7xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                onClick={() => setEnlargedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
                title="关闭"
              >
                <X size={32} />
              </button>

              {/* 放大的图片 */}
              <img
                src={getProxiedImageUrl(enlargedImage)}
                alt="放大查看"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ==================== TransitionNode ====================

interface TransitionNodeProps {
  value?: 'none' | 'dissolve' | 'fade_black' | 'match_cut' | 'wipe' | 'ai_transition';
  onChange: (value: string) => void;
}

export const TransitionNode: React.FC<TransitionNodeProps> = ({ value = 'dissolve', onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const transitions = [
    { value: 'none', label: '无转场' },
    { value: 'dissolve', label: '溶解' },
    { value: 'fade_black', label: '淡入淡出' },
    { value: 'match_cut', label: '匹配剪辑' },
    { value: 'wipe', label: '擦除' },
    { value: 'ai_transition', label: 'AI转场' }
  ];

  const currentTransition = transitions.find(t => t.value === value);

  return (
    <div className="relative flex items-center justify-center py-2">
      {/* Timeline connector */}
      <div className="absolute left-0 right-0 h-px bg-border" />
      
      {/* Transition node */}
      <div className="relative z-10">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            'bg-card border border-border hover:border-primary/50 hover:shadow-md',
            isOpen && 'border-primary shadow-md'
          )}
        >
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground group-hover:text-foreground">
            {currentTransition?.label || '转场'}
          </span>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-40 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
            >
              {transitions.map((transition) => (
                <button
                  key={transition.value}
                  onClick={() => {
                    onChange(transition.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs transition-colors',
                    transition.value === value
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-accent text-foreground'
                  )}
                >
                  {transition.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};
