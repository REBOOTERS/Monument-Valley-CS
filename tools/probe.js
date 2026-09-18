// Probe camera projection: screen-space axes per world unit, and node positions.
const { chromium } = require('playwright-core');
const exe = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 600));
  const out = await page.evaluate(() => {
    const { camera, N } = MV;
    const origin = new THREE.Vector3(0, 0, 0).project(camera);
    const px = v => [(v.x * 0.5 + 0.5) * 576, (-v.y * 0.5 + 0.5) * 1280];
    const O = px(origin);
    const res = { origin: O };
    for (const [ax, vec] of [['x', [1, 0, 0]], ['y', [0, 1, 0]], ['z', [0, 0, 1]]]) {
      const p = px(new THREE.Vector3(...vec).project(camera));
      res[ax] = [p[0] - O[0], p[1] - O[1]];
    }
    res.nodes = {};
    for (const k of Object.keys(N)) {
      res.nodes[k] = px(N[k].clone().project(camera));
    }
    res.mechAngle = MV.mech.rotation.x;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
