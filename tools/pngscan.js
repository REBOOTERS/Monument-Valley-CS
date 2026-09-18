// Zero-dep PNG pixel scanner (Node zlib only). 8-bit gray/rgb/rgba, non-interlaced.
// Modes:
//   node tools/pngscan.js row   img.png y  x0 x1 [step]
//   node tools/pngscan.js col   img.png x  y0 y1 [step]
//   node tools/pngscan.js rows  img.png y0 y1 step x0 x1     (structure extents, pixscan-style)
//   node tools/pngscan.js vprof img.png x0 x1 step y0 y1     (lum transitions per column)
const fs = require('fs');
const zlib = require('zlib');

function readPNG(path) {
  const buf = fs.readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let p = 8, W = 0, H = 0, depth = 0, colorType = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      W = data.readUInt32BE(0); H = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!ch || depth !== 8) throw new Error('unsupported depth/type ' + depth + '/' + colorType);
  const stride = W * ch;
  const rgba = Buffer.alloc(W * H * 4);
  const prev = Buffer.alloc(stride);
  let rp = 0;
  function pa(a, b, c) {
    const q = a + b - c;
    return Math.abs(q - a) <= Math.abs(q - b) && Math.abs(q - a) <= Math.abs(q - c) ? a
      : Math.abs(q - b) <= Math.abs(q - c) ? b : c;
  }
  for (let y = 0; y < H; y++) {
    const f = raw[rp++];
    const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const x = line[i], L = cur[i - ch] || 0, U = prev[i], UL = prev[i - ch] || 0;
      cur[i] = f === 0 ? x : f === 1 ? (x + L) & 255 : f === 2 ? (x + U) & 255
        : f === 3 ? (x + ((L + U) >> 1)) & 255
        : (x + pa(L, U, UL)) & 255;
    }
    for (let x = 0; x < W; x++) {
      const o = x * ch, d = (y * W + x) * 4;
      rgba[d] = cur[o];
      rgba[d + 1] = colorType === 0 ? cur[o] : cur[o + 1];
      rgba[d + 2] = colorType === 0 ? cur[o] : cur[o + (ch === 4 ? 2 : 1)];
      rgba[d + 3] = ch === 4 ? cur[o + 3] : 255;
    }
    cur.copy(prev);
  }
  return { W, H, data: rgba };
}

const [, , mode, img, a0s, a1s, a2s, a3s, a4s, a5s] = process.argv;
const { W, H, data } = readPNG(img);
const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};
const lum = (x, y) => {
  const [r, g, b] = px(x, y);
  return (r + g + b) / 3;
};
console.log('size', W, H);

if (mode === 'row') {
  const y = +a0s, x0 = +a1s, x1 = +a2s, step = +(a3s || 2);
  for (let x = x0; x <= x1; x += step)
    console.log(x, JSON.stringify(px(x, y)));
} else if (mode === 'col') {
  const x = +a0s, y0 = +a1s, y1 = +a2s, step = +(a3s || 2);
  for (let y = y0; y <= y1; y += step)
    console.log(y, JSON.stringify(px(x, y)));
} else if (mode === 'rows') {
  const y0 = +a0s, y1 = +a1s, step = +(a2s || 10), x0 = +(a3s || 0), x1 = +(a4s || W - 1);
  const cls = (x, y) => {
    const [r, g, b] = px(x, y);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 214 && (b - r) >= 0 && (mx - mn) < 55) return 2;
    if (mx > 178 && (b - r) > 4 && (mx - mn) < 70) return 1;
    return 0;
  };
  for (let y = y0; y <= y1; y += step) {
    let first = -1, last = -1, cnt = 0;
    const runs = []; let s = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const on = x <= x1 && cls(x, y) > 0;
      if (on && first < 0) first = x;
      if (on) { last = x; cnt++; }
      const on2 = x <= x1 && cls(x, y) === 2;
      if (on2 && s < 0) s = x;
      if (!on2 && s >= 0) { if (x - s >= 4) runs.push([s, x - 1]); s = -1; }
    }
    console.log(JSON.stringify({ y, first, last, cnt, bright: runs }));
  }
} else if (mode === 'art') {
  // art img x0 y0 w h sx sy  -> ascii brightness (and '#' for bright class2)
  const x0 = +a0s, y0 = +a1s, w = +a2s, h = +a3s, sx = +(a4s || 2), sy = +(a5s || 2);
  for (let y = y0; y < y0 + h; y += sy) {
    let line = String(y).padStart(4) + ' ';
    for (let x = x0; x < x0 + w; x += sx) {
      const [r, g, b] = px(x, y), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const L = (r + g + b) / 3;
      if (mx > 214 && (b - r) >= 0 && (mx - mn) < 55) line += '#';
      else if (mx > 178 && (b - r) > 4 && (mx - mn) < 70) line += '+';
      else if (L < 90) line += '.';
      else if (L < 130) line += ':';
      else if (L < 165) line += '-';
      else line += ' ';
    }
    console.log(line);
  }
  let hdr = '     ';
  for (let x = x0; x < x0 + w; x += sx) hdr += (x % 10 === 0) ? String((x / 10) % 10) : ' ';
  console.log(hdr);
} else if (mode === 'vprof') {
  const x0 = +a0s, x1 = +a1s, step = +(a2s || 10), y0 = +(a3s || 0), y1 = +(a4s || H - 1);
  for (let x = x0; x <= x1; x += step) {
    const tr = [];
    let prev = null;
    for (let y = y0; y <= y1; y++) {
      const L = lum(x, y);
      if (prev !== null && Math.abs(L - prev) > 45)
        tr.push([y, Math.round(L - prev), px(x, y)]);
      prev = L;
    }
    console.log(JSON.stringify({ x, tr: tr.slice(0, 14) }));
  }
}
