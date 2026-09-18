// 极简 PNG 读取 + 结构边缘测量（零依赖）
// 用法: node tools/measure.js frame.png x0 y0 x1 y1 mode
// mode: top 每列最上结构点 | bottom 最下 | hprof 行计数 | raw 打印采样点
const fs = require('fs');
const zlib = require('zlib');

function readPNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w = 0, h = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      w = buf.readUInt32BE(pos + 8);
      h = buf.readUInt32BE(pos + 12);
    } else if (type === 'IDAT') idat.push(buf.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ct = buf[25];
  const ch = ct === 0 ? 1 : ct === 2 ? 3 : ct === 6 ? 4 : 3;
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= ch && y > 0) ? out[(y - 1) * stride + x - ch] : 0;
      let o;
      switch (f) {
        case 0: o = v; break;
        case 1: o = v + a; break;
        case 2: o = v + b; break;
        case 3: o = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          o = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break;
        }
      }
      out[y * stride + x] = o & 255;
    }
  }
  return { w, h, data: out, ch };
}
module.exports = readPNG;

if (require.main !== module) return;
const file = process.argv[2];
const [x0, y0, x1, y1] = process.argv.slice(3, 7).map(Number);
const mode = process.argv[7] || 'top';
const img = readPNG(file);
const { w, data, ch } = img;
function px(x, y) {
  const i = (y * w + x) * ch;
  return [data[i], data[i + 1], data[i + 2]];
}
// 结构像素：与深灰背景区分（蓝/亮度）
function isStruct(x, y) {
  const [r, g, b] = px(x, y);
  return b > 105 && (b - r) > 8;
}

if (mode === 'top') {
  for (let x = x0; x <= x1; x += 6) {
    let yTop = -1;
    for (let y = y0; y <= y1; y++) if (isStruct(x, y)) { yTop = y; break; }
    console.log(x, yTop);
  }
} else if (mode === 'bottom') {
  for (let x = x0; x <= x1; x += 6) {
    let yB = -1;
    for (let y = y1; y >= y0; y--) if (isStruct(x, y)) { yB = y; break; }
    console.log(x, yB);
  }
} else if (mode === 'hprof') {
  for (let y = y0; y <= y1; y += 3) {
    let n = 0;
    for (let x = x0; x <= x1; x++) if (isStruct(x, y)) n++;
    console.log(y, n);
  }
} else if (mode === 'vprof') {
  for (let x = x0; x <= x1; x += 3) {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (isStruct(x, y)) n++;
    console.log(x, n);
  }
}
