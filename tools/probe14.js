// Branch-aware final arbitration for f3-simultaneity finalists.
// For each axis: BOTH dock-short crossings (branches) of az 105.6 with sane
// Lb; per branch: f3-simultaneity (S-az at the valid f3 long crossing) and
// joint-hidden theta runs (both arms fully occluded). Data vs hiding in one pass.
const { chromium } = require('playwright-core');
const CHROME = process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const CANDS = [
  [22, [-0.939, 0.342, -0.035]], [37, [-0.913, 0.406, 0.035]],
  [40, [-0.909, 0.405, 0.105]], [62, [-0.870, 0.462, 0.174]],
  [89, [-0.823, 0.514, 0.242]],
  [195, [-0.382, -0.139, 0.914]], [204, [-0.329, -0.094, 0.940]],
  [217, [-0.259, -0.094, 0.961]], [230, [-0.190, -0.085, 0.978]],
];

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

  async function evalAxis(idx, nv) {
    return page.evaluate(([idx, nv]) => {
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
      function crossingsAt(target) {
        const res = [];
        for (let k = 0; k < 5760; k++) {
          const th = TAU * k / 5760;
          const d = rod(n, th, Y);
          if (Math.abs(((azOf(d) - target + 180) % 360) - 180) < 0.3)
            res.push({ th, d, px: projOf(d) * 154 * 0.99, proj: projOf(d) });
        }
        return res;
      }
      const branches = [];
      for (const c of crossingsAt(105.6)) {
        const Lb = 57.1 / (154 * c.proj);
        if (Lb >= 0.30 && Lb <= 0.60) branches.push({ th: c.th, d: c.d, Lb: +Lb.toFixed(3) });
      }
      const out = [];
      for (const br of branches) {
        // f3 simultaneity for this branch
        let sim = null;
        for (const c of crossingsAt(160.8)) {
          if (c.px < 94 || c.px > 122) continue;
          const bp = rod(n, c.th, br.d);
          sim = { longPx: +c.px.toFixed(0), Saz: +azOf(bp).toFixed(1), Spx: +(br.Lb * projOf(bp) * 154).toFixed(0) };
        }
        // joint hidden runs
        const rows = [];
        for (let k = 0; k < 120; k++) {
          const th = TAU * k / 120;
          rows.push([th, fracHidden(rod(n, th, Y), 0.99, 0.11),
                     fracHidden(rod(n, th, br.d), br.Lb, 0.09)]);
        }
        const runs = [];
        for (let i = 0; i < 120; i++) {
          if (rows[i][1] >= .93 && rows[i][2] >= .93) {
            let j = i;
            while (j + 1 < 120 && rows[j + 1][1] >= .93 && rows[j + 1][2] >= .93) j++;
            runs.push([rows[i][0] / D2R, rows[j][0] / D2R]);
            i = j;
          }
        }
        let best = null;
        if (runs.length) {
          let bi = 0;
          for (let i = 1; i < runs.length; i++)
            if (runs[i][1] - runs[i][0] > runs[bi][1] - runs[bi][0]) bi = i;
          const thh = (runs[bi][0] + runs[bi][1]) / 2 * D2R;
          const a0 = rod(n, thh, Y), b0 = rod(n, thh, br.d);
          best = { midDeg: +(thh / D2R).toFixed(1), azA: +azOf(a0).toFixed(1), azB: +azOf(b0).toFixed(1),
                   va: +Vn.dot(a0).toFixed(2), za: +a0.z.toFixed(2),
                   a0: a0.toArray().map(x => +x.toFixed(4)), b0: b0.toArray().map(x => +x.toFixed(4)),
                   thetaDock: +(-thh).toFixed(4) };
        }
        out.push({ Lb: br.Lb, sim, runs: runs.map(rr => rr.map(x => +x.toFixed(0))), best });
      }
      return out;
    }, [idx, nv]);
  }

  for (const [idx, nv] of CANDS) {
    const res = await evalAxis(idx, nv);
    for (const b of res) {
      const sim = b.sim ? ('f3px ' + b.sim.longPx + ' Saz ' + b.sim.Saz + ' (d ' + (b.sim.Saz - 120.2).toFixed(1) + ') Spx ' + b.sim.Spx) : 'f3: no valid crossing';
      console.log('idx %d n(%+.2f,%+.2f,%+.2f) Lb %.3f | %s | runs %s',
        idx, nv[0], nv[1], nv[2], b.Lb, sim, JSON.stringify(b.runs));
      if (b.best) console.log('     best', JSON.stringify(b.best));
    }
  }
  await browser.close();
})();
