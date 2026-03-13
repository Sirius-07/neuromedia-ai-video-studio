#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stable Audio 批量生成脚本
一次性加载模型，批量生成多个音效，避免重复加载模型
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
    parser = argparse.ArgumentParser(description='Stable Audio 批量音频生成')
    
    # 必需参数
    parser.add_argument('--tasks', type=str, required=True,
                        help='JSON 格式的任务列表文件路径')
    
    # 可选参数
    parser.add_argument('--steps', type=int, default=50,
                        help='推理步数（默认: 50）')
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
    """加载 Stable Audio 模型（只加载一次）"""
    print("=" * 60)
    print("初始化 Stable Audio 模型")
    print("=" * 60)
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
    print("=" * 60)
    print()
    
    return model, model_config, device


def calculate_sample_size(duration, sample_rate, downsampling_ratio):
    """计算精确的 sample_size"""
    raw_sample_size = int(duration * sample_rate)
    sample_size = (raw_sample_size // downsampling_ratio) * downsampling_ratio
    actual_seconds = sample_size / sample_rate
    return sample_size, actual_seconds


def generate_single_audio(model, model_config, device, task, args):
    """生成单个音频"""
    prompt = task['prompt']
    duration = task['duration']
    output_path = task['output']
    
    print(f"\n🎵 生成音效: {task.get('index', '?')}")
    print(f"   提示词: {prompt}")
    print(f"   时长: {duration} 秒")
    
    try:
        from stable_audio_tools.inference.generation import generate_diffusion_cond
        
        # 计算 sample_size
        sample_rate = model_config["sample_rate"]
        downsampling_ratio = model_config["model"]["pretransform"]["config"]["downsampling_ratio"]
        sample_size, actual_seconds = calculate_sample_size(duration, sample_rate, downsampling_ratio)
        
        # 准备条件
        conditioning = [{
            "prompt": prompt,
            "seconds_start": 0,
            "seconds_total": duration
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
        
        torchaudio.save(output_path, output, sample_rate)
        
        actual_duration = output.shape[1] / sample_rate
        
        print(f"   ✅ 生成成功！耗时: {inference_time:.2f}秒")
        
        return {
            'success': True,
            'output': output_path,
            'duration': actual_duration,
            'inference_time': inference_time
        }
        
    except Exception as e:
        print(f"   ❌ 生成失败: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def main():
    """主函数"""
    try:
        # 解析参数
        args = parse_arguments()
        
        # 读取任务列表
        print(f"📂 读取任务列表: {args.tasks}\n")
        
        if not os.path.exists(args.tasks):
            raise FileNotFoundError(f"任务文件不存在: {args.tasks}")
        
        with open(args.tasks, 'r', encoding='utf-8') as f:
            tasks = json.load(f)
        
        if not isinstance(tasks, list):
            raise ValueError("任务文件必须是 JSON 数组格式")
        
        print(f"✓ 读取到 {len(tasks)} 个生成任务\n")
        
        # 加载模型（只加载一次！）
        model, model_config, device = load_model(args.model_config, args.model_checkpoint)
        
        # 批量生成
        print("=" * 60)
        print(f"开始批量生成 {len(tasks)} 个音效")
        print("=" * 60)
        
        results = []
        success_count = 0
        total_inference_time = 0
        
        batch_start_time = time.time()
        
        for i, task in enumerate(tasks):
            task['index'] = i + 1
            result = generate_single_audio(model, model_config, device, task, args)
            results.append(result)
            
            if result['success']:
                success_count += 1
                total_inference_time += result['inference_time']
        
        batch_end_time = time.time()
        total_time = batch_end_time - batch_start_time
        
        # 输出统计
        print("\n" + "=" * 60)
        print("批量生成完成")
        print("=" * 60)
        print(f"✅ 成功: {success_count}/{len(tasks)}")
        print(f"❌ 失败: {len(tasks) - success_count}/{len(tasks)}")
        print(f"⏱️  总耗时: {total_time:.2f} 秒")
        print(f"⚡ 平均推理时间: {total_inference_time/success_count:.2f} 秒/个" if success_count > 0 else "")
        print(f"🚀 效率提升: 避免了 {len(tasks)-1} 次重复加载模型")
        print("=" * 60)
        
        # 保存结果
        results_file = args.tasks.replace('.json', '_results.json')
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump({
                'total': len(tasks),
                'success': success_count,
                'failed': len(tasks) - success_count,
                'total_time': total_time,
                'results': results
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 详细结果已保存: {results_file}\n")
        
        sys.exit(0 if success_count == len(tasks) else 1)
            
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()


















