// Rotor render arbitration: shoot init / f3 / dock states (+ rotor-hidden twins)
// so the rotor's visible footprint can be diffed against the reference frames.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { chromeExecutablePath } = require('./chrome');
const OUT = path.join(__dirname, '..', 'shots', 'v9');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = chromeExecutablePath();

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await page.waitForTimeout(12600);   // 等操作提示（t>12s 自动隐藏），保证与参考帧可比

  const THETA = await page.evaluate(() => MV.THETA_F3 || 0);
  console.log('theta f3 =', THETA);

  async function snap(name, theta, hideRotor) {
    await page.evaluate(([t, h]) => {
      MV.init();
      MV.setTheta(t);
      MV.rotor.visible = !h;
    }, [theta, hideRotor]);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, name) });
    console.log('saved', name);
  }

  await snap('init.png', 0, false);
  await snap('init_norotor.png', 0, true);
  if (THETA) {
    await snap('f3.png', THETA, false);
  }
  await page.evaluate(() => { MV.init(); MV.dock(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'dock.png') });
  console.log('saved dock.png  state', JSON.stringify(await page.evaluate(() => MV.state())));
  await browser.close();
})();
