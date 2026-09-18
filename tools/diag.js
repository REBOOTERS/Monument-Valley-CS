// Diagnose the sky veil: full -> no-snow -> no-scene screenshots.
const { chromium } = require('playwright-core');
const { chromeExecutablePath } = require('./chrome');
const CHROME = chromeExecutablePath();

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/diag_full.png' });
  await page.evaluate(() => {
    MV.scene.traverse(o => { if (o.isPoints || o.isSprite) o.visible = false; });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/diag_nosnow.png' });
  await page.evaluate(() => { MV.scene.visible = false; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/diag_noscene.png' });
  await browser.close();
  console.log('diag shots saved');
})();
