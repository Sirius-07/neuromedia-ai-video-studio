"""
IndexTTS2 语音合成服务

提供文本转语音(TTS)功能，支持多种中文语音
对接 IndexTTS2 API 服务
"""

import os
import sys
import io

# 确保标准输出使用 UTF-8 编码
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import requests
from pathlib import Path
import logging
from typing import Optional, Dict, Any
import time
import asyncio
import aiohttp

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IndexTTS2Service:
    """IndexTTS2 语音合成服务"""
    
    # IndexTTS2 API 配置
    API_HOST = os.getenv('INDEXTTS2_HOST', 'http://127.0.0.1')
    API_PORT = os.getenv('INDEXTTS2_PORT', '6006')
    API_BASE_URL = f"{API_HOST}:{API_PORT}"
    
    # 支持的语音类型（映射到 IndexTTS2 的 speaker ID）
    VOICES = {
        'stable-male': {
            'name': '央视男声',
            'description': '沉稳专业的男声',
            'speaker_id': 'speaker_01',
            'emotions': ['neutral', 'serious']
        },
        'energetic-female': {
            'name': '活力女声',
            'description': '充满活力的女声',
            'speaker_id': 'speaker_02',
            'emotions': ['neutral', 'happy', 'excited']
        },
        'narrator': {
            'name': '沉稳旁白',
            'description': '专业旁白男声',
            'speaker_id': 'speaker_03',
            'emotions': ['neutral', 'serious']
        },
        'gentle-female': {
            'name': '温柔女声',
            'description': '温柔亲切的女声',
            'speaker_id': 'speaker_04',
            'emotions': ['neutral', 'happy', 'gentle']
        },
    }
    
    def __init__(self):
        """初始化 TTS 服务"""
        self.output_dir = Path(__file__).parent.parent.parent / "uploads" / "voiceovers"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"IndexTTS2 Service 初始化完成")
        logger.info(f"API 地址: {self.API_BASE_URL}")
        logger.info(f"输出目录: {self.output_dir}")
        
        # 检查服务是否可用
        self._check_service_availability()
    
    def _check_service_availability(self):
        """检查 IndexTTS2 服务是否可用"""
        try:
            health_url = f"{self.API_BASE_URL}/health"
            response = requests.get(health_url, timeout=5)
            if response.status_code == 200:
                logger.info("✅ IndexTTS2 服务可用")
                return True
            else:
                logger.warning(f"⚠️ IndexTTS2 服务响应异常: {response.status_code}")
                return False
        except Exception as e:
            logger.warning(f"⚠️ IndexTTS2 服务不可用: {str(e)}")
            logger.warning("请确保 IndexTTS2 服务已启动: python api_server_v2.py")
            return False
    
    def _get_speaker_id(self, voice: str) -> str:
        """获取 IndexTTS2 的 speaker ID"""
        voice_config = self.VOICES.get(voice, self.VOICES['stable-male'])
        return voice_config['speaker_id']
    
    def _get_emotion(self, voice: str, emotion: str = 'neutral') -> str:
        """获取可用的情感参数"""
        voice_config = self.VOICES.get(voice, self.VOICES['stable-male'])
        available_emotions = voice_config.get('emotions', ['neutral'])
        
        if emotion in available_emotions:
            return emotion
        return 'neutral'
    
    async def generate_speech(
        self,
        text: str,
        voice: str = "stable-male",
        speed: float = 1.0,
        emotion: str = "neutral",
        output_filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        调用 IndexTTS2 API 生成语音
        
        Args:
            text: 要转换的文本
            voice: 语音类型
            speed: 语速 (0.5-2.0)
            emotion: 情感 (neutral, happy, sad, etc.)
            output_filename: 输出文件名（不含路径）
            
        Returns:
            {
                "success": bool,
                "audio_path": str,
                "audio_url": str,
                "duration": float,
                "message": str
            }
        """
        try:
            logger.info(f"开始生成语音: {text[:50]}...")
            logger.info(f"语音类型: {voice}, 语速: {speed}, 情感: {emotion}")
            
            # 生成唯一的文件名
            if output_filename is None:
                timestamp = int(time.time() * 1000)
                output_filename = f"voiceover_{timestamp}.wav"
            
            output_path = self.output_dir / output_filename
            
            # 获取 IndexTTS2 speaker ID
            speaker_id = self._get_speaker_id(voice)
            emotion = self._get_emotion(voice, emotion)
            
            # 准备 API 请求
            api_url = f"{self.API_BASE_URL}/generate"
            payload = {
                "text": text,
                "speaker": speaker_id,
                "emotion": emotion,
                "speed": speed,
                "output_format": "wav"
            }
            
            logger.info(f"调用 IndexTTS2 API: {api_url}")
            logger.info(f"参数: {payload}")
            
            # 使用 aiohttp 发送异步请求
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        # 保存音频文件
                        audio_data = await response.read()
                        with open(output_path, 'wb') as f:
                            f.write(audio_data)
                        
                        # 估算音频时长（每秒约7个字）
                        duration = self.estimate_duration(text, speed)
                        
                        # 构建返回URL
                        audio_url = f"/uploads/voiceovers/{output_filename}"
                        
                        logger.info(f"✅ 语音生成成功: {output_filename}")
                        logger.info(f"   时长: {duration:.2f}秒")
                        logger.info(f"   文件大小: {len(audio_data) / 1024:.2f} KB")
                        
                        return {
                            "success": True,
                            "audio_path": str(output_path),
                            "audio_url": audio_url,
                            "duration": duration,
                            "text_length": len(text),
                            "message": "语音生成成功"
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ API 返回错误: {response.status}")
                        logger.error(f"   错误信息: {error_text}")
                        return {
                            "success": False,
                            "message": f"IndexTTS2 API 错误 ({response.status}): {error_text}"
                        }
            
        except aiohttp.ClientConnectorError:
            error_msg = "无法连接到 IndexTTS2 服务。请确保服务已启动: python api_server_v2.py"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "message": error_msg
            }
        except asyncio.TimeoutError:
            error_msg = "IndexTTS2 API 请求超时"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "message": error_msg
            }
        except Exception as e:
            logger.error(f"❌ 语音生成失败: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "message": f"语音生成失败: {str(e)}"
            }
    
    def estimate_duration(self, text: str, speed: float = 1.0) -> float:
        """
        估算语音时长
        
        中文平均语速: 7字/秒
        """
        char_count = len(text)
        base_duration = char_count / 7.0  # 7字/秒
        adjusted_duration = base_duration / speed
        return adjusted_duration
    
    @classmethod
    def get_available_voices(cls) -> Dict[str, Dict[str, Any]]:
        """获取可用的语音列表"""
        return cls.VOICES
    
    async def batch_generate(
        self,
        texts: list,
        voice: str = "stable-male",
        speed: float = 1.0,
        emotion: str = "neutral"
    ) -> Dict[str, Any]:
        """
        批量生成语音
        
        Args:
            texts: 文本列表
            voice: 语音类型
            speed: 语速
            emotion: 情感
            
        Returns:
            {
                "success": bool,
                "results": [...],
                "total": int,
                "success_count": int,
                "failed_count": int
            }
        """
        logger.info(f"开始批量生成 {len(texts)} 个语音...")
        
        results = []
        success_count = 0
        failed_count = 0
        
        for idx, text in enumerate(texts, 1):
            logger.info(f"处理 {idx}/{len(texts)}: {text[:30]}...")
            
            result = await self.generate_speech(
                text=text,
                voice=voice,
                speed=speed,
                emotion=emotion
            )
            
            results.append({
                "index": idx - 1,
                "text": text[:50] + "..." if len(text) > 50 else text,
                **result
            })
            
            if result["success"]:
                success_count += 1
            else:
                failed_count += 1
            
            # 短暂延迟，避免 API 过载
            await asyncio.sleep(0.1)
        
        logger.info(f"批量生成完成: 成功 {success_count}, 失败 {failed_count}")
        
        return {
            "success": success_count > 0,
            "results": results,
            "total": len(texts),
            "success_count": success_count,
            "failed_count": failed_count,
            "message": f"批量生成完成: 成功 {success_count}/{len(texts)}"
        }


# 创建全局服务实例
tts_service = IndexTTS2Service()


# 用于 FastAPI 的异步接口
async def generate_voiceover(
    text: str,
    voice: str = "stable-male",
    speed: float = 1.0,
    output_filename: Optional[str] = None
) -> Dict[str, Any]:
    """生成配音（异步接口）"""
    return await tts_service.generate_speech(text, voice, speed, output_filename)


def get_voices() -> Dict[str, Dict[str, Any]]:
    """获取可用语音列表"""
    return IndexTTS2Service.get_available_voices()


async def batch_generate_voiceovers(
    texts: list,
    voice: str = "stable-male",
    speed: float = 1.0,
    emotion: str = "neutral"
) -> Dict[str, Any]:
    """批量生成配音（异步接口）"""
    return await tts_service.batch_generate(texts, voice, speed, emotion)


if __name__ == "__main__":
    """命令行入口"""
    import asyncio
    import json
    
    if len(sys.argv) < 2:
        logger.error("用法: python indextts_service.py <method> <params_json>")
        sys.exit(1)
    
    method = sys.argv[1]
    params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    
    async def run_command():
        if method == "generate":
            result = await generate_voiceover(**params)
            print(json.dumps(result, ensure_ascii=False))
        
        elif method == "batch_generate":
            result = await batch_generate_voiceovers(**params)
            print(json.dumps(result, ensure_ascii=False))
        
        elif method == "get_voices":
            result = get_voices()
            print(json.dumps(result, ensure_ascii=False))
        
        elif method == "health_check":
            service = IndexTTS2Service()
            is_available = service._check_service_availability()
            result = {
                "available": is_available,
                "api_url": service.API_BASE_URL
            }
            print(json.dumps(result, ensure_ascii=False))
        
        elif method == "test":
            # 测试模式
            logger.info("=== IndexTTS2 服务测试 ===")
            test_text = "在这座有着两千多年历史的城市里，传统与现代交织出独特的韵味。"
            result = await generate_voiceover(
                text=test_text,
                voice="stable-male",
                speed=1.0,
                emotion="neutral"
            )
            print(json.dumps(result, ensure_ascii=False))
        
        else:
            result = {"success": False, "message": f"未知方法: {method}"}
            print(json.dumps(result, ensure_ascii=False))
    
    asyncio.run(run_command())

