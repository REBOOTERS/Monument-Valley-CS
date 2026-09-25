// 三态截图（新等轴测版）：init / mid-rotation / dock。
// 通过 hash 参数确定性设置状态（#theta & #ff 固定步长快进）。
// 用法：node shot2.js（需 serve.js 在 8123）。输出 shots/v2/。
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { chromeExecutablePath } = require('./chrome');
const OUT = path.join(__dirname, '..', 'shots', 'v2');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

  async function snap(name, hash) {
    // query 变化强制整页加载（仅 hash 不同时浏览器不重新加载，hash 参数不会生效）
    await page.goto('http://localhost:8123/index.html?st=' + name + hash);
    await page.waitForFunction(() => window.__MV_BOOTED);
    // headless swiftshader 下 WebGL 上下文会在加载后 ~0.25s 丢失、~1.3s 自动恢复，
    // 等恢复完成再截图（真实浏览器无此现象）
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      MV.hideHint();
      // 跳过 1.2s 淡出过渡，保证截图时提示已不可见
      document.getElementById('hint').style.transition = 'none';
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, name) });
    console.log('saved', name, JSON.stringify(await page.evaluate(() => MV.state())));
  }

  await snap('init.png', '#ff=1');                      // θ=0 长臂藏于横梁
  await snap('mid.png', '#theta=-0.6&ff=1');            // 旋转中
  await snap('dock.png', '#theta=-1.5708&ff=1');        // 停靠（竖臂搭接小平台）
  await browser.close();
})();
