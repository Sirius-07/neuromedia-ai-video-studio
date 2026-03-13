"""
AI 视频制作工具 - FastAPI 后端服务

提供文件上传、脚本生成等核心 API。
"""

import os
import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from dotenv import load_dotenv

from models import AssetInfo, FileType, InputPayload, ScriptResponse, Scene, SceneType
from models.scene_regenerate_models import SceneRegenerateRequest, SceneRegenerateResponse
from services.ark_llm_service import ArkLLMService
from prompts.scene_regenerate_prompt import get_regenerate_user_prompt, SCENE_REGENERATE_SYSTEM_PROMPT

# 加载环境变量
load_dotenv()


# ============================================================
# 配置常量
# ============================================================

# 上传文件存储目录
UPLOAD_DIR = Path("static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 允许的文件扩展名
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv"}
ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS

# 文件大小限制 (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024


# ============================================================
# FastAPI 应用初始化
# ============================================================

app = FastAPI(
    title="AI 视频制作工具 API",
    description="提供视频脚本生成、素材管理、AI 内容生成等功能",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


# ============================================================
# CORS 跨域配置
# ============================================================

# 允许的跨域来源（开发环境允许所有，生产环境应限制具体域名）
origins = [
    "http://localhost:3000",      # React 开发服务器
    "http://localhost:5173",      # Vite 开发服务器
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "*",                          # 开发阶段允许所有来源
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],          # 允许所有 HTTP 方法
    allow_headers=["*"],          # 允许所有请求头
)


# ============================================================
# 静态文件服务
# ============================================================

# 挂载静态文件目录，使上传的文件可通过 URL 访问
# 例如：http://localhost:8000/static/uploads/xxx.mp4
app.mount("/static", StaticFiles(directory="static"), name="static")


# ============================================================
# 工具函数
# ============================================================

def get_file_extension(filename: str) -> str:
    """获取文件扩展名（小写）"""
    return Path(filename).suffix.lower()


def generate_unique_filename(original_filename: str) -> str:
    """
    生成唯一文件名
    
    格式: {timestamp}_{uuid}_{原文件名}
    例如: 20241205_143052_a1b2c3d4_demo.mp4
    """
    ext = get_file_extension(original_filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    
    # 清理原文件名（移除特殊字符）
    original_stem = Path(original_filename).stem
    safe_stem = "".join(c if c.isalnum() or c in "_-" else "_" for c in original_stem)
    safe_stem = safe_stem[:50]  # 限制长度
    
    return f"{timestamp}_{unique_id}_{safe_stem}{ext}"


def get_file_type(extension: str) -> FileType:
    """根据扩展名判断文件类型"""
    if extension in ALLOWED_IMAGE_EXTENSIONS:
        return FileType.IMAGE
    elif extension in ALLOWED_VIDEO_EXTENSIONS:
        return FileType.VIDEO
    else:
        raise ValueError(f"不支持的文件类型: {extension}")


# ============================================================
# API 路由
# ============================================================

@app.get("/")
async def root():
    """API 根路径 - 健康检查"""
    return {
        "status": "ok",
        "message": "AI 视频制作工具 API 服务运行中",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post(
    "/api/upload",
    response_model=AssetInfo,
    summary="上传素材文件",
    description="上传图片或视频文件，返回文件信息",
    responses={
        200: {"description": "上传成功"},
        400: {"description": "文件类型不支持或文件过大"},
        500: {"description": "服务器内部错误"}
    }
)
async def upload_file(file: UploadFile = File(..., description="要上传的图片或视频文件")):
    """
    上传素材文件 API
    
    - 接收单个文件
    - 验证文件类型和大小
    - 生成唯一文件名并保存
    - 返回 AssetInfo 结构
    """
    
    # 1. 验证文件是否存在
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供文件名"
        )
    
    # 2. 验证文件扩展名
    extension = get_file_extension(file.filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件类型: {extension}。允许的类型: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 3. 验证文件大小（通过读取内容长度）
    # 注意: 大文件应该使用流式处理，这里简化处理
    content = await file.read()
    file_size = len(content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"文件过大。最大允许 {MAX_FILE_SIZE // (1024*1024)}MB，当前文件 {file_size // (1024*1024)}MB"
        )
    
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件为空"
        )
    
    # 4. 生成唯一文件名
    unique_filename = generate_unique_filename(file.filename)
    file_path = UPLOAD_DIR / unique_filename
    
    # 5. 保存文件
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件保存失败: {str(e)}"
        )
    
    # 6. 构建响应
    file_type = get_file_type(extension)
    relative_path = f"/static/uploads/{unique_filename}"
    
    return AssetInfo(
        file_path=relative_path,
        file_type=file_type,
        description=None  # 初始为空，后续 AI 分析后填充
    )


@app.post(
    "/api/upload/batch",
    response_model=List[AssetInfo],
    summary="批量上传素材文件",
    description="一次性上传多个图片或视频文件"
)
async def upload_files_batch(files: List[UploadFile] = File(..., description="要上传的文件列表")):
    """
    批量上传素材文件 API
    
    - 接收多个文件
    - 逐个验证并保存
    - 返回 AssetInfo 列表
    """
    
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供任何文件"
        )
    
    results: List[AssetInfo] = []
    errors: List[str] = []
    
    for file in files:
        try:
            # 复用单文件上传逻辑
            result = await upload_file(file)
            results.append(result)
        except HTTPException as e:
            errors.append(f"{file.filename}: {e.detail}")
        except Exception as e:
            errors.append(f"{file.filename}: 未知错误 - {str(e)}")
    
    # 如果全部失败，返回错误
    if not results and errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "所有文件上传失败", "errors": errors}
        )
    
    # 如果部分成功，在响应头中提示
    if errors:
        return JSONResponse(
            content={
                "uploaded": [r.model_dump() for r in results],
                "errors": errors
            },
            headers={"X-Partial-Success": "true"}
        )
    
    return results


