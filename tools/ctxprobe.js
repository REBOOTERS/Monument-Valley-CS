// 探测 headless swiftshader 下 webglcontextlost/restored 是否触发（环境排查用）
const { chromium } = require('playwright-core');
const { chromeExecutablePath } = require('./chrome');

(async () => {
  const browser = await chromium.launch({
    executablePath: chromeExecutablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  await page.addInitScript(() => {
    window.__ctxEvents = [];
    window.addEventListener('DOMContentLoaded', () => {
      const c = document.getElementById('gl');
      if (!c) return;
      c.addEventListener('webglcontextlost', () => window.__ctxEvents.push('lost@' + performance.now().toFixed(0)));
      c.addEventListener('webglcontextrestored', () => window.__ctxEvents.push('restored@' + performance.now().toFixed(0)));
    });
  });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await page.waitForTimeout(3000);
  console.log('ctx events:', await page.evaluate(() => window.__ctxEvents));
  // 顺带验证 resize 修复：改视口后 drawingBuffer 应跟随
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const c = document.getElementById('gl');
    return { client: [c.clientWidth, c.clientHeight], buf: [c.width, c.height],
             styleW: c.style.width || '(none)' };
  });
  console.log('after resize to 400x800:', JSON.stringify(info));
  await browser.close();
})();
