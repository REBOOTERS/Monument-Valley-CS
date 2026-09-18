# Cache static-blue screen map (AND of 7 calibration frames) + distance field.
# static EDT: px distance to nearest static-blue region; arms at init must live
# where EDT ~ 0 to be invisible in the rotor mask (rotor = blue & ~static).
import numpy as np
from PIL import Image
from scipy import ndimage

NAMES = ['f_001.png', 'f_005.png', 'f_008.png', 'f_010.png', 'f_012.png', 'f_014.png', 'f_015.png']

def load(name):
    a = np.asarray(Image.open('frames/' + name).convert('RGB')).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    return ((R + G + B) / 3.0 > 140) & ((B - R) > 12) & (B > 150)

def morph(m, k, erode):
    for _ in range(k):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    s = np.roll(np.roll(m, dy, 0), dx, 1)
                    n = n & s if erode else n | s
        m = n
    return m

static = np.ones((1280, 576), bool)
for n in NAMES:
    static &= morph(load(n), 2, True)

np.save('tools/staticmask.npy', static)
edt = ndimage.distance_transform_edt(~ndimage.binary_dilation(static, np.ones((3, 3)), iterations=4))
np.save('tools/staticedt.npy', edt.astype(np.float32))
print('static px %d  edt max %.1f  saved tools/staticmask.npy staticedt.npy'
      % (static.sum(), edt.max()))
