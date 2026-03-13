"""
单个分镜重新生成模型

用于AI以编辑思维重新优化单个分镜内容
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class SceneContext(BaseModel):
    """场景上下文信息"""
    scene_id: int = Field(..., description="场景ID")
    script_content: str = Field(..., description="场景旁白内容")
    visual_description: str = Field(..., description="画面描述")
    duration: int = Field(..., description="场景时长（秒）")


class SceneRegenerateRequest(BaseModel):
    """单个分镜重新生成请求"""
    
    # 项目整体信息
    project_title: str = Field(..., description="项目标题")
    user_prompt: str = Field(..., description="用户输入的整体视频主题/需求")
    
    # 所有场景的上下文
    all_scenes: List[SceneContext] = Field(..., description="所有场景的信息（按顺序）")
    
    # 当前要重新生成的场景
    target_scene_index: int = Field(..., description="目标场景的索引（从0开始）")
    
    # 可选的用户反馈
    user_feedback: Optional[str] = Field(
        default=None, 
        description="用户对当前分镜的反馈意见（可选）"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "project_title": "魅力广州：传统与现代的文化交响",
                "user_prompt": "制作一部展示广州城市魅力的宣传片，突出传统文化与现代发展的融合",
                "all_scenes": [
                    {
                        "scene_id": 1,
                        "script_content": "晨光洒向广州，江面波光粼粼，镜头从水面缓缓升起拍向城市天际线",
                        "visual_description": "广州日出，江面波光粼粼，缓缓升起的镜头拍向城市天际线",
                        "duration": 5
                    },
                    {
                        "scene_id": 2,
                        "script_content": "镜头切换到繁华的商业街区，人来人往，现代建筑林立",
                        "visual_description": "繁华商业街区，人流如织，现代建筑林立",
                        "duration": 6
                    }
                ],
                "target_scene_index": 0,
                "user_feedback": "希望开场更有冲击力，能够立即抓住观众的注意力"
            }
        }


class SceneRegenerateResponse(BaseModel):
    """单个分镜重新生成响应"""
    
    scene_id: int = Field(..., description="场景ID")
    script_content: str = Field(..., description="重新生成的旁白内容")
    visual_description: str = Field(..., description="重新生成的画面描述")
    duration: int = Field(..., description="建议的场景时长（秒）")
    motion_prompt: Optional[str] = Field(default=None, description="运镜提示")
    
    # AI生成说明
    regenerate_reason: str = Field(..., description="重新生成的理由说明")
    improvements: List[str] = Field(
        default_factory=list, 
        description="改进点列表"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "scene_id": 1,
                "script_content": "破晓时分，镜头从珠江水面倒影中缓缓上升，晨光洒满城市，摩天大楼如同巨人般苏醒",
                "visual_description": "珠江水面倒影特写，镜头上升，晨光下的广州天际线，摩天大楼剪影",
                "duration": 6,
                "motion_prompt": "从低角度缓慢向上推进，强调城市的宏伟感",
                "regenerate_reason": "优化开场镜头，增加视觉冲击力和诗意美感",
                "improvements": [
                    "使用水面倒影作为开场，增加艺术性",
                    "强化\"城市苏醒\"的意象，更有情感张力",
                    "延长1秒，给观众更充分的视觉体验"
                ]
            }
        }






