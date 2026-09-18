# Choose short-leg init dir a0 in plane perp to long init +x (axis n=(-1,-1,1)/sqrt3, TH=120).
# Wants: init screen az ~93 (down behind arcade), dock az ~205-215 (up-left hidden in top beam).
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755]); V = np.array([-.499, .566, .656])
n = np.array([-1., -1., 1.]); n /= np.linalg.norm(n); TH = np.radians(120)

def az(d): return np.degrees(np.arctan2(-(u @ d), r @ d)) % 360
def Rod(d, t): return d * np.cos(t) + np.cross(n, d) * np.sin(t) + n * np.dot(n, d) * (1 - np.cos(t))

print('phi(deg) initAz dockAz dockSV dockz | initSV')
best = None
for deg in range(-90, 91):
    phi = np.radians(deg)
    a0 = np.array([0., np.cos(phi), np.sin(phi)])
    ad = Rod(a0, TH)
    iaz, daz = az(a0), az(ad)
    score = (abs(((iaz - 93 + 180) % 360) - 180) +
             0.8 * abs(((daz - 210 + 180) % 360) - 180) -
             0.4 * (V @ ad))
    if best is None or score < best[0]:
        best = (score, deg, a0, ad, iaz, daz)
    if deg % 10 == 0:
        print('%5d %6.1f %6.1f %+6.2f %+5.2f | %+5.2f' %
              (deg, iaz, daz, V @ ad, ad[2], V @ a0))
score, deg, a0, ad, iaz, daz = best
print('\nBEST phi', deg, 'a0', np.round(a0, 4), 'dock', np.round(ad, 4))
print('init az %.1f sv %+.2f  dock az %.1f sv %+.2f z %+.2f' % (iaz, V @ a0, daz, V @ ad, ad[2]))
for fr, nm in [(0, 'f001'), (.28, 'f005'), (.55, 'f008'), (1, 'f015')]:
    d = Rod(a0, TH * fr)
    print('%-5s az %6.1f sr %+.2f su %+.2f sv %+.2f z %+.2f' % (nm, az(d), r @ d, u @ d, V @ d, d[2]))
