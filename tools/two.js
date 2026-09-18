// Screenshot init + docked states.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 576, height: 1280 } });
  p.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await p.goto('http://localhost:8123/index.html');
  await p.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 600));
  await p.screenshot({ path: 'shots/v_init.png' });
  await p.evaluate(() => MV.dock());
  await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: 'shots/v_dock.png' });
  await b.close();
})();
