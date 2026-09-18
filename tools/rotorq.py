# Common pivot Q fit: rotor corner is on the rotation axis -> fixed on screen.
# Grid-search Q; for each frame build angle histogram of rotor pixels (r in band),
# score two strongest rays (>=70deg apart). Report rays + extents per frame.
import numpy as np
from PIL import Image, ImageDraw
from rotorx import NAMES, rotors, static, H, W

def rays_at(Q, r0=34, r1=165):
    y0, x0 = np.mgrid[0:H, 0:W]
    res = []
    for r in rotors:
        dx = x0 - Q[0]; dy = y0 - Q[1]
        rad = np.hypot(dx, dy)
        m = r & (rad > r0) & (rad < r1)
        ang = (np.degrees(np.arctan2(dy[m], dx[m])) + 360) % 360
        rr = rad[m]
        hist, edges = np.histogram(ang, bins=120, range=(0, 360))
        hs = np.convolve(hist, np.ones(5) / 5, mode='same')
        pks = []
        for b in range(120):
            if hs[b] >= hs[(b - 1) % 120] and hs[b] >= hs[(b + 1) % 120] and hs[b] > 10:
                pks.append((hs[b], edges[b] + 1.5))
        pks.sort(reverse=True)
        keep = []
        for h, a in pks:
            if all(abs(((a - t[1] + 180) % 360) - 180) > 55 for t in keep):
                sel = np.abs(((ang - a + 180) % 360) - 180) < 9
                if sel.sum() > 25:
                    keep.append((h, a, rr[sel].max(), sel.sum(),
                                 np.median(ang[sel])))
            if len(keep) == 2:
                break
        res.append(keep)
    return res

# f005 (i=1) and f008 (i=2) both legs visible in air; score Q on those frames
best = None
for qx in range(330, 410, 4):
    for qy in range(600, 700, 4):
        rr = rays_at((qx, qy))
        s = 0
        for i in (1, 2, 4):
            if len(rr[i]) >= 2:
                s += rr[i][0][0] + rr[i][1][0]
        if best is None or s > best[0]:
            best = (s, qx, qy, rr)
s, QX, QY, rr = best
print('best Q', (QX, QY), 'score', s)
for i, name in enumerate(NAMES):
    print('--', name)
    for h, a, rmax, n, med in sorted(rr[i], key=lambda t: -t[3]):
        print('   ray az %6.1f (med %6.1f) rmax %6.1f n %5d h %6.0f' % (a, med, rmax, n, h))

# zoomed overlay per frame: static gray, rotor colored, Q white, rays red
COL = [(255, 90, 90), (255, 180, 40), (255, 230, 70), (110, 255, 140),
       (80, 200, 255), (190, 120, 255), (255, 110, 220)]
X0, Y0, X1, Y1 = 150, 480, 470, 920
SC = 3
panels = []
for i, name in enumerate(NAMES):
    im = Image.open('frames/' + name).convert('RGB')
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ys, xs = np.where(static)
    for x, y in zip(xs[::3], ys[::3]):
        ld.point((x, y), fill=(120, 150, 170, 70))
    ys, xs = np.where(rotors[i])
    for x, y in zip(xs, ys):
        ld.point((x, y), fill=COL[i] + (235,))
    im = Image.alpha_composite(im.convert('RGBA'), layer)
    dr = ImageDraw.Draw(im)
    dr.ellipse([QX - 7, QY - 7, QX + 7, QY + 7], outline=(255, 255, 255), width=2)
    for h, a, rmax, n, med in rr[i]:
        ar = np.radians(med)
        dr.line([QX, QY, QX + rmax * np.cos(ar), QY + rmax * np.sin(ar)],
                fill=(255, 60, 60), width=1)
    dr.text((QX + 10, QY - 18), name, fill=(255, 255, 80))
    crop = im.crop((X0, Y0, X1, Y1)).resize(((X1 - X0) * SC, (Y1 - Y0) * SC), Image.NEAREST)
    panels.append(crop)
strip = Image.new('RGBA', (panels[0].width * 4, panels[0].height * 2), (0, 0, 0, 255))
for i, p in enumerate(panels):
    strip.paste(p, ((i % 4) * p.width, (i // 4) * p.height))
strip.convert('RGB').save('shots/cmp/rotorq.png')
print('saved shots/cmp/rotorq.png')
