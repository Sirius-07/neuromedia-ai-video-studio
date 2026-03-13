"""
单个分镜重新生成的AI提示词

以专业编辑的思维来优化分镜内容
"""

SCENE_REGENERATE_SYSTEM_PROMPT = """你是一位资深的视频编辑和导演，擅长分析视频叙事结构并优化每个镜头的表现力。

你的任务是根据整体项目主题和所有分镜的上下文，重新优化指定的单个分镜内容，使其：
1. 更符合整体叙事逻辑和节奏
2. 与前后分镜形成流畅的衔接
3. 具有更强的视觉冲击力和情感表达
4. 符合专业视频制作的标准

编辑思维原则：
- **叙事连贯性**：确保该分镜在整体故事线中的作用明确，与前后镜头自然衔接
- **视觉节奏**：注意镜头的动静结合，避免单调重复，保持观看节奏
- **情感递进**：每个镜头都应该推动情感的发展，不只是简单的画面堆砌
- **视觉语言**：运用专业的视觉元素（构图、光影、运镜、色彩）来强化表达
- **信息密度**：在有限时间内传达最有价值的信息，避免冗余
- **高潮铺垫**：如果是关键镜头，要有足够的戏剧张力；如果是过渡镜头，要自然流畅

重新生成时的考虑因素：
1. **位置分析**：
   - 开场镜头：要有强烈的吸引力，设定基调
   - 中间镜头：推动叙事，保持节奏，铺垫情感
   - 结尾镜头：升华主题，留下深刻印象

2. **上下文衔接**：
   - 分析前一个镜头的结束状态（画面、情绪、节奏）
   - 分析后一个镜头的起始状态
   - 确保当前镜头能够起到桥梁作用

3. **视觉强化**：
   - 使用具体、生动的画面描述，避免空泛
   - 考虑光影、色彩、构图对情感的影响
   - 加入细节特写或广角全景来调节节奏

4. **时长控制**：
   - 快节奏场景：3-5秒
   - 正常叙事：5-7秒
   - 情感铺垫/高潮：7-10秒

输出格式要求：
- 严格按照JSON Schema格式输出
- script_content：精炼的旁白文案，富有节奏感和感染力
- visual_description：详细的画面描述，包含构图、光影、色彩、重点元素
- motion_prompt：运镜方式和节奏，如"缓慢推进"、"快速切换"等
- regenerate_reason：简要说明为什么这样修改（2-3句话）
- improvements：列出3-5个具体的改进点

记住：你的目标是让每一个镜头都发挥最大价值，服务于整体叙事，而不是孤立地存在。"""


def get_regenerate_user_prompt(
    project_title: str,
    user_prompt: str,
    all_scenes: list,
    target_index: int,
    user_feedback: str = None
) -> str:
    """
    生成重新生成单个分镜的用户提示词
    
    Args:
        project_title: 项目标题
        user_prompt: 用户原始需求
        all_scenes: 所有场景列表
        target_index: 目标场景索引
        user_feedback: 用户反馈（可选）
    
    Returns:
        格式化的提示词
    """
    
    # 构建项目信息
    project_info = f"""项目信息：
- 标题：{project_title}
- 主题：{user_prompt}
- 总场景数：{len(all_scenes)}
"""
    
    # 构建所有场景的上下文
    scenes_context = "所有分镜内容（按顺序）：\n\n"
    for i, scene in enumerate(all_scenes):
        scene_mark = " >>> [需要重新生成]" if i == target_index else ""
        scenes_context += f"""分镜 {i + 1}{scene_mark}：
  时长：{scene['duration']}秒
  旁白：{scene['script_content']}
  画面：{scene['visual_description']}

"""
    
    # 构建目标场景信息
    target_scene = all_scenes[target_index]
    position_desc = ""
    if target_index == 0:
        position_desc = "开场镜头"
    elif target_index == len(all_scenes) - 1:
        position_desc = "结尾镜头"
    else:
        position_desc = f"中间镜头（第{target_index + 1}/{len(all_scenes)}个）"
    
    target_info = f"""需要重新生成的分镜：
- 位置：{position_desc}
- 当前内容：
  * 旁白：{target_scene['script_content']}
  * 画面：{target_scene['visual_description']}
  * 时长：{target_scene['duration']}秒
"""
    
    # 添加上下文分析
    context_analysis = "\n上下文分析：\n"
    if target_index > 0:
        prev_scene = all_scenes[target_index - 1]
        context_analysis += f"- 前一个镜头：{prev_scene['script_content']}\n"
    if target_index < len(all_scenes) - 1:
        next_scene = all_scenes[target_index + 1]
        context_analysis += f"- 后一个镜头：{next_scene['script_content']}\n"
    
    # 添加用户反馈
    feedback_section = ""
    if user_feedback:
        feedback_section = f"\n用户反馈意见：\n{user_feedback}\n"
    
    # 组合完整提示词
    full_prompt = f"""{project_info}

{scenes_context}

{target_info}
{context_analysis}
{feedback_section}

请以专业编辑的视角，重新设计这个分镜，使其：
1. 在整体叙事中发挥更好的作用
2. 与前后镜头更流畅地衔接
3. 具有更强的视觉表现力和情感感染力
4. 符合当前位置（{position_desc}）应有的特点

请严格按照 SceneRegenerateResponse 的 JSON Schema 格式输出结果。"""
    
    return full_prompt


# 为了方便测试，提供一个示例
EXAMPLE_REQUEST = {
    "project_title": "魅力广州：传统与现代的文化交响",
    "user_prompt": "制作一部展示广州城市魅力的宣传片，突出传统文化与现代发展的融合",
    "all_scenes": [
        {
            "scene_id": 1,
            "script_content": "晨光洒向广州，江面波光粼粼",
            "visual_description": "广州日出，江面波光粼粼",
            "duration": 5
        },
        {
            "scene_id": 2,
            "script_content": "镜头切换到繁华的商业街区，人来人往",
            "visual_description": "繁华商业街区，人流如织",
            "duration": 6
        },
        {
            "scene_id": 3,
            "script_content": "传统茶楼内，老人们悠闲品茶聊天",
            "visual_description": "传统茶楼内景，老人品茶",
            "duration": 7
        }
    ],
    "target_scene_index": 0,
    "user_feedback": "希望开场更有冲击力，能够立即抓住观众的注意力"
}

