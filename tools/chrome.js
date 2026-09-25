// 解析 Chromium 可执行文件路径（shot2/play2/diag/probe* 共用）。
// 优先级：环境变量 CHROME_PATH > playwright 浏览器缓存（自动探测平台目录）。
// 若都没有：执行 `npx playwright install chromium` 后重试。
const fs = require('fs');
const path = require('path');
const os = require('os');

function chromeExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  // playwright 浏览器缓存：macOS / Windows / Linux 三平台目录
  const caches = [
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(process.env.LOCALAPPDATA || os.homedir(), 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ];
  const candidates = [];
  for (const cache of caches) {
    let dirs = [];
    try {
      dirs = fs.readdirSync(cache);
    } catch (e) { continue; /* 无缓存目录 */ }
    for (const dir of dirs) {
      if (!/^chromium/.test(dir)) continue;
      const base = path.join(cache, dir);
      for (const sub of fs.readdirSync(base)) {
        if (/^chrome-mac/.test(sub)) {
          candidates.push(path.join(base, sub,
            'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
          candidates.push(path.join(base, sub, 'Chromium.app/Contents/MacOS/Chromium'));
        } else if (/^chrome-win/.test(sub)) {
          candidates.push(path.join(base, sub, 'chrome.exe'));
        } else if (/^chrome-linux/.test(sub)) {
          candidates.push(path.join(base, sub, 'chrome'));
        }
      }
    }
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('未找到 Chromium：请设置 CHROME_PATH 指向本机 Chrome/Chromium，' +
    '或先执行 `npx playwright install chromium`');
}

module.exports = { chromeExecutablePath };
