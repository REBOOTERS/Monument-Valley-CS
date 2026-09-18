// Sample average RGB colors from a video frame via ffmpeg rawvideo pipe.
// Usage: node sample.js <frame.png> <x> <y> <w> <h> [name]
const { execFileSync } = require('child_process');
const [file, x, y, w, h, name] = process.argv.slice(2);
const buf = execFileSync('ffmpeg', [
  '-y', '-v', 'quiet', '-i', file,
  '-vf', `crop=${w}:${h}:${x}:${y}`,
  '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'
]);
let r = 0, g = 0, b = 0;
const n = buf.length / 3;
for (let i = 0; i < n; i++) { r += buf[i*3]; g += buf[i*3+1]; b += buf[i*3+2]; }
const hex = v => Math.round(v).toString(16).padStart(2, '0');
console.log(`${name || 'color'}: #${hex(r/n)}${hex(g/n)}${hex(b/n)}  (n=${n})`);
