# NeuroMedia · AI 视频创作工作台

一套以 AI 为核心驱动的视频创作平台，覆盖从剧本策划、风格设定、分镜生成到音频合成的完整制作流程。

---

## 功能概览

### 一、创作流程（四步走廊）

| 步骤 | 页面 | 说明 |
|------|------|------|
| 1 | **Script** 剧本编辑 | 输入创意描述或上传素材，AI 自动生成结构化剧本与分场 |
| 2 | **Style** 风格选择 | 选择画面艺术风格、画幅比例，支持自定义视觉描述 |
| 3 | **Storyboard** 可视分镜 | AI 逐场生成图像/视频，支持单场重生、拖拽排序、转场动画 |
| 4 | **Editor** 剪辑输出 | 音视频时间轴编辑、BGM 合成、粗剪导出 |

### 二、视频生成模式

- **AI 生成模式**：全场景由 AI（即梦 / ComfyUI Wan2.2）生成图像或视频
- **AI + 真实素材**：AI 镜头与用户上传视频混合排布
- **纯真实素材**：仅使用用户上传的视频进行剪辑编排

### 三、AI 能力

- **意图驱动控制台（Intent-Driven Console）**：通过自然语言指令批量操控分镜（修改提示词、调整时长、重新生成等）
- **灵感模式（Inspiration Mode）**：AI 根据主题生成完整故事提案，含脚本扩展与场景拆解
- **脚本助手**：对话式 AI 辅助修改台词、调整叙事节奏
- **分镜导演面板**：AI 批量优化分镜提示词、统一视觉风格
- **情绪分析**：基于多模态模型对视频内容进行情感标注
- **AI 转场**：利用视觉帧分析自动生成衔接转场视频

### 四、音频能力

- **AI 配乐生成**：通过 Stable Audio 生成与情绪匹配的背景音乐
- **音效合成**：按场景类别自动推荐并生成音效
- **TTS 配音（IndexTTS2）**：本地部署的高质量文字转语音，支持自定义音色
- **字幕旁白**：自动生成旁白文本并与音频对齐

### 五、存储与导出

- **项目数据库**：使用 Prisma + SQLite 持久化所有项目、分镜、音频数据
- **火山引擎 TOS**：图片/视频资源上传至对象存储，支持公网访问
- **粗剪导出**：一键导出视频序列（FFmpeg 合并）
- **版本对比**：支持同一场景多个版本的对比预览

### 六、协作面板

- 实时活动记录（剧本修改、图像生成等操作均留痕）
- 讨论消息、任务清单
- 支持按创作阶段过滤协作内容

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion |
| 后端 | Node.js + Express + Prisma (SQLite) |
| AI 图像 | 火山引擎即梦 API（Seedream/Seededit）|
| AI 视频 | ComfyUI（Wan2.2 14B i2v 工作流）|
| AI 文本 | 火山引擎 ARK API（DeepSeek / Doubao）|
| 音乐生成 | Stable Audio Tools（本地）|
| TTS | IndexTTS2（本地 Python 服务）|
| 对象存储 | 火山引擎 TOS |
| 内网穿透 | ngrok（可选，用于远程访问 ComfyUI）|

---

## 目录结构

```
AIEditing/
├── frontend/          # React 前端
│   └── src/
│       ├── components/    # 页面组件（StudioApp、ScriptEditorPage 等）
│       ├── api/           # 后端接口封装
│       ├── hooks/         # 自定义 Hook
│       └── utils/         # 工具函数
├── backend/           # Node.js 后端
│   └── src/
│       ├── routes/        # 路由定义
│       ├── services/      # 业务逻辑层
│       └── index.js       # 服务入口
├── index-tts/         # IndexTTS2 TTS 服务（Python）
├── stable-audio/      # Stable Audio 音乐生成工具
└── start_indextts2.bat  # 一键启动 TTS 服务
```

---

## 部署指南

