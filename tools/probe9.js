// Depth-aware occlusion sweep for the rotor (v9a fit).
// For each theta (fit frame), sample points across both arms' cross-sections
// and raycast from the camera: a sample is hidden iff a non-arm mesh is
// strictly closer. Output: theta ranges where both arms are fully occluded
// => valid re-zeroing poses for init. Runs against localhost:8123.
const { chromium } = require('playwright-core');
const CHROME = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

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

  const res = await page.evaluate(() => {
    const TAU = Math.PI * 2, eps = 0.05;
    const cam = MV.camera, rc = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const Vn = new THREE.Vector3(-0.499, 0.566, 0.656);
    const n = MV.ROT_AXIS.clone().normalize();
    const a0 = new THREE.Vector3(0.5611, 0.4858, 0.6702).normalize();
    const b0 = new THREE.Vector3(0.238, 0.8949, 0.3776).normalize();
    const La = 0.99, Lb = 0.415, hw = 0.11, hd = 0.15;

    function rod(nn, th, d) {
      const c = Math.cos(th), s = Math.sin(th);
      return d.clone().multiplyScalar(c)
        .add(new THREE.Vector3().crossVectors(nn, d).multiplyScalar(s))
        .add(nn.clone().multiplyScalar(nn.dot(d) * (1 - c)));
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
      const w1 = new THREE.Vector3().crossVectors(Vn, dw).normalize(); // on-screen perp
      let hid = 0, tot = 0;
      for (let i = 0; i <= 8; i++) {
        const s = 0.06 + (L - 0.06) * i / 8;
        for (const o1 of [-hw, 0, hw]) for (const o2 of [-hd, hd]) {
          const P = MV.QW.clone().addScaledVector(dw, s)
            .addScaledVector(w1, o1).addScaledVector(Vn, o2);
          tot++; if (hidden(P)) hid++;
        }
      }
      return hid / tot;
    }
    const rows = [];
    for (let k = 0; k < 180; k++) {
      const th = TAU * k / 180;
      MV.rotor.visible = false;              // exclude rotor from its own occlusion test
      rows.push([Math.round(th * 180 / Math.PI),
                 +fracHidden(rod(n, th, a0), La).toFixed(2),
                 +fracHidden(rod(n, th, b0), Lb).toFixed(2)]);
    }
    MV.rotor.visible = true;
    MV.init();
    const runs = [];
    for (let i = 0; i < 180; i++) {
      if (rows[i][1] >= .98 && rows[i][2] >= .98) {
        let j = i;
        while (j + 1 < 180 && rows[j + 1][1] >= .98 && rows[j + 1][2] >= .98) j++;
        runs.push([rows[i][0], rows[j][0]]);
        i = j;
      }
    }
    return { rows, runs };
  });
  console.log(res.rows.map(r => r.join(',')).join('\n'));
  console.log('FULLY-HIDDEN RUNS (deg start,end):', JSON.stringify(res.runs));
  await browser.close();
})();
