# f3-simultaneity ranking over the seam-safe axes4 survivors.
import json
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); Y = np.array([0., 1., 0.])
V = np.array([-.499, .566, .656])
La, K, N_TH = 0.99, 154., 11520
th = np.linspace(0, 2 * np.pi, N_TH, endpoint=False)
c, s = np.cos(th), np.sin(th)

def Rod(n, t, d):
    return d * np.cos(t) + np.cross(n, d) * np.sin(t) + n * np.dot(n, d) * (1 - np.cos(t))

def circle(n):
    nY = n @ Y; CR = np.cross(n, Y)
    return (La * (c[:, None] * Y[None, :] + s[:, None] * CR[None, :]
                  + (1 - c)[:, None] * (n * nY)[None, :]))

def cross_true(P, target, valv=None):
    azv = np.degrees(np.arctan2(-(P @ u), P @ r)) % 360
    pxv = La * K * np.hypot(P @ r, P @ u) if valv is None else valv
    dd = (azv - target + 180) % 360 - 180
    idxs = np.where(np.diff(np.sign(dd)) != 0)[0]
    out = []
    for i in idxs:
        j = (i + 1) % N_TH
        d1 = -dd[j] if dd[j] == 0 else dd[j]
        if d1 == dd[i]:
            continue
        w = dd[i] / (dd[i] - d1)
        az_i = azv[i] + w * (((azv[j] - azv[i] + 180) % 360) - 180)
        if abs(((az_i - target + 180) % 360) - 180) > 30:
            continue
        out.append((th[i] + w * (th[j] - th[i]), pxv[i] + w * (pxv[j] - pxv[i])))
    return out

axes = json.load(open('tools/axes4.json'))['axes']
rows = []
for idx, nv in enumerate(axes):
    n = np.array(nv); n /= np.linalg.norm(n)
    P = circle(n)
    sd = cross_true(P, 105.6)
    bd = None
    for t, p in sd:
        proj_u = p / (La * K)
        Lb = 57.1 / (K * proj_u)
        if 0.30 <= Lb <= 0.60:
            bd = (t, Lb)
    if bd is None:
        continue
    tsd, Lb = bd
    b0d = Rod(n, tsd, Y)
    best = None
    for tf, pxf in cross_true(P, 160.8):
        if not (94 <= pxf <= 122):
            continue
        bp = Rod(n, tf, b0d)
        saz = np.degrees(np.arctan2(-(u @ bp), r @ bp)) % 360
        spx = Lb * K * np.hypot(r @ bp, u @ bp)
        err = abs(saz - 120.2)
        if best is None or err < best[0]:
            best = (err, pxf, saz, spx, tf)
    if best is None:
        continue
    rows.append((best[0], idx, n.copy(), Lb) + best)

rows.sort(key=lambda t2: t2[0])
print('f3-sim candidates:', len(rows))
for e, idx, n, Lb, pxf, saz, spx, tf, _t in rows[:12]:
    print('idx %2d n(%+.3f,%+.3f,%+.3f) Lb %.3f f3longPx %.0f Saz %.1f (d %+.1f) Spx %.0f f3th %.1f tiltV %.0f'
          % (idx, n[0], n[1], n[2], Lb, pxf, saz, saz - 120.2, spx, tf * 57.2958,
             np.degrees(np.arccos(abs(n @ V)))))
json.dump([{'idx': idx, 'n': n.tolist(), 'Lb': Lb} for e, idx, n, Lb, *_ in rows[:10]],
          open('tools/cand5.json', 'w'))
print('wrote tools/cand5.json')
