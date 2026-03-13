"""
Stable Audio 短音效生成工具
支持精确控制秒数（如 3.5 秒、7 秒等）
"""

import os
import sys
import json
import time
import torch
import torchaudio
from einops import rearrange
from datetime import datetime
import glob

# 添加 stable-audio-tools 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'stable-audio-tools'))

print("=" * 60)
print("Stable Audio 短音效生成工具")
print("=" * 60)
print("\n" + "="*60)
print("[Parameters] Adjustable Parameters")
print("="*60)
print("  1. PROMPT - Describe audio content, most important!")
print("  2. NEGATIVE_PROMPT - Avoid unwanted features")
print("  3. SECONDS_TOTAL - Audio length (0.5-95s)")
print("  4. STEPS - Quality vs Speed (20-250)")
print("  5. CFG_SCALE - Accuracy vs Creativity (1-15)")
print("  6. SEED - -1=random, fixed=reproducible")
print("  7. SIGMA_MIN/MAX - Advanced, keep default")
print("  8. SAMPLER_TYPE - Advanced, keep default")
print()
print("[Presets] Quick Configuration:")
print("  [SFX-Fast] STEPS=50, CFG_SCALE=7")
print("  [SFX-HQ]   STEPS=150, CFG_SCALE=9-12")
print("  [Music-Creative] STEPS=100, CFG_SCALE=5-7")
print("  [Music-Accurate] STEPS=200, CFG_SCALE=8-10")
print("="*60)
print()

# ========== 配置参数 ==========
# 🎵 在这里修改生成参数来测试不同效果

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📝 参数 1: PROMPT（提示词）- 最重要的参数！
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 描述你想要生成的音效内容
# 影响: 直接决定生成的音效类型和特征
# 
# ⚠️ 重要提示：此模型主要训练在音乐数据上，对音效的效果有限！
# 
# 🎯 音效提示词技巧：
#   - 使用音频术语：percussive（打击）, sustained（延续）, staccato（短促）
#   - 描述频率：high-pitched（高频）, low rumble（低频）, mid-range（中频）
#   - 描述音色：metallic, wooden, digital, organic, synthesized
#   - 添加上下文：sound effect, SFX, foley, isolated sound
#   - 避免：复杂句子，多个音效混合
# 
# 🎵 音乐提示词技巧：
#   - 指定风格：hip-hop, electronic, orchestral, jazz
#   - 指定 BPM：120 BPM, fast tempo, slow tempo
#   - 指定乐器：piano, drums, synthesizer, guitar
#   - 指定情绪：upbeat, melancholic, energetic, calm
PROMPT = "Swing the badminton racket forcefully to hit the shuttlecock"

