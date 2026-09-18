# Full-sphere axis grid: which rotor axes n can satisfy the MASK-observed
# orbit radii (f3 window + strobe lower bounds)?  Orbit = circle ⊥ n, radius
# La=0.99 about Q.  Every screen azimuth is crossed twice; constraints are on
# the projected length (px) AT those crossings.
#   f003      az 160.8  px in [94,122]   (far end may hide behind arcade)
#   f005      az 343.8  px >= 110
#   f007      az 340.6  px >= 112
#   f006/8/10 az 187.4  px >= 100
#   f009      az 288.7  px >= 65   (weak: near end occluded by beam)
# Survivors go to browser raycast occlusion sweep (probe10.js).
import json
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755])
La, K = 0.99, 154.

CONS = [  # (az, lo, hi) px at the two crossings; hi=None means lower bound only
    (160.8, 94., 122.), (343.8, 110., None), (340.6, 112., None),
    (187.4, 100., None), (288.7, 65., None),
]

N_TH = 1440
th = np.linspace(0, 2 * np.pi, N_TH, endpoint=False)
c, s = np.cos(th), np.sin(th)

def basis_batch(n):
    e1 = np.cross(n, [0, 0, 1.0])
    ln = np.linalg.norm(e1, axis=1, keepdims=True)
    e1 = np.where(ln < 1e-6, np.cross(n, [0, 1.0, 0]), e1)
    e1 /= np.linalg.norm(e1, axis=1, keepdims=True)
    return e1, np.cross(n, e1)

def gen_grid(deg):
    pts = []
    steps = np.arange(0, 180.0, deg)
    for pole in np.arange(0, 180.0, deg):
        for azg in np.arange(0, 360.0, deg * max(1, int(deg)) ):
            p, a = np.radians(pole), np.radians(azg)
            pts.append([np.sin(p) * np.cos(a), np.sin(p) * np.sin(a), np.cos(p)])
    return np.unique(np.round(np.array(pts), 6), axis=0)

grid = gen_grid(5.0)
e1, e2 = basis_batch(grid)
# p(θ) = La (c e1 + s e2)  for all axes × θ
P = La * (c[None, :, None] * e1[:, None, :] + s[None, :, None] * e2[:, None, :])
px = K * np.hypot(P @ r, P @ u)              # (naxes, nth)
az = np.degrees(np.arctan2(-(P @ u), P @ r)) % 360

def crossings(azr, pxr, target, halfwin=2.0):
    d = (azr - target + 180) % 360 - 180
    idx = np.where(np.abs(d) <= halfwin)[0]
    return pxr[idx]

score = np.zeros(len(grid))
ok = np.zeros(len(grid), bool)
detail = []
for i in range(len(grid)):
    good, viol = True, 0.0
    info = []
    for (ta, lo, hi) in CONS:
        cpx = crossings(az[i], px[i], ta)
        if len(cpx) == 0:
            good = False; viol += 50; info.append((ta, None)); continue
        best = None
        for p0 in cpx:                       # need ONE crossing inside window
            v = max(lo - p0, 0.) + (max(p0 - hi, 0.) if hi else 0.)
            if best is None or v < best[0]:
                best = (v, p0)
        viol += best[0]
        if best[0] > 0: good = False
        info.append((ta, round(float(best[1]), 1)))
    score[i] = viol
    ok[i] = good
    detail.append(info)

print('axes %d, strict-ok %d' % (len(grid), ok.sum()))
order = np.argsort(score)
seen = []
top = []
for i in order[:400]:
    n = grid[i]
    if any(np.degrees(np.arccos(np.clip(abs(n @ m), -1, 1))) < 18 for m in seen):
        continue
    seen.append(n)
    top.append((float(score[i]), n.tolist(), detail[i]))
    if len(top) >= 40: break
for sc, n, info in top[:25]:
    print('viol %6.2f  n (%+.3f,%+.3f,%+.3f)  tiltV %4.1f  %s'
          % (sc, n[0], n[1], n[2],
             np.degrees(np.arccos(np.clip(abs(np.array(n) @ np.array([-.499, .566, .656])), -1, 1))),
             info))
json.dump({'axes': [t[1] for t in top]}, open('tools/axes.json', 'w'))
print('wrote tools/axes.json (%d axes)' % len(top))
