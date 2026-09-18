// Capture init frame + every edge mid-walk at fine polling.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots', 'play');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(OUT, 'p0_init.png') });

  const hubXY = await page.evaluate(() => {
    const p = MV.hubWorld.clone().project(MV.camera);
    return [Math.round((p.x * 0.5 + 0.5) * 576), Math.round((-p.y * 0.5 + 0.5) * 1280)];
  });
  const [hx, hy] = hubXY;
  async function drag(sign) {
    await page.mouse.move(hx + 8, hy - 8);
    await page.mouse.down();
    const R = 30, a0 = -Math.PI / 4;
    for (let i = 0; i <= 14; i++) {
      const a = a0 + sign * (105 * Math.PI / 180) * (i / 14);
      await page.mouse.move(hx + Math.cos(a) * R, hy + Math.sin(a) * R);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
  }
  await drag(1);
  let docked = await page.evaluate(() => MV.state().docked);
  console.log('docked after +drag:', docked);
  if (!docked) { await drag(-1); docked = await page.evaluate(() => MV.state().docked); }
  console.log('docked final:', docked);

  await page.mouse.click(328, 368);
  const shot = new Set();
  for (let i = 0; i < 800; i++) {
    await page.waitForTimeout(60);
    const s = await page.evaluate(() => {
      const x = MV.state();
      return { edge: x.idaState && x.idaState.edge, t: x.idaState && x.idaState.t, won: x.won };
    });
    if (s.edge && s.t > 0.3 && s.t < 0.75 && !shot.has(s.edge)) {
      shot.add(s.edge);
      console.log('shot', s.edge, s.t.toFixed(2));
      await page.screenshot({ path: path.join(OUT, 'w_' + s.edge + '.png') });
    }
    if (i % 15 === 0) console.log('poll', i, JSON.stringify(s));
    if (s.won) break;
  }
  console.log('walkshots:', [...shot].join(','));
  await browser.close();
})();
