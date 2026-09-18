# Final candidates: family B (near-vertical axes) with BOTH dock-short
# branches evaluated consistently. Output tools/cand4.json for browser
# hiding check. Sim = |S-az at f3 valid crossing - 120.2|.
import json
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); Y = np.array([0., 1., 0.])
La, K, N_TH = 0.99, 154., 11520
th = np.linspace(0, 2 * np.pi, N_TH, endpoint=False)
c, s = np.cos(th), np.sin(th)

def Rodv(n, d, t):
    return d[None, :] * c[:, None] + np.cross(n, d)[None, :] * s[:, None] + n[None, :] * (n @ d) * (1 - c)[:, None]

def azOf(P): return np.degrees(np.arctan2(-(P @ u), P @ r)) % 360
def pxOf(P): return La * K * np.hypot(P @ r, P @ u)

def cross_interp(target, azv, valv):
    dd = (azv - target + 180) % 360 - 180
    idxs = np.where(np.diff(np.sign(dd)) != 0)[0]
    out = []
    for i in idxs:
        j = (i + 1) % N_TH
        d1 = -dd[j] if dd[j] == 0 else dd[j]
        if d1 == dd[i]:
            continue
        w = dd[i] / (dd[i] - d1)
        out.append((th[i] + w * (th[j] - th[i]), valv[i] + w * (valv[j] - valv[i])))
    return out

axes = json.load(open('tools/axes3.json'))['axes']
cands = []
for idx in list(range(190, 240)):
    n = np.array(axes[idx]); nY = n @ Y; CR = np.cross(n, Y)
    P = La * (c[:, None] * Y[None, :] + s[:, None] * CR[None, :] + (1 - c)[:, None] * (n * nY)[None, :])
    azv, pxv = azOf(P), pxOf(P)
    projv = pxv / (La * K)
    # dock-short branches (dedup: collapse crossings closer than 0.05 rad)
    branches = []
    for t, p in cross_interp(105.6, azv, projv * K):
        Lb = 57.1 / p                     # p = 154*proj(unit dir) -> Lb = 57.1/(154*proj)
        if 0.30 <= Lb <= 0.62 and all(abs(t - t0) > 0.05 for t0, _, _ in branches):
            b0d = Y * np.cos(t) + CR * np.sin(t) + n * nY * (1 - np.cos(t))
            branches.append((t, Lb, b0d))
    for t, Lb, b0d in branches:
        # short arm poses along its own circle
        CRb = np.cross(n, b0d); nb = n * (n @ b0d)
        BP = (np.cos(th)[:, None] * b0d[None, :] + np.sin(th)[:, None] * CRb[None, :]
              + (1 - np.cos(th))[:, None] * nb[None, :])
        Baz = azOf(BP); Bpx = K * Lb * np.hypot(BP @ r, BP @ u)
        sim = None
        for tf, pxf in cross_interp(160.8, azv, pxv):
            if not (94 <= pxf <= 122):
                continue
            i = int(round(tf / (2 * np.pi) * N_TH)) % N_TH
            err = abs(Baz[i] - 120.2)
            if sim is None or err < sim[0]:
                sim = (err, pxf, Baz[i], Bpx[i])
        if sim is None:
            continue
        cands.append({'idx': idx, 'n': n.tolist(), 'Lb': round(Lb, 3),
                      'b0d': b0d.tolist(), 'simErr': round(float(sim[0]), 2),
                      'f3longPx': round(float(sim[1]), 1),
                      'f3Saz': round(float(sim[2]), 1), 'f3Spx': round(float(sim[3]), 1)})

cands.sort(key=lambda x: x['simErr'])
for cd in cands[:16]:
    print('idx %3d n(%+.3f,%+.3f,%+.3f) Lb %.3f simErr %.2f  f3: long %s Saz %s Spx %s'
          % (cd['idx'], *cd['n'], cd['Lb'], cd['simErr'], cd['f3longPx'], cd['f3Saz'], cd['f3Spx']))
json.dump(cands[:12], open('tools/cand4.json', 'w'))
print('wrote tools/cand4.json (%d)' % min(12, len(cands)))
