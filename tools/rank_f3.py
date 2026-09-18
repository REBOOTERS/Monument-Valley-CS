# Rank all grid3 survivor axes by f3-simultaneity: at the f003 instant the long
# arm crosses screen az 160.8 (px in [94,122]) and the rigid short arm must
# show az ~120.2 (px >= 55). Dock-short branch fixed by az 105.6 & Lb range.
import json
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); Y = np.array([0., 1., 0.])
V = np.array([-.499, .566, .656])
La, K, N_TH = 0.99, 154., 5760
th = np.linspace(0, 2 * np.pi, N_TH, endpoint=False)
c, s = np.cos(th), np.sin(th)

def Rod(n, thv, d):
    return d * np.cos(thv) + np.cross(n, d) * np.sin(thv) + n * np.dot(n, d) * (1 - np.cos(thv))

axes = json.load(open('tools/axes3.json'))['axes']
rows = []
for idx, nv in enumerate(axes):
    n = np.array(nv); nY = n @ Y; CR = np.cross(n, Y)
    P = La * (c[:, None] * Y[None, :] + s[:, None] * CR[None, :] + (1 - c)[:, None] * (n * nY)[None, :])
    px = K * np.hypot(P @ r, P @ u)
    az = np.degrees(np.arctan2(-(P @ u), P @ r)) % 360
    prj = np.hypot(P @ r, P @ u)

    def cross_px(target):
        dd = (az - target + 180) % 360 - 180
        idxs = np.where(np.diff(np.sign(dd)) != 0)[0]
        out = []
        for i in idxs[:6]:
            j = (i + 1) % N_TH
            d1 = -dd[j] if dd[j] == 0 else dd[j]
            if d1 == dd[i]:
                continue
            w = dd[i] / (dd[i] - d1)
            out.append((th[i] + w * (th[j] - th[i]), px[i] + w * (px[j] - px[i])))
        return out

    bd = None
    for t, p in cross_px(105.6):
        Lb = 57.1 / (K * (p / (La * K)))
        if 0.30 <= Lb <= 0.60:
            bd = (t, Lb)
    if bd is None:
        continue
    thd, Lb = bd
    b0d = Rod(n, thd, Y)
    best = None
    for t, p in cross_px(160.8):
        if not (94 <= p <= 122):
            continue
        bp = Rod(n, t, b0d)
        saz = np.degrees(np.arctan2(-(u @ bp), r @ bp)) % 360
        spx = Lb * np.hypot(r @ bp, u @ bp) * K
        err = abs(saz - 120.2)
        if best is None or err < best[0]:
            best = (err, p, saz, spx, t)
    if best is None:
        continue
    err, p, saz, spx, tf3 = best
    rows.append((err, idx, n.copy(), Lb, p, saz, spx, tf3))

rows.sort(key=lambda t: t[0])
print('candidates with f3-simultaneity:', len(rows))
for err, idx, n, Lb, p, saz, spx, tf3 in rows[:14]:
    print('idx %3d n(%+.3f,%+.3f,%+.3f) f3longPx %3.0f S-az %5.1f (d %+4.1f) S-px %2.0f Lb %.3f tiltV %2.0f f3th %5.1f'
          % (idx, n[0], n[1], n[2], p, saz, saz - 120.2, spx, Lb,
             np.degrees(np.arccos(abs(n @ V))), np.degrees(tf3)))
