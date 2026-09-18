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
  await new Promise(r => setTimeout(r, 800));
  const out = await p.evaluate(() =>
    [[438, 702], [438, 660], [470, 695], [405, 720], [438, 745], [460, 730]]
      .map(q => [q, MV.testHub(q[0], q[1])]));
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
