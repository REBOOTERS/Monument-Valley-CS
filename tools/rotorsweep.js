// Sweep ALL rotations mapping long leg +x -> v; print short-leg screen projection
// so we can pick an axis whose short leg hides (overlaps arm / stub / wall).
// Usage: node tools/rotorsweep.js vx vy vz
function norm(a) { const l = Math.hypot(...a); return a.map(v => v / l); }
function cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function rod(n, theta, v) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const nx = cross(n, v);
  const nd = n.map(x => x * dot(n, v) * (1 - c));
  return [v[0]*c + nx[0]*s + nd[0],
          v[1]*c + nx[1]*s + nd[1],
          v[2]*c + nx[2]*s + nd[2]];
}
const r = [-0.750, -0.661, 0], u = [0.434, -0.492, 0.755], V = [-0.499, 0.566, 0.656];
const v = norm(process.argv.slice(2).map(Number));
const d = norm([v[0]-1, v[1], v[2]]);
const tmp = Math.abs(d[2]) > 0.9 ? [1,0,0] : [0,0,1];
const e1 = norm(cross(d, tmp));
const e2 = cross(d, e1);
console.log('kk  theta  sr     su     sV     screenLen  screenAng(deg, screen x-right/y-down)');
for (let kk = 0; kk < 360; kk += 15) {
  const a = kk * Math.PI / 180;
  const k = [e1[0]*Math.cos(a)+e2[0]*Math.sin(a),
             e1[1]*Math.cos(a)+e2[1]*Math.sin(a),
             e1[2]*Math.cos(a)+e2[2]*Math.sin(a)];
  const n = norm(cross(d, k));
  const theta = Math.atan2(dot(n, cross([1,0,0], v)), dot([1,0,0], v));
  const s1 = rod(n, theta, [0,0,-1]);
  const sr = dot(s1, r), su = dot(s1, u), sV = dot(s1, V);
  const len = Math.hypot(sr, su);
  const ang = Math.atan2(-su, sr) * 180 / Math.PI;
  console.log(kk, (theta*180/Math.PI).toFixed(1).padStart(6),
    sr.toFixed(2).padStart(6), su.toFixed(2).padStart(6), sV.toFixed(2).padStart(6),
    len.toFixed(2).padStart(6), ang.toFixed(0).padStart(5));
}
