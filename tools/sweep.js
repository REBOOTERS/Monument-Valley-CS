// Sweep rotor angle, screenshot each, print key endpoint projections.
// Usage: node sweep.js [fromDeg] [toDeg] [stepDeg]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const exe = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const from = +(process.argv[2] ?? 0);
const to = +(process.argv[3] ?? 60);
const step = +(process.argv[4] ?? 10);
const OUT = path.join(__dirname, '..', 'shots', 'sweep');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 500));

  for (let deg = from; deg <= to; deg += step) {
    const rad = deg * Math.PI / 180;
    const proj = await page.evaluate((r) => {
      MV.setTheta(r);
      MV.scene.updateMatrixWorld(true);
      const { rotor, camera, N } = MV;
      const wB = rotor.localToWorld(new THREE.Vector3(1.06, 0, 0));
      const wA = rotor.localToWorld(new THREE.Vector3(0, 0, -2));
      const px = v => {
        const p = v.clone().project(camera);
        return [Math.round((p.x * 0.5 + 0.5) * 576), Math.round((-p.y * 0.5 + 0.5) * 1280)];
      };
      const r3 = v => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
      return {
        Q: px(N.N4), B: px(wB), A: px(wA),
        tip: px(N.N3), wB: r3(wB), wA: r3(wA),
      };
    }, rad);
    const name = String(deg).padStart(3, '0');
    await page.screenshot({ path: path.join(OUT, 'a' + name + '.png') });
    console.log(deg, JSON.stringify(proj));
  }
  await browser.close();
})();
