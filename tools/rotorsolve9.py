# Rotor fit v9 — init-hidden modeled with the REAL static-blue screen map.
# Evidence recap: f001 mask empty only proves arm pixels overlap static-blue
# regions (rotor = blue & ~static, regardless of depth order). So instead of
# the old V·d<0 guess, penalize init arm samples by their EDT distance to the
# static-blue screen regions. Also adds short-arm strobe f006/f010 (az 94.5).
# Hard: La=0.99, dock long arm = pure +y (a0 = Rod(n,-Theta,Y)).
import numpy as np
from scipy.optimize import least_squares

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); V = np.array([-.499, .566, .656])
Y = np.array([0., 1., 0.])
EDT = np.load('tools/staticedt.npy')

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

def screen(d, L):
    w = L * d
    return 644.0 - 154.0 * (w @ u), 377.0 + 154.0 * (w @ r)   # (yy, xx)

def hidden_cost(d, Lmax, npts=14):
    ts = np.linspace(0.12, Lmax, npts)
    s = 0.0
    for L in ts:
        yy, xx = screen(d, L)
        yi, xi = int(np.clip(yy, 0, 1279)), int(np.clip(xx, 0, 575))
        s += max(0.0, float(EDT[yi, xi]) - 2.0)
    return s / npts / 5.0

La = 0.99
LSTRO = [(343.8, 110., 3.), (340.6, 112., 3.), (187.4, 100., 1.5), (288.7, 65., 3.)]

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
    a3 = Rod(n, t3, a0); b3 = Rod(n, t3, b0)
    out.append(wan(az(a3), 160.8))
    px3 = La * proj(a3) * 154
    out.append(1.5 * max(0.0, 94.0 - px3))
    out.append(1.5 * max(0.0, px3 - 122.0))
    out.append(wan(az(b3), 120.2))
    out.append(1.0 * max(0.0, 55.0 - Lb * proj(b3) * 154))
    bd = Rod(n, Theta, b0)
    out.append(wan(az(bd), 105.6))
    out.append(1.0 * max(0.0, 53.0 - Lb * proj(bd) * 154))
    for i, (oa, opx, tol) in enumerate(LSTRO):
        A = Rod(n, x[6 + i], a0)
        out.append(wan(az(A), oa) / tol * 0.5)
        out.append(1.5 * max(0.0, opx - La * proj(A) * 154))
    Bs = Rod(n, x[10], b0)                       # short strobe f006/f010
    out.append(wan(az(Bs), 94.5) / 3.0 * 0.5)
    out.append(1.0 * max(0.0, 44.0 - Lb * proj(Bs) * 154))
    out.append(hidden_cost(a0, La))              # init long hidden in static blue
    out.append(hidden_cost(b0, Lb))              # init short hidden
    out.append(3.0 * max(0.0, a0[2] - 0.05))     # init long end must not poke above beam top
    out.append(2.0 * max(0.0, V @ a0 - 0.15))    # init long must not face camera
    return np.array(out)

best = None
rng = np.random.default_rng(11)
for seed in range(2000):
    sgn = -1 if rng.random() < .5 else 1
    x0 = np.r_[rng.uniform(.2, 2.9), rng.uniform(-np.pi, np.pi),
               sgn * rng.uniform(.4, 2.6), rng.uniform(0, 6.28),
               rng.uniform(.32, .50), sgn * rng.uniform(.2, 1.1)]
    for _ in range(5):
        x0 = np.r_[x0, rng.uniform(0, 6.28)]
    lb = np.r_[.05, -np.pi, -3.05, 0, .25, -1.5, np.full(5, -1)]
    ub = np.r_[np.pi, np.pi, 3.05, 6.28, .60, 1.5, np.full(5, 7.3)]
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
print('cost %.4f' % best.cost)
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
for a, opx, _ in LSTRO + [(210.0, 0., 0), (145.5, 0., 0)]:
    near = [h for a2, h in hits if adist(a2, a) < 3]
    print('  az %.0f -> px %s' % (a, ('%.0f..%.0f' % (min(near), max(near))) if near else 'NOT ON ORBIT'))
print('strobe thetas L:', np.round(np.degrees(x[6:10]) % 360, 0),
      'S', round(np.degrees(x[10]) % 360, 0))
print('init hidden EDT: long %.1f short %.1f (px beyond 2px tol, mean/sample)'
      % (hidden_cost(a0, La) * 5, hidden_cost(b0, Lb) * 5))
