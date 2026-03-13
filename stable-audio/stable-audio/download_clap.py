#!/usr/bin/env python3
"""下载 CLAP 模型"""
import os
from huggingface_hub import hf_hub_download

# 下载 CLAP checkpoint
print("正在下载 CLAP 模型...")
clap_path = hf_hub_download(
    repo_id="lukewys/laion_clap",
    filename="music_audioset_epoch_15_esc_90.14.pt",
    cache_dir="./clap_cache"
)

print(f"CLAP 模型已下载到: {clap_path}")

# 复制到项目目录
import shutil
target_path = "clap_checkpoint.pt"
shutil.copy(clap_path, target_path)
print(f"CLAP 模型已复制到: {target_path}")
print(f"\n完整路径: {os.path.abspath(target_path)}")


