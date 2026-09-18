// Print vertical structure clusters at given columns: node tools/colprof.js img.png x1 x2 ...
const readPNG = require('./measure');
const file = process.argv[2];
const cols = process.argv.slice(3).map(Number);
const img = readPNG(file);
const { w, h, data, ch } = img;
function isStruct(x, y) {
  const i = (y * w + x) * ch;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return (r + g + b) > 500 && (b - r) > 16;
}
for (const x of cols) {
  const clusters = [];
  let start = -1;
  for (let y = 0; y < h; y++) {
    let any = false;
    for (let dx = -2; dx <= 2; dx++) if (x + dx >= 0 && x + dx < w && isStruct(x + dx, y)) { any = true; break; }
    if (any && start < 0) start = y;
    if (!any && start >= 0) { if (y - start > 6) clusters.push([start, y - 1]); start = -1; }
  }
  if (start >= 0) clusters.push([start, h - 1]);
  console.log(x, JSON.stringify(clusters));
}
