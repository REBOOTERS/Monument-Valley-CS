# Global 3D fit of the rotor L from CLEAN observations.
# Facts (px, K=154, az=atan2(-u.d, r.d) deg):
#   init  : long hidden behind top beam -> az ~210, V.d<0  (f_001 empty arm mask)
#   f003  : L az160.8 proj.623 ; S az120.2 proj.392   (static dwell)
#   dock  : L az145.5 proj.660 ; S az105.6 proj.371   (f_012..029 identical)
#   strobe points on the orbits (aliased full turns):
#     L (343.8,.716) (187.4,.687) (288.7,.462) ; S (94.5,.309)
# Fit: axis n, long dir a & len La, short dir b & len Lb (a,b ⊥ n, angle free),
#      pose angles t3, Theta, plus 4 auxiliary strobe angles.
import numpy as np
from scipy.optimize import least_squares

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); V = np.array([-.499, .566, .656])

def Rod(n, th, d):
    return d * np.cos(th) + np.cross(n, d) * np.sin(th) + n * np.dot(n, d) * (1 - np.cos(th))
def az(d): return np.degrees(np.arctan2(-(u @ d), r @ d))
def wan(p, o): return np.degrees(np.arctan2(np.sin(np.radians(p - o)), np.cos(np.radians(p - o))))
def proj(d): return np.hypot(r @ d, u @ d)

# observations: (leg, poseTag, azimuth, projLen) ; poseTag in {init,f3,dock,st1,st2,st3,sst}
OBS = [('L', 'init', 210.0, None),
       ('L', 'f3', 160.8, .623), ('S', 'f3', 120.2, .392),
       ('L', 'dock', 145.5, .660), ('S', 'dock', 105.6, .371),
       ('L', 'st1', 343.8, .716), ('L', 'st2', 187.4, .687), ('L', 'st3', 288.7, .462),
       ('S', 'sst', 94.5, .309)]

# param vector x: [nAxis(2: theta,phi), aAng(1 in-plane), bAng(1), La, Lb, t3, Theta, st1, st2, st3, sst]
def basis(n):
    e1 = np.cross(n, [0, 0, 1.0]);
    if np.linalg.norm(e1) < 1e-6: e1 = np.cross(n, [0, 1.0, 0])
    e1 /= np.linalg.norm(e1); e2 = np.cross(n, e1)
    return e1, e2

def unpack(x):
    th, ph = x[0], x[1]
    n = np.array([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)])
    e1, e2 = basis(n)
    a = np.cos(x[2]) * e1 + np.sin(x[2]) * e2
    b = np.cos(x[3]) * e1 + np.sin(x[3]) * e2
    return n, a, b, x[4], x[5], x[6], x[7]

def pose_angle(tag, x):
    return {'init': 0.0, 'f3': x[6], 'dock': x[7], 'st1': x[8], 'st2': x[9],
            'st3': x[10], 'sst': x[11]}[tag]

def resids(x):
    n, a, b, La, Lb, t3, Theta = unpack(x)
    out = []
    for leg, tag, oaz, oproj in OBS:
        th = pose_angle(tag, x)
        d = Rod(n, th, a if leg == 'L' else b)
        out.append(wan(az(d), oaz))
        if oproj is not None:
            L = La if leg == 'L' else Lb
            out.append(2.5 * (L * proj(d) - oproj))
    ad = Rod(n, Theta, a)
    out.append(1.5 * ad[2])                      # docked bridge walkable: ~horizontal
    a0 = Rod(n, 0.0, a)
    out.append(1.0 * min(0.0, -(V @ a0)))        # init long behind beam (V.d<0)
    return np.array(out)

best = None
rng = np.random.default_rng(11)
for seed in range(400):
    x0 = np.r_[rng.uniform(.3, 2.8), rng.uniform(-np.pi, np.pi),
               rng.uniform(0, 2 * np.pi), rng.uniform(0, 2 * np.pi),
               rng.uniform(.6, 1.1), rng.uniform(.3, .6),
               rng.uniform(-.9, -.2), rng.uniform(-1.2, -.4),
               rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28)]
    lb = np.r_[.05, -np.pi, 0, 0, .45, .18, -1.6, -2.2, -1, -1, -1, -1]
    ub = np.r_[np.pi, np.pi, 2 * np.pi, 2 * np.pi, 1.4, .95, -.05, -.05, 7.3, 7.3, 7.3, 7.3]
    try:
        sol = least_squares(resids, np.clip(x0, lb + 1e-4, ub - 1e-4),
                            bounds=(lb, ub), max_nfev=4000)
    except ValueError as e:
        if seed == 0:
            print('first-seed ValueError:', e)
        continue
    if best is None or sol.cost < best.cost:
        best = sol

n, a, b, La, Lb, t3, Theta = unpack(best.x)
print('cost %.4f   rms %.2f' % (best.cost, np.sqrt(2 * best.cost / len(resids(best.x)))))
print('axis n   ', np.round(n, 4))
print('long a0  ', np.round(a, 4), 'La %.3f (%.0f px)' % (La, La * 154))
print('short b0 ', np.round(b, 4), 'Lb %.3f (%.0f px)' % (Lb, Lb * 154))
print('angle(a0,b0) %.1f deg' % np.degrees(np.arccos(np.clip(a @ b, -1, 1))))
print('t3 %.1f deg  Theta(dock) %.1f deg' % (np.degrees(t3), np.degrees(Theta)))
print('--- verification table ---')
for leg, d0, L in (('L', a, La), ('S', b, Lb)):
    for tag, tht in (('init', 0), ('f3', t3), ('dock', Theta)):
        d = Rod(n, tht, d0)
        print('%s %-4s az %6.1f proj %5.3f px %5.1f  V.d %+.2f z %+.2f'
              % (leg, tag, az(d) % 360, proj(d), L * proj(d) * 154, V @ d, d[2]))
print('--- orbit coverage (long leg az/proj over full turn) ---')
zs = []
for k in range(24):
    d = Rod(n, 2 * np.pi * k / 24, a)
    zs.append((az(d) % 360, L * proj(d)))
for z in sorted(zs):
    print('  az %6.1f proj %5.3f' % z)
