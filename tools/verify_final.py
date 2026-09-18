# Seam-safe final verification for near-vertical finalists (idx 195..235).
# cross_interp now REJECTS antipodal crossings (interp az within 30 deg of
# target+180). Re-verify all mask constraints, then emit final params.
import json
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); Y = np.array([0., 1., 0.])
V = np.array([-.499, .566, .656])
La, K, N_TH = 0.99, 154., 11520
th = np.linspace(0, 2 * np.pi, N_TH, endpoint=False)
c, s = np.cos(th), np.sin(th)

def azv_of(P): return np.degrees(np.arctan2(-(P @ u), P @ r)) % 360

def cross_true(n, target, valv=None):
    """seam-safe crossings of screen az `target` for the long-arm circle of n"""
    nY = n @ Y; CR = np.cross(n, Y)
    P = La * (c[:, None] * Y[None, :] + s[:, None] * CR[None, :] + (1 - c)[:, None] * (n * nY)[None, :])
    azv = azv_of(P)
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
        t = th[i] + w * (th[j] - th[i])
        # reject antipodal: interp az must be near target
        az_i = azv[i] + w * (((azv[j] - azv[i] + 180) % 360) - 180)
        if abs(((az_i - target + 180) % 360) - 180) > 30:
            continue
        out.append((t, pxv[i] + w * (pxv[j] - pxv[i])))
    return out

def Rod(n, t, d):
    return d * np.cos(t) + np.cross(n, d) * np.sin(t) + n * np.dot(n, d) * (1 - np.cos(t))

CONS = [(160.8, 94., 122.), (343.8, 110., None), (340.6, 112., None),
        (187.4, 100., None), (288.7, 65., None)]
axes = json.load(open('tools/axes3.json'))['axes']
good = []
for idx in range(190, 240):
    n = np.array(axes[idx]); n /= np.linalg.norm(n)
    viol, info = 0., {}
    for ta, lo, hi in CONS:
        cx = cross_true(n, ta)
        if not cx:
            viol += 30; continue
        best = min(cx, key=lambda x: max(lo - x[1], 0.) + (max(x[1] - hi, 0.) if hi else 0.))
        viol += max(lo - best[1], 0.) + (max(best[1] - hi, 0.) if hi else 0.)
        info[ta] = (round(best[0] * 57.2958, 1), round(best[1], 1))
    # dock-short TRUE branches
    br = []
    for t, p in cross_true(n, 105.6):
        proj_u = p / (La * K)           # unit-dir proj
        Lb = 57.1 / (K * proj_u)
        if 0.30 <= Lb <= 0.62 and all(abs(t - t0) > 0.05 for t0, _, _ in br):
            br.append((t, Lb, Rod(n, t, Y)))
    if viol > 0.5 or not br:
        continue
    good.append((idx, n, viol, info, br))

print('seam-safe survivors in window:', [g[0] for g in good])
for idx, n, viol, info, br in good:
    print('idx %d viol %.2f f3 %s s1 %s s2 %s s3 %s s4 %s branches %s'
          % (idx, viol, info[160.8], info[343.8], info[340.6], info[187.4], info[288.7],
             [('th%.0f' % (t * 57.2958), 'Lb%.3f' % L, 'az%.1f' % (np.degrees(np.arctan2(-(u @ d), r @ d)) % 360))
              for t, L, d in br]))