@app.delete(
    "/api/upload/{filename}",
    summary="删除已上传的文件",
    description="根据文件名删除上传目录中的文件"
)
async def delete_file(filename: str):
    """
    删除已上传的文件
    
    - 验证文件存在
    - 删除文件
    - 返回成功消息
    """
    
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文件不存在: {filename}"
        )
    
    # 安全检查：确保文件在上传目录内（防止路径遍历攻击）
    try:
        file_path.resolve().relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的文件路径"
        )
    
    try:
        os.remove(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件删除失败: {str(e)}"
        )
    
    return {"message": f"文件已删除: {filename}"}


@app.get(
    "/api/uploads",
    response_model=List[AssetInfo],
    summary="获取已上传文件列表",
    description="列出上传目录中的所有文件"
)
async def list_uploaded_files():
    """
    获取已上传文件列表
    
    - 扫描上传目录
    - 返回所有文件的 AssetInfo 列表
    """
    
    files: List[AssetInfo] = []
    
    for file_path in UPLOAD_DIR.iterdir():
        if file_path.is_file():
            extension = get_file_extension(file_path.name)
            if extension in ALLOWED_EXTENSIONS:
                try:
                    file_type = get_file_type(extension)
                    files.append(AssetInfo(
                        file_path=f"/static/uploads/{file_path.name}",
                        file_type=file_type,
                        description=None
                    ))
                except ValueError:
                    continue  # 跳过不支持的文件类型
    
    # 按文件名排序（最新的在前）
    files.sort(key=lambda x: x.file_path, reverse=True)
    
    return files


# ============================================================
# Mock 函数（占位，后续接入真实 AI 模型）
# ============================================================

def mock_analyze_assets(assets: List[AssetInfo]) -> List[AssetInfo]:
    """
    模拟素材分析（占位函数）
    
    未来将调用视觉模型 (VLM) 分析每个素材的内容。
    当前返回带有模拟描述的素材列表。
    
    Args:
        assets: 原始素材列表
        
    Returns:
        带有 description 字段填充的素材列表
    """
    # 模拟的素材描述库
    mock_descriptions = {
        "video": [
            "现代化办公室内景，多人围坐在会议桌前进行商务讨论，氛围专业",
            "城市街道航拍镜头，车流穿梭，展现都市繁华景象",
            "工厂生产线实拍，机械臂高效运转，体现智能制造",
            "户外采访场景，受访者面带微笑，背景为城市公园",
            "科技展会现场，参观者驻足观看最新产品展示",
        ],
        "image": [
            "商务人士握手特写，象征合作与信任",
            "数据可视化图表，展示上升趋势",
            "现代化建筑外观，玻璃幕墙反射蓝天",
            "团队合影照片，成员面带笑容",
            "产品特写图，细节清晰，光线专业",
        ]
    }
    
    analyzed_assets = []
    for i, asset in enumerate(assets):
        # 根据文件类型选择描述
        desc_list = mock_descriptions.get(asset.file_type.value, mock_descriptions["video"])
        description = desc_list[i % len(desc_list)]
        
        # 创建新的 AssetInfo，填充 description
        analyzed_asset = AssetInfo(
            file_path=asset.file_path,
            file_type=asset.file_type,
            description=description
        )
        analyzed_assets.append(analyzed_asset)
    
    return analyzed_assets