# 🚫 负面提示词（可选）- 告诉模型"不要生成什么"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 避免不想要的特征
# 建议: 低质量、嘈杂、失真、背景音乐等
# 留空表示不使用负面提示
NEGATIVE_PROMPT = "low quality, distorted, noisy, background music, multiple sounds, ambient"  # 留空 "" 表示不使用

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ⏱️ 参数 2: SECONDS_TOTAL（音频时长）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 设置生成音频的长度
# 影响: 时长越长，生成速度越慢
# 范围: 0.5 ~ 95 秒（模型支持最长 95 秒）
# 建议:
#   - 短音效：1-3 秒（单次音效）
#   - 中等音效：3-7 秒（带余音的音效）
#   - 背景音乐循环：10-30 秒
#   - 完整音乐：30-95 秒
#   - 支持小数，如 2.5、5.8
SECONDS_TOTAL = 100

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔢 参数 3: STEPS（推理步数）- 质量 vs 速度
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 控制生成的迭代次数
# 影响: 步数越多，质量越好，但速度越慢
# 范围: 10 ~ 250
# 建议:
#   - 快速测试: 20-30 步（质量较低，适合快速迭代提示词）
#   - 日常使用: 50 步（推荐，质量与速度平衡）
#   - 高质量: 100-150 步（音效清晰度更高）
#   - 官方推荐: 200-250 步（接近最佳质量）
# 参考: 50步 ≈ 2秒，100步 ≈ 4秒，250步 ≈ 10秒
STEPS = 100  # 提高到 100 步以获得更好的音效质量

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 参数 4: CFG_SCALE（引导强度）- 创意 vs 准确
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 控制生成结果与提示词的贴合程度（Classifier-Free Guidance）
# 影响: 
#   - 低值(1-4): 更有创意自由，但可能偏离提示词，音质可能模糊
#   - 中值(5-9): 平衡创意和准确性（推荐）
#   - 高值(10-15): 严格遵循提示词，细节更清晰，但可能过度拟合
# 范围: 1.0 ~ 15.0
# 建议:
#   - 音效（需要精确）: 8-12（更高的值让音效更清晰）
#   - 音乐（需要创意）: 5-7
#   - 实验探索: 3-4
#   - 官方音乐示例: 3, 6, 9
CFG_SCALE = 9  # 对音效使用较高值，提高清晰度

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎲 参数 5: SEED（随机种子）- 可重复性
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 控制随机性
# 影响: 
#   - -1: 每次生成都不同（随机）
#   - 固定数字(如 42): 每次生成相同结果（可重复）
# 用途: 找到满意的效果后，可以固定 seed 来重复生成
SEED = -1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🌊 参数 6: SIGMA_MIN / SIGMA_MAX（噪声范围）- 高级参数
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 控制扩散过程的噪声水平范围
# 影响: 
#   - sigma_min 越小: 细节越多，但可能产生噪音
#   - sigma_max 越大: 生成过程更稳定
# 默认值: 0.3 / 500（一般不需要改）
# 建议: 保持默认，除非你了解扩散模型原理
SIGMA_MIN = 0.3
SIGMA_MAX = 500

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ⚙️ 参数 7: SAMPLER_TYPE（采样器类型）- 高级参数
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 作用: 选择扩散模型的采样算法
# 影响: 不同算法在质量、速度上有差异
# 可选值:
#   - "dpmpp-3m-sde": 默认，质量高，速度快（推荐）
#   - "dpmpp-2m-sde": 稍快，质量略低
#   - "k-heun": 高质量，但较慢
#   - "k-lms": 经典算法，中等速度
#   - "k-dpmpp-2s-ancestral": 更多随机性
# 建议: 保持默认 "dpmpp-3m-sde"
SAMPLER_TYPE = "dpmpp-3m-sde"

# 文件路径
MODEL_CONFIG_PATH = "model_config.json"
MODEL_CKPT_PATH = "model.safetensors"

# 🎯 自动生成文件名：序号_时间戳.wav
# 获取当前目录下已有的音频文件数量，作为序号
existing_files = glob.glob("audio_*.wav")
file_number = len(existing_files) + 1
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
OUTPUT_FILE = f"audio_{file_number:03d}_{timestamp}.wav"

print(f"\n[输出文件] {OUTPUT_FILE}")
# ==============================

# 💡 优化后的提示词示例（针对此模型）：
#
# 🎼 音乐类（推荐，效果最好）：
# - "Upbeat electronic dance music, 128 BPM, energetic synths and driving bass"
# - "Chill lo-fi hip hop beat, relaxed tempo, jazzy piano and vinyl crackle"
# - "Epic orchestral soundtrack, cinematic strings and brass, heroic mood"
# - "Acoustic guitar melody, fingerstyle, warm and intimate"
# 
# 🥁 节奏/打击类（效果较好）：
# - "Drum break, 174 BPM, breakbeat style, punchy kicks and snappy snares"
# - "Techno kick drum pattern, 130 BPM, four-on-the-floor, deep and pounding"
# - "Hand clap rhythm, isolated percussive sound, bright attack"
# 
# 🔔 音效类（效果一般，需要详细描述）：
# - "Dog bark sound effect, single sharp bark, high-pitched attack, isolated, no reverb"
# - "Door creak foley, wooden texture, slow movement, squeaky hinge sound"
# - "Glass break SFX, sharp crash, high-frequency shatter, short and percussive"
# - "Whoosh sound effect, fast air movement, swoosh transition, clean and airy"
# - "Digital UI click, short percussive beep, high-pitched, synthesized"
# 
# 🌧️ 环境音（效果中等）：
# - "Rain ambience, heavy rainfall, water droplets, continuous white noise texture"
# - "Ocean waves, gentle surf, natural beach ambience, rolling water sounds"

print(f"\n[1/5] 加载配置文件...")
with open(MODEL_CONFIG_PATH, 'r') as f:
    model_config = json.load(f)

