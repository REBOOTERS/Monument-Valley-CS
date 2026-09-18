# Enlarged crops with coordinate grid for direct pixel reading.
# Usage: python tools/zoomgrid.py frame x0 y0 x1 y1 out [scale]
import sys
import numpy as np
from PIL import Image, ImageDraw

name = sys.argv[1]
x0, y0, x1, y1 = map(int, sys.argv[2:6])
out = sys.argv[6]
SC = int(sys.argv[7]) if len(sys.argv) > 7 else 3
im = Image.open('frames/' + name).convert('RGB').crop((x0, y0, x1, y1))
im = im.resize(((x1 - x0) * SC, (y1 - y0) * SC), Image.NEAREST)
dr = ImageDraw.Draw(im)
for gx in range((x0 // 10) * 10, x1, 10):
    X = (gx - x0) * SC
    major = gx % 50 == 0
    dr.line([X, 0, X, im.height], fill=(255, 80, 80) if major else (90, 40, 40))
    if major:
        dr.text((X + 1, 1), str(gx), fill=(255, 220, 120))
for gy in range((y0 // 10) * 10, y1, 10):
    Y = (gy - y0) * SC
    major = gy % 50 == 0
    dr.line([0, Y, im.width, Y], fill=(255, 80, 80) if major else (90, 40, 40))
    if major:
        dr.text((1, Y + 1), str(gy), fill=(255, 220, 120))
im.save(out)
print('saved', out, im.size)
