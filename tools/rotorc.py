# Per-frame L-corner fit in a tight sky ROI (no ground/Ida/static contamination).
# For candidate corner C: angle histogram of arm pixels -> two peaks 65..115 deg
# apart; score counts. Coarse grid + local refinement; robust line fit per lobe.
import numpy as np
from PIL import Image, ImageDraw
from rotorx import NAMES, rotors, H, W

# tight ROI around the in-air arm (sky only); f005 long tip reaches x~515
RX0, RY0, RX1, RY1 = 235, 500, 525, 705

def arm_mask(i):
    m = np.zeros((H, W), bool)
    m[RY0:RY1, RX0:RX1] = rotors[i][RY0:RY1, RX0:RX1]
    # drop residual crank/axle bits right of pillar
    m &= ~((xx_ > 408) & (yy_ > 632))
    return m

yy_, xx_ = np.indices((H, W))

def corner_fit(i, verbose=False):
    m = arm_mask(i)
    ys, xs = np.where(m)
    if len(xs) < 60:
        return None
    P = np.c_[xs, ys].astype(float)

    def peaks_for(C):
        dx, dy = P[:, 0] - C[0], P[:, 1] - C[1]
        rad = np.hypot(dx, dy)
        kp = (rad > 22) & (rad < 170)
        ang = (np.degrees(np.arctan2(dy[kp], dx[kp])) + 360) % 360
        hist, _ = np.histogram(ang, bins=144, range=(0, 360))
        hs = np.convolve(hist, np.ones(5) / 5, mode='same')
        order = np.argsort(hs)[::-1]
        pks = []
        for b in order:
            a = b * 2.5 + 1.25
            if all(abs(((a - a2 + 180) % 360) - 180) > 30 for a2, _ in pks):
                pks.append((a, hs[b]))
            if len(pks) == 6:
                break
        return pks, ang, kp, dx, dy

    def score(C):
        pks, ang, kp, dx, dy = peaks_for(C)
        best = None
        for j in range(len(pks)):
            for k in range(j + 1, len(pks)):
                a1, h1 = pks[j]; a2, h2 = pks[k]
                sep = abs(((a1 - a2 + 180) % 360) - 180)
                if 60 < sep < 120:
                    s = h1 + h2 - 0.15 * abs(sep - 90)
                    if best is None or s > best[0]:
                        best = (s, a1, a2)
        return best

    best = None
    for cx in range(360, 452, 6):
        for cy in range(600, 690, 6):
            sc = score((cx, cy))
            if sc and (best is None or sc[0] > best[0]):
                best = (sc[0], cx, cy, sc[1], sc[2])
    _, cx, cy, a1, a2 = best
    # local refine
    for step in (3, 1):
        improved = True
        while improved:
            improved = False
            for ddx in (-step, 0, step):
                for ddy in (-step, 0, step):
                    if ddx == 0 and ddy == 0:
                        continue
                    sc = score((cx + ddx, cy + ddy))
                    if sc and sc[0] > best[0] + 1e-9:
                        best = (sc[0], cx + ddx, cy + ddy, sc[1], sc[2])
                        cx, cy, a1, a2 = cx + ddx, cy + ddy, sc[1], sc[2]
                        improved = True
    C = np.array([cx, cy], float)
    # robust lobe lines: pixels within +-11deg of each ray, fit PCA, intersect
    pks, ang, kp, dxall, dyall = peaks_for(C)
    rr = np.hypot(dxall, dyall)
    lines = []
    for a in (a1, a2):
        sel = kp & (np.abs(((np.degrees(np.arctan2(dyall, dxall)) + 360) % 360 - a + 180) % 360 - 180) < 11)
        X = P[sel]
        mu = X.mean(0)
        w, v = np.linalg.eigh(np.cov((X - mu).T))
        d = v[:, -1]
        sgn = np.sign(np.cos(np.radians(a)) * d[0] + np.sin(np.radians(a)) * d[1])
        if sgn == 0: sgn = 1
        d = d * sgn
        ts = (X - mu) @ d
        tip = mu + d * np.percentile(ts, 97)
        # line through mu,d ; store
        lines.append((mu, d, tip, sel.sum(), np.hypot(*(tip - C))))
    m1, d1, t1, n1, l1 = lines[0]
    m2, d2, t2, n2, l2 = lines[1]
    A = np.array([[d1[0], -d2[0]], [d1[1], -d2[1]]])
    bb = m2 - m1
    t = np.linalg.solve(A, bb)
    Cint = m1 + d1 * t[0]
    if verbose:
        print(NAMES[i], 'gridC', (cx, cy), 'intersect C', np.round(Cint, 1),
              'rays', np.round((a1, a2), 1),
              'tips', np.round(np.c_[t1, t2].T, 1).tolist(),
              'tipR', np.round((l1, l2), 1), 'n', (n1, n2))
    return Cint, (a1, a2), (t1, t2), (l1, l2), m

for i in range(len(NAMES)):
    try:
        corner_fit(i, verbose=True)
    except Exception as e:
        print(NAMES[i], 'FAIL', e)

# overlay for the informative frames
SC = 3
panels = []
for i in range(len(NAMES)):
    im = Image.open('frames/' + NAMES[i]).convert('RGBA')
    fit = None
    try:
        fit = corner_fit(i)
    except Exception:
        pass
    dr = ImageDraw.Draw(im)
    if fit:
        C, rays, tips, lens, mm = fit
        dr.ellipse([C[0] - 6, C[1] - 6, C[0] + 6, C[1] + 6], outline=(255, 255, 0), width=2)
        for tp in tips:
            dr.line([C[0], C[1], tp[0], tp[1]], fill=(255, 40, 40, 255), width=2)
    dr.rectangle([RX0, RY0, RX1, RY1], outline=(90, 255, 90, 180))
    crop = im.crop((RX0 - 30, RY0 - 30, RX1 + 30, RY1 + 60)).resize(
        ((RX1 - RX0 + 60) * SC, (RY1 - RY0 + 90) * SC), Image.NEAREST)
    panels.append(crop)
strip = Image.new('RGBA', (panels[0].width * 4, panels[0].height * 2), (0, 0, 0, 255))
for i, p in enumerate(panels):
    strip.paste(p, ((i % 4) * p.width, (i // 4) * p.height))
strip.convert('RGB').save('shots/cmp/rotorc.png')
print('saved shots/cmp/rotorc.png')
