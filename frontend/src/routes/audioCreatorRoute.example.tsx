/**
 * 音频创作页面路由配置示例
 * 
 * 将此代码添加到你的主路由配置文件中（如 App.tsx 或 routes.tsx）
 */

import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AudioCreatorPage } from '../components/AudioCreatorPage';
import { Music } from 'lucide-react';

// ====================================
// 方式 1：独立路由（推荐用于独立音频编辑器）
// ====================================

export const audioCreatorRoutes = (
  <Route path="/audio-creator" element={<AudioCreatorPage />} />
);

// 使用示例：
// function App() {
//   return (
//     <Router>
//       <Routes>
//         <Route path="/" element={<HomePage />} />
//         {audioCreatorRoutes}
//         <Route path="/video-editor" element={<VideoEditor />} />
//       </Routes>
//     </Router>
//   );
// }


// ====================================
// 方式 2：嵌套在编辑器路由下
// ====================================

export const editorRoutes = (
  <Route path="/editor">
    <Route path="video" element={<VideoEditor />} />
    <Route path="audio" element={<AudioCreatorPage />} />
    <Route path="script" element={<ScriptEditor />} />
  </Route>
);

// 使用示例：
// 访问路径：/editor/audio


// ====================================
// 方式 3：作为项目编辑器的一个标签页
// ====================================

import { AudioInspector } from '../components/storyboard/AudioInspector';
import { EnhancedAudioTimeline } from '../components/storyboard/EnhancedAudioTimeline';

export const ProjectEditorWithTabs: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'video' | 'audio' | 'script'>('video');

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部标签导航 */}
      <div className="flex border-b border-border bg-muted/10">
        <button
          onClick={() => setActiveTab('video')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'video'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          🎬 视频编辑
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'audio'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          🎵 音频创作
        </button>
        <button
          onClick={() => setActiveTab('script')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'script'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          📝 脚本编辑
        </button>
      </div>

      {/* 标签内容 */}
      <div className="flex-1">
        {activeTab === 'video' && <VideoEditorContent />}
        {activeTab === 'audio' && <AudioCreatorPage />}
        {activeTab === 'script' && <ScriptEditorContent />}
      </div>
    </div>
  );
};


// ====================================
// 方式 4：导航菜单配置
// ====================================

export const navigationConfig = [
  {
    path: '/',
    label: '首页',
    icon: '🏠'
  },
  {
    path: '/projects',
    label: '项目列表',
    icon: '📁'
  },
  {
    path: '/audio-creator',
    label: '音频创作',
    icon: '🎵',
    description: '专业的音频混音和配音工具'
  },
  {
    path: '/video-editor',
    label: '视频编辑',
    icon: '🎬'
  }
];

// 使用示例：
// function Navigation() {
//   return (
//     <nav>
//       {navigationConfig.map(item => (
//         <Link key={item.path} to={item.path}>
//           <span>{item.icon}</span>
//           <span>{item.label}</span>
//         </Link>
//       ))}
//     </nav>
//   );
// }


// ====================================
// 方式 5：直接访问链接
// ====================================

export const AudioCreatorLink: React.FC = () => (
  <Link
    to="/audio-creator"
    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
  >
    <Music size={20} />
    <span className="font-medium">打开音频创作器</span>
  </Link>
);


// ====================================
// 快速启动按钮（用于开发测试）
// ====================================

export const QuickAccessButton: React.FC = () => {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link
        to="/audio-creator"
        className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-full shadow-2xl hover:bg-purple-700 transition-all hover:scale-105"
        title="音频创作器"
      >
        <Music size={20} />
        <span className="text-sm font-medium">音频</span>
      </Link>
    </div>
  );
};


// ====================================
// 完整的 App.tsx 示例
// ====================================

/*
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AudioCreatorPage } from './components/AudioCreatorPage';
import { HomePage } from './components/HomePage';
import { QuickAccessButton } from './routes/audioCreatorRoute.example';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          {/* 首页 *\/}
          <Route path="/" element={<HomePage />} />
          
          {/* 音频创作页面 *\/}
          <Route path="/audio-creator" element={<AudioCreatorPage />} />
          
          {/* 其他路由... *\/}
        </Routes>

        {/* 快速访问按钮（开发环境） *\/}
        {process.env.NODE_ENV === 'development' && <QuickAccessButton />}
      </div>
    </Router>
  );
}

export default App;
*/


// ====================================
// 404 页面中添加推荐链接
// ====================================

export const NotFoundPage: React.FC = () => (
  <div className="h-screen flex flex-col items-center justify-center gap-6">
    <h1 className="text-4xl font-bold">404</h1>
    <p className="text-muted-foreground">页面未找到</p>
    
    <div className="flex gap-4">
      <Link
        to="/"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        返回首页
      </Link>
      
      <Link
        to="/audio-creator"
        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600"
      >
        <Music className="inline mr-2" size={16} />
        尝试音频创作器
      </Link>
    </div>
  </div>
);


// ====================================
// TypeScript 类型定义
// ====================================

export interface RouteConfig {
  path: string;
  element: React.ReactElement;
  label?: string;
  icon?: string;
  description?: string;
  protected?: boolean; // 是否需要登录
}

export const audioCreatorRoute: RouteConfig = {
  path: '/audio-creator',
  element: <AudioCreatorPage />,
  label: '音频创作',
  icon: '🎵',
  description: '专业的音频混音、配音和音效编辑工具',
  protected: false
};


// ====================================
// 使用说明
// ====================================

/*
## 1. 安装必要的依赖

```bash
npm install react-router-dom
npm install lucide-react clsx
```

## 2. 在 App.tsx 中导入并使用

```typescript
import { AudioCreatorPage } from './components/AudioCreatorPage';

// 在你的路由配置中添加
<Route path="/audio-creator" element={<AudioCreatorPage />} />
```

## 3. 访问页面

启动开发服务器后，访问：
http://localhost:3000/audio-creator

## 4. 自定义配置

你可以通过 props 自定义组件行为：

```typescript
<AudioCreatorPage
  initialDuration={120}  // 初始时长（秒）
  initialBlocks={[...]}  // 初始音频块
  onSave={(data) => {    // 保存回调
    console.log('保存数据:', data);
  }}
/>
```

## 5. 样式主题

组件使用 Tailwind CSS 的主题变量，确保你的项目已配置：

- `--background`
- `--foreground`
- `--primary`
- `--muted`
- `--border`

*/

export default {};

