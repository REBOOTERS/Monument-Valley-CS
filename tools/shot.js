// Headless screenshots for visual comparison with video frames.
// Usage: node shot.js [scene...]
//   scenes: init dock arm top pad win   (default: all)
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const URL = 'http://localhost:8123/index.html';
const OUT = path.join(__dirname, '..', 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SCENES = {
  async init(page) {
    await sleep(1400);
  },
  async dock(page) {
    await page.evaluate(() => MV.dock());
    await sleep(900);
  },
  async arm(page) {
    await page.evaluate(() => { MV.dock(); MV.plan('e3', 0.55); });
    await waitIdle(page, 12000);
    await sleep(300);
  },
  async top(page) {
    await page.evaluate(() => { MV.dock(); MV.plan('e4', 0.5); });
    await waitIdle(page, 14000);
    await sleep(300);
  },
  async pad(page) {
    await page.evaluate(() => { MV.dock(); MV.plan('e6', 1); });
    await waitIdle(page, 20000);
    await sleep(200);
  },
  async win(page) {
    await page.evaluate(() => { MV.dock(); MV.plan('e6', 1); });
    await waitIdle(page, 20000);
    await sleep(3800);
  },
};

async function waitIdle(page, timeout) {
  await page.waitForFunction(() => !MV.state().moving, { timeout });
}

(async () => {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(SCENES);
  const exe = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
  for (const name of names) {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window.MV && window.MV.renderer), { timeout: 8000 });
    await sleep(400);
    await SCENES[name](page);
    await page.screenshot({ path: path.join(OUT, 's_' + name + '.png') });
    console.log('saved', name);
  }
  await browser.close();
})();
