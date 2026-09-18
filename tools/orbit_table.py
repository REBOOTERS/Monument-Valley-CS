# Orbit table for the FINAL rotor (vertical axis n=(0,0,1), Theta=91.7deg).
# Predicted screen az/px of the long arm vs the observed mask measurements.
import numpy as np

r = np.array([-.750, -.661, 0.]); u = np.array([.434, -.492, .755])
La, K = 0.99, 154.
OBS = [  # frame, long-arm observed (az, r96 px) or None
    ('f001-2 init', None),
    ('f003 mid', (160.8, 96.)),
    ('f005 strobe', (343.8, 110.)),
    ('f006 strobe', (187.0, 105.)),
    ('f007 strobe', (340.6, 112.)),
    ('f008 strobe', (187.4, 106.)),
    ('f009 strobe', (288.7, 71.)),
    ('f010 strobe', (188.3, 106.)),
    ('f012+ dock', (145.5, 101.6)),
]

def theta_for(az_target):
    """smallest in-swing-friendly positive theta whose arm az == az_target"""
    best = None
    for k in range(3600):
        t = 360.0 * k / 3600
        a, p = azpx(t)
        if abs(((a - az_target + 180) % 360) - 180) < 0.2:
            if best is None or t < best[0]:
                best = (t, a, p)
    return best

def azpx(tdeg):
    t = np.radians(tdeg)
    d = np.array([np.cos(t), np.sin(t), 0.]) * La
    a = np.degrees(np.arctan2(-(u @ d), r @ d)) % 360
    p = K * np.hypot(r @ d, u @ d)
    return a, p

print('vertical axis n=(0,0,1)  dock=+y@91.7deg  (px visible = px - occluded)')
print('%-14s %-18s %-22s %s' % ('state', 'observed az/r96', 'predicted az/px @theta', 'note'))
for name, obs in OBS:
    if obs is None:
        a, p = azpx(0.0)
        print('%-14s %-18s az %6.1f px %5.0f @%5.1f  init: arm inside top beam (hidden)'
              % (name, '-', a, p, 0.0))
        continue
    oa, op = obs
    t, a, p = theta_for(oa)
    note = 'far end occluded by %dpx' % max(0, round(p - op)) if p > op else 'ok'
    print('%-14s %6.1f / %5.1f      az %6.1f px %5.0f @%5.1f  %s' % (name, oa, op, a, p, t, note))
