#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""简单的音频生成测试脚本"""

import os
import sys

# 添加 stable-audio-tools 到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'stable-audio-tools'))

os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import torch
import torchaudio
from einops import rearrange
import json

print("=" * 60)
print("Stable Audio 简单测试脚本")
print("=" * 60)

# 1. 加载模型配置
print("\n[1/5] 加载模型配置...")
config_path = "stable-audio-tools/stable_audio_tools/configs/model_configs/txt2audio/stable_audio_1_0.json"
with open(config_path, encoding='utf-8') as f:
    model_config = json.load(f)

print(f"   [OK] 配置已加载")
print(f"   - 采样率: {model_config['sample_rate']} Hz")
print(f"   - 音频通道: {model_config['audio_channels']}")

# 2. 创建模型
print("\n[2/5] 创建模型...")
from stable_audio_tools.models.factory import create_model_from_config

model = create_model_from_config(model_config)
print("   [OK] 模型结构已创建")

# 3. 加载权重
print("\n[3/5] 加载模型权重...")
ckpt_path = "model.safetensors"

from safetensors.torch import load_file
state_dict = load_file(ckpt_path)
missing, unexpected = model.load_state_dict(state_dict, strict=False)
print(f"   [OK] 权重已加载: {ckpt_path}")
if missing:
    print(f"   注意: {len(missing)} 个权重未找到")
if unexpected:
    print(f"   注意: {len(unexpected)} 个额外权重被忽略")

# 4. 准备生成
print("\n[4/5] 准备生成音频...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"   - 使用设备: {device}")

model = model.to(device)
model.eval()

sample_rate = model_config["sample_rate"]
sample_size = model_config["sample_size"]

# 设置生成参数
prompt = "鼓点节奏，电子音乐风格"  # 你可以修改这个提示词
seconds_total = 30  # 生成 30 秒
steps = 100  # 推理步数

print(f"   - 提示词: {prompt}")
print(f"   - 时长: {seconds_total} 秒")
print(f"   - 推理步数: {steps}")

# 5. 生成音频
print("\n[5/5] 生成音频中...")
print("   这可能需要几分钟，请耐心等待...")

try:
    from stable_audio_tools.inference.generation import generate_diffusion_cond
    
    # 准备条件
    conditioning = [{
        "prompt": prompt,
        "seconds_start": 0,
        "seconds_total": seconds_total
    }]
    
    with torch.no_grad():
        output = generate_diffusion_cond(
            model,
            conditioning=conditioning,
            sample_size=sample_size,
            sample_rate=sample_rate,
            steps=steps,
            cfg_scale=7,
            device=device,
            batch_size=1
        )
    
    # 保存音频
    output_file = "test_output.wav"
    
    # 确保音频格式正确
    output = rearrange(output, "b d n -> d (b n)")
    output = output.to(torch.float32).div(torch.max(torch.abs(output))).clamp(-1, 1).mul(32767).to(torch.int16).cpu()
    
    torchaudio.save(output_file, output, sample_rate)
    
    print(f"\n[SUCCESS] 生成成功！")
    print(f"[SUCCESS] 音频已保存到: {os.path.abspath(output_file)}")
    print(f"[SUCCESS] 时长: {seconds_total} 秒")
    print(f"[SUCCESS] 采样率: {sample_rate} Hz")
    
except Exception as e:
    print(f"\n[ERROR] 生成失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)

