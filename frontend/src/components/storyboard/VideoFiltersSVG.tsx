import React from 'react';

/**
 * SVG 滤镜库组件
 * 定义那些 CSS 做不到的高级滤镜（比如锐化）
 * 这个组件不可见，但必须存在于 DOM 中供其他元素引用
 */
const VideoFiltersSVG: React.FC = () => {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        {/* 1. 锐化滤镜 (Sharpen) - 原理是卷积矩阵增强边缘对比 */}
        <filter id="filter-sharp">
          <feConvolveMatrix
            order="3"
            preserveAlpha="true"
            kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"
          />
        </filter>

        {/* 2. 强力锐化 (Extra Sharp) */}
        <filter id="filter-extra-sharp">
          <feConvolveMatrix
            order="3"
            preserveAlpha="true"
            kernelMatrix="-1 -1 -1 -1 9 -1 -1 -1 -1"
          />
        </filter>

        {/* 3. 真实冷调 (Cool Tone) - 增强蓝色通道 */}
        <filter id="filter-cool-tone">
           <feColorMatrix 
            type="matrix" 
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1.2 0 0
              0 0 0 1 0
            " 
          />
        </filter>

        {/* 4. 暖调滤镜 (Warm Tone) - 增强红黄色通道 */}
        <filter id="filter-warm-tone">
           <feColorMatrix 
            type="matrix" 
            values="
              1.1 0 0 0 0
              0 1.05 0 0 0
              0 0 0.9 0 0
              0 0 0 1 0
            " 
          />
        </filter>

        {/* 5. 复古胶片效果 */}
        <filter id="filter-vintage">
          <feColorMatrix
            type="matrix"
            values="
              0.9 0 0 0 0.1
              0 0.8 0 0 0.1
              0 0 0.7 0 0.1
              0 0 0 1 0
            "
          />
        </filter>

        {/* 6. 冷调科技风 */}
        <filter id="filter-cyberpunk">
          <feColorMatrix
            type="matrix"
            values="
              0.8 0 0 0 0
              0 0.9 0 0 0
              0 0 1.3 0 0
              0 0 0 1 0
            "
          />
        </filter>
      </defs>
    </svg>
  );
};

export default VideoFiltersSVG;





















