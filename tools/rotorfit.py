# Clean rotor extraction + screen geometry fit.
# presence count across frames; static=cnt>=5, rotor(t)=mask(t) & cnt<=3.
# V-vertex C from PCA of f_008 two lobes; per-frame lobe centroid angles/extents.
import numpy as np
from PIL import Image

NAMES = ['f_001.png', 'f_005.png', 'f_008.png', 'f_010.png', 'f_012.png', 'f_014.png', 'f_015.png']

def load(name):
    a = np.asarray(Image.open('frames/' + name).convert('RGB')).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    bright = (R + G + B) / 3.0
    m = (bright > 140) & ((B - R) > 12) & (B > 150)
    return m

def erode(m, k):
    for _ in range(k):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    n &= np.roll(np.roll(m, dy, 0), dx, 1)
        m = n
    return m

def dilate(m, k):
    for _ in range(k):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    n |= np.roll(np.roll(m, dy, 0), dx, 1)
        m = n
    return m

masks = [load(n) for n in NAMES]
cnt = sum(m.astype(np.int16) for m in masks)
H, W = cnt.shape
yy, xx = np.indices((H, W))
hub = (452.0, 706.0)

def rotor_of(i):
    m = masks[i]
    r = m & (cnt <= 2)
    r &= np.hypot(xx - hub[0], yy - hub[1]) > 74     # drop wheel
    r &= (xx > 225) & (xx < 460) & (yy > 540) & (yy < 870)
    r &= ~((xx < 258) & (yy < 740))                  # arcade piers
    sup = np.zeros_like(r, np.int16)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            sup += np.roll(np.roll(r, dy, 0), dx, 1)
    return r & (sup > 13)

rotors = [rotor_of(i) for i in range(len(NAMES))]

def line_intersect(p1, d1, p2, d2):
    # p + t d ; solve
    A = np.array([[d1[0], -d2[0]], [d1[1], -d2[1]]])
    b = np.array([p2[0] - p1[0], p2[1] - p1[1]])
    t = np.linalg.solve(A, b)
    return np.array([p1[0] + t[0] * d1[0], p1[1] + t[0] * d1[1]])

# f_008 = index 2: two lobes about rough C0
C0 = np.array([378.0, 688.0])
r8 = rotors[2]
ys, xs = np.where(r8)
dx, dy = xs - C0[0], ys - C0[1]
ang = np.degrees(np.arctan2(dy, dx))
lobeA = (ang > -90) & (ang < -10)     # up-right blade
lobeB = (ang > 120) & (ang < 200)     # down-left blade
def pca_axis(sel):
    X = np.c_[xs[sel], ys[sel]].astype(float)
    mu = X.mean(0)
    cov = np.cov((X - mu).T)
    w, v = np.linalg.eigh(cov)
    d = v[:, -1]
    return mu, d / np.hypot(*d)
muA, dA = pca_axis(lobeA)
muB, dB = pca_axis(lobeB)
C = line_intersect(muA, dA, muB, dB)
print('f008 lobe A mean-angle dir', dA, ' B', dB)
print('corner C =', C)

def lobe_report(i, C):
    r = rotors[i]
    ys, xs = np.where(r)
    dx, dy = xs - C[0], ys - C[1]
    rad = np.hypot(dx, dy)
    ang = (np.degrees(np.arctan2(dy, dx)) + 360) % 360
    keep = (rad > 20) & (rad < 210)
    ang, rad, dx, dy = ang[keep], rad[keep], dx[keep], dy[keep]
    hist, edges = np.histogram(ang, bins=72, range=(0, 360))
    # smooth
    hs = np.convolve(hist, np.ones(3) / 3, mode='same')
    pk = []
    for b in range(72):
        if hs[b] > 12 and hs[b] >= hs[(b - 1) % 72] and hs[b] >= hs[(b + 1) % 72]:
            a0 = edges[b]
            sel = np.abs(((ang - a0 + 180) % 360) - 180) < 18
            if sel.sum():
                # extent along principal direction of this lobe
                ux, uy = np.cos(np.radians(np.median(ang[sel]))), np.sin(np.radians(np.median(ang[sel])))
                proj = dx[sel] * ux + dy[sel] * uy
                pk.append((a0, hs[b], proj.max(), proj.min(), sel.sum(),
                           np.median(ang[sel])))
    print(f'-- {NAMES[i]}')
    for a, h, pmax, pmin, n, med in sorted(pk, key=lambda t: -t[4]):
        print('   centerAng %5.1f n %4d alongMax %6.1f alongMin %6.1f medianAng %5.1f'
              % (a, n, pmax, pmin, med))

for i in range(len(NAMES)):
    lobe_report(i, C)

# annotate
out = np.zeros((H, W, 3), np.uint8)
out[cnt >= 5] = (45, 45, 55)
col = [(255, 80, 80), (255, 160, 0), (255, 255, 80), (120, 255, 120),
       (90, 200, 255), (180, 120, 255), (255, 120, 220)]
for r, c in zip(rotors, col):
    out[r] = c
for dxx in range(-4, 5):
    for dyy in range(-4, 5):
        out[int(C[1]) + dyy, int(C[0]) + dxx] = (255, 255, 255)
Image.fromarray(out[520:880, 200:470]).resize((810, 1080), Image.NEAREST).save('shots/cmp/fit.png')
print('saved shots/cmp/fit.png')
