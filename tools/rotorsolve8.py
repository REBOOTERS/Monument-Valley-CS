# Rotor fit v8 — fixes v7 bugs:
#  1) init long-arm az penalty was garbled (penalized az~204 instead of deviation
#     from it) -> proper wrapped angdist hinge around 207 deg, tol 8.
#  2) strobe points now carry px LOWER bounds (r96 is a lower bound; end-on orbit
#     crossings with tiny px are invalid): f5 344/110, f7 341/112, f6-10 187/100,
#     f9 289/65 (weak: near end occluded by beam).
#  Hard: La=0.99, dock long arm = pure +y (a0 = Rod(n,-Theta,Y)).
import numpy as np
from scipy.optimize import least_squares

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); V = np.array([-.499, .566, .656])
Y = np.array([0., 1., 0.])

def Rod(n, th, d):
    return d * np.cos(th) + np.cross(n, d) * np.sin(th) + n * np.dot(n, d) * (1 - np.cos(th))
def az(d): return np.degrees(np.arctan2(-(u @ d), r @ d))
def wan(p, o): return np.degrees(np.arctan2(np.sin(np.radians(p - o)), np.cos(np.radians(p - o))))
def proj(d): return np.hypot(r @ d, u @ d)
def adist(a, b): return abs(((a - b + 180) % 360) - 180)
def basis(n):
    e1 = np.cross(n, [0, 0, 1.0])
    if np.linalg.norm(e1) < 1e-6: e1 = np.cross(n, [0, 1.0, 0])
    e1 /= np.linalg.norm(e1)
    return e1, np.cross(n, e1)

La = 0.99
# (target az, px lower bound, az tol deg)
STROBES = [(343.8, 110., 3.), (340.6, 112., 3.), (187.4, 100., 1.5), (288.7, 65., 3.)]

def unpack(x):
    n = np.array([np.sin(x[0]) * np.cos(x[1]), np.sin(x[0]) * np.sin(x[1]), np.cos(x[0])])
    n /= np.linalg.norm(n)
    Theta = x[2]
    a0 = Rod(n, -Theta, Y)
    e1, e2 = basis(n)
    b0 = np.cos(x[3]) * e1 + np.sin(x[3]) * e2
    return n, Theta, a0, b0, x[4], x[5]

def resids(x):
    n, Theta, a0, b0, Lb, t3 = unpack(x)
    out = []
    # f003: long az exact, px in [94,122] (far end may hide behind arcade top)
    a3 = Rod(n, t3, a0); b3 = Rod(n, t3, b0)
    out.append(wan(az(a3), 160.8))
    px3 = La * proj(a3) * 154
    out.append(1.5 * max(0.0, 94.0 - px3))
    out.append(1.5 * max(0.0, px3 - 122.0))
    out.append(wan(az(b3), 120.2))
    out.append(1.0 * max(0.0, 55.0 - Lb * proj(b3) * 154))
    # dock short
    bd = Rod(n, Theta, b0)
    out.append(wan(az(bd), 105.6))
    out.append(1.0 * max(0.0, 53.0 - Lb * proj(bd) * 154))
    # strobes: az residual + px lower-bound hinge
    for i, (oa, opx, tol) in enumerate(STROBES):
        th = x[6 + i]
        A = Rod(n, th, a0)
        out.append(wan(az(A), oa) / tol * 0.5)
        out.append(1.5 * max(0.0, opx - La * proj(A) * 154))
    # init: long arm along beam (az 207 +- 8) and hidden; short behind pillar
    out.append(0.8 * max(0.0, adist(az(a0) % 360, 207.0) - 8.0))
    out.append(5.0 * max(0.0, V @ a0 - 0.10))
    out.append(5.0 * max(0.0, a0[2] - 0.05))
    out.append(4.0 * max(0.0, V @ b0))
    out.append(0.8 * max(0.0, adist(az(b0) % 360, 111.0) - 25.0))
    return np.array(out)

NB = 6 + 2 * len(STROBES) + 1  # n(2) Theta t4 Lb t3 + strobe thetas + sst
best = None
rng = np.random.default_rng(11)
for seed in range(2000):
    sgn = -1 if rng.random() < .5 else 1
    x0 = np.r_[rng.uniform(.2, 2.9), rng.uniform(-np.pi, np.pi),
               sgn * rng.uniform(.4, 2.6), rng.uniform(0, 6.28),
               rng.uniform(.32, .50), sgn * rng.uniform(.2, 1.1)]
    for _ in range(len(STROBES) + 1):
        x0 = np.r_[x0, rng.uniform(0, 6.28)]
    lb = np.r_[.05, -np.pi, -3.05, 0, .25, -1.5, np.full(len(STROBES) + 1, -1)]
    ub = np.r_[np.pi, np.pi, 3.05, 6.28, .60, 1.5, np.full(len(STROBES) + 1, 7.3)]
    if abs(x0[2]) < .15: x0[2] = sgn * .2
    if abs(x0[5]) < .08: x0[5] = sgn * .12
    try:
        sol = least_squares(resids, np.clip(x0, lb + 1e-4, ub - 1e-4),
                            bounds=(lb, ub), max_nfev=3500)
    except ValueError:
        continue
    if best is None or sol.cost < best.cost:
        best = sol

x = best.x
n, Theta, a0, b0, Lb, t3 = unpack(x)
print('cost %.4f  nparams %d' % (best.cost, NB))
print('resids', np.round(best.fun, 2))
print('axis n     ', np.round(n, 4), ' n.V %+.3f  tilt %.1f' % (n @ V, np.degrees(np.arccos(abs(n @ V)))))
print('Theta %.2f rad (%.1f deg)  t3 %.2f (%.1f deg)' % (Theta, np.degrees(Theta), t3, np.degrees(t3)))
print('long a0  ', np.round(a0, 4))
print('short b0 ', np.round(b0, 4), ' Lb %.3f (%.0f px)' % (Lb, Lb * 154))
print('V-angle %.1f deg' % np.degrees(np.arccos(np.clip(a0 @ b0, -1, 1))))
print('init  L az %6.1f V %+.2f z %+.2f px %5.0f | S az %6.1f V %+.2f z %+.2f'
      % (az(a0) % 360, V @ a0, a0[2], La * proj(a0) * 154, az(b0) % 360, V @ b0, b0[2]))
for tag, tht in (('f3', t3), ('dock', Theta)):
    A = Rod(n, tht, a0); B = Rod(n, tht, b0)
    print('%-4s L az %6.1f px %5.0f V %+.2f | S az %6.1f px %5.0f V %+.2f'
          % (tag, az(A) % 360, La * proj(A) * 154, V @ A, az(B) % 360, Lb * proj(B) * 154, V @ B))
hits = [(az(Rod(n, 2 * np.pi * k / 1440, a0)) % 360, La * proj(Rod(n, 2 * np.pi * k / 1440, a0)) * 154)
        for k in range(1440)]
print('orbit px %.0f..%.0f' % (min(h for _, h in hits), max(h for _, h in hits)))
for a, opx, _ in STROBES + [(210.0, 0., 0), (145.5, 0., 0)]:
    near = [h for a2, h in hits if adist(a2, a) < 3]
    print('  az %.0f -> px %s' % (a, ('%.0f..%.0f' % (min(near), max(near))) if near else 'NOT ON ORBIT'))
print('strobe thetas:', np.round(np.degrees(x[6:6 + len(STROBES)]) % 360, 0),
      'sst', round(np.degrees(x[-1]) % 360, 0))
