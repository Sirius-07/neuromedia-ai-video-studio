import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, ChevronDown, ChevronUp, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ZoomIn, ZoomOut, RotateCw, Plane, Image as ImageIcon, User, Lock, 
  Upload, Sparkles, Clock, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';

// 类型定义
export interface PromptTag {
  id: string;
  text: string;
  weight?: number; // 1.0 = normal, >1.0 = emphasis, <1.0 = de-emphasis
}

export interface StructuredPrompt {
  subjects: PromptTag[];
  environment: PromptTag[];
  motion: PromptTag[];
}

export interface CameraControl {
  movement: 'none' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'roll' | 'drone';
  strength: number; // 0-10
}

export interface ReferenceControl {
  styleRef?: string; // URL
  characterRef?: string; // URL
}

export interface GenerationConfig {
  structuredPrompt: StructuredPrompt;
  cameraControl: CameraControl;
  referenceControl: ReferenceControl;
  duration: number; // seconds
  matchNarrationDuration: boolean;
  estimatedNarrationDuration?: number;
}

interface SmartGenerationConsoleProps {
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
  onRegenerate?: () => void;
  isGenerating?: boolean;
  scriptText?: string;
}

// 标签组件
const TagItem: React.FC<{
  tag: PromptTag;
  onRemove: () => void;
  onWeightChange?: (weight: number) => void;
  showWeight?: boolean;
}> = ({ tag, onRemove, onWeightChange, showWeight = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
        "bg-primary/10 border border-primary/20 text-primary",
        "hover:bg-primary/20 hover:border-primary/30"
      )}>
        <span>{tag.text}</span>
        {tag.weight && tag.weight !== 1.0 && (
          <span className="text-[10px] opacity-60">×{tag.weight.toFixed(1)}</span>
        )}
        <button
          onClick={onRemove}
          className="ml-0.5 hover:bg-primary/20 rounded p-0.5 transition-colors"
        >
          <X size={10} />
        </button>
      </div>
      
      {/* Weight adjustment (shown on hover) */}
      {showWeight && isHovered && onWeightChange && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-popover border border-border rounded shadow-lg z-10"
        >
          <button
            onClick={() => onWeightChange(Math.max(0.5, (tag.weight || 1.0) - 0.1))}
            className="hover:bg-muted rounded p-0.5"
          >
            <ChevronDown size={10} />
          </button>
          <span className="text-[10px] font-mono min-w-[2ch] text-center">
            {(tag.weight || 1.0).toFixed(1)}
          </span>
          <button
            onClick={() => onWeightChange(Math.min(2.0, (tag.weight || 1.0) + 0.1))}
            className="hover:bg-muted rounded p-0.5"
          >
            <ChevronUp size={10} />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

// 标签组
const TagGroup: React.FC<{
  title: string;
  icon: React.ReactNode;
  tags: PromptTag[];
  onAddTag: (text: string) => void;
  onRemoveTag: (id: string) => void;
  onUpdateWeight?: (id: string, weight: number) => void;
  placeholder?: string;
  showWeight?: boolean;
}> = ({ title, icon, tags, onAddTag, onRemoveTag, onUpdateWeight, placeholder = "输入后按Enter添加", showWeight = false }) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      onAddTag(inputValue.trim());
      setInputValue('');
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      
      <motion.div 
        className="flex flex-wrap gap-1.5 p-2 bg-muted/30 border border-border/50 rounded-lg transition-all"
        animate={{
          minHeight: isFocused ? '80px' : '32px',
          borderColor: isFocused ? 'rgba(139, 92, 246, 0.5)' : 'rgba(var(--border), 0.5)'
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <AnimatePresence>
          {tags.map(tag => (
            <TagItem
              key={tag.id}
              tag={tag}
              onRemove={() => onRemoveTag(tag.id)}
              onWeightChange={onUpdateWeight ? (weight) => onUpdateWeight(tag.id, weight) : undefined}
              showWeight={showWeight}
            />
          ))}
        </AnimatePresence>
        
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/40 px-1"
        />
        
        {/* 聚焦提示 */}
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full text-[9px] text-primary/60 flex items-center gap-1 pt-1"
          >
            <Sparkles size={10} />
            输入完成后按 Enter 添加标签
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

// 运镜控制按钮
const CameraButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all",
      "border text-xs font-medium",
      isActive 
        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" 
        : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
    title={label}
  >
    {icon}
    <span className="text-[9px]">{label}</span>
  </button>
);

export const SmartGenerationConsole: React.FC<SmartGenerationConsoleProps> = ({
  config,
  onChange,
  onRegenerate,
  isGenerating = false,
  scriptText = ''
}) => {
  const [expandedSections, setExpandedSections] = useState({
    prompt: true,
    camera: false, // 默认折叠运镜控制
    reference: false,
    timing: true
  });
  
  // 估算旁白时长（中文：~4字/秒）
  useEffect(() => {
    if (scriptText && config.matchNarrationDuration) {
      const chineseChars = scriptText.replace(/[^\u4e00-\u9fa5]/g, '').length;
      const estimatedDuration = Math.max(2, Math.min(8, Math.ceil(chineseChars / 4)));
      
      if (estimatedDuration !== config.estimatedNarrationDuration) {
        onChange({
          ...config,
          estimatedNarrationDuration: estimatedDuration,
          duration: estimatedDuration
        });
      }
    }
  }, [scriptText, config.matchNarrationDuration]);
  
  // 切换折叠区域
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // 标签操作
  const addTag = (category: keyof StructuredPrompt, text: string) => {
    const newTag: PromptTag = {
      id: `${category}-${Date.now()}`,
      text,
      weight: 1.0
    };
    onChange({
      ...config,
      structuredPrompt: {
        ...config.structuredPrompt,
        [category]: [...config.structuredPrompt[category], newTag]
      }
    });
  };
  
  const removeTag = (category: keyof StructuredPrompt, tagId: string) => {
    onChange({
      ...config,
      structuredPrompt: {
        ...config.structuredPrompt,
        [category]: config.structuredPrompt[category].filter(t => t.id !== tagId)
      }
    });
  };
  
  const updateTagWeight = (category: keyof StructuredPrompt, tagId: string, weight: number) => {
    onChange({
      ...config,
      structuredPrompt: {
        ...config.structuredPrompt,
        [category]: config.structuredPrompt[category].map(t =>
          t.id === tagId ? { ...t, weight } : t
        )
      }
    });
  };
  
  // 运镜控制
  const setCameraMovement = (movement: CameraControl['movement']) => {
    onChange({
      ...config,
      cameraControl: {
        ...config.cameraControl,
        movement: config.cameraControl.movement === movement ? 'none' : movement
      }
    });
  };
  
  const setCameraStrength = (strength: number) => {
    onChange({
      ...config,
      cameraControl: { ...config.cameraControl, strength }
    });
  };
  
  // 参考图上传
  const handleFileUpload = (type: 'style' | 'character', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      onChange({
        ...config,
        referenceControl: {
          ...config.referenceControl,
          [type === 'style' ? 'styleRef' : 'characterRef']: url
        }
      });
    };
    reader.readAsDataURL(file);
  };
  
  // 时长控制
  const setDuration = (duration: number) => {
    onChange({ ...config, duration });
  };
  
  const toggleMatchNarration = () => {
    onChange({
      ...config,
      matchNarrationDuration: !config.matchNarrationDuration,
      duration: config.matchNarrationDuration ? config.duration : (config.estimatedNarrationDuration || config.duration)
    });
  };
  
  return (
    <div className="flex flex-col h-full space-y-3">
      {/* 标题 */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Sparkles size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">AI 生成控制台</h3>
      </div>
      
      {/* 滚动内容区 */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        
        {/* 1. 结构化提示词 */}
        <section className="space-y-3">
          <button
            onClick={() => toggleSection('prompt')}
            className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">1</span>
              画面描述
            </span>
            {expandedSections.prompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          <AnimatePresence>
            {expandedSections.prompt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <TagGroup
                  title="主体"
                  icon={<User size={12} />}
                  tags={config.structuredPrompt.subjects}
                  onAddTag={(text) => addTag('subjects', text)}
                  onRemoveTag={(id) => removeTag('subjects', id)}
                  onUpdateWeight={(id, weight) => updateTagWeight('subjects', id, weight)}
                  placeholder="描述核心人物或物体..."
                  showWeight={true}
                />
                
                <TagGroup
                  title="环境与风格"
                  icon={<ImageIcon size={12} />}
                  tags={config.structuredPrompt.environment}
                  onAddTag={(text) => addTag('environment', text)}
                  onRemoveTag={(id) => removeTag('environment', id)}
                  onUpdateWeight={(id, weight) => updateTagWeight('environment', id, weight)}
                  placeholder="光影、天气、艺术风格..."
                  showWeight={true}
                />
                
                <TagGroup
                  title="动态描述"
                  icon={<RotateCw size={12} />}
                  tags={config.structuredPrompt.motion}
                  onAddTag={(text) => addTag('motion', text)}
                  onRemoveTag={(id) => removeTag('motion', id)}
                  placeholder="画面内的动作..."
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        
        {/* 2. 运镜控制 */}
        <section className="space-y-3">
          <button
            onClick={() => toggleSection('camera')}
            className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">2</span>
              运镜控制
            </span>
            {expandedSections.camera ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          <AnimatePresence>
            {expandedSections.camera && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* 方向控制 */}
                <div className="grid grid-cols-3 gap-2">
                  <div />
                  <CameraButton
                    icon={<ArrowUp size={14} />}
                    label="上移"
                    isActive={config.cameraControl.movement === 'tilt_up'}
                    onClick={() => setCameraMovement('tilt_up')}
                  />
                  <div />
                  
                  <CameraButton
                    icon={<ArrowLeft size={14} />}
                    label="左移"
                    isActive={config.cameraControl.movement === 'pan_left'}
                    onClick={() => setCameraMovement('pan_left')}
                  />
                  <CameraButton
                    icon={<RotateCw size={14} />}
                    label="旋转"
                    isActive={config.cameraControl.movement === 'roll'}
                    onClick={() => setCameraMovement('roll')}
                  />
                  <CameraButton
                    icon={<ArrowRight size={14} />}
                    label="右移"
                    isActive={config.cameraControl.movement === 'pan_right'}
                    onClick={() => setCameraMovement('pan_right')}
                  />
                  
                  <div />
                  <CameraButton
                    icon={<ArrowDown size={14} />}
                    label="下移"
                    isActive={config.cameraControl.movement === 'tilt_down'}
                    onClick={() => setCameraMovement('tilt_down')}
                  />
                  <div />
                </div>
                
                {/* 变焦控制 */}
                <div className="grid grid-cols-3 gap-2">
                  <CameraButton
                    icon={<ZoomIn size={14} />}
                    label="推进"
                    isActive={config.cameraControl.movement === 'zoom_in'}
                    onClick={() => setCameraMovement('zoom_in')}
                  />
                  <CameraButton
                    icon={<ZoomOut size={14} />}
                    label="拉远"
                    isActive={config.cameraControl.movement === 'zoom_out'}
                    onClick={() => setCameraMovement('zoom_out')}
                  />
                  <CameraButton
                    icon={<Plane size={14} />}
                    label="航拍"
                    isActive={config.cameraControl.movement === 'drone'}
                    onClick={() => setCameraMovement('drone')}
                  />
                </div>
                
                {/* 运动幅度 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">运动幅度</span>
                    <span className="font-mono text-primary">{config.cameraControl.strength}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={config.cameraControl.strength}
                    onChange={(e) => setCameraStrength(parseInt(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60">
                    <span>静止</span>
                    <span>安全区</span>
                    <span>剧烈</span>
                  </div>
                </div>
                
                {config.cameraControl.strength > 7 && (
                  <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-600">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>运动幅度过大可能导致人物变形或崩坏，建议保持在3-5之间</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        
        {/* 3. 参考约束 */}
        <section className="space-y-3">
          <button
            onClick={() => toggleSection('reference')}
            className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">3</span>
              参考约束
            </span>
            {expandedSections.reference ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          <AnimatePresence>
            {expandedSections.reference && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* 风格参考 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon size={12} />
                    <span>风格参考</span>
                  </div>
                  <div className="relative">
                    {config.referenceControl.styleRef ? (
                      <div className="relative group">
                        <img
                          src={config.referenceControl.styleRef}
                          alt="Style reference"
                          className="w-full h-32 object-cover rounded-lg border border-border"
                        />
                        <button
                          onClick={() => onChange({
                            ...config,
                            referenceControl: { ...config.referenceControl, styleRef: undefined }
                          })}
                          className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                        <Upload size={20} className="text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">上传标准色调图</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload('style', file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">确保生成视频的色调统一</p>
                </div>
                
                {/* 角色锁定 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User size={12} />
                    <span>角色锁定</span>
                  </div>
                  <div className="relative">
                    {config.referenceControl.characterRef ? (
                      <div className="relative group">
                        <img
                          src={config.referenceControl.characterRef}
                          alt="Character reference"
                          className="w-full h-32 object-cover rounded-lg border border-border"
                        />
                        <button
                          onClick={() => onChange({
                            ...config,
                            referenceControl: { ...config.referenceControl, characterRef: undefined }
                          })}
                          className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                        <Upload size={20} className="text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">上传人物参考图</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload('character', file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">保持多镜头人物特征一致（FaceID）</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        
        {/* 4. 时长与同步 */}
        <section className="space-y-3">
          <button
            onClick={() => toggleSection('timing')}
            className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">4</span>
              时长设置
            </span>
            {expandedSections.timing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          <AnimatePresence>
            {expandedSections.timing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* 时长滑块 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">视频时长</span>
                    <span className="font-mono text-primary">{config.duration}秒</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    step="1"
                    value={config.duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    disabled={config.matchNarrationDuration}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60">
                    <span>2s</span>
                    <span>8s</span>
                  </div>
                </div>
                
                {/* 智能锁定 */}
                <label className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/50 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.matchNarrationDuration}
                    onChange={toggleMatchNarration}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <div className="flex-1 flex items-center gap-2 text-xs">
                    <Lock size={12} className="text-muted-foreground" />
                    <span className="font-medium">匹配旁白时长</span>
                  </div>
                  {config.estimatedNarrationDuration && (
                    <span className="text-[10px] text-muted-foreground">
                      ≈ {config.estimatedNarrationDuration}秒
                    </span>
                  )}
                </label>
                
                {config.matchNarrationDuration && scriptText && (
                  <div className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-600">
                    <Clock size={12} className="shrink-0 mt-0.5" />
                    <div>
                      <div>脚本字数：{scriptText.replace(/[^\u4e00-\u9fa5]/g, '').length} 字</div>
                      <div>预计时长：{config.estimatedNarrationDuration} 秒（按 4字/秒 计算）</div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
      
      {/* 底部操作按钮 */}
      <div className="pt-3 border-t border-border">
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
            isGenerating
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          )}
        >
          {isGenerating ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles size={16} />
              </motion.div>
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>重新生成</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

