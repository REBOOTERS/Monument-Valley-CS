// Find centroid of saturated-blue crank pixels in a frame: node tools/centroid.js img.png
const rd = require('./measure.js');
const f = process.argv[2];
const im = rd(f);
const { w, h, data, ch } = im;
let n = 0, sx = 0, sy = 0, minx = 9999, maxx = 0, miny = 9999, maxy = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * ch;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (b - r > 34 && b - g > 8 && b > 120 && r < 190 && y > 300 && y < 900 && x > 350) {
      n++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
}
console.log(f, 'crank blue centroid:', (sx / n).toFixed(0), (sy / n).toFixed(0), 'bbox', minx, miny, maxx, maxy, 'n=', n);
