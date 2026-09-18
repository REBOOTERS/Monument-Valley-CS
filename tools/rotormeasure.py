# Measure the rotating L-arm in reference frames.
# static = AND of structure masks; rotor(t) = mask(t)-static, wheel disk + Ida removed.
# Find shared corner Q (rotor pixels present in ALL frames), then per frame angular
# rays from Q -> two legs: angle / extent / tip.
import sys
import numpy as np
from PIL import Image

NAMES = ['f_001.png', 'f_005.png', 'f_008.png', 'f_010.png', 'f_012.png', 'f_014.png', 'f_015.png']

def load(name):
    a = np.asarray(Image.open('frames/' + name).convert('RGB')).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    bright = (R + G + B) / 3.0
    m = (bright > 140) & ((B - R) > 12) & (B > 150)
    return m

def despeckle(m, it=2):
    for _ in range(it):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    n &= np.roll(np.roll(m, dy, 0), dx, 1)
        m = n
    for _ in range(it):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    n |= np.roll(np.roll(m, dy, 0), dx, 1)
        m = n
    return m

masks = [despeckle(load(n)) for n in NAMES]
H, W = masks[0].shape
static = np.ones_like(masks[0])
for m in masks:
    static &= m

# wheel hub: static blob in x>430, y 620..780 (hub sphere is always there)
ys, xs = np.where(static & (np.indices(static.shape)[1] > 430)
                  & (np.indices(static.shape)[0] > 620) & (np.indices(static.shape)[0] < 780))
hub = (float(np.median(xs)), float(np.median(ys)))
print('hub ~', hub)

yy, xx = np.indices(static.shape)
rotors = []
for m in masks:
    r = m & ~static
    d = np.hypot(xx - hub[0], yy - hub[1])
    r &= d > 72                      # drop wheel + spokes
    r &= xx < 452                    # arm never far right of pillar face
    # drop Ida: tiny support blobs
    sup = np.zeros_like(r, np.int16)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            sup += np.roll(np.roll(r, dy, 0), dx, 1)
    r &= sup > 16
    rotors.append(r)

# Q = pixels that are rotor in every frame (the fixed mount/corner)
qmask = np.ones_like(static)
for r in rotors:
    qmask &= r
ys, xs = np.where(qmask)
print('shared rotor px:', len(xs))
if len(xs):
    Q = (float(np.median(xs)), float(np.median(ys)))
else:
    Q = (400, 640)
print('Q ~', Q)

def rays(r, Q, tag):
    ys, xs = np.where(r)
    dx = xs - Q[0]
    dy = ys - Q[1]
    rad = np.hypot(dx, dy)
    ang = (np.degrees(np.arctan2(dy, dx)) + 360) % 360  # screen x-right, y-down
    keep = rad > 18
    ang, rad = ang[keep], rad[keep]
    # extent per 6deg bin
    bins = np.arange(0, 361, 6)
    ext = np.zeros(len(bins) - 1)
    tipxy = [None] * (len(bins) - 1)
    for a, rr in zip(ang, rad):
        i = min(int(a // 6), len(ext) - 1)
        if rr > ext[i]:
            ext[i] = rr
    # dilate ext over neighbours to bridge gaps, then find peaks
    ext2 = ext.copy()
    for _ in range(2):
        ext2 = np.maximum(ext2, np.r_[ext2[1:], 0])
        ext2 = np.maximum(ext2, np.r_[0, ext2[:-1]])
    peaks = []
    for i in range(len(ext)):
        if ext[i] > 45 and ext[i] >= ext2[i] - 1:
            peaks.append((bins[i] + 3, ext[i]))
    # merge nearby peaks
    merged = []
    for a, e in sorted(peaks, key=lambda t: -t[1]):
        if all(abs(((a - ma + 180) % 360) - 180) > 15 for ma, _ in merged):
            merged.append((a, e))
    print(f'-- {tag}: legs(angle deg screen-x-right/y-down, extent px)')
    for a, e in merged[:4]:
        ar = np.radians(a)
        print('   ang %6.1f  ext %5.1f  tip (%d,%d)' %
              (a, e, int(Q[0] + e * np.cos(ar)), int(Q[1] + e * np.sin(ar))))
    return merged

for n, r in zip(NAMES, rotors):
    rays(r, Q, n)

# debug overlay
out = np.zeros((H, W, 3), np.uint8)
out[static] = (50, 50, 60)
col = [(255,80,80),(255,160,0),(255,255,80),(120,255,120),(90,200,255),(180,120,255),(255,120,220)]
for r, c in zip(rotors, col):
    out[r] = c
Image.fromarray(out[460:940, 140:470]).resize((660, 960), Image.NEAREST).save('shots/cmp/meas.png')
print('overlay shots/cmp/meas.png')
