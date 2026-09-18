// Quick single screenshot: node tools/shot1.js out.png [dock]
const { chromium } = require('playwright-core');
const out = process.argv[2] || 'shots/tmp.png';
const dock = process.argv[3] === 'dock';
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 500));
  if (dock) await page.evaluate(() => MV.dock());
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: out });
  console.log('saved', out, dock ? '(docked)' : '(init)');
  await browser.close();
})();
