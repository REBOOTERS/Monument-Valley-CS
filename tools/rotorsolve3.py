# Robust global fit of the rotating L-arm.
# Long init +x (hidden in top beam), dock +y (walkable horizontal bridge).
# Short init projects straight DOWN (az93, full 1.42 length visible behind arcade),
# long f005 points RIGHT(341), f008/f010 LEFT(182/177), dock 145.
import numpy as np
from scipy.optimize import least_squares

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); V = np.array([-.499, .566, .656])

def Rod(n, th, d):
    return d * np.cos(th) + np.cross(n, d) * np.sin(th) + n * np.dot(n, d) * (1 - np.cos(th))
def az(d): return np.degrees(np.arctan2(-(u @ d), r @ d))
def wan(p, o): return np.degrees(np.arctan2(np.sin(np.radians(p - o)), np.cos(np.radians(p - o))))
def proj(d): return np.hypot(r @ d, u @ d)

K = 154.0
LS, LL = 1.42, 0.92
# (leg, frame, azimuth)  frame: 0 init, 5 f005, 8 f008, 10 f010, 15 dock
OBS = [('a', 0, 93), ('a', 5, 101), ('a', 8, 303),
       ('b', 5, 341), ('b', 8, 182), ('b', 10, 177), ('b', 15, 145)]
# (leg, frame, projected px)
OLEN = [('a', 0, 221), ('a', 5, 225), ('a', 8, 103),
        ('b', 5, 76), ('b', 8, 127), ('b', 10, 121), ('b', 15, 138)]

def unpack(x):
    n = x[0:3].copy(); a = x[3:6].copy(); b = x[6:9].copy()
    return n / np.linalg.norm(n), a / np.linalg.norm(a), b / np.linalg.norm(b), x[9], x[10], x[11], x[12]

def resids(x):
    n, a, b, Theta, f5, f8, f10 = unpack(x)
    th = {0: 0, 5: Theta * f5, 8: Theta * f8, 10: Theta * f10, 15: Theta}
    D = {leg: {fi: Rod(n, th[fi], a if leg == 'a' else b) for fi in th} for leg in ('a', 'b')}
    out = []
    for leg, fi, o in OBS:
        out.append(wan(az(D[leg][fi]), o))
    for leg, fi, pxv in OLEN:
        L = LS if leg == 'a' else LL
        out.append(2.5 * (L * proj(D[leg][fi]) - pxv / K))
    # legs perpendicular (rigid L)
    out.append(3.0 * (a @ b))
    # init long hidden in top beam: screen az ~210 and pushed behind in depth
    out.append(1.0 * wan(az(b), 210))
    out.append(2.0 * max(0.0, V @ b + 0.15))
    # init short descends below Q
    out.append(1.0 * max(0.0, a[2] + 0.45))
    # dock short should be edge-on / up-left hidden behind top beam
    ad = D['a'][15]
    out.append(0.7 * wan(az(ad), 210))
    # dock long roughly horizontal (Ida walks it) - gentle
    out.append(1.2 * D['b'][15][2])
    return np.array(out)

# x: n(3) a(3) b(3) Theta f5 f8 f10
best = None
rng = np.random.default_rng(7)
for seed in range(80):
    x0 = np.r_[rng.normal(0, 1, 9), rng.uniform(2.2, 6.1),
               rng.uniform(.12, .4), rng.uniform(.4, .72), rng.uniform(.55, .9)]
    lb = np.r_[-3 * np.ones(9), 1.6, .08, .35, .5]
    ub = np.r_[ 3 * np.ones(9), 6.28, .5,  .8,  .97]
    try:
        sol = least_squares(resids, np.clip(x0, lb + 1e-3, ub - 1e-3),
                            bounds=(lb, ub), max_nfev=3000)
    except ValueError:
        continue
    if best is None or sol.cost < best.cost:
        best = sol

n, a, b, Theta, f5, f8, f10 = unpack(best.x)
print('cost', round(best.cost, 3))
print('axis n', np.round(n, 4))
print('short a0', np.round(a, 4), ' long b0', np.round(b, 4), ' dot', round(a @ b, 3))
print('Theta', round(np.degrees(Theta), 1), ' fracs', np.round([f5, f8, f10], 3),
      ' midTheta', np.round(np.degrees([Theta * f5, Theta * f8, Theta * f10]), 1))
for fi, nm in [(0, 'f001'), (5, 'f005'), (8, 'f008'), (10, 'f010'), (15, 'f015')]:
    tt = {0: 0, 5: Theta * f5, 8: Theta * f8, 10: Theta * f10, 15: Theta}[fi]
    for leg, d0, L in [('short', a, LS), ('long ', b, LL)]:
        d = Rod(n, tt, d0)
        print('%-5s %s az %6.1f projLen %5.2f px %5.0f  sv %+.2f z %+.2f' %
              (nm, leg, az(d) % 360, proj(d), L * proj(d) * K, V @ d, d[2]))
