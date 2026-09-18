// Segment pale structure pixels in a frame; report structure x-extent per row
// (or y-extent per column). Usage:
//   node tools/pixscan.js img.png rows y0 y1 step [x0 x1]
//   node tools/pixscan.js img.png cols x0 x1 step [y0 y1]
const { chromium } = require('playwright-core');
const [img, mode, a0, a1, stepStr] = process.argv.slice(2);
const b0 = +(process.argv[7] || 0);
const b1 = +(process.argv[8] || (mode === 'rows' ? 576 : 1280));
const n0 = +a0, n1 = +a1, step = +(stepStr || 10);
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  const url = 'http://localhost:8123/' + img.replace(/\\/g, '/');
  await page.goto(url);
  const out = await page.evaluate(async ({ mode, n0, n1, step, b0, b1 }) => {
    const img = document.querySelector('img');
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const W = cv.width, H = cv.height;
    const data = ctx.getImageData(0, 0, W, H).data;
    function cls(x, y) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i + 1], bl = data[i + 2];
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      if (mx > 214 && (bl - r) >= 0 && (mx - mn) < 55) return 2; // near-white top
      if (mx > 178 && (bl - r) > 4 && (mx - mn) < 70) return 1; // any structure
      return 0;
    }
    function runsOf(line, want, along) {
      const runs = [];
      let s = -1;
      for (let x = b0; x <= b1 + 1; x++) {
        const on = x <= b1 && cls(x, line) === want;
        if (on && s < 0) s = x;
        if (!on && s >= 0) { if (x - s >= 4) runs.push([s, x - 1]); s = -1; }
      }
      return runs;
    }
    const lines = [];
    if (mode === 'vprof') {
      const xs = [];
      for (let x = n0; x <= n1; x += step) xs.push(x);
      for (const x of xs) {
        const tr = [];
        let prev = null;
        for (let y = b0; y <= b1; y++) {
          const i = (y * W + x) * 4;
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (prev !== null && Math.abs(lum - prev) > 45) {
            tr.push([y, Math.round(lum - prev), [data[i], data[i + 1], data[i + 2]]]);
          }
          prev = lum;
        }
        lines.push({ x, tr: tr.slice(0, 12) });
      }
      return { W, H, lines };
    }
    if (mode === 'hprof') {
      const y = n0;
      for (let x = b0; x <= b1; x += step) {
        const i = (y * W + x) * 4;
        lines.push({ x, rgb: [data[i], data[i + 1], data[i + 2]] });
      }
      return { W, H, lines };
    }
    if (mode === 'vedge') {
      // per x column: y where luminance jumps up (bg->bright face) and down
      for (let x = n0; x <= n1; x += step) {
        const up = [], dn = [];
        let prev = null;
        for (let y = b0; y <= b1; y++) {
          const i = (y * W + x) * 4;
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (prev !== null && lum - prev > 55) up.push(y);
          if (prev !== null && prev - lum > 55) dn.push(y);
          prev = lum;
        }
        lines.push({ x, up: up.slice(0, 8), dn: dn.slice(0, 8) });
      }
      return { W, H, lines };
    }
    if (mode === 'rows') {
      for (let y = n0; y <= n1; y += step) {
        let first = -1, last = -1, cnt = 0;
        for (let x = b0; x <= b1; x++) if (cls(x, y)) { if (first < 0) first = x; last = x; cnt++; }
        lines.push({ y, first, last, cnt, bright: runsOf(y, 2) });
      }
    } else {
      for (let x = n0; x <= n1; x += step) {
        let first = -1, last = -1, cnt = 0;
        for (let y = b0; y <= b1; y++) if (cls(x, y)) { if (first < 0) first = y; last = y; cnt++; }
        lines.push({ x, first, last, cnt });
      }
    }
    return { W, H, lines };
  }, { mode, n0, n1, step, b0, b1 });
  console.log('size', out.W, out.H);
  for (const l of out.lines) console.log(JSON.stringify(l));
  await browser.close();
})();
