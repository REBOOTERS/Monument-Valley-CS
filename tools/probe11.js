// Joint occlusion arbitration for the 30 grid-surviving axes (tools/axes.json).
// Per axis: dock short-arm dir b0d = orbit crossing of screen az 105.6 with px
// nearest 57.1 (Lb = px/154/proj). Sweep theta (pose = rod(n,theta,+y), so
// theta=0 is dock): find theta ranges where BOTH arms are fully occluded =>
// valid init poses (theta_i); game thetaDock = -theta_i.
const { chromium } = require('playwright-core');
const fs = require('fs');
const CHROME = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const AXES = JSON.parse(fs.readFileSync(__dirname + '/axes.json', 'utf8')).axes;

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

  function evalAxis(nv) {
    return page.evaluate((nv) => {
      const TAU = Math.PI * 2, eps = 0.05, D2R = Math.PI / 180;
      const cam = MV.camera, rc = new THREE.Raycaster(), ptr = new THREE.Vector2();
      const Vn = new THREE.Vector3(-0.499, 0.566, 0.656);
      const rS = new THREE.Vector3(-.750, -.661, 0), uS = new THREE.Vector3(.434, -.492, .755);
      const Y = new THREE.Vector3(0, 1, 0);
      const n = new THREE.Vector3(...nv).normalize();
      const Q = MV.QW.clone();
      function rod(nn, th, d) {
        const c = Math.cos(th), s = Math.sin(th);
        return d.clone().multiplyScalar(c)
          .add(new THREE.Vector3().crossVectors(nn, d).multiplyScalar(s))
          .add(nn.clone().multiplyScalar(nn.dot(d) * (1 - c)));
      }
      const azOf = d => { const a = Math.atan2(-(uS.dot(d)), rS.dot(d)) / D2R; return (a + 360) % 360; };
      const projOf = d => Math.hypot(rS.dot(d), uS.dot(d));
      // dock short dir: crossings of az 105.6
      let b0d = null, Lb = 0;
      {
        let best = null;
        for (let k = 0; k < 1440; k++) {
          const d = rod(n, TAU * k / 1440, Y);
          const da = Math.abs(((azOf(d) - 105.6 + 180) % 360) - 180);
          if (da < 1.5) {
            const px = projOf(d) * 154;
            const sc = Math.abs(px - 57.1);
            if (!best || sc < best.sc) best = { sc, px, proj: projOf(d), d };
          }
        }
        if (!best) return { err: 'no dock-short crossing' };
        b0d = best.d; Lb = best.px / 154 / best.proj;
      }
      function hidden(P) {
        const ndc = P.clone().project(cam);
        ptr.set(ndc.x, ndc.y);
        rc.setFromCamera(ptr, cam);
        const hits = rc.intersectObjects(MV.scene.children, true);
        const pDist = P.clone().sub(rc.ray.origin).dot(rc.ray.direction);
        for (const h of hits) {
          let o = h.object, skip = false;
          while (o) { if (o === MV.mech || o === MV.rotor || o === MV.ida) { skip = true; break; } o = o.parent; }
          if (skip || h.object.isPoints || h.object.isSprite) continue;
          if (h.distance < pDist - eps) return true;
        }
        return false;
      }
      function fracHidden(dw, L) {
        const w1 = new THREE.Vector3().crossVectors(Vn, dw).normalize();
        let hid = 0, tot = 0;
        for (let i = 0; i <= 6; i++) {
          const s = 0.06 + (L - 0.06) * i / 6;
          for (const o1 of [-0.11, 0, 0.11]) for (const o2 of [-0.15, 0.15]) {
            const P = Q.clone().addScaledVector(dw, s).addScaledVector(w1, o1).addScaledVector(Vn, o2);
            tot++; if (hidden(P)) hid++;
          }
        }
        return hid / tot;
      }
      const rows = [];
      for (let k = 0; k < 120; k++) {
        const th = TAU * k / 120;
        const fl = fracHidden(rod(n, th, Y), 0.99);
        const fs = Lb >= 0.25 && Lb <= 0.60 ? fracHidden(rod(n, th, b0d), Lb) : -1;
        rows.push([th, fl, fs]);
      }
      const runsL = [], runsS = [];
      for (let i = 0; i < 120; i++) {
        if (rows[i][1] >= .93) { let j = i; while (j + 1 < 120 && rows[j + 1][1] >= .93) j++; runsL.push([+(rows[i][0]*180/Math.PI).toFixed(0), +(rows[j][0]*180/Math.PI).toFixed(0)]); i = j; }
      }
      for (let i = 0; i < 120; i++) {
        if (rows[i][2] >= .93) { let j = i; while (j + 1 < 120 && rows[j + 1][2] >= .93) j++; runsS.push([+(rows[i][0]*180/Math.PI).toFixed(0), +(rows[j][0]*180/Math.PI).toFixed(0)]); i = j; }
      }
      let f3 = null;
      for (let k = 0; k < 1440; k++) {
        const d = rod(n, TAU * k / 1440, Y);
        const da = Math.abs(((azOf(d) - 160.8 + 180) % 360) - 180);
        if (da < 1.0) {
          const px = projOf(d) * 154;
          if (px >= 90 && px <= 126) f3 = { th: TAU * k / 1440 / D2R, px: +px.toFixed(0) };
        }
      }
      const a0i = runsL.length ? rod(n, ((runsL[0][0] + runsL[0][1]) / 2) / 180 * Math.PI, Y) : null;
      return { runsL, runsS,
        Lb: +Lb.toFixed(3),
        f3: f3 ? { th: +f3.th.toFixed(1), px: f3.px } : null,
        a0: a0i ? [+a0i.x.toFixed(4), +a0i.y.toFixed(4), +a0i.z.toFixed(4)] : null,
        azInit: a0i ? +azOf(a0i).toFixed(1) : null,
      };
    }, nv);
  }

  for (let i = 0; i < AXES.length; i++) {
    const nv = AXES[i];
    const res = await evalAxis(nv);
    console.log('AX' + i + ' n(' + nv.map(v=>v.toFixed(2)).join(',') + ') Lb ' + (res.Lb ?? '-') + ' runsL ' + JSON.stringify(res.runsL ?? res.err ?? '?') + ' runsS ' + JSON.stringify(res.runsS ?? '-') + ' f3 ' + JSON.stringify(res.f3 ?? '-') + ' azInitL ' + (res.azInit ?? '-'));
  }
  await browser.close();
})();
