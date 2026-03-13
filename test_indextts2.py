#!/usr/bin/env python3
"""
IndexTTS2 测试脚本

测试 IndexTTS2 服务是否正常工作
"""

import requests
import json
import time
import sys

API_BASE = "http://127.0.0.1:6006"

def print_header(text):
    """打印标题"""
    print("\n" + "=" * 50)
    print(f"  {text}")
    print("=" * 50 + "\n")

def test_health_check():
    """测试健康检查"""
    print_header("测试 1: 健康检查")
    
    try:
        url = f"{API_BASE}/health"
        print(f"请求: GET {url}")
        
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 服务可用")
            print(f"   状态: {data.get('status')}")
            print(f"   模型已加载: {data.get('model_loaded')}")
            print(f"   设备: {data.get('device')}")
            return True
        else:
            print(f"❌ 服务响应异常: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务")
        print("   请确保 IndexTTS2 服务已启动:")
        print("   python api_server_v2.py")
        return False
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
        return False

def test_get_voices():
    """测试获取语音列表"""
    print_header("测试 2: 获取语音列表")
    
    try:
        url = f"{API_BASE}/voices"
        print(f"请求: GET {url}")
        
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            voices = data.get('voices', [])
            print(f"✅ 获取成功，共 {len(voices)} 个语音:")
            for voice in voices:
                print(f"   - {voice.get('name')} ({voice.get('id')})")
                print(f"     情感: {', '.join(voice.get('emotions', []))}")
            return True
        else:
            print(f"❌ 获取失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
        return False

def test_generate_voice():
    """测试生成语音"""
    print_header("测试 3: 生成语音")
    
    test_text = "在这座有着两千多年历史的城市里，传统与现代交织出独特的韵味。"
    
    try:
        url = f"{API_BASE}/generate"
        print(f"请求: POST {url}")
        print(f"文本: {test_text}")
        print(f"语音: speaker_01")
        print(f"情感: neutral")
        print(f"语速: 1.0")
        print("\n生成中...")
        
        data = {
            "text": test_text,
            "speaker": "speaker_01",
            "emotion": "neutral",
            "speed": 1.0
        }
        
        start_time = time.time()
        response = requests.post(url, json=data, timeout=60)
        elapsed_time = time.time() - start_time
        
        if response.status_code == 200:
            # 保存音频文件
            output_file = "test_output.wav"
            with open(output_file, 'wb') as f:
                f.write(response.content)
            
            file_size = len(response.content) / 1024  # KB
            
            print(f"✅ 生成成功!")
            print(f"   文件: {output_file}")
            print(f"   大小: {file_size:.2f} KB")
            print(f"   耗时: {elapsed_time:.2f} 秒")
            print(f"\n🔊 请播放 {output_file} 检查音质")
            return True
        else:
            print(f"❌ 生成失败: {response.status_code}")
            print(f"   响应: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
        return False

def test_batch_generate():
    """测试批量生成"""
    print_header("测试 4: 批量生成")
    
    test_texts = [
        "第一个测试文本。",
        "第二个测试文本。",
        "第三个测试文本。"
    ]
    
    try:
        url = f"{API_BASE}/batch-generate"
        print(f"请求: POST {url}")
        print(f"文本数量: {len(test_texts)}")
        print("\n生成中...")
        
        data = {
            "texts": test_texts,
            "speaker": "speaker_01",
            "emotion": "neutral",
            "speed": 1.0
        }
        
        start_time = time.time()
        response = requests.post(url, json=data, timeout=120)
        elapsed_time = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 批量生成完成!")
            print(f"   成功: {result.get('success_count')}/{result.get('total')}")
            print(f"   失败: {result.get('failed_count')}")
            print(f"   耗时: {elapsed_time:.2f} 秒")
            return True
        else:
            print(f"❌ 生成失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
        return False

def main():
    """主函数"""
    print("""
╔══════════════════════════════════════════════════╗
║                                                  ║
║          IndexTTS2 服务测试                       ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    """)
    
    results = []
    
    # 运行所有测试
    results.append(("健康检查", test_health_check()))
    
    if results[-1][1]:  # 如果健康检查通过，继续其他测试
        results.append(("获取语音列表", test_get_voices()))
        results.append(("生成语音", test_generate_voice()))
        results.append(("批量生成", test_batch_generate()))
    else:
        print("\n⚠️ 健康检查未通过，跳过其他测试")
    
    # 打印测试结果摘要
    print_header("测试结果摘要")
    
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{test_name}: {status}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！IndexTTS2 服务运行正常。")
        return 0
    else:
        print("\n⚠️ 部分测试失败，请检查配置。")
        return 1

if __name__ == "__main__":
    sys.exit(main())

