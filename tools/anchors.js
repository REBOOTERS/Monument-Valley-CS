// Project world anchor points to screen px for comparison with reference frames
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
    function P(x, y, z) {
      const p = new THREE.Vector3(x, y, z).project(MV.camera);
      return [Math.round((p.x * 0.5 + 0.5) * 576), Math.round((-p.y * 0.5 + 0.5) * 1280)];
    }
    const N = MV.N;
    return {
      Q_top: P(0, 0, 2), Q_bottom_beamface: P(0, 0, 1.7),
      colFront_top: P(0.25, -0.37, 2.22),
      N2: P(N.N2.x, N.N2.y, N.N2.z), N3: P(N.N3.x, N.N3.y, N.N3.z),
      N2_bottom: P(N.N2.x, N.N2.y, N.N2.z - 0.34),
      TL_top: P(2.45, 0, 2), TL_band: P(2.0, 0, 1.7),
      N7_pad: P(N.N7.x, N.N7.y, N.N7.z),
      beam_x285_top: P(0.85, 0, 2), beam_x285_bottom: P(0.85, 0, 1.7),
      hub: P(-0.375, -0.115, 1.545),
      bottomBeam_nearArch: P(1.167, 1.028, 0),
      bottomBeam_col: P(0, 0, 0),
    };
  });
  console.log(JSON.stringify(a, null, 1));
  await browser.close();
})();
