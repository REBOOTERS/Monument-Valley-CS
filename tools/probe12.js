// Focused joint sweep for ONE axis (default AX27): both dock-short crossings,
// per-theta long/short hidden fractions, joint runs, pose printouts.
const { chromium } = require('playwright-core');
const CHROME = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const N = (process.argv[2] || '0.413176,0.492404,-0.766044').split(',').map(Number);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await page.waitForTimeout(700);

  const out = await page.evaluate((nv) => {
    const TAU = Math.PI * 2, eps = 0.05, D2R = Math.PI / 180;
    const cam = MV.camera, rc = new THREE.Raycaster(), ptr = new THREE.Vector2();
    const Vn = new THREE.Vector3(-0.499, 0.566, 0.656);
    const rS = new THREE.Vector3(-.750, -.661, 0), uS = new THREE.Vector3(.434, -.492, .755);
    const Y = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3(...nv).normalize();
    const Q = MV.QW.clone();
    const rod = (nn, th, d) => d.clone().multiplyScalar(Math.cos(th))
      .add(new THREE.Vector3().crossVectors(nn, d).multiplyScalar(Math.sin(th)))
      .add(nn.clone().multiplyScalar(nn.dot(d) * (1 - Math.cos(th))));
    const azOf = d => ((Math.atan2(-(uS.dot(d)), rS.dot(d)) / D2R) + 360) % 360;
    const projOf = d => Math.hypot(rS.dot(d), uS.dot(d));
    function hidden(P) {
      const ndc = P.clone().project(cam);
      ptr.set(ndc.x, ndc.y); rc.setFromCamera(ptr, cam);
      const pDist = P.clone().sub(rc.ray.origin).dot(rc.ray.direction);
      for (const h of rc.intersectObjects(MV.scene.children, true)) {
        let o = h.object, skip = false;
        while (o) { if (o === MV.mech || o === MV.rotor || o === MV.ida) { skip = true; break; } o = o.parent; }
        if (skip || h.object.isPoints || h.object.isSprite) continue;
        if (h.distance < pDist - eps) return true;
      }
      return false;
    }
    function fracHidden(dw, L, w) {
      const w1 = new THREE.Vector3().crossVectors(Vn, dw).normalize();
      let hid = 0, tot = 0;
      for (let i = 0; i <= 6; i++) {
        const s = 0.05 + (L - 0.05) * i / 6;
        for (const o1 of [-w, 0, w]) for (const o2 of [-0.14, 0.14]) {
          tot++; if (hidden(Q.clone().addScaledVector(dw, s).addScaledVector(w1, o1).addScaledVector(Vn, o2))) hid++;
        }
      }
      return hid / tot;
    }
    function crossings(target) {
      const res = [];
      for (let k = 0; k < 2880; k++) {
        const th = TAU * k / 2880;
        const d = rod(n, th, Y);
        if (Math.abs(((azOf(d) - target + 180) % 360) - 180) < 0.8) {
          const proj = projOf(d);
          res.push({ thDeg: +(th / D2R).toFixed(1), px: +(proj * 154 * 0.99).toFixed(1), proj: +proj.toFixed(3), d: d.toArray() });
        }
      }
      return res;
    }
    const f3cross = crossings(160.8);
    const dockShort = crossings(105.6).map(c => ({ ...c, Lb: +(c.px * 0.99 / 154 / c.proj / 0.99).toFixed(3) }));
    // short-arm candidates with sane Lb range get a full sweep
    const sweeps = [];
    for (const sc of dockShort) {
      if (sc.Lb < 0.25 || sc.Lb > 0.60) continue;
      const b0d = new THREE.Vector3(...sc.d), Lb = sc.Lb;
      const rows = [];
      for (let k = 0; k < 180; k++) {
        const th = TAU * k / 180;
        const dl = rod(n, th, Y), ds = rod(n, th, b0d);
        rows.push([+(th / D2R).toFixed(0), +azOf(dl).toFixed(0), +(projOf(dl) * 154 * 0.99).toFixed(0),
          +fracHidden(dl, 0.99, 0.11).toFixed(2), +azOf(ds).toFixed(0), +(projOf(ds) * 154 * Lb).toFixed(0),
          +fracHidden(ds, Lb, 0.09).toFixed(2)]);
      }
      sweeps.push({ Lb, rows });
    }
    return { n: n.toArray(), f3cross, dockShort, sweeps };
  }, N);
  console.log('n =', out.n.map(v => +v.toFixed(4)));
  console.log('f3 crossings (theta, px):', JSON.stringify(out.f3cross.map(c => [c.thDeg, c.px])));
  console.log('dock-short crossings (theta, px, Lb):', JSON.stringify(out.dockShort.map(c => [c.thDeg, c.px, c.Lb])));
  for (const sw of out.sweeps) {
    console.log('--- short Lb', sw.Lb, ' rows: th azL pxL fL | azS pxS fS');
    console.log(sw.rows.map(r => r.join(',')).join('\n'));
    const runs = [];
    for (let i = 0; i < sw.rows.length; i++) {
      if (sw.rows[i][3] >= .93 && sw.rows[i][6] >= .93) {
        let j = i;
        while (j + 1 < sw.rows.length && sw.rows[j + 1][3] >= .93 && sw.rows[j + 1][6] >= .93) j++;
        runs.push([sw.rows[i][0], sw.rows[j][0]]);
        i = j;
      }
    }
    console.log('JOINT HIDDEN RUNS:', JSON.stringify(runs));
  }
  await browser.close();
})();