sample_rate = model_config["sample_rate"]
downsampling_ratio = model_config["model"]["pretransform"]["config"]["downsampling_ratio"]

print(f"   [OK] 配置已加载")
print(f"   - 采样率: {sample_rate} Hz")
print(f"   - 下采样率: {downsampling_ratio}")

# 🎯 动态计算精确的 sample_size
raw_sample_size = int(SECONDS_TOTAL * sample_rate)
sample_size = (raw_sample_size // downsampling_ratio) * downsampling_ratio
actual_seconds = sample_size / sample_rate

print(f"\n[2/5] 计算 sample_size...")
print(f"   - 目标时长: {SECONDS_TOTAL} 秒")
print(f"   - 计算得到 sample_size: {sample_size}")
print(f"   - 实际时长: {actual_seconds:.3f} 秒")

print(f"\n[3/5] 创建模型...")
from stable_audio_tools.models.factory import create_model_from_config

model = create_model_from_config(model_config)
print(f"   [OK] 模型结构已创建")

print(f"\n[4/5] 加载模型权重...")
from safetensors.torch import load_file

state_dict = load_file(MODEL_CKPT_PATH)
model.load_state_dict(state_dict, strict=False)
print(f"   [OK] 权重已加载")

device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
model.eval()
print(f"   - 使用设备: {device}")

print(f"\n[5/5] 生成音频...")
print(f"   - 提示词: {PROMPT}")
print(f"   - 时长: {actual_seconds:.3f} 秒")
print(f"   - 推理步数: {STEPS}")
print(f"   - CFG Scale: {CFG_SCALE}")
print(f"   - 随机种子: {SEED}")
print(f"   - 采样器: {SAMPLER_TYPE}")
print(f"   - 噪声范围: {SIGMA_MIN} ~ {SIGMA_MAX}")

try:
    from stable_audio_tools.inference.generation import generate_diffusion_cond
    
    # 准备正向条件
    conditioning = [{
        "prompt": PROMPT,
        "seconds_start": 0,
        "seconds_total": SECONDS_TOTAL
    }]
    
    # 准备负向条件（如果有）
    negative_conditioning = None
    if NEGATIVE_PROMPT and NEGATIVE_PROMPT.strip():
        negative_conditioning = [{
            "prompt": NEGATIVE_PROMPT,
            "seconds_start": 0,
            "seconds_total": SECONDS_TOTAL
        }]
        print(f"   - 负面提示词: {NEGATIVE_PROMPT}")
    
    # 开始计时
    start_time = time.time()
    print(f"\n开始推理...")
    
    with torch.no_grad():
        output = generate_diffusion_cond(
            model,
            steps=STEPS,
            cfg_scale=CFG_SCALE,
            conditioning=conditioning,
            negative_conditioning=negative_conditioning,
            sample_size=sample_size,
            sigma_min=SIGMA_MIN,
            sigma_max=SIGMA_MAX,
            sampler_type=SAMPLER_TYPE,
            device=device,
            seed=SEED
        )
    
    # 结束计时
    inference_time = time.time() - start_time
    
    # 保存音频
    output = rearrange(output, "b d n -> d (b n)")
    output = output.to(torch.float32).div(torch.max(torch.abs(output))).clamp(-1, 1).mul(32767).to(torch.int16).cpu()
    
    torchaudio.save(OUTPUT_FILE, output, sample_rate)
    
    actual_duration = output.shape[1] / sample_rate
    real_time_factor = actual_duration / inference_time
    
    print(f"\n" + "=" * 60)
    print(f"[SUCCESS] 生成成功！")
    print(f"=" * 60)
    print(f"文件: {os.path.abspath(OUTPUT_FILE)}")
    print(f"时长: {actual_duration:.3f} 秒")
    print(f"采样率: {sample_rate} Hz")
    print(f"-" * 60)
    print(f"推理耗时: {inference_time:.2f} 秒")
    print(f"实时倍率: {real_time_factor:.2f}x (生成 1 秒音频需要 {1/real_time_factor:.2f} 秒)")
    print(f"=" * 60)
    
except Exception as e:
    print(f"\n[ERROR] 生成失败: {e}")
    import traceback
    traceback.print_exc()

