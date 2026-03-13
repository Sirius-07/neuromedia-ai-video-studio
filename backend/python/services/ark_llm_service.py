"""
火山方舟 Doubao 大模型服务

调用火山引擎 Ark 平台的 doubao 模型生成结构化视频脚本。
"""

import os
import json
import httpx
from typing import List, Optional
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class ArkLLMService:
    """
    火山方舟 LLM 服务
    
    使用 doubao 模型生成结构化的视频分镜脚本。
    """
    
    # API 配置
    API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    MODEL_ID = "ep-m-20251107114928-w8j8v"  # doubao 模型端点
    
    # 系统提示词
    SYSTEM_PROMPT = """你是一个专业的AI视频脚本编剧，擅长根据用户需求生成结构化的视频分镜脚本。

【核心能力】
1. 理解用户的视频制作意图和主题
2. 分析用户提供的素材内容描述
3. 创作专业的分镜脚本，包括口播文案和画面描述
4. 合理安排每个分镜的时长和节奏

【输出规则】
- 严格按照JSON格式返回数据
- 不添加任何额外的解释、注释或markdown代码块
- 所有字段必须完整填写
- 时长单位为秒，数值为整数

【分镜类型说明】
- ai_generated: 纯AI生成的画面（无实拍素材）
- mixed_media: 混合模式，使用用户提供的实拍素材

【创作原则】
1. 开场要吸引观众注意力
2. 内容逻辑清晰，层层递进
3. 如有实拍素材，合理融入叙事
4. 结尾要有总结或呼吁行动
5. 每个分镜时长控制在3-6秒"""

    @classmethod
    def get_api_key(cls) -> str:
        """获取 API Key"""
        api_key = os.getenv("ARK_API_KEY")
        if not api_key:
            raise ValueError("缺少环境变量 ARK_API_KEY，请在 .env 文件中配置火山方舟API密钥")
        return api_key
    
    @classmethod
    def build_user_prompt(
        cls, 
        user_prompt: str, 
        assets_description: List[dict],
        project_title: Optional[str] = None
    ) -> str:
        """
        构建用户提示词
        
        Args:
            user_prompt: 用户输入的视频需求描述
            assets_description: 素材描述列表 [{"file_path": "...", "description": "..."}]
            project_title: 项目标题（可选）
        """
        
        # 素材信息部分
        if assets_description:
            assets_text = "\n".join([
                f"  - 素材{i+1} ({a.get('file_type', 'video')}): {a.get('description', '无描述')}"
                for i, a in enumerate(assets_description)
            ])
            assets_section = f"""
【用户上传的素材】
{assets_text}

请在脚本中合理使用这些素材（type 设为 "mixed_media"，并填写 reference_asset_path）。
"""
        else:
            assets_section = """
【用户素材】
用户未上传任何素材，所有分镜都使用 AI 生成（type 设为 "ai_generated"）。
"""
        
        # 标题说明
        title_section = f'项目标题建议为："{project_title}"' if project_title else "请根据内容自动生成一个吸引人的标题"
        
        return f"""请根据以下需求，生成一个视频分镜脚本。

【用户需求】
{user_prompt}

{assets_section}

【输出要求】
{title_section}

请返回以下JSON格式：
{{
  "title": "视频标题",
  "scenes": [
    {{
      "scene_id": 1,
      "type": "ai_generated 或 mixed_media",
      "script_content": "该分镜的口播文案/旁白",
      "visual_description": "该分镜的画面描述（用于指导后续生图或剪辑）",
      "estimated_duration": 4,
      "reference_asset_path": "如果是mixed_media，填写素材路径，否则为null",
      "design_reason": "该分镜的设计理由和创意思路（为什么这样设计）",
      "creative_notes": ["创意要点1", "创意要点2", "创意要点3"]
    }}
  ]
}}

要求：
1. 生成4-6个分镜
2. 总时长控制在30-90秒
3. 如有素材，至少使用1-2个
4. 每个分镜的画面描述要详细具体，便于后续AI生图
5. **重要**：为每个分镜提供 design_reason（设计理由）和 creative_notes（3-5个创意要点）
   - design_reason 应说明：为什么在这个位置设计这个镜头？它在整体叙事中的作用是什么？
   - creative_notes 应包含：画面构图、运镜选择、情感表达、视觉节奏等具体创意点"""

    @classmethod
    async def generate_script(
        cls,
        user_prompt: str,
        assets: List[dict],
        project_title: Optional[str] = None
    ) -> dict:
        """
        调用火山方舟API生成脚本
        
        Args:
            user_prompt: 用户输入的视频需求
            assets: 素材列表，每个元素包含 file_path, file_type, description
            project_title: 项目标题（可选）
            
        Returns:
            生成的脚本字典，包含 title 和 scenes
        """
        
        try:
            print(f"[火山方舟AI] 开始生成脚本...")
            print(f"[用户需求] {user_prompt[:100]}...")
            print(f"[素材数量] {len(assets)}")
        except UnicodeEncodeError:
            # Windows控制台编码问题，忽略打印错误
            pass
        
        api_key = cls.get_api_key()
        
        # 构建用户提示词
        user_message = cls.build_user_prompt(
            user_prompt=user_prompt,
            assets_description=assets,
            project_title=project_title
        )
        
        # 构建请求体
        request_body = {
            "model": cls.MODEL_ID,
            "messages": [
                {
                    "role": "system",
                    "content": cls.SYSTEM_PROMPT
                },
                {
                    "role": "user", 
                    "content": user_message
                }
            ],
            "response_format": {
                "type": "json_object"
            },
            "temperature": 0.7,
            "max_tokens": 4096
        }
        
        # 发送请求
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    cls.API_URL,
                    json=request_body,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                )
                response.raise_for_status()
                
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                error_detail = e.response.text
                
                if status_code == 401:
                    raise ValueError("API认证失败：请检查 ARK_API_KEY 是否正确")
                elif status_code == 429:
                    raise ValueError("API请求频率超限：请稍后再试")
                elif status_code == 400:
                    raise ValueError(f"API请求参数错误: {error_detail}")
                else:
                    raise ValueError(f"API请求失败 ({status_code}): {error_detail}")
                    
            except httpx.TimeoutException:
                raise ValueError("API请求超时：请检查网络连接或稍后再试")
        
        # 解析响应
        result = response.json()
        
        if "choices" not in result or not result["choices"]:
            raise ValueError("API响应格式错误：缺少 choices 字段")
        
        content = result["choices"][0]["message"]["content"]
        
        # 解析JSON
        try:
            script_data = json.loads(content)
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON解析失败，原始内容: {content}")
            raise ValueError(f"AI返回的内容不是有效的JSON: {e}")
        
        try:
            print(f"[火山方舟AI] 脚本生成完成!")
            print(f"[结果] 生成了 {len(script_data.get('scenes', []))} 个分镜")
        except UnicodeEncodeError:
            pass
        
        return script_data
    
    @classmethod
    async def generate_with_schema(
        cls,
        system_prompt: str,
        user_prompt: str,
        response_schema: dict
    ) -> dict:
        """
        使用指定的响应schema调用AI生成内容
        
        Args:
            system_prompt: 系统提示词
            user_prompt: 用户提示词
            response_schema: 响应的JSON schema
            
        Returns:
            生成的结构化数据字典
        """
        
        try:
            print(f"[火山方舟AI] 开始生成结构化内容...")
            print(f"[System] {system_prompt[:100]}...")
            print(f"[User] {user_prompt[:100]}...")
        except UnicodeEncodeError:
            pass
        
        api_key = cls.get_api_key()
        
        # 构建请求体
        request_body = {
            "model": cls.MODEL_ID,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user", 
                    "content": user_prompt
                }
            ],
            "response_format": {
                "type": "json_object"
            },
            "temperature": 0.7,
            "max_tokens": 4096
        }
        
        # 发送请求
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    cls.API_URL,
                    json=request_body,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                )
                response.raise_for_status()
                
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                error_detail = e.response.text
                
                if status_code == 401:
                    raise ValueError("API认证失败：请检查 ARK_API_KEY 是否正确")
                elif status_code == 429:
                    raise ValueError("API请求频率超限：请稍后再试")
                elif status_code == 400:
                    raise ValueError(f"API请求参数错误: {error_detail}")
                else:
                    raise ValueError(f"API请求失败 ({status_code}): {error_detail}")
                    
            except httpx.TimeoutException:
                raise ValueError("API请求超时：请检查网络连接或稍后再试")
        
        # 解析响应
        result = response.json()
        
        if "choices" not in result or not result["choices"]:
            raise ValueError("API响应格式错误：缺少 choices 字段")
        
        content = result["choices"][0]["message"]["content"]
        
        # 解析JSON
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON解析失败，原始内容: {content}")
            raise ValueError(f"AI返回的内容不是有效的JSON: {e}")
        
        try:
            print(f"[火山方舟AI] 结构化内容生成完成!")
        except UnicodeEncodeError:
            pass
        
        return data
    
    @classmethod
    async def analyze_asset(cls, asset_description: str) -> str:
        """
        分析单个素材内容（简化版，用于给素材生成描述）
        
        这是一个简化的文本分析，实际的视觉分析需要用 VLM 模型。
        """
        # 这里暂时返回原描述，实际应该调用 VLM 分析图片/视频
        return asset_description or "用户上传的素材"

