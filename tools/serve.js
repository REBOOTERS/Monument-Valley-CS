// Tiny zero-dependency static server for the project root.
// Usage: node tools/serve.js [port]
//
// Serves both versions from one origin (mirrors GitHub Pages layout):
//   http://localhost:8123/                         → 主版
//   http://localhost:8123/fable/                   → fable（目录改名后）
//   http://localhost:8123/fable-5.1-version/       → fable（改名前）
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = +(process.argv[2] || 8123);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (!rel.startsWith('/')) rel = '/' + rel;

  // directory → index.html（与 Pages 尾斜杠行为一致）
  const abs = path.normalize(path.join(ROOT, rel));
  if (!abs.startsWith(ROOT)) return null;

  try {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      const index = path.join(abs, 'index.html');
      if (fs.existsSync(index)) return index;
      return null;
    }
    if (st.isFile()) return abs;
  } catch (_) {
    // fall through：可能是缺尾斜杠的目录
  }

  if (!path.extname(rel)) {
    const asDir = path.normalize(path.join(ROOT, rel));
    const index = path.join(asDir, 'index.html');
    if (fs.existsSync(index)) return index;
  }
  return null;
}

http.createServer((req, res) => {
  const file = resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found: ' + req.url);
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('serving ' + ROOT);
  console.log('  main : http://localhost:' + PORT + '/');
  const fableDir = fs.existsSync(path.join(ROOT, 'fable'))
    ? 'fable'
    : (fs.existsSync(path.join(ROOT, 'fable-5.1-version')) ? 'fable-5.1-version' : null);
  if (fableDir) {
    console.log('  fable: http://localhost:' + PORT + '/' + fableDir + '/');
  }
});
