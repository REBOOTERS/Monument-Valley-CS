// 自动演示按钮回归（新等轴测版）：点击 → 视频操作序列（转曲柄→停靠→行进）
// → 通关后按钮态清除 → 重置后可再次启动。
// 用法：node autocheck.js（需 serve.js 在 8123）。
const { chromium } = require('playwright-core');
const { chromeExecutablePath } = require('./chrome');

(async () => {
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => window.__MV_BOOTED);
  await page.waitForTimeout(500);

  await page.click('#btnAuto');
  const runningOn = await page.evaluate(() =>
    document.getElementById('btnAuto').classList.contains('running'));
  await page.waitForFunction(() => MV.state().finished, null, { timeout: 90000 });
  // 通关瞬间 demo 取消在主循环下一帧发生
  await page.waitForFunction(() =>
    !document.getElementById('btnAuto').classList.contains('running'),
    null, { timeout: 2000 }).catch(() => {});
  const runningOff = await page.evaluate(() =>
    document.getElementById('btnAuto').classList.contains('running'));

  // 通关后重置，再确认按钮可重新启动演示
  await page.click('#btnReset');
  await page.waitForTimeout(200);
  await page.click('#btnAuto');
  const restarted = await page.evaluate(() =>
    document.getElementById('btnAuto').classList.contains('running'));

  console.log('running on click:', runningOn, '| cleared after win:', !runningOff,
    '| restartable after reset:', restarted);
  const ok = runningOn && !runningOff && restarted;
  console.log(ok ? 'AUTOCHECK PASSED' : 'AUTOCHECK FAILED');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