### 前置条件

- Node.js >= 18
- Python >= 3.10（用于 IndexTTS2 和 Stable Audio）
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)（可选，用于视频生成）
- 火山引擎账号（用于即梦图像 API、ARK 文本 API、TOS 存储）

### 1. 克隆并安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 初始化数据库
npx prisma generate
npx prisma migrate dev

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env`，填入以下内容：

```env
# 火山引擎旧版 API（图像生成 / 图生视频）
VOLCENGINE_ACCESS_KEY=your_access_key
VOLCENGINE_SECRET_KEY=your_secret_key

# ARK API Key（Seedream 图像生成 / AI 文本）
ARK_API_KEY=your_ark_api_key

# 服务端口（默认 4300）
PORT=4300

# 公网 URL（可选，用于图片 URL 转换，如使用 ngrok 时填写）
# PUBLIC_URL=https://xxxx.ngrok.io
```

**TOS 存储配置**（在后端代码 `TOSService.js` 中或通过 `.env` 扩展）：

```env
TOS_ACCESS_KEY=your_tos_access_key
TOS_SECRET_KEY=your_tos_secret_key
TOS_BUCKET=your_bucket_name
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_REGION=cn-beijing
```

### 3. 启动后端服务

```bash
cd backend
npm run dev   # 开发模式（nodemon 热重载）
# 或
npm start     # 生产模式
```

后端默认运行在 `http://localhost:4300`

### 4. 启动前端

```bash
cd frontend
npm run dev
```

前端默认运行在 `http://localhost:4301`，访问该地址即可使用。

### 5. 启动 TTS 服务（可选）

若需要 AI 配音功能，需先启动 IndexTTS2：

```bash
# Windows 双击运行
start_indextts2.bat

# 或手动启动
cd index-tts
python -m indextts.api_server
```

TTS 服务默认运行在 `http://localhost:9880`

### 6. 配置 ComfyUI（可选）

若需要 AI 视频生成功能：

1. 安装并启动 ComfyUI，默认地址 `http://127.0.0.1:8188`
2. 将 `video_wan2_2_14B_i2v.json` 工作流导入 ComfyUI
3. 确保已下载 Wan2.2 14B i2v 模型权重

若 ComfyUI 在远程机器上，可通过 ngrok 暴露端口：

```bash
ngrok http 8188
# 将生成的公网地址配置到 backend/.env 的 COMFYUI_URL
```

---

## 快速使用

1. 打开 `http://localhost:4301`，点击 **新建项目**
2. 在输入框描述你的视频主题（如"一段赛博朋克城市夜景的宣传片"）
3. 选择生成模式：纯 AI / AI + 真实素材 / 纯真实素材
4. 点击 **生成** → AI 自动生成剧本和场景拆解
5. 进入 **Style** 步骤，选择画面风格和画幅
6. 进入 **Storyboard**，等待 AI 逐场生成分镜图像
7. 在分镜页可：重新生成单场、调整提示词、添加 BGM、生成配音
8. 进入 **Editor** 完成最终音画合成，导出视频序列

---

## 常见问题

**Q: 图像生成报错 404 / 鉴权失败？**  
检查 `.env` 中的 `ARK_API_KEY` 是否正确，并确认已在火山引擎控制台开通即梦 API 权限。

**Q: ComfyUI 连接失败？**  
确认 ComfyUI 已启动，地址为 `http://127.0.0.1:8188`。若使用远程机器，请配置 ngrok 并更新后端 ComfyUI 地址配置。

**Q: TTS 没有声音输出？**  
确认 IndexTTS2 服务已启动（端口 9880），并检查 `backend/src/services/ttsServiceManager.js` 中的服务地址配置。

**Q: 视频导出为空或报错？**  
视频合并依赖 FFmpeg，请确保系统已安装 FFmpeg 并添加到 PATH。

---

## License

本项目为内部开发版本，暂未开源。
