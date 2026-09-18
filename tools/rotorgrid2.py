# Axis grid v2 — EXACT crossing interpolation (no az-window slop).
# For each axis n: orbit = circle ⊥ n, radius La=0.99 about Q.
# Constraint set (px = projected length AT the exact az crossing):
#   f3   az 160.8 : one crossing with px in [94,122]
#   s1   az 343.8 : crossing px >= 110
#   s2   az 340.6 : crossing px >= 112
#   s3   az 187.4 : crossing px >= 100
#   s4   az 288.7 : crossing px >= 65
#   sd   az 105.6 : crossing px >= 53 AND implied Lb = px/(154*proj) in [0.32,0.55]
# Output: strict survivors sorted by margin, tools/axes2.json
import json
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755])
La, K = 0.99, 154.
N_TH = 2880
th = np.linspace(0, 2 * np.pi, N_TH, endpoint=False)

def basis_batch(n):
    e1 = np.cross(n, [0, 0, 1.0])
    ln = np.linalg.norm(e1, axis=1, keepdims=True)
    e1 = np.where(ln < 1e-6, np.cross(n, [0, 1.0, 0]), e1)
    e1 /= np.linalg.norm(e1, axis=1, keepdims=True)
    return e1, np.cross(n, e1)

def gen_grid(deg):
    pts = []
    for pole in np.arange(0, 180.0, deg):
        for azg in np.arange(0, 360.0, deg):
            p, a = np.radians(pole), np.radians(azg)
            pts.append([np.sin(p) * np.cos(a), np.sin(p) * np.sin(a), np.cos(p)])
    return np.unique(np.round(np.array(pts), 6), axis=0)

def crossings_for(azseq, pxseq, target):
    """exact linear-interp px at wrapped-az crossings of target; per orbit every
    az is hit exactly twice (return up to 2 interpolated px values)."""
    d = (azseq - target + 180) % 360 - 180
    out = []
    idx = np.where(np.diff(np.sign(d)) != 0)[0]
    for i in idx:
        j = (i + 1) % N_TH
        d0, d1 = d[i], -d[j] if d[j] == 0 else d[j]
        if d1 == d0:
            continue
        w = d0 / (d0 - d1)
        out.append(pxseq[i] + w * (pxseq[j] - pxseq[i]))
    return out[:4]

grid = gen_grid(4.0)
e1, e2 = basis_batch(grid)
P = La * (th[None, :, None] * 0 + np.cos(th)[None, :, None] * e1[:, None, :]
          + np.sin(th)[None, :, None] * e2[:, None, :])
px = K * np.hypot(P @ r, P @ u)
az = np.degrees(np.arctan2(-(P @ u), P @ r)) % 360
proj = np.hypot(P @ r, P @ u)

CONS = [(160.8, 94., 122.), (343.8, 110., None), (340.6, 112., None),
        (187.4, 100., None), (288.7, 65., None)]

survivors = []
for i in range(len(grid)):
    viol, info = 0., {}
    for (ta, lo, hi) in CONS:
        cx = crossings_for(az[i], px[i], ta)
        if not cx:
            viol += 30; info[ta] = None; continue
        best = min(cx, key=lambda p: max(lo - p, 0.) + (max(p - hi, 0.) if hi else 0.))
        viol += max(lo - best, 0.) + (max(best - hi, 0.) if hi else 0.)
        info[ta] = round(float(best), 1)
    # dock short: need a crossing with px>=53 and Lb in range
    sdbest = None
    for p0 in crossings_for(az[i], px[i], 105.6):
        # recover proj at that crossing: px = La*154*proj -> but Lb needs SHORT-arm proj.
        # the crossing direction is the same physical direction; short arm uses same
        # direction with its own length: Lb = px_obs/(154*proj). Store proj too.
        pass
    # recompute with proj sequence
    cs = crossings_for(az[i], proj[i] * 154, 105.6)   # px if length were La
    for pc in cs:
        proj_c = pc / (La * 154)
        Lb = 57.1 / (154 * proj_c)          # obs 57.1 lower bound -> Lb lower bound
        if 0.32 <= Lb <= 0.55:
            sdbest = (round(proj_c, 3), round(Lb, 3))
            break
    if sdbest is None:
        viol += 30
    if viol < 0.5:
        survivors.append((round(float(viol), 3), grid[i].tolist(), info, sdbest))

survivors.sort(key=lambda t: t[0])
print('strict survivors:', len(survivors))
V = np.array([-.499, .566, .656])
for sc, n, info, sd in survivors[:20]:
    print('viol %.2f n(%+.3f,%+.3f,%+.3f) tiltV %4.1f f3 %s s1 %s s2 %s s3 %s s4 %s sd(proj,Lb) %s'
          % (sc, n[0], n[1], n[2],
             np.degrees(np.arccos(np.clip(abs(np.array(n) @ V), -1, 1))),
             info[160.8], info[343.8], info[340.6], info[187.4], info[288.7], sd))
json.dump({'axes': [s[1] for s in survivors]}, open('tools/axes2.json', 'w'))
print('wrote tools/axes2.json')
