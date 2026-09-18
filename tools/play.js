// End-to-end: drag crank to dock, tap altar, capture journey + finale.
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

  // ---- 1. drag crank ~105° around hub ----
  const hubXY = await page.evaluate(() => {
    const p = MV.hubWorld.clone().project(MV.camera);
    return [Math.round((p.x * 0.5 + 0.5) * 576), Math.round((-p.y * 0.5 + 0.5) * 1280)];
  });
  const [hx, hy] = hubXY;
  console.log('hub screen', hx, hy);
  async function drag(sign) {
    // down on the hub itself, then sweep around it at R=30
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
  console.log('after drag', JSON.stringify(st));
  if (!st.docked) {
    await drag(-1);
    st = await page.evaluate(() => MV.state());
    console.log('after retry', JSON.stringify(st));
  }
  await page.screenshot({ path: path.join(OUT, 'p1_docked.png') });

  // ---- 2. tap the altar pad -> full BFS route to t≈1 -> win ----
  await page.mouse.click(328, 368);
  const shotted = new Set();
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const x = MV.state();
      return { edge: x.idaState && x.idaState.edge, t: x.idaState && x.idaState.t, won: x.won };
    });
    if (s.edge && s.t > 0.3 && s.t < 0.8 && !shotted.has(s.edge)) {
      shotted.add(s.edge);
      console.log('shot edge', s.edge);
      await page.screenshot({ path: path.join(OUT, 'walk_' + s.edge + '.png') });
    }
    if (i % 5 === 0) console.log('...', s.edge, s.t && s.t.toFixed(2), s.won);
    if (s.won) break;
  }
  // finale frames (teardrop descends ~3.6s)
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'fin1.png') });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'fin2.png') });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(OUT, 'fin3.png') });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'fin4.png') });
  console.log('done', JSON.stringify(await page.evaluate(() => MV.state())));
  await browser.close();
})();
