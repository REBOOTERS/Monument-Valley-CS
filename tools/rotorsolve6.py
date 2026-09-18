# Rotor fit v6.
# Hard: La=0.99 (dock spans Q->ledge), dock long arm = +y exactly.
# Obs (clean): f3 L az160.8 px96 ; f3 S az120.2 px60 ; dock S az105.6 px57 ;
#              S strobe az94.5 px47(lower bound) ; L strobe AZ only (proj unreliable);
#              init: L az~208 hidden behind beam (V.a0<0); S hidden behind pillar
#              (V.b0<0, az in 88..135).
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
    th, ph = x[0], x[1]
    n = np.array([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)])
    n /= np.linalg.norm(n)
    Theta = x[2]
    a0 = Rod(n, -Theta, Y)
    e1, e2 = basis(n)
    b0 = np.cos(x[3]) * e1 + np.sin(x[3]) * e2
    return n, Theta, a0, b0, x[4], x[5]

def resids(x):
    n, Theta, a0, b0, Lb, t3 = unpack(x)
    out = []
    # --- f003 ---
    a3 = Rod(n, t3, a0); b3 = Rod(n, t3, b0)
    out.append(wan(az(a3), 160.8))
    out.append(2.5 * (La * proj(a3) * 154 - 96.0))
    out.append(wan(az(b3), 120.2))
    out.append(2.5 * (Lb * proj(b3) * 154 - 60.0))
    # --- dock ---
    bd = Rod(n, Theta, b0)
    out.append(wan(az(bd), 105.6))
    out.append(2.5 * (Lb * proj(bd) * 154 - 57.0))
    # --- strobes: az only (L), az+lowerbound (S) ---
    for i, oa in enumerate(STROBE_L_AZ):
        out.append(wan(az(Rod(n, x[6 + i], a0)), oa))
    bs = Rod(n, x[9], b0)
    out.append(wan(az(bs), 94.5))
    out.append(1.5 * max(0.0, 47.0 - Lb * proj(bs) * 154))
    # --- init ---
    out.append(0.6 * wan(az(a0), 208.0))
    out.append(4.0 * max(0.0, V @ a0))            # long behind beam
    out.append(4.0 * max(0.0, a0[2] - 0.05))      # tip below beam top
    out.append(4.0 * max(0.0, V @ b0))            # short behind pillar
    saz = az(b0) % 360
    d1 = min(abs(saz - 111), 360 - abs(saz - 111))
    out.append(0.8 * max(0.0, d1 - 22))           # short init az within 111+-22
    return np.array(out)

best = None
rng = np.random.default_rng(5)
for seed in range(800):
    x0 = np.r_[rng.uniform(.2, 2.9), rng.uniform(-np.pi, np.pi),
               rng.uniform(-2.4, -.5), rng.uniform(0, 6.28),
               rng.uniform(.32, .50), rng.uniform(-1.0, -.3),
               rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28)]
    lb = np.r_[.05, -np.pi, -3.1, 0, .25, -1.3, -1, -1, -1, -1]
    ub = np.r_[np.pi, np.pi, -.15, 6.28, .60, -.08, 7.3, 7.3, 7.3, 7.3]
    try:
        sol = least_squares(resids, np.clip(x0, lb + 1e-4, ub - 1e-4),
                            bounds=(lb, ub), max_nfev=4000)
    except ValueError:
        continue
    if best is None or sol.cost < best.cost:
        best = sol

x = best.x
n, Theta, a0, b0, Lb, t3 = unpack(x)
print('cost %.4f' % best.cost)
print('axis n     ', np.round(n, 4), ' n.V %+.3f  tilt %.1f deg' % (n @ V, np.degrees(np.arccos(abs(n @ V)))))
print('Theta %.1f  t3 %.1f deg' % (np.degrees(Theta), np.degrees(t3)))
print('long a0  ', np.round(a0, 4))
print('short b0 ', np.round(b0, 4), ' Lb %.3f (%.0f px)' % (Lb, Lb * 154))
print('V-angle %.1f deg' % np.degrees(np.arccos(np.clip(a0 @ b0, -1, 1))))
print('init  L az %6.1f  V %+.2f z %+.2f | S az %6.1f V %+.2f z %+.2f'
      % (az(a0) % 360, V @ a0, a0[2], az(b0) % 360, V @ b0, b0[2]))
for tag, tht in (('f3', t3), ('dock', Theta)):
    A = Rod(n, tht, a0); B = Rod(n, tht, b0)
    print('%-4s  L az %6.1f px %5.1f | S az %6.1f px %5.1f'
          % (tag, az(A) % 360, La * proj(A) * 154, az(B) % 360, Lb * proj(B) * 154))
print('long orbit extrema & strobe azs reachable:')
hits = []
for k in range(720):
    d = Rod(n, 2 * np.pi * k / 720, a0)
    hits.append((az(d) % 360, La * proj(d) * 154))
import collections
hmax = max(h for _, h in hits); hmin = min(h for _, h in hits)
print('  px range %.0f..%.0f' % (hmin, hmax))
for target in STROBE_L_AZ + [210.0, 145.5]:
    near = [h for a, h in hits if abs(((a - target + 180) % 360) - 180) < 3]
    print('  az %.0f -> px %.0f..%.0f' % (target, min(near), max(near)))
