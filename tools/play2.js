// 端到端回归（新等轴测版）：拖拽曲柄 → 90° 吸附停靠 → 艾达行至终点通关。
// 任一断言失败退出码 1。用法：node play2.js（需 serve.js 在 8123）。
const { chromium } = require('playwright-core');
const { chromeExecutablePath } = require('./chrome');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => window.__MV_BOOTED);
  await page.waitForTimeout(500);

  // ---- 1) 拖拽：从毂上方 60px 顺时针拖到右侧 60px（θ 减 π/2 → -90° 停靠位）
  const hs0 = await page.evaluate(() => {
    const hs = MV.hubScreen(), off = MV.appOffset();
    return { x: hs.x + off.left, y: hs.y + off.top };
  });
  await page.mouse.move(hs0.x, hs0.y - 60);
  await page.mouse.down();
  await page.mouse.move(hs0.x + 60, hs0.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);      // 等吸附补间（0.28s）
  const st1 = await page.evaluate(() => MV.state());
  check('拖拽后停靠连接（θ=-π/2）', st1.connected && Math.abs(st1.theta + Math.PI / 2) < 0.02,
    JSON.stringify(st1));

  // ---- 2) 点击终点：艾达沿行走链全程行进至通关
  await page.evaluate(() => { MV.go(MV.TOTAL); });
  await page.waitForFunction(() => MV.state().finished, null, { timeout: 60000 });
  const st2 = await page.evaluate(() => MV.state());
  check('艾达到达终点通关', st2.finished && !st2.moving, JSON.stringify(st2));

  // ---- 3) 结尾演出：镜头上移 + 章节标题浮现
  await page.waitForTimeout(7500);
  const chapterOn = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('chapter')).opacity) > 0.5);
  check('章节标题浮现', chapterOn);

  await browser.close();
  console.log(failures ? 'PLAY CHECK FAILED (' + failures + ')' : 'PLAY CHECK PASSED');
  process.exit(failures ? 1 : 0);
})();
