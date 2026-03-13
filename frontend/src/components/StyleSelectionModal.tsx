import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Plus, Check } from 'lucide-react';

interface StyleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (aspectRatio: string, artStyle: string, customStyleImage?: File) => void;
  currentAspectRatio?: string;
}

// 预设的艺术风格（只显示有图片的风格）
const artStyles = [
  { id: 'children', name: '儿童画', image: '/风格/儿童画.png' },
  { id: 'animation', name: '动画', image: '/风格/动画.png' },
  { id: 'japanese', name: '日本水墨画', image: '/风格/日本水墨画.png' },
  { id: 'realistic', name: '真实', image: '/风格/真实.png' },
  { id: 'pencil', name: '铅笔画', image: '/风格/铅笔画.png' },
  { id: 'retro', name: '黑白复古', image: '/风格/黑白复古.png' },
];

// 画幅比例选项
const aspectRatios = [
  { id: '16:9', name: '16:9 横屏', description: '横屏视频' },
  { id: '9:16', name: '9:16 竖屏', description: '竖屏短视频' },
  { id: '1:1', name: '1:1 方形', description: '方形社交媒体' },
  { id: '4:3', name: '4:3 标准', description: '传统电视' },
];

export const StyleSelectionModal: React.FC<StyleSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentAspectRatio = '16:9',
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: 故事构思, 2: 崩演, 3: 分镜
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(currentAspectRatio);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [showCustomUpload, setShowCustomUpload] = useState(false);
  const [customStyleFile, setCustomStyleFile] = useState<File | null>(null);
  const [customStylePreview, setCustomStylePreview] = useState<string>('');

  // 处理自定义风格上传
  const handleCustomStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomStyleFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomStylePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 确认选择
  const handleConfirm = () => {
    if (selectedAspectRatio && selectedStyle) {
      onConfirm(selectedAspectRatio, selectedStyle, customStyleFile || undefined);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* 主弹窗 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-[90vw] max-w-5xl max-h-[85vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>

          {/* 步骤指示器 */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-8 py-6">
            <div className="flex items-center justify-center gap-8">
              {['1. 故事构思', '2. 崩演', '3. 分镜'].map((label, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`flex items-center gap-3 ${step === index + 1 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      step === index + 1 ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-white font-medium">{label}</span>
                  </div>
                  {index < 2 && (
                    <div className="w-12 h-0.5 bg-gray-600" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 内容区域 */}
          <div className="p-8 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(85vh - 200px)' }}>
            {/* 标题 */}
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
                为你的项目选择一种风格
              </h2>
              <p className="text-gray-400 text-lg">
                用最适合你视觉风格的艺术风格扩展你的故事
              </p>
            </div>

            {/* 画幅比例选择 */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">选择画幅比例</h3>
              <div className="grid grid-cols-4 gap-3">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedAspectRatio(ratio.id)}
                    className={`relative p-5 rounded-lg border-2 transition-all group ${
                      selectedAspectRatio === ratio.id
                        ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-500'
                    }`}
                  >
                    {selectedAspectRatio === ratio.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                    <div className="flex items-center justify-center mb-3">
                      <div className={`bg-gradient-to-br from-gray-600 to-gray-700 rounded shadow-lg border border-gray-500 ${
                        ratio.id === '16:9' ? 'w-16 h-9' :
                        ratio.id === '9:16' ? 'w-9 h-16' :
                        ratio.id === '1:1' ? 'w-12 h-12' :
                        'w-16 h-12'
                      }`} />
                    </div>
                    <p className="text-white font-medium text-center text-sm mb-0.5">{ratio.name}</p>
                    <p className="text-gray-400 text-xs text-center">{ratio.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 艺术风格选择 */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">选择艺术风格</h3>
              <div className="grid grid-cols-4 gap-3">
                {artStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      setSelectedStyle(style.id);
                      setShowCustomUpload(false);
                    }}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
                      selectedStyle === style.id
                        ? 'border-purple-500 ring-2 ring-purple-500/50 scale-[1.02]'
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {/* 风格图片 */}
                    <img
                      src={style.image}
                      alt={style.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* 标签 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3">
                      <p className="text-white text-xs font-medium">{style.name}</p>
                    </div>
                    
                    {/* 选中标记 */}
                    {selectedStyle === style.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                    
                    {/* 悬停效果 */}
                    <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/10 transition-colors" />
                  </button>
                ))}

                {/* 自定义风格上传框 */}
                <button
                  onClick={() => setShowCustomUpload(true)}
                  className={`relative aspect-video rounded-lg border-2 border-dashed transition-all group ${
                    showCustomUpload || customStylePreview
                      ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-500'
                  }`}
                >
                  {customStylePreview ? (
                    <>
                      <img
                        src={customStylePreview}
                        alt="自定义风格"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3">
                        <p className="text-white text-xs font-medium">自定义风格</p>
                      </div>
                      <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                        <Check size={14} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-2 group-hover:bg-gray-600 transition-colors">
                        <Plus size={24} className="text-gray-400" />
                      </div>
                      <p className="text-gray-300 text-xs font-medium px-2 text-center">
                        加入你自己的风格
                      </p>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="bg-gray-800 px-8 py-5 flex items-center justify-between border-t border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {!selectedAspectRatio && !selectedStyle && (
                <span>请选择画幅比例和艺术风格</span>
              )}
              {selectedAspectRatio && !selectedStyle && (
                <span>✓ 已选择画幅比例，请选择艺术风格</span>
              )}
              {!selectedAspectRatio && selectedStyle && (
                <span>✓ 已选择艺术风格，请选择画幅比例</span>
              )}
              {selectedAspectRatio && selectedStyle && (
                <span className="text-green-400">✓ 已完成选择</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedAspectRatio || !selectedStyle}
                className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                创建项目 →
              </button>
            </div>
          </div>
        </motion.div>

        {/* 自定义风格上传弹窗 */}
        <AnimatePresence>
          {showCustomUpload && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setShowCustomUpload(false)}
              />
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden"
              >
                {/* 关闭按钮 */}
                <button
                  onClick={() => setShowCustomUpload(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                >
                  <X size={24} className="text-gray-600" />
                </button>

                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    上传你的自定义艺术风格
                  </h3>

                  {/* 说明文字 */}
                  <div className="space-y-4 mb-6">
                    <p className="text-gray-700 text-sm leading-relaxed">
                      上传自定义艺术风格图片，让你的分镜拥有独特的视觉效果。这张图片将作为你视觉风格的参考。
                    </p>
                    
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">i</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 font-medium mb-1">充分利用您自己的风格</p>
                        <p className="text-sm text-gray-600">
                          上传16：9格式的 .jpg 或 .png。不是16：9吗？没关系——我们会帮你裁剪。
                        </p>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        <span className="font-semibold text-gray-900">专业提示：</span> 选择一种抽象地描绘整体视觉风格的艺术风格图片，不要过分强调角色或面部——这通常效果最佳。
                      </p>
                    </div>
                  </div>

                  {/* 上传区域 */}
                  {!customStylePreview ? (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleCustomStyleUpload}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 hover:border-purple-500 hover:bg-purple-50/50 transition-all cursor-pointer group">
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center mb-4 transition-colors">
                            <Upload size={32} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                          </div>
                          <p className="text-gray-800 font-semibold mb-2">点击上传或拖放</p>
                          <p className="text-sm text-gray-500">支持 jpg、png 格式</p>
                        </div>
                      </div>
                    </label>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-xl overflow-hidden border-2 border-purple-500">
                        <img
                          src={customStylePreview}
                          alt="预览"
                          className="w-full h-auto"
                        />
                      </div>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={handleCustomStyleUpload}
                          className="hidden"
                        />
                        <button
                          className="w-full px-4 py-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          更换图片
                        </button>
                      </label>
                    </div>
                  )}
                </div>

                {/* 底部按钮 */}
                <div className="bg-gray-50 px-8 py-5 flex items-center gap-3 border-t border-gray-200">
                  <button
                    onClick={() => setShowCustomUpload(false)}
                    className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      if (customStyleFile) {
                        setSelectedStyle('custom');
                        setShowCustomUpload(false);
                      }
                    }}
                    disabled={!customStyleFile}
                    className="flex-1 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    继续 →
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};
