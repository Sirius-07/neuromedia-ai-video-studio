"""
AI 视频制作工具 - 核心数据模型定义

使用 Pydantic 定义前端请求和后端响应的数据结构。
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from enum import Enum


# ============================================================
# 枚举类型定义
# ============================================================

class FileType(str, Enum):
    """素材文件类型"""
    IMAGE = "image"
    VIDEO = "video"


class SceneType(str, Enum):
    """分镜类型"""
    AI_GENERATED = "ai_generated"      # 纯 AI 生成
    MIXED_MEDIA = "mixed_media"        # AI + 实拍素材混剪


# ============================================================
# 素材信息模型
# ============================================================

class AssetInfo(BaseModel):
    """
    素材信息模型
    
    描述用户上传的图片或视频素材。
    """
    file_path: str = Field(
        ..., 
        description="文件在服务器存储的路径或 URL"
    )
    file_type: FileType = Field(
        ..., 
        description="文件类型：'image' 或 'video'"
    )
    description: Optional[str] = Field(
        default=None, 
        description="AI 分析出的素材内容描述（初始为空，后端处理后填充）"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "/uploads/assets/meeting_scene_001.mp4",
                "file_type": "video",
                "description": "现代化会议室内景，多人围坐讨论，氛围专业"
            }
        }


# ============================================================
# 前端输入模型
# ============================================================

class InputPayload(BaseModel):
    """
    前端输入请求模型
    
    用户提交的视频生成请求，包含文本提示词和上传的素材。
    """
    user_prompt: str = Field(
        ..., 
        min_length=1,
        description="用户输入的文本提示词，描述想要生成的视频内容"
    )
    uploaded_assets: List[AssetInfo] = Field(
        default_factory=list, 
        description="用户上传的素材列表"
    )
    project_title: Optional[str] = Field(
        default=None, 
        description="项目标题（可选，如未提供将由 AI 自动生成）"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_prompt": "制作一个关于新能源汽车行业发展的3分钟新闻简报视频",
                "uploaded_assets": [
                    {
                        "file_path": "/uploads/assets/ev_factory.mp4",
                        "file_type": "video",
                        "description": None
                    }
                ],
                "project_title": "新能源汽车行业周报"
            }
        }


# ============================================================
# 分镜模型
# ============================================================

class Scene(BaseModel):
    """
    分镜模型
    
    脚本中最小的单元，描述单个分镜的所有信息。
    """
    scene_id: int = Field(
        ..., 
        ge=1,
        description="分镜序号，从 1 开始递增"
    )
    type: SceneType = Field(
        ..., 
        description="分镜类型：'ai_generated' (纯AI生成) 或 'mixed_media' (AI+实拍素材混剪)"
    )
    script_content: str = Field(
        ..., 
        description="该分镜的口播文案/旁白"
    )
    visual_description: str = Field(
        ..., 
        description="该分镜的画面描述（用于指导后续的生图或剪辑）"
    )
    estimated_duration: int = Field(
        ..., 
        ge=1,
        description="预估时长（秒）"
    )
    reference_asset_path: Optional[str] = Field(
        default=None, 
        description="如果是 'mixed_media' 类型，这里存放引用的实拍素材路径"
    )
    
    # AI 创意说明（可选）
    design_reason: Optional[str] = Field(
        default=None,
        description="AI设计该分镜的创意理由和设计思路"
    )
    creative_notes: Optional[List[str]] = Field(
        default=None,
        description="创意要点列表，说明该分镜的关键设计点"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "scene_id": 1,
                "type": "mixed_media",
                "script_content": "近年来，新能源汽车行业迎来了爆发式增长。",
                "visual_description": "航拍视角，现代化新能源汽车工厂全景，流水线高速运转",
                "estimated_duration": 5,
                "reference_asset_path": "/uploads/assets/ev_factory.mp4",
                "design_reason": "开场使用航拍视角展现工业规模，建立宏大叙事基调",
                "creative_notes": ["航拍视角增强视觉冲击", "工厂全景展现行业规模", "流水线细节体现技术感"]
            }
        }


# ============================================================
# 后端响应模型
# ============================================================

class ScriptResponse(BaseModel):
    """
    后端返回的完整脚本模型
    
    包含项目元信息和完整的分镜列表。
    """
    project_id: str = Field(
        ..., 
        description="项目唯一标识（UUID）"
    )
    title: str = Field(
        ..., 
        description="生成出的视频标题"
    )
    scenes: List[Scene] = Field(
        ..., 
        min_length=1,
        description="分镜列表"
    )
    total_duration: int = Field(
        ..., 
        ge=1,
        description="总时长（秒）"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "project_id": "proj_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "title": "新能源汽车行业周报 | 销量再创新高",
                "scenes": [
                    {
                        "scene_id": 1,
                        "type": "ai_generated",
                        "script_content": "欢迎收看本期新能源汽车行业简报。",
                        "visual_description": "专业新闻演播室，虚拟主持人面对镜头微笑",
                        "estimated_duration": 3,
                        "reference_asset_path": None
                    },
                    {
                        "scene_id": 2,
                        "type": "mixed_media",
                        "script_content": "本周，国内新能源汽车销量突破50万辆。",
                        "visual_description": "数据图表叠加，显示销量上升曲线",
                        "estimated_duration": 5,
                        "reference_asset_path": "/uploads/assets/ev_factory.mp4"
                    }
                ],
                "total_duration": 8
            }
        }

    def calculate_total_duration(self) -> int:
        """根据分镜列表重新计算总时长"""
        return sum(scene.estimated_duration for scene in self.scenes)


# ============================================================
# 使用示例
# ============================================================

if __name__ == "__main__":
    # 示例：创建输入请求
    input_data = InputPayload(
        user_prompt="制作一个3分钟的科技新闻视频，介绍最新的AI发展动态",
        uploaded_assets=[
            AssetInfo(
                file_path="/uploads/ai_lab.mp4",
                file_type=FileType.VIDEO
            )
        ],
        project_title="AI 前沿周报"
    )
    print("=== 输入请求 ===")
    print(input_data.model_dump_json(indent=2))

    # 示例：创建响应
    response = ScriptResponse(
        project_id="proj_12345678-abcd-efgh-ijkl-mnopqrstuvwx",
        title="AI 前沿周报 | 大模型技术突破",
        scenes=[
            Scene(
                scene_id=1,
                type=SceneType.AI_GENERATED,
                script_content="欢迎来到本期AI前沿周报。",
                visual_description="科技感演播室，全息投影效果",
                estimated_duration=3
            ),
            Scene(
                scene_id=2,
                type=SceneType.MIXED_MEDIA,
                script_content="本周，多家科技巨头发布了新一代大语言模型。",
                visual_description="实拍素材：AI实验室内部场景",
                estimated_duration=5,
                reference_asset_path="/uploads/ai_lab.mp4"
            )
        ],
        total_duration=8
    )
    print("\n=== 响应结果 ===")
    print(response.model_dump_json(indent=2))




