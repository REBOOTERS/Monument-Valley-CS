// Scan a line of pixels, print hex colors at intervals.
// Usage: node scan.js <frame.png> <x0> <y0> <x1> <y1> <steps>
const { execFileSync } = require('child_process');
const [file, x0, y0, x1, y1, steps] = process.argv.slice(2).map((v, i) => i === 0 ? v : +v);
const W = 2, H = 2;
const hex = v => v.toString(16).padStart(2, '0');
for (let i = 0; i <= steps; i++) {
  const t = i / steps;
  const x = Math.round(+x0 + (+x1 - +x0) * t);
  const y = Math.round(+y0 + (+y1 - +y0) * t);
  const buf = execFileSync('ffmpeg', [
    '-y', '-v', 'quiet', '-i', file,
    '-vf', `crop=${W}:${H}:${x}:${y}`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'
  ]);
  let r=0,g=0,b=0; const n=buf.length/3;
  for (let k=0;k<n;k++){r+=buf[k*3];g+=buf[k*3+1];b+=buf[k*3+2];}
  console.log(`(${x},${y}) #${hex(Math.round(r/n))}${hex(Math.round(g/n))}${hex(Math.round(b/n))}`);
}
