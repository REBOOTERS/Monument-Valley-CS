// Joint-hidden verification for cand5.json (axis + correct dock-short branch).
const { chromium } = require('playwright-core');
const fs = require('fs');
const CHROME = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const CANDS = JSON.parse(fs.readFileSync(__dirname + '/cand5.json', 'utf8')).slice(0, 6);

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

  for (const cd of CANDS) {
    const res = await page.evaluate((cd) => {
      const TAU = Math.PI * 2, eps = 0.05, D2R = Math.PI / 180;
      const cam = MV.camera, rc = new THREE.Raycaster(), ptr = new THREE.Vector2();
      const Vn = new THREE.Vector3(-0.499, 0.566, 0.656);
      const rS = new THREE.Vector3(-.750, -.661, 0), uS = new THREE.Vector3(.434, -.492, .755);
      const Y = new THREE.Vector3(0, 1, 0);
      const n = new THREE.Vector3(...cd.n).normalize();
      const Q = MV.QW.clone();
      const rod = (nn, th, d) => d.clone().multiplyScalar(Math.cos(th))
        .add(new THREE.Vector3().crossVectors(nn, d).multiplyScalar(Math.sin(th)))
        .add(nn.clone().multiplyScalar(nn.dot(d) * (1 - Math.cos(th))));
      const azOf = d => ((Math.atan2(-(uS.dot(d)), rS.dot(d)) / D2R) + 360) % 360;
      const projOf0 = d => Math.hypot(rS.dot(d), uS.dot(d));
      let b0d = null, Lb = 0;
      for (let k = 0; k < 11520; k++) {
        const t = TAU * k / 11520;
        const d = rod(n, t, Y);
        if (Math.abs(((azOf(d) - 105.6 + 180) % 360) - 180) < 0.4) {
          const L = 57.1 / (154 * projOf0(d));
          if (L >= 0.30 && L <= 0.60) { b0d = d; Lb = L; break; }
        }
      }
      if (!b0d) return { runs: 'no dock-short branch' };
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
      const rows = [];
      for (let k = 0; k < 120; k++) {
        const th = TAU * k / 120;
        rows.push([th / D2R, fracHidden(rod(n, th, Y), 0.99, 0.11),
                   fracHidden(rod(n, th, b0d), Lb, 0.09)]);
      }
      const runs = [];
      for (let i = 0; i < 120; i++) {
        if (rows[i][1] >= .93) {
          let j = i;
          while (j + 1 < 120 && rows[j + 1][1] >= .93) j++;
          runs.push([rows[i][0], rows[j][0]]);
          i = j;
        }
      }
      let best = null;
      if (runs.length) {
        let bi = 0;
        for (let i = 1; i < runs.length; i++)
          if (runs[i][1] - runs[i][0] > runs[bi][1] - runs[bi][0]) bi = i;
        const thh = (runs[bi][0] + runs[bi][1]) / 2 * D2R;
        const a0 = rod(n, thh, Y), b0 = rod(n, thh, b0d);
        best = { midDeg: +(thh / D2R).toFixed(1), azA: +azOf(a0).toFixed(1), azB: +azOf(b0).toFixed(1),
                 va: +Vn.dot(a0).toFixed(2), za: +a0.z.toFixed(2),
                 a0: a0.toArray().map(x => +x.toFixed(4)), b0: b0.toArray().map(x => +x.toFixed(4)),
                 thetaDockDeg: +((-thh / D2R + 360) % 360).toFixed(1) };
      }
      return { runs: runs.map(rr => rr.map(x => +x.toFixed(0))), best };
    }, cd);
    console.log('idx ' + cd.idx + ' Lb ' + (cd.Lb).toFixed(3) + ' runs ' + JSON.stringify(res.runs));
    if (res.best) console.log('   best', JSON.stringify(res.best));
  }
  await browser.close();
})();
