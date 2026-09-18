# Axis grid v4 - seam-safe (antipodal crossings rejected)
# (Rodrigues about n with dock pose p(0)=La*+y; preserves p·n = La*n·Y, so the
# circle is offset along the axis — NOT the ⊥n circle through Q used in v2).
# Constraints (px at exact az crossings):
#   f3 az160.8 in [94,122]; s1 az343.8>=110; s2 az340.6>=112;
#   s3 az187.4>=100; s4 az288.7>=65; sd az105.6 with Lb=57.1/(154*proj) in [.32,.55]
# ±n give the same circle -> dedup.
import json
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755])
Y = np.array([0., 1., 0.])
La, K = 0.99, 154.
N_TH = 2880
th = np.linspace(0, 2 * np.pi, N_TH, endpoint=False)
c, s = np.cos(th), np.sin(th)

def gen_grid(deg):
    pts = []
    for pole in np.arange(0, 180.0, deg):
        for azg in np.arange(0, 360.0, deg):
            p, a = np.radians(pole), np.radians(azg)
            pts.append([np.sin(p) * np.cos(a), np.sin(p) * np.sin(a), np.cos(p)])
    return np.unique(np.round(np.array(pts), 6), axis=0)

grid = gen_grid(4.0)
nY = grid @ Y                                  # (A,)
CR = np.cross(grid, Y)                         # (A,3)
P = La * (c[None, :, None] * Y[None, None, :]
          + s[None, :, None] * CR[:, None, :]
          + (1 - c)[None, :, None] * (grid * nY[:, None])[:, None, :])   # (A,T,3)
px = K * np.hypot(P @ r, P @ u)
az = np.degrees(np.arctan2(-(P @ u), P @ r)) % 360
proj = np.hypot(P @ r, P @ u)

def crossings(azseq, pxseq, target, azref=None):
    dd = (azseq - target + 180) % 360 - 180
    idxs = np.where(np.diff(np.sign(dd)) != 0)[0]
    out = []
    for i in idxs:
        j = (i + 1) % N_TH
        d1 = -dd[j] if dd[j] == 0 else dd[j]
        if d1 == dd[i]:
            continue
        w = dd[i] / (dd[i] - d1)
        t = th[i] + w * (th[j] - th[i])
        if azref is not None:
            az_i = azseq[i] + w * (((azseq[j] - azseq[i] + 180) % 360) - 180)
            if abs(((az_i - target + 180) % 360) - 180) > 30:
                continue
        out.append((t, pxseq[i] + w * (pxseq[j] - pxseq[i])))
    return out[:6]

CONS = [(160.8, 94., 122.), (343.8, 110., None), (340.6, 112., None),
        (187.4, 100., None), (288.7, 65., None)]
survivors = []
for i in range(len(grid)):
    viol, info = 0., {}
    for (ta, lo, hi) in CONS:
        cx = crossings(az[i], px[i], ta, az[i])
        if not cx:
            viol += 30; info[ta] = None; continue
        best = min(cx, key=lambda q: max(lo - q[1], 0.) + (max(q[1] - hi, 0.) if hi else 0.))
        viol += max(lo - best[1], 0.) + (max(best[1] - hi, 0.) if hi else 0.)
        info[ta] = round(float(best[1]), 1)
    sdbest = None
    for pc in crossings(az[i], proj[i] * 154, 105.6, az[i]):
        pc = pc[1]
        proj_c = pc / (La * 154)
        Lb = 57.1 / (154 * proj_c)
        if 0.32 <= Lb <= 0.55:
            sdbest = (round(float(proj_c), 3), round(float(Lb), 3))
            break
    if sdbest is None:
        viol += 30
    if viol < 0.5:
        key = tuple(np.round(sorted([grid[i].tolist(), (-grid[i]).tolist()])[0], 4))
        survivors.append((round(float(viol), 3), grid[i].tolist(), info, sdbest, key))

# dedup ±n (same circle)
seen, uniq = set(), []
for sv in sorted(survivors, key=lambda t: t[0]):
    if sv[4] in seen:
        continue
    seen.add(sv[4])
    uniq.append(sv)
print('strict survivors (deduped):', len(uniq))
V = np.array([-.499, .566, .656])
for sc, n, info, sd, _ in uniq[:24]:
    print('viol %.2f n(%+.3f,%+.3f,%+.3f) tiltV %4.1f nY %+.2f f3 %s s1 %s s2 %s s3 %s s4 %s sd %s'
          % (sc, n[0], n[1], n[2],
             np.degrees(np.arccos(np.clip(abs(np.array(n) @ V), -1, 1))), n[1],
             info[160.8], info[343.8], info[340.6], info[187.4], info[288.7], sd))
json.dump({'axes': [sv[1] for sv in uniq]}, open('tools/axes4.json', 'w'))
print('wrote tools/axes4.json')