def mock_generate_structured_script(
    prompt: str, 
    analyzed_assets: List[AssetInfo],
    project_title: str | None = None
) -> ScriptResponse:
    """
    模拟脚本生成（占位函数）
    
    未来将调用大语言模型 (LLM) 生成结构化脚本。
    当前返回硬编码的示例脚本。
    
    Args:
        prompt: 用户输入的提示词
        analyzed_assets: 已分析的素材列表
        project_title: 项目标题（可选）
        
    Returns:
        完整的结构化脚本响应
    """
    # 生成项目 ID
    project_id = f"proj_{uuid.uuid4().hex[:8]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    
    # 根据是否有素材决定标题风格
    has_assets = len(analyzed_assets) > 0
    
    # 生成标题（如果没有提供则自动生成）
    if project_title:
        title = project_title
    else:
        # 简单的标题生成逻辑（从 prompt 中提取关键信息）
        title = f"AI 视频 | {prompt[:20]}..." if len(prompt) > 20 else f"AI 视频 | {prompt}"
    
    # 构建分镜列表
    scenes: List[Scene] = []
    
    # Scene 1: 开场
    scenes.append(Scene(
        scene_id=1,
        type=SceneType.AI_GENERATED,
        script_content="欢迎收看本期节目。今天我们将为您带来一段精彩的内容。",
        visual_description="专业演播室场景，虚拟主持人面对镜头微笑，背景为动态科技感图形",
        estimated_duration=4,
        reference_asset_path=None
    ))
    
    # Scene 2: 内容展开（如果有素材则使用混合模式）
    if has_assets and len(analyzed_assets) > 0:
        first_asset = analyzed_assets[0]
        scenes.append(Scene(
            scene_id=2,
            type=SceneType.MIXED_MEDIA,
            script_content=f"首先，让我们来看这段画面。{first_asset.description or '这是一段精心准备的素材。'}",
            visual_description=f"切入实拍素材：{first_asset.description or '用户上传的视频/图片素材'}",
            estimated_duration=5,
            reference_asset_path=first_asset.file_path
        ))
    else:
        scenes.append(Scene(
            scene_id=2,
            type=SceneType.AI_GENERATED,
            script_content="接下来，让我们深入了解今天的主题内容。",
            visual_description="信息图表动画，数据可视化展示，配合动态转场效果",
            estimated_duration=5,
            reference_asset_path=None
        ))
    
    # Scene 3: 深入内容
    scenes.append(Scene(
        scene_id=3,
        type=SceneType.AI_GENERATED,
        script_content="通过以上内容，我们可以看到这个领域正在发生深刻的变化。",
        visual_description="分屏展示多个相关画面，左侧为数据图表，右侧为概念动画",
        estimated_duration=4,
        reference_asset_path=None
    ))
    
    # Scene 4: 如果有第二个素材，添加额外场景
    if has_assets and len(analyzed_assets) > 1:
        second_asset = analyzed_assets[1]
        scenes.append(Scene(
            scene_id=4,
            type=SceneType.MIXED_MEDIA,
            script_content=f"此外，我们还准备了这段内容。{second_asset.description or ''}",
            visual_description=f"实拍素材展示：{second_asset.description or '补充素材'}",
            estimated_duration=4,
            reference_asset_path=second_asset.file_path
        ))
    
    # Scene: 结尾
    closing_scene_id = len(scenes) + 1
    scenes.append(Scene(
        scene_id=closing_scene_id,
        type=SceneType.AI_GENERATED,
        script_content="感谢您的观看，我们下期再见！",
        visual_description="演播室场景，主持人挥手告别，Logo 动画淡出，背景音乐渐弱",
        estimated_duration=3,
        reference_asset_path=None
    ))
    
    # 计算总时长
    total_duration = sum(scene.estimated_duration for scene in scenes)
    
    return ScriptResponse(
        project_id=project_id,
        title=title,
        scenes=scenes,
        total_duration=total_duration
    )


