// Solve rotation (axis n, angle theta) for the L rotor:
//   long leg initial dir (1,0,0) -> v = (TIP-Q)/L  (exact)
//   short leg initial dir (0,0,-1) -> s1 should project near zero screen
//                                     (aligned with view axis = hidden)
// Usage: node tools/rotorsolve.js tipx tipy tipz qz L
const rx = -0.750, ry = -0.661;
const ux = 0.434, uy = -0.492, uz = 0.755;
const vx0 = -0.499, vy0 = 0.566, vz0 = 0.656;
function norm(a) { const l = Math.hypot(...a); return a.map(v => v / l); }
function cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function rod(n, c, s, v) {
  const nx = cross(n, v);
  const nd = n.map(x => x * dot(n, v) * (1 - c));
  return [v[0]*c + nx[0]*s + nd[0],
          v[1]*c + nx[1]*s + nd[1],
          v[2]*c + nx[2]*s + nd[2]];
}
const [tx, ty, tz, qz, L] = process.argv.slice(2).map(Number);
const target = norm([tx, ty, tz - qz]);
console.log('arm target dir', target.map(x => +x.toFixed(4)), 'L=', L);
// axis candidates: n perpendicular to (target - x), parameterized as
// n = norm(cross(target - x, k)) sweep k on sphere -> parameterize k angle
const d = norm([target[0]-1, target[1], target[2]]);
let best = null;
for (let kk = 0; kk < 360; kk++) {
  const a = kk * Math.PI / 180;
  // build an orthonormal frame around d: e1 = normalize(cross(d, up-ish))
  const tmp = Math.abs(d[2]) > 0.9 ? [1,0,0] : [0,0,1];
  const e1 = norm(cross(d, tmp));
  const e2 = cross(d, e1);
  const k = [e1[0]*Math.cos(a)+e2[0]*Math.sin(a),
             e1[1]*Math.cos(a)+e2[1]*Math.sin(a),
             e1[2]*Math.cos(a)+e2[2]*Math.sin(a)];
  const n = norm(cross(d, k));
  // theta from x to target: cos = dot, sin via n
  const c = dot(n, cross([1,0,0], target)) >= 0
    ? Math.sqrt(Math.max(0, 1 - (1-dot([1,0,0],target))**2 / 4)) * 2 - 1 : 0;
  // robust: theta via atan2
  const cosT = dot([1,0,0], target);
  const sinT = dot(n, cross([1,0,0], target));
  const theta = Math.atan2(sinT, cosT);
  const s1 = rod(n, Math.cos(theta), Math.sin(theta), [0,0,-1]);
  // verify arm
  const v1 = rod(n, Math.cos(theta), Math.sin(theta), [1,0,0]);
  const errArm = Math.hypot(v1[0]-target[0], v1[1]-target[1], v1[2]-target[2]);
  const sr = dot(s1, [rx, ry, 0]), su = dot(s1, [ux, uy, uz]);
  // short leg should point near VIEW_N toward camera: maximize s1.V (in front),
  // minimize screen projection
  const sV = dot(s1, [vx0, vy0, vz0]);
  const score = sr*sr + su*su - 0.6 * sV + errArm * 100;
  if (!best || score < best.score) best = { n, theta, s1, sr, su, sV, errArm, score };
}
console.log('axis', best.n.map(x => +x.toFixed(4)).join(','));
console.log('theta deg', +(best.theta*180/Math.PI).toFixed(2));
console.log('short dir', best.s1.map(x => +x.toFixed(3)).join(','),
  'screen r/u', best.sr.toFixed(3), best.su.toFixed(3), 'V', best.sV.toFixed(3),
  'armErr', best.errArm.toFixed(4));
