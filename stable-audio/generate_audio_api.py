#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stable Audio API 调用脚本
支持通过命令行参数生成音频，用于 Node.js 后端集成
"""

import os
import sys
import json
import time
import argparse
import torch
import torchaudio
from einops import rearrange

# 设置 UTF-8 编码输出（解决 Windows GBK 编码问题）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 添加 stable-audio-tools 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'stable-audio-tools'))


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='Stable Audio 音频生成 API')
    
    # 必需参数
    parser.add_argument('--prompt', type=str, required=True,
                        help='提示词，描述要生成的音频内容')
    parser.add_argument('--duration', type=float, required=True,
                        help='音频时长（秒），支持小数')
    parser.add_argument('--output', type=str, required=True,
                        help='输出文件路径')
    
    # 可选参数
    parser.add_argument('--steps', type=int, default=100,
                        help='推理步数（默认: 100）')
    parser.add_argument('--cfg-scale', type=float, default=7.0,
                        help='CFG引导强度（默认: 7.0）')
    parser.add_argument('--seed', type=int, default=-1,
                        help='随机种子，-1表示随机（默认: -1）')
    parser.add_argument('--sampler-type', type=str, default='dpmpp-3m-sde',
                        help='采样器类型（默认: dpmpp-3m-sde）')
    parser.add_argument('--sigma-min', type=float, default=0.3,
                        help='最小噪声水平（默认: 0.3）')
    parser.add_argument('--sigma-max', type=float, default=500.0,
                        help='最大噪声水平（默认: 500.0）')
    
    # 模型配置文件路径
    parser.add_argument('--model-config', type=str, default='model_config.json',
                        help='模型配置文件路径（默认: model_config.json）')
    parser.add_argument('--model-checkpoint', type=str, default='model.safetensors',
                        help='模型权重文件路径（默认: model.safetensors）')
    
    return parser.parse_args()


def load_model(model_config_path, model_ckpt_path):
    """加载 Stable Audio 模型"""
    print(f"[1/3] 加载配置文件: {model_config_path}")
    
    if not os.path.exists(model_config_path):
        raise FileNotFoundError(f"配置文件不存在: {model_config_path}")
    
    with open(model_config_path, 'r') as f:
        model_config = json.load(f)
    
    sample_rate = model_config["sample_rate"]
    downsampling_ratio = model_config["model"]["pretransform"]["config"]["downsampling_ratio"]
    
    print(f"   ✓ 配置已加载 (采样率: {sample_rate} Hz, 下采样率: {downsampling_ratio})")
    
    # 创建模型
    print(f"[2/3] 创建模型结构...")
    from stable_audio_tools.models.factory import create_model_from_config
    model = create_model_from_config(model_config)
    print(f"   ✓ 模型结构已创建")
    
    # 加载权重
    print(f"[3/3] 加载模型权重: {model_ckpt_path}")
    
    if not os.path.exists(model_ckpt_path):
        raise FileNotFoundError(f"权重文件不存在: {model_ckpt_path}")
    
    from safetensors.torch import load_file
    state_dict = load_file(model_ckpt_path)
    model.load_state_dict(state_dict, strict=False)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    model.eval()
    
    print(f"   ✓ 权重已加载 (设备: {device})")
    
    return model, model_config, device


def calculate_sample_size(duration, sample_rate, downsampling_ratio):
    """计算精确的 sample_size"""
    raw_sample_size = int(duration * sample_rate)
    sample_size = (raw_sample_size // downsampling_ratio) * downsampling_ratio
    actual_seconds = sample_size / sample_rate
    
    print(f"\n📊 音频参数:")
    print(f"   - 目标时长: {duration:.3f} 秒")
    print(f"   - 计算得到 sample_size: {sample_size}")
    print(f"   - 实际时长: {actual_seconds:.3f} 秒")
    
    return sample_size, actual_seconds


def generate_audio(model, model_config, device, args, sample_size):
    """生成音频"""
    print(f"\n🎵 开始生成音频...")
    print(f"   - 提示词: {args.prompt}")
    print(f"   - 推理步数: {args.steps}")
    print(f"   - CFG Scale: {args.cfg_scale}")
    print(f"   - 随机种子: {args.seed}")
    
    try:
        from stable_audio_tools.inference.generation import generate_diffusion_cond
        
        # 准备条件
        conditioning = [{
            "prompt": args.prompt,
            "seconds_start": 0,
            "seconds_total": args.duration
        }]
        
        # 开始计时
        start_time = time.time()
        
        with torch.no_grad():
            output = generate_diffusion_cond(
                model,
                steps=args.steps,
                cfg_scale=args.cfg_scale,
                conditioning=conditioning,
                sample_size=sample_size,
                sigma_min=args.sigma_min,
                sigma_max=args.sigma_max,
                sampler_type=args.sampler_type,
                device=device,
                seed=args.seed
            )
        
        # 结束计时
        inference_time = time.time() - start_time
        
        # 保存音频
        output = rearrange(output, "b d n -> d (b n)")
        output = output.to(torch.float32).div(torch.max(torch.abs(output))).clamp(-1, 1).mul(32767).to(torch.int16).cpu()
        
        sample_rate = model_config["sample_rate"]
        torchaudio.save(args.output, output, sample_rate)
        
        actual_duration = output.shape[1] / sample_rate
        real_time_factor = actual_duration / inference_time
        
        print(f"\n✅ 生成成功！")
        print(f"   - 文件: {os.path.abspath(args.output)}")
        print(f"   - 时长: {actual_duration:.3f} 秒")
        print(f"   - 采样率: {sample_rate} Hz")
        print(f"   - 推理耗时: {inference_time:.2f} 秒")
        print(f"   - 实时倍率: {real_time_factor:.2f}x")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 生成失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("Stable Audio API 音频生成")
    print("=" * 60)
    
    try:
        # 解析参数
        args = parse_arguments()
        
        # 加载模型
        model, model_config, device = load_model(args.model_config, args.model_checkpoint)
        
        # 计算 sample_size
        sample_rate = model_config["sample_rate"]
        downsampling_ratio = model_config["model"]["pretransform"]["config"]["downsampling_ratio"]
        sample_size, actual_seconds = calculate_sample_size(args.duration, sample_rate, downsampling_ratio)
        
        # 生成音频
        success = generate_audio(model, model_config, device, args, sample_size)
        
        print("=" * 60)
        
        if success:
            sys.exit(0)
        else:
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

