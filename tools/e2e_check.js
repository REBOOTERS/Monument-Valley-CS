// 本轮专项回归（新等轴测版）：pointercancel 恢复 / 构件上锁定曲柄 / 原地重置。
// 任一断言失败退出码 1。用法：node e2e_check.js（需 serve.js 在 8123）。
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
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => window.__MV_BOOTED);
  await page.waitForTimeout(500);

  const hub = await page.evaluate(() => {
    const hs = MV.hubScreen(), off = MV.appOffset();
    return { x: hs.x + off.left, y: hs.y + off.top };
  });

  /* ---------- 1) pointercancel：拖拽中系统中断 → 状态复位 + 吸附 ---------- */
  await page.mouse.move(hub.x, hub.y - 60);
  await page.mouse.down();
  await page.mouse.move(hub.x + 30, hub.y - 30, { steps: 4 });
  const curDuring = await page.evaluate(() => document.getElementById('gl').style.cursor);
  await page.dispatchEvent('#gl', 'pointercancel');
  await page.waitForTimeout(150);      // 光标/吸附在主循环下一帧生效
  const curAfter = await page.evaluate(() => document.getElementById('gl').style.cursor);
  await page.waitForTimeout(600);
  const snapInfo = await page.evaluate(() => {
    const th = MV.getTheta();
    const snapped = Math.abs(th / (Math.PI / 2) - Math.round(th / (Math.PI / 2)));
    return { th, snapped };
  });
  check('拖拽中 cursor=grabbing', curDuring === 'grabbing', curDuring);
  // 指针仍悬停在毂附近（<0.06*vh）→ grab 是正确的悬停态；关键是不再卡在 grabbing
  check('pointercancel 后 cursor 复位（悬停 grab / 离开 default）', curAfter === 'grab' || curAfter === 'default', curAfter);
  check('pointercancel 后吸附到 90° 整数位', snapInfo.snapped < 0.02,
    'theta=' + snapInfo.th.toFixed(3));

  /* ---------- 2) 艾达站在旋转构件上时曲柄锁定 ---------- */
  // query 变化强制整页加载（仅 hash 不同时浏览器不重新加载，#s=12 不会生效）
  await page.goto('http://localhost:8123/index.html?st=lock#s=12');   // s=12 在构件区间内
  await page.waitForFunction(() => window.__MV_BOOTED);
  await page.waitForTimeout(500);
  const onRotor = await page.evaluate(() => MV.state().onRotor);
  const thBefore = await page.evaluate(() => MV.getTheta());
  await page.mouse.move(hub.x, hub.y - 60);
  await page.mouse.down();
  await page.mouse.move(hub.x + 55, hub.y, { steps: 5 });
  const thDuring = await page.evaluate(() => MV.getTheta());
  const curLocked = await page.evaluate(() => document.getElementById('gl').style.cursor);
  await page.mouse.up();
  check('艾达在构件上（s=12）', onRotor === true);
  check('构件上拖拽曲柄无效', Math.abs(thDuring - thBefore) < 1e-6,
    'before=' + thBefore.toFixed(3) + ' during=' + thDuring.toFixed(3));
  check('锁定时无 grab 光标', curLocked !== 'grab', curLocked);

  /* ---------- 3) 原地重置（含通关后重置） ---------- */
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => window.__MV_BOOTED);
  await page.waitForTimeout(400);
  await page.evaluate(() => { MV.dock(); MV.go(MV.TOTAL); });
  await page.waitForFunction(() => MV.state().finished, null, { timeout: 60000 });
  await page.waitForTimeout(7500);            // 等章节标题浮现
  const chapterOnBefore = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('chapter')).opacity) > 0.5);
  await page.click('#btnReset');
  await page.waitForTimeout(1600);            // 等章节标题 1.2s 淡出过渡走完
  const st = await page.evaluate(() => ({
    s: MV.state(), theta: MV.getTheta(),
    chapter: parseFloat(getComputedStyle(document.getElementById('chapter')).opacity),
    hintShown: document.getElementById('hint').style.opacity !== '0',
  }));
  check('通关后章节标题可见', chapterOnBefore === true);
  check('重置后 finished=false / 不在行走', st.s.finished === false && !st.s.moving, JSON.stringify(st.s));
  check('重置后艾达回起点', st.s.s === 0 && st.s.sTarget === 0);
  check('重置后转子归零 / 未连接', Math.abs(st.theta) < 1e-6 && st.s.connected === false);
  check('重置后章节标题隐藏', st.chapter < 0.05);
  check('重置后提示恢复显示', st.hintShown === true);

  await browser.close();
  console.log(failures ? 'E2E CHECK FAILED (' + failures + ')' : 'E2E CHECK PASSED');
  process.exit(failures ? 1 : 0);
})();