# ============================================================
# 真实 AI 脚本生成函数
# ============================================================

async def real_generate_script(
    prompt: str,
    assets: List[AssetInfo],
    project_title: str | None = None
) -> ScriptResponse:
    """
    调用火山方舟 Doubao 模型生成真实脚本
    
    Args:
        prompt: 用户输入的视频需求
        assets: 素材列表
        project_title: 项目标题
        
    Returns:
        ScriptResponse 对象
    """
    # 准备素材信息
    assets_data = [
        {
            "file_path": a.file_path,
            "file_type": a.file_type.value,
            "description": a.description
        }
        for a in assets
    ]
    
    # 调用火山方舟 API
    script_data = await ArkLLMService.generate_script(
        user_prompt=prompt,
        assets=assets_data,
        project_title=project_title
    )
    
    # 生成项目 ID
    project_id = f"proj_{uuid.uuid4().hex[:8]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    
    # 转换为 ScriptResponse 格式
    scenes = []
    for scene_data in script_data.get("scenes", []):
        scene = Scene(
            scene_id=scene_data["scene_id"],
            type=SceneType(scene_data["type"]),
            script_content=scene_data["script_content"],
            visual_description=scene_data["visual_description"],
            estimated_duration=scene_data["estimated_duration"],
            reference_asset_path=scene_data.get("reference_asset_path")
        )
        scenes.append(scene)
    
    total_duration = sum(s.estimated_duration for s in scenes)
    
    return ScriptResponse(
        project_id=project_id,
        title=script_data.get("title", project_title or "AI 生成视频"),
        scenes=scenes,
        total_duration=total_duration
    )


# ============================================================
# 脚本生成 API
# ============================================================

@app.post(
    "/api/generate-script",
    response_model=ScriptResponse,
    summary="生成视频脚本",
    description="根据用户提示词和上传的素材，生成结构化的分镜脚本。可通过 use_ai 参数选择使用真实AI还是Mock数据。",
    responses={
        200: {"description": "脚本生成成功"},
        400: {"description": "请求参数无效"},
        500: {"description": "脚本生成失败"}
    },
    tags=["脚本生成"]
)
async def generate_script(payload: InputPayload, use_ai: bool = True):
    """
    生成视频脚本 API
    
    处理流程：
    1. 接收用户输入（提示词 + 素材列表）
    2. 分析素材内容
    3. 调用 LLM 生成结构化脚本
    4. 返回完整的 ScriptResponse
    
    Args:
        payload: 包含用户提示词和素材列表的请求体
        use_ai: 是否使用真实 AI（默认 True），设为 False 则使用 Mock 数据
        
    Returns:
        ScriptResponse: 包含项目信息和分镜列表的完整脚本
    """
    
    # 1. 验证输入
    if not payload.user_prompt or not payload.user_prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户提示词不能为空"
        )
    
    # 2. 根据参数选择生成方式
    if use_ai:
        # 使用真实 AI（火山方舟 Doubao）
        try:
            print("[AI] 使用火山方舟 Doubao 模型生成脚本...")
            
            # 先分析素材（目前用 mock，实际应该用 VLM）
            analyzed_assets = mock_analyze_assets(payload.uploaded_assets)
            
            # 调用真实 AI 生成脚本
            script_response = await real_generate_script(
                prompt=payload.user_prompt,
                assets=analyzed_assets,
                project_title=payload.project_title
            )
            
        except ValueError as e:
            # AI 服务错误，返回具体错误信息
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"AI 服务错误: {str(e)}"
            )
        except Exception as e:
            # 其他错误，回退到 Mock
            print(f"[WARN] AI 调用失败，回退到 Mock: {e}")
            analyzed_assets = mock_analyze_assets(payload.uploaded_assets)
            script_response = mock_generate_structured_script(
                prompt=payload.user_prompt,
                analyzed_assets=analyzed_assets,
                project_title=payload.project_title
            )
    else:
        # 使用 Mock 数据
        print("[MOCK] 使用 Mock 数据生成脚本...")
        analyzed_assets = mock_analyze_assets(payload.uploaded_assets)
        script_response = mock_generate_structured_script(
            prompt=payload.user_prompt,
            analyzed_assets=analyzed_assets,
            project_title=payload.project_title
        )
    
    # 3. 返回结果
    return script_response


