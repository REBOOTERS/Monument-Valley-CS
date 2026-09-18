# 三态视觉对比：ours(init/f3/dock) vs 参考(f_001/f_003/f_015)。
# 输出 shots/v9/accept_final.png（整幅双栏 x 三行）+ init 转子足迹 diff 像素数。
# 依赖：先跑 tools/shot2.js 生成 shots/v9/{init,init_norotor,f3,dock}.png。
from PIL import Image
import numpy as np
import os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

def load(p):
    return Image.open(os.path.join(BASE, p)).convert('RGB')

a = load('shots/v9/init.png')
b = load('shots/v9/init_norotor.png')
d = np.abs(np.asarray(a, int) - np.asarray(b, int)).sum(2)
print('init 转子足迹 diff px（纯雪花噪声应 <400）:', int((d > 45).sum()))

pairs = [
    ('shots/v9/init.png', 'frames/f_001.png'),
    ('shots/v9/f3.png', 'frames/f_003.png'),
    ('shots/v9/dock.png', 'frames/f_015.png'),
]
W, H = 576, 1280
canv = Image.new('RGB', (W * 2 + 8, (H + 8) * 3), (10, 10, 12))
for i, (x, y) in enumerate(pairs):
    canv.paste(load(x), (0, i * (H + 8)))
    canv.paste(load(y), (W + 8, i * (H + 8)))
out = os.path.join(BASE, 'shots', 'v9', 'accept_final.png')
canv.save(out)
print('saved', os.path.relpath(out, BASE))
