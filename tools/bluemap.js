// ASCII density map of dark-blue crank pixels within a box
const rd = require('./measure.js');
const f = process.argv[2];
const x0 = +process.argv[3], y0 = +process.argv[4], x1 = +process.argv[5], y1 = +process.argv[6];
const im = rd(f);
const { w, data, ch } = im;
for (let y = y0; y <= y1; y += 6) {
  let row = '';
  for (let x = x0; x <= x1; x += 4) {
    let c = 0;
    for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 4; dx++) {
      const i = ((y + dy) * w + x + dx) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (b - r > 40 && r < 150 && g < 175) c++;
    }
    row += c > 14 ? '#' : c > 7 ? '+' : c > 2 ? '.' : ' ';
  }
  console.log(String(y).padStart(4), row);
}