# ============================================================
# 单个分镜重新生成 API
# ============================================================

@app.post(
    "/api/regenerate-scene",
    response_model=SceneRegenerateResponse,
    summary="重新生成单个分镜",
    description="基于整体项目上下文和编辑思维，重新优化单个分镜的内容",
    responses={
        200: {"description": "分镜重新生成成功"},
        400: {"description": "请求参数无效"},
        500: {"description": "分镜重新生成失败"}
    },
    tags=["脚本生成"]
)
async def regenerate_scene(request: SceneRegenerateRequest, use_ai: bool = True):
    """
    重新生成单个分镜 API
    
    以专业编辑的视角，根据整体项目主题和所有分镜的上下文，
    重新优化指定分镜的内容，使其更符合叙事逻辑和视觉表现力。
    
    Args:
        request: 包含项目信息、所有场景和目标场景索引的请求体
        use_ai: 是否使用真实 AI（默认 True）
        
    Returns:
        SceneRegenerateResponse: 重新生成的分镜内容及改进说明
    """
    
    # 1. 验证输入
    if request.target_scene_index < 0 or request.target_scene_index >= len(request.all_scenes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"目标场景索引 {request.target_scene_index} 超出范围 (0-{len(request.all_scenes)-1})"
        )
    
    target_scene = request.all_scenes[request.target_scene_index]
    
    # 2. 构建提示词
    user_prompt = get_regenerate_user_prompt(
        project_title=request.project_title,
        user_prompt=request.user_prompt,
        all_scenes=[s.dict() for s in request.all_scenes],
        target_index=request.target_scene_index,
        user_feedback=request.user_feedback
    )
    
    try:
        print("\n" + "=" * 80)
        print("[AI] 单个分镜重新生成")
        print("=" * 80)
        print(f"项目: {request.project_title}")
        print(f"目标场景: 第 {request.target_scene_index + 1}/{len(request.all_scenes)} 个")
        print(f"当前内容: {target_scene.script_content[:50]}...")
    except UnicodeEncodeError:
        # Windows控制台编码问题，忽略打印错误
        pass
    
    if use_ai:
        try:
            # 使用真实 AI 生成
            print("[AI] 使用火山方舟 Doubao 模型重新生成...")
            
            # 初始化 LLM 服务
            llm_service = ArkLLMService()
            
            # 调用 AI
            response = await llm_service.generate_with_schema(
                system_prompt=SCENE_REGENERATE_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_schema=SceneRegenerateResponse.model_json_schema()
            )
            
            # 在解析之前添加必需字段（AI可能不会返回这些字段）
            if 'scene_id' not in response:
                response['scene_id'] = target_scene.scene_id
            if 'duration' not in response:
                response['duration'] = target_scene.duration
            
            # 解析响应
            regenerated = SceneRegenerateResponse(**response)
            
            try:
                print(f"[AI] 重新生成成功")
                print(f"新内容: {regenerated.script_content[:50]}...")
                print(f"改进点: {len(regenerated.improvements)} 个")
                print("=" * 80)
            except UnicodeEncodeError:
                # Windows控制台编码问题，忽略打印错误
                pass
            
            return regenerated
            
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"AI 服务错误: {str(e)}"
            )
        except Exception as e:
            print(f"[ERROR] AI 调用失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"重新生成失败: {str(e)}"
            )
    else:
        # Mock 数据
        print("[MOCK] 使用模拟数据...")
        return SceneRegenerateResponse(
            scene_id=target_scene.scene_id,
            script_content=f"【优化后】{target_scene.script_content}，增强视觉冲击力和情感表达",
            visual_description=f"{target_scene.visual_description}，加入更多细节和光影效果",
            duration=target_scene.duration + 1,
            motion_prompt="缓慢推进，强调视觉张力",
            regenerate_reason="优化叙事节奏，增强视觉表现力，提升情感共鸣",
            improvements=[
                "增强画面细节描述",
                "优化镜头运动节奏",
                "加强与前后镜头的衔接"
            ]
        )


# ============================================================
# 启动入口
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("AI 视频制作工具 - 后端服务启动中...")
    print("=" * 50)
    print(f"API 文档: http://localhost:8000/docs")
    print(f"上传目录: {UPLOAD_DIR.resolve()}")
    print("=" * 50)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # 开发模式下启用热重载
        log_level="info"
    )

