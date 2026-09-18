// Crop+zoom an image region: node tools/crop.js in.png out.png x y w h [scale]
const { chromium } = require('playwright-core');
const path = require('path');
const av = process.argv.slice(2);
const inp = av[0], outp = av[1];
const [x, y, w, h] = av.slice(2, 6).map(Number);
const scale = +(av[6] || 3);
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: w * (scale || 3), height: h * (scale || 3) } });
  const url = 'http://localhost:8123/' + inp.replace(/\\/g, '/');
  await page.setContent(`<img src="${url}" style="position:absolute;left:${-x * (scale || 3)}px;top:${-y * (scale || 3)}px;width:${576 * (scale || 3)}px">`);
  await page.waitForFunction(() => document.querySelector('img').complete);
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: outp });
  await browser.close();
})();
