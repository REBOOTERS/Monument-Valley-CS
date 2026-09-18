# Rotor fit v5 — hard constraints:
#   * La fixed 0.99 (arm must span Q -> ledge N3 when docked)
#   * docked long arm EXACTLY world +y (0,1,0): az 143.3, z=0 (walkable bridge)
#   => a0 = Rod(n, -Theta, +y). Unknowns: n(2), Theta, b0-angle(1), V-angle(1), Lb, t3, 4 strobe angles.
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

def unpack(x):
    th, ph = x[0], x[1]
    n = np.array([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)])
    n /= np.linalg.norm(n)
    Theta = x[2]
    a0 = Rod(n, -Theta, Y)
    e1, e2 = basis(n)
    b0 = np.cos(x[3]) * e1 + np.sin(x[3]) * e2
    return n, Theta, a0, b0, x[4], x[5]

# strobe obs (long): az, projLen ;  short obs list
STROBE_L = [(343.8, .716), (187.4, .687), (288.7, .462)]
def resids(x):
    n, Theta, a0, b0, Vang, t3 = unpack(x)
    # short leg direction: rotate b0 in-plane by Vang from perpendicular? simpler:
    # re-parameterize: b0 built at angle x[3]; V-angle emerges. Use obs directly.
    out = []
    # init long: az ~210, hidden behind beam
    out.append(wan(az(a0), 210.0))
    out.append(4.0 * max(0.0, V @ a0))          # behind at init
    out.append(4.0 * max(0.0, a0[2] - 0.05))    # tip not above beam top
    # f003 pose
    a3 = Rod(n, t3, a0); b3 = Rod(n, t3, b0)
    out.append(wan(az(a3), 160.8)); out.append(2.5 * (La * proj(a3) - .623))
    out.append(wan(az(b3), 120.2)); out.append(2.5 * (x[4] * proj(b3) - .392))
    # dock pose: long is +y by construction; its proj-length obs
    out.append(2.5 * (La * proj(Y) - .660))     # constant, sanity
    bd = Rod(n, Theta, b0)
    out.append(wan(az(bd), 105.6)); out.append(2.5 * (x[4] * proj(bd) - .371))
    # strobes: long-leg orbit members at aux angles x[6..8], short x[9]
    for i, (oaz, opr) in enumerate(STROBE_L):
        d = Rod(n, x[6 + i], a0)
        out.append(wan(az(d), oaz)); out.append(2.0 * (La * proj(d) - opr))
    ds = Rod(n, x[9], b0)
    out.append(wan(az(ds), 94.5)); out.append(2.0 * (x[4] * proj(ds) - .309))
    # init short hidden behind pillar/beam
    out.append(3.0 * max(0.0, V @ b0))
    return np.array(out)

best = None
rng = np.random.default_rng(3)
for seed in range(600):
    x0 = np.r_[rng.uniform(.2, 2.9), rng.uniform(-np.pi, np.pi),
               rng.uniform(-2.6, -.3), rng.uniform(0, 6.28),
               rng.uniform(.30, .55), rng.uniform(-1.0, -.2),
               rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28)]
    lb = np.r_[.05, -np.pi, -3.1, 0, .22, -1.4, -1, -1, -1, -1]
    ub = np.r_[np.pi, np.pi, -.1, 6.28, .75, -.05, 7.3, 7.3, 7.3, 7.3]
    try:
        sol = least_squares(resids, np.clip(x0, lb + 1e-4, ub - 1e-4),
                            bounds=(lb, ub), max_nfev=5000)
    except ValueError:
        continue
    if best is None or sol.cost < best.cost:
        best = sol

x = best.x
n, Theta, a0, b0, Lb, t3 = unpack(x)
print('cost %.4f' % best.cost)
print('axis n    ', np.round(n, 4), ' (n.V = %+.3f, tilt from view %.1f deg)'
      % (n @ V, np.degrees(np.arccos(abs(n @ V)))))
print('Theta(dock) %.1f deg   t3 %.1f deg' % (np.degrees(Theta), np.degrees(t3)))
print('long a0   ', np.round(a0, 4), ' La 0.99')
print('short b0  ', np.round(b0, 4), ' Lb %.3f (%.0f px)' % (Lb, Lb * 154))
print('V-angle(a0,b0) %.1f deg' % np.degrees(np.arccos(np.clip(a0 @ b0, -1, 1))))
print()
print('pose table:')
for tag, tht in (('init', 0), ('f3', t3), ('dock', Theta)):
    A = Rod(n, tht, a0); B = Rod(n, tht, b0)
    print(' %-4s L az %6.1f px %5.1f (V %+0.2f z %+.2f)   S az %6.1f px %5.1f (V %+.2f z %+.2f)'
          % (tag, az(A) % 360, La * proj(A) * 154, V @ A, A[2],
             az(B) % 360, Lb * proj(B) * 154, V @ B, B[2]))
print()
print('long-leg orbit (az, px):')
orb = []
for k in range(36):
    d = Rod(n, 2 * np.pi * k / 36, a0)
    orb.append((az(d) % 360, La * proj(d) * 154))
for z in sorted(orb):
    print('  az %6.1f  %5.1f px' % z)
print('strobe thetas (deg mod 360):', np.round(np.degrees(x[7:10]) % 360, 1),
      ' short-strobe', round(np.degrees(x[10]) % 360, 1))
