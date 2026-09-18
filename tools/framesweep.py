# Extract the rotating L-arm from reference frames.
#   static mask  = intersection of structure masks of all given frames
#   rotor(t)     = structure(t) - static, crank/Ida regions dropped, small specks removed
# Outputs a colour composite: static=gray, rotor of each frame in its own hue.
# Usage: python tools/framesweep.py out.png f001 f005 f008 f012 f015 [x0 y0 x1 y1]
import sys
import re
import numpy as np
from PIL import Image

FR = 'frames/'
COLORS = [(255, 70, 70), (255, 170, 0), (255, 255, 60), (70, 255, 120),
          (60, 180, 255), (200, 90, 255), (255, 90, 200), (160, 255, 240)]

def load(name):
    im = Image.open(FR + name).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    bright = (R + G + B) / 3.0
    sat = B - R
    # icy-blue monument: saturated enough to reject white snow / dark sky
    m = (bright > 140) & (sat > 12) & (B > 150)
    return np.asarray(im), m

def despeckle(m, iters=3):
    # erode then dilate (3x3) via shifts to drop isolated snow specks
    for _ in range(iters):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                n &= np.roll(np.roll(m, dy, 0), dx, 1)
        m = n
    for _ in range(iters):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                n |= np.roll(np.roll(m, dy, 0), dx, 1)
        m = n
    return m

out = sys.argv[1]
rest = sys.argv[2:]
crop = None
if len(rest) >= 4 and all(re.fullmatch(r'\d+', a) for a in rest[-4:]):
    crop = tuple(map(int, rest[-4:]))
    rest = rest[:-4]
names = rest[:8]

frames = [load(n) for n in names]
masks = [despeckle(m) for _, m in frames]
static = np.ones_like(masks[0])
for m in masks:
    static &= m

H, W = static.shape

def rotor_of(m):
    rotor = m & ~static
    rotor[:, 425:] = False  # drop crank wheel
    sup = np.zeros_like(rotor, dtype=np.int16)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            sup += np.roll(np.roll(rotor, dy, 0), dx, 1)
    return rotor & (sup > 14)

x0, y0, x1, y1 = crop if crop else (0, 0, W, H)
ch, cw = y1 - y0, x1 - x0
panels = []
for i, ((_, m), name) in enumerate(zip(frames, names)):
    panel = np.zeros((H, W, 3), dtype=np.uint8)
    panel[static] = (60, 60, 72)
    panel[rotor_of(m)] = (90, 220, 255)
    panels.append(panel[y0:y1, x0:x1])
strip = np.concatenate(panels, axis=1)
Image.fromarray(strip).save(out)
print('saved', out, strip.shape, 'frames:', names)
