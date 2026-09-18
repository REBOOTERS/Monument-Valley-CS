// Full-circle hidden-pose table for ONE axis: theta where long arm fracHidden>=.85.
const { chromium } = require('playwright-core');
const CHROME = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const N = [-0.3288, -0.0943, 0.9397];

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
    for (let k = 0; k < 180; k++) {
      const th = TAU * k / 180;
      const d = rod(n, th, Y);
      const f = fracHidden(d, 0.99, 0.11);
      rows.push([+(th / D2R).toFixed(0), +azOf(d).toFixed(0), +d.z.toFixed(2),
                 +(Vn.dot(d)).toFixed(2), +f.toFixed(2)]);
    }
    return rows;
  }, N);
  console.log('theta  az  Vx   z   frac');
  for (const r of out) if (r[4] >= 0.85) console.log(r.join('  '));
  await browser.close();
})();
