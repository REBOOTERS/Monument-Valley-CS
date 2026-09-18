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
  const cache = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  const candidates = [];
  try {
    for (const dir of fs.readdirSync(cache)) {
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
  } catch (e) { /* 无缓存目录 */ }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('未找到 Chromium：请设置 CHROME_PATH 指向本机 Chrome/Chromium，' +
    '或先执行 `npx playwright install chromium`');
}

module.exports = { chromeExecutablePath };
