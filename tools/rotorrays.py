# Precise rotor rays with fixed Q. Arm-only mask: sky ROI, crank/axle/hub dropped,
# static top beam dropped (keep only pixels BELOW its lower edge). Angle hist peaks,
# robust medians, projected extents; overlay for verification.
import numpy as np
from PIL import Image, ImageDraw
from rotorx import NAMES, rotors, H, W

Q = np.array([377.0, 644.0])          # (x, y) screen pivot (L corner / on axis)

yy, xx = np.indices((H, W))
rad = np.hypot(xx - Q[0], yy - Q[1])
angAll = (np.degrees(np.arctan2(yy - Q[1], xx - Q[0])) + 360) % 360

def arm_only(i):
    m = rotors[i].copy()
    m &= (xx > 230) & (xx < 520) & (yy > 540) & (yy < 700)
    m &= rad > 16
    # crank hub + axle + spoke blobs (right of pillar)
    m &= ~((xx > 405) & (yy > 630))
    # static top beam: its bottom edge runs ~ y = 505 + 0.335(x-150);
    # arm leg in that zone is the axis bar emerging just below beam -> keep narrow band,
    # drop anything ABOVE the beam's lower face
    m &= ~(yy < 500 + 0.30 * (xx - 150))
    # support
    sup = np.zeros_like(m, np.int16)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            sup += np.roll(np.roll(m, dy, 0), dx, 1)
    m &= sup > 7
    return m

arms = [arm_only(i) for i in range(len(NAMES))]

def peaks(m, minsep=42):
    a = angAll[m]; rr = rad[m]
    hist, edges = np.histogram(a, bins=180, range=(0, 360))
    hs = np.convolve(hist, np.ones(5) / 5, mode='same')
    order = np.argsort(hs)[::-1]
    out = []
    for b in order:
        az = b * 2 + 1
        if hs[b] < 8:
            break
        if all(abs(((az - t[0] + 180) % 360) - 180) > minsep for t in out):
            sel = np.abs(((a - az + 180) % 360) - 180) < 10
            if sel.sum() > 30:
                out.append((float(np.median(a[sel])), hs[b],
                            float(np.percentile(rr[sel], 96)), int(sel.sum())))
        if len(out) == 3:
            break
    return sorted(out, key=lambda t: -t[3])

results = []
for i, n in enumerate(NAMES):
    pk = peaks(arms[i])
    results.append(pk)
    print(n, [(round(a, 1), int(h), round(rm, 1), c) for a, h, rm, c in pk[:3]])

# overlay
SC = 3
X0, Y0, X1, Y1 = 220, 520, 520, 720
COL = [(255, 90, 90), (255, 180, 40), (255, 230, 70), (110, 255, 140),
       (80, 200, 255), (190, 120, 255), (255, 110, 220)]
panels = []
for i, n in enumerate(NAMES):
    im = Image.open('frames/' + n).convert('RGBA')
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ys, xs = np.where(arms[i])
    for x, y in zip(xs, ys):
        ld.point((x, y), fill=COL[i] + (255,))
    im = Image.alpha_composite(im, layer)
    dr = ImageDraw.Draw(im)
    dr.ellipse([Q[0] - 5, Q[1] - 5, Q[0] + 5, Q[1] + 5], outline=(255, 255, 0), width=2)
    for a, h, rm, c in results[i]:
        ar = np.radians(a)
        dr.line([Q[0], Q[1], Q[0] + rm * np.cos(ar), Q[1] + rm * np.sin(ar)],
                fill=(255, 0, 0, 255), width=1)
        dr.text((Q[0] + rm * np.cos(ar) + 2, Q[1] + rm * np.sin(ar) - 8),
                '%.0f' % a, fill=(255, 255, 80, 255))
    crop = im.crop((X0, Y0, X1, Y1)).resize(((X1 - X0) * SC, (Y1 - Y0) * SC), Image.NEAREST)
    panels.append(crop)
strip = Image.new('RGBA', (panels[0].width * 4, panels[0].height * 2), (0, 0, 0, 255))
for i, p in enumerate(panels):
    strip.paste(p, ((i % 4) * p.width, (i // 4) * p.height))
strip.convert('RGB').save('shots/cmp/rotorrays.png')
print('saved shots/cmp/rotorrays.png')
