# Fresh rotor extraction + per-component PCA + annotated overlay.
# static = AND of despeckled structure masks; rotor(t) = mask(t) & ~static,
# wheel/Ida/snow dropped; components -> centroid/PCA axis/extents.
import sys
import numpy as np
from PIL import Image, ImageDraw

NAMES = ['f_001.png', 'f_005.png', 'f_008.png', 'f_010.png', 'f_012.png', 'f_014.png', 'f_015.png']

def load(name):
    a = np.asarray(Image.open('frames/' + name).convert('RGB')).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    bright = (R + G + B) / 3.0
    m = (bright > 140) & ((B - R) > 12) & (B > 150)
    return m

def morph(m, k, erode_first):
    for _ in range(k):
        n = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    s = np.roll(np.roll(m, dy, 0), dx, 1)
                    n = n & s if erode_first else n | s
        m = n
    return m

def despeckle(m, er=2, di=2):
    m = morph(m, er, True)
    m = morph(m, di, False)
    return m

masks = [despeckle(load(n)) for n in NAMES]
H, W = masks[0].shape
static = np.ones_like(masks[0])
for m in masks:
    static &= m

yy, xx = np.indices((H, W))
hub = (447.0, 700.0)

def rotor_of(m):
    r = m & ~static
    r &= np.hypot(xx - hub[0], yy - hub[1]) > 60          # drop wheel
    r &= ~((xx > 405) & (yy > 640) & (yy < 800))         # hub sphere + axle
    # Ida: dark dress not in icy mask anyway; her skin/hair blobs small -> area filter
    return r

def components(r, minpx=120):
    # label via BFS (frames small, region bounded)
    lab = -np.ones(r.shape, np.int32)
    nxt = 0
    out = []
    ys, xs = np.where(r)
    pts = set(zip(ys.tolist(), xs.tolist()))
    seen = set()
    for s in pts:
        if s in seen:
            continue
        q = [s]; seen.add(s); comp = []
        while q:
            y, x = q.pop(); comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    p = (y + dy, x + dx)
                    if p in pts and p not in seen:
                        seen.add(p); q.append(p)
        if len(comp) >= minpx:
            out.append(comp)
    return out

rotors = []
for i, m in enumerate(masks):
    r = rotor_of(m)
    # support filter: drop thin specks
    sup = np.zeros_like(r, np.int16)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            sup += np.roll(np.roll(r, dy, 0), dx, 1)
    r &= sup > 8
    rotors.append(r)

def pca(comp):
    A = np.array(comp, dtype=float)
    mu = A.mean(0)
    cov = np.cov((A - mu).T)
    w, v = np.linalg.eigh(cov)
    d = v[:, -1]
    proj = (A - mu) @ d
    perp = (A - mu) @ v[:, 0]
    # azimuth in screen x-right/y-down
    az = np.degrees(np.arctan2(d[0], d[1]))  # angle from screen +x? use atan2(dy,dx)
    ang = np.degrees(np.arctan2(d[0], d[1])) % 360
    return mu, d, proj.min(), proj.max(), perp.min(), perp.max(), ang, len(comp)

print('hub', hub)
for i, r in enumerate(rotors):
    comps = components(r)
    comps.sort(key=lambda c: -len(c))
    print('--', NAMES[i], ' components:', len(comps))
    for c in comps[:8]:
        mu, d, p0, p1, q0, q1, ang, npx = pca(c)
        print('   n %5d centroid (%6.1f,%6.1f) ang %5.1f len %6.1f width %5.1f'
              % (npx, mu[1], mu[0], ang, p1 - p0, q1 - q0))

# ---------- annotated composite ----------
SC = 2
panel_w, panel_h = W * SC, H * SC
strip = Image.new('RGB', (panel_w * len(NAMES), panel_h), (10, 10, 14))
dr = ImageDraw.Draw(strip)
COL = [(255, 90, 90), (255, 180, 40), (255, 255, 90), (110, 255, 140),
       (80, 200, 255), (190, 120, 255), (255, 110, 220)]
for i, (r, name) in enumerate(zip(rotors, NAMES)):
    ox = i * panel_w
    ys, xs = np.where(r)
    for x, y in zip(xs[::2], ys[::2]):
        dr.rectangle([ox + x * SC, y * SC, ox + x * SC + SC - 1, y * SC + SC - 1], fill=COL[i])
    # grid
    for gx in range(0, W, 50):
        dr.line([ox + gx * SC, 0, ox + gx * SC, panel_h], fill=(40, 40, 52))
        dr.text((ox + gx * SC + 2, 4), str(gx), fill=(120, 130, 150))
    for gy in range(0, H, 50):
        dr.line([ox, gy * SC, ox + panel_w, gy * SC], fill=(40, 40, 52))
        dr.text((ox + 2, gy * SC + 2), str(gy), fill=(120, 130, 150))
    dr.text((ox + 8, 24), name, fill=(255, 255, 255))
    # hub marker
    dr.ellipse([ox + hub[0] * SC - 6, hub[1] * SC - 6, ox + hub[0] * SC + 6, hub[1] * SC + 6],
               outline=(255, 255, 255))
strip.crop((0, 900, strip.width, 1700)).save('shots/cmp/rotorx.png')
print('saved shots/cmp/rotorx.png')
