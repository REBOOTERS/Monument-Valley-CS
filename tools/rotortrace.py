# Trace rotor leg rays across ALL frames (f_001..f_039) with fixed Q.
# static = AND over the 7 calibration frames; per frame: arm-only mask,
# angle-histogram peaks -> (az, r96, count). Output table for 3D fit.
import glob
import os
import re
import numpy as np
from rotorx import rotors, static, H, W   # rotors[i] correspond to NAMES

NAMES = ['f_%03d.png' % k for k in range(1, 40)]
FILES = [os.path.basename(p) for p in sorted(glob.glob('frames/f_*.png'))]

def load(name):
    from PIL import Image
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

Q = np.array([377.0, 644.0])
yy, xx = np.indices((H, W))
rad = np.hypot(xx - Q[0], yy - Q[1])
angAll = (np.degrees(np.arctan2(yy - Q[1], xx - Q[0])) + 360) % 360

def arm_only(m):
    r = m & ~static
    r &= (xx > 230) & (xx < 520) & (yy > 540) & (yy < 700)
    r &= rad > 16
    r &= ~((xx > 405) & (yy > 630))            # crank hub/axle
    r &= ~(yy < 500 + 0.30 * (xx - 150))       # top beam zone
    sup = np.zeros_like(r, np.int16)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            sup += np.roll(np.roll(r, dy, 0), dx, 1)
    return r & (sup > 7)

# pillar-edge artifact band: az 205..222 & r 40..100 constant across frames
def peaks(m, minsep=40):
    a = angAll[m]; rr = rad[m]
    hist, _ = np.histogram(a, bins=180, range=(0, 360))
    hs = np.convolve(hist, np.ones(5) / 5, mode='same')
    order = np.argsort(hs)[::-1]
    out = []
    for b in order:
        az = b * 2 + 1
        if hs[b] < 8:
            break
        if all(abs(((az - t[0] + 180) % 360) - 180) > minsep for t in out):
            sel = np.abs(((a - az + 180) % 360) - 180) < 10
            if sel.sum() > 30:
                med = float(np.median(a[sel]))
                # tag pillar artifact: az within 206..220
                tag = 'P' if 205 < med < 223 else ''
                out.append((med, float(np.percentile(rr[sel], 96)), int(sel.sum()), tag))
        if len(out) == 4:
            break
    return sorted(out, key=lambda t: -t[2])

rows = []
for name in FILES:
    m = morph(load(name), 2, True)
    m = morph(m, 2, False)
    pk = peaks(arm_only(m))
    rows.append((name, pk))
    print(name, [(round(a, 1), round(r, 1), c, tg) for a, r, c, tg in pk[:3]])

np.save('tools/rotortrace.npy', np.array([(i, a, r) for i, (n, pk) in enumerate(rows)
                                          for a, r, c, tg in pk], dtype=float))
print('saved tools/rotortrace.npy')
