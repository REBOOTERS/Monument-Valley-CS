# Rotor fit v7 — r96 extents are LOWER bounds (far ends overlap static ledge/arcade
# and get subtracted). Hard: La=0.99, dock long arm = +y (spans Q->N3 ledge,
# projection 125.6px of which far ~25px hides against the ledge).
import numpy as np
from scipy.optimize import least_squares

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); V = np.array([-.499, .566, .656])
Y = np.array([0., 1., 0.])

def Rod(n, th, d):
    return d * np.cos(th) + np.cross(n, d) * np.sin(th) + n * np.dot(n, d) * (1 - np.cos(th))
def az(d): return np.degrees(np.arctan2(-(u @ d), r @ d))
def wan(p, o): return np.degrees(np.arctan2(np.sin(np.radians(p - o)), np.cos(np.radians(p - o))))
def proj(d): return np.hypot(r @ d, u @ d)
def basis(n):
    e1 = np.cross(n, [0, 0, 1.0])
    if np.linalg.norm(e1) < 1e-6: e1 = np.cross(n, [0, 1.0, 0])
    e1 /= np.linalg.norm(e1)
    return e1, np.cross(n, e1)

La = 0.99
STROBE_L_AZ = [343.8, 187.4, 288.7]

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
    # f003: long az exact, px lower-bounded (true 96..122)
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
    # strobes az only
    for i, oa in enumerate(STROBE_L_AZ):
        out.append(wan(az(Rod(n, x[6 + i], a0)), oa))
    out.append(wan(az(Rod(n, x[9], b0)), 94.5))
    # init: long along beam & hidden; short behind pillar
    out.append(0.8 * max(0.0, abs(((az(a0) % 360 + 180) % 360) - 180) - 172.5 - 8 + 172.5 - abs(((az(a0) % 360 - 204 + 180) % 360) - 180)))
    out.append(5.0 * max(0.0, V @ a0))
    out.append(5.0 * max(0.0, a0[2] - 0.05))
    out.append(4.0 * max(0.0, V @ b0))
    saz = az(b0) % 360
    out.append(0.8 * max(0.0, abs(((saz - 111 + 180) % 360) - 180) - 25))
    return np.array(out)

best = None
rng = np.random.default_rng(9)
for seed in range(1500):
    sgn = -1 if rng.random() < .5 else 1
    x0 = np.r_[rng.uniform(.2, 2.9), rng.uniform(-np.pi, np.pi),
               sgn * rng.uniform(.4, 2.6), rng.uniform(0, 6.28),
               rng.uniform(.32, .50), sgn * rng.uniform(.2, 1.1),
               rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28)]
    lb = np.r_[.05, -np.pi, -3.05, 0, .25, -1.5, -1, -1, -1, -1]
    ub = np.r_[np.pi, np.pi, 3.05, 6.28, .60, 1.5, 7.3, 7.3, 7.3, 7.3]
    x0[2] = np.clip(x0[2], -.3 if sgn < 0 else .15, -.15 if sgn < 0 else .3) if False else x0[2]
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
hits = [(az(Rod(n, 2 * np.pi * k / 720, a0)) % 360, La * proj(Rod(n, 2 * np.pi * k / 720, a0)) * 154)
        for k in range(720)]
print('orbit px %.0f..%.0f' % (min(h for _, h in hits), max(h for _, h in hits)))
for target in STROBE_L_AZ + [210.0, 145.5]:
    near = [h for a, h in hits if abs(((a - target + 180) % 360) - 180) < 3]
    print('  az %.0f -> px %.0f..%.0f' % (target, min(near), max(near)))
print('strobe thetas:', np.round(np.degrees(x[6:9]) % 360, 0), 'sst', round(np.degrees(x[9]) % 360, 0))
