import numpy as np
import matplotlib.pyplot as plt

# 设置参数
# t 代表角度，同时也用来代表高度 z（因为在圆锥螺旋中，高度随旋转增加）
t = np.linspace(0, 10 * np.pi, 1000) 
z = t  # 高度 z
x = t * np.cos(t) # x 坐标：半径(t) * cos(角度)

# 绘图
plt.figure(figsize=(10, 6))

# 画出螺旋线的侧面投影（蓝色波浪线）
plt.plot(x, z, label='Helix Side View (XZ Plane)', color='blue')

# 画出圆锥的轮廓（红色虚线），这就是那个"V"字形区域
plt.plot(t, t, 'r--', label='Cone Boundary', alpha=0.5)
plt.plot(-t, t, 'r--', alpha=0.5)

# 设置标签和标题
plt.title('Side View of a Conical Helix (Projection on XZ Plane)')
plt.xlabel('X Axis (Left - Right)')
plt.ylabel('Z Axis (Height)')
plt.axvline(0, color='black', linewidth=0.5)
plt.axhline(0, color='black', linewidth=0.5)
plt.legend()
plt.grid(True)

# 保存图片
output_file = 'conical_helix.png'
plt.savefig(output_file, dpi=300, bbox_inches='tight')
print(f'图片已保存到: {output_file}')

# 显示（如果环境支持）
plt.show()