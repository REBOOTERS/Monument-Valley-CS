// Joint occlusion arbitration v2 for grid survivors (tools/axes2.json).
// Per axis: exact dock-short crossing (b0d, Lb in [0.32,0.55]), then theta
// sweep (pose = rod(n,theta,+y), dock at theta=0): joint hidden runs of both
// arms, plus re-zeroing printout (a0/b0 at mid-hidden, thetaDock = -theta_h).
const { chromium } = require('playwright-core');
const fs = require('fs');
const CHROME = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
let AXES = JSON.parse(fs.readFileSync(__dirname + '/axes3.json', 'utf8')).axes;
AXES = AXES.filter((_, i) => i % 15 === 0).slice(0, 20);

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

  async function evalAxis(nv) {
    return page.evaluate((nv) => {
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
      function crossingAt(target, want) {   // want: 'px>=lo,Lb in range' style callback
        for (let k = 0; k < 2880; k++) {
          const th = TAU * k / 2880;
          const d = rod(n, th, Y);
          if (Math.abs(((azOf(d) - target + 180) % 360) - 180) < 0.6) {
            const proj = projOf(d);
            const Lb = want / (154 * proj);
            if (Lb >= 0.32 && Lb <= 0.55) return { th, d, Lb: +Lb.toFixed(3), proj: +proj.toFixed(3) };
          }
        }
        return null;
      }
      const bd = crossingAt(105.6, 57.1);
      if (!bd) return { err: 'no dock-short crossing with sane Lb' };
      const Lb = bd.Lb, b0d = bd.d;
      const rows = [];
      for (let k = 0; k < 120; k++) {
        const th = TAU * k / 120;
        rows.push([th / D2R,
          fracHidden(rod(n, th, Y), 0.99, 0.11),
          fracHidden(rod(n, th, b0d), Lb, 0.09)]);
      }
      const runs = [];
      for (let i = 0; i < 120; i++) {
        if (rows[i][1] >= .93 && rows[i][2] >= .93) {
          let j = i;
          while (j + 1 < 120 && rows[j + 1][1] >= .93 && rows[j + 1][2] >= .93) j++;
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
        const v = new THREE.Vector3(-0.499, 0.566, 0.656);
        best = { midDeg: +(thh / D2R).toFixed(1), azA: +azOf(a0).toFixed(1), azB: +azOf(b0).toFixed(1),
                 va: +(v.dot(a0)).toFixed(2), vb: +(v.dot(b0)).toFixed(2), za: +a0.z.toFixed(2), zb: +b0.z.toFixed(2),
                 a0: a0.toArray().map(x => +x.toFixed(4)), b0: b0.toArray().map(x => +x.toFixed(4)) };
      }
      return { Lb, runs: runs.map(rr => rr.map(x => +x.toFixed(0))), best };
    }, nv);
  }

  for (let i = 0; i < AXES.length; i++) {
    const nv = AXES[i];
    const res = await evalAxis(nv);
    const tag = 'AX' + String(i).padStart(2, '0') + ' n(' + nv.map(v => v.toFixed(2)).join(',') + ')';
    if (res.err) { console.log(tag, 'ERR', res.err); continue; }
    console.log(tag, 'Lb', res.Lb, 'runs', JSON.stringify(res.runs));
    if (res.best) console.log('    best', JSON.stringify(res.best));
  }
  await browser.close();
})();
