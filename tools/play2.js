// End-to-end drag test on macOS: drag crank to dock, tap altar, capture finale.
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots', 'play');
fs.mkdirSync(OUT, { recursive: true });
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
  await new Promise(r => setTimeout(r, 700));

  const hubXY = await page.evaluate(() => {
    const p = MV.hubWorld.clone().project(MV.camera);
    return [Math.round((p.x * 0.5 + 0.5) * 576), Math.round((-p.y * 0.5 + 0.5) * 1280)];
  });
  const [hx, hy] = hubXY;
  console.log('hub screen', hx, hy);

  async function drag(sign) {
    await page.mouse.move(hx + 8, hy - 8);
    await page.mouse.down();
    const R = 30;
    const a0 = -Math.PI / 4;
    for (let i = 0; i <= 14; i++) {
      const a = a0 + sign * (105 * Math.PI / 180) * (i / 14);
      await page.mouse.move(hx + Math.cos(a) * R, hy + Math.sin(a) * R);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
  }
  await drag(1);
  let st = await page.evaluate(() => MV.state());
  console.log('after cw drag', JSON.stringify(st));
  if (!st.docked) {
    await drag(-1);
    st = await page.evaluate(() => MV.state());
    console.log('after ccw drag', JSON.stringify(st));
  }
  await page.screenshot({ path: path.join(OUT, 'p1_docked.png') });

  if (st.docked) {
    await page.mouse.click(328, 368);
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(400);
      const s = await page.evaluate(() => {
        const x = MV.state();
        return { edge: x.idaState && x.idaState.edge, t: x.idaState && x.idaState.t, won: x.won };
      });
      if (s.won) { console.log('WON at iter', i); break; }
      if (i % 10 === 0) console.log('...', JSON.stringify(s));
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'fin1.png') });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, 'fin2.png') });
    console.log('final', JSON.stringify(await page.evaluate(() => MV.state())));
  }
  await browser.close();
})();
