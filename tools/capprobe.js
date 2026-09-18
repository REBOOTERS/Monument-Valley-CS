// Probe crank cap world/screen positions and depth (V dot) at init
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 500));
  const a = await page.evaluate(() => {
    const V = new THREE.Vector3(-0.499, 0.566, 0.656);
    const hub = MV.hubWorld;
    const dirs = [
      ['a_up', new THREE.Vector3(0.434, -0.492, 0.755), 0.36],
      ['a_dn', new THREE.Vector3(-0.434, 0.492, -0.755), 0.36],
      ['b_ru', new THREE.Vector3(0.051, -0.901, -0.433), 0.58],
      ['b_ld', new THREE.Vector3(-0.075, 0.938, 0.334), 0.32],
    ];
    function P(v) {
      const p = v.clone().project(MV.camera);
      return [Math.round((p.x * 0.5 + 0.5) * 576), Math.round((-p.y * 0.5 + 0.5) * 1280)];
    }
    return { hub: { screen: P(hub), V: +hub.dot(V).toFixed(3) },
      caps: dirs.map(([name, v, d]) => {
        const w = hub.clone().addScaledVector(v, d);
        return { name, world: [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)],
          screen: P(w), V: +w.dot(V).toFixed(3) };
      }) };
  });
  console.log(JSON.stringify(a, null, 1));
  await browser.close();
})();
