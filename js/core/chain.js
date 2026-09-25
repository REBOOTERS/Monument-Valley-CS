/* ============================================================
   行走链：把有序点列编译为弧长参数化路径（纯数学，无场景依赖）。

   点标记（chain 数组的元素除 p 外可携带）：
     seam       与下一点投影重合的零长度跳段（视错觉接缝）
     needsRotor 经过该接缝需要旋转机关处于连接态
     rotorEnd   艾达离开旋转构件的点（划定 onRotor 区间）
     stairs     该点开始的段为楼梯（行走减速由玩法层读取）
   ============================================================ */
import * as THREE from 'three';

export function buildChain(points) {
  const segLen = [], cum = [0], meta = [];
  for (let i = 0; i < points.length - 1; i++) {
    const L = points[i].seam ? 0 : points[i].p.distanceTo(points[i + 1].p);
    segLen.push(L); cum.push(cum[i] + L);
    meta.push({ stairs: !!points[i].stairs });
  }
  const TOTAL = cum[cum.length - 1];

  const entryIdx = points.findIndex(p => p.needsRotor);
  const endIdx = points.findIndex(p => p.rotorEnd);
  const rotorRange = entryIdx >= 0 && endIdx >= 0
    ? [cum[entryIdx + 1], cum[endIdx]] : null;

  function posAt(s) {
    s = THREE.MathUtils.clamp(s, 0, TOTAL);
    let i = 0; while (i < segLen.length - 1 && s > cum[i + 1]) i++;
    // 处于接缝（零长度段）时取后一点
    while (segLen[i] === 0 && i < segLen.length - 1) i++;
    const t = segLen[i] > 0 ? (s - cum[i]) / segLen[i] : 0;
    const p = points[i].p.clone().lerp(points[i + 1].p, t);
    const dir = points[i + 1].p.clone().sub(points[i].p); dir.y = 0;
    return { p, dir: dir.lengthSq() > 1e-6 ? dir.normalize() : null, seg: i, meta: meta[i] };
  }

  // 可达性：起讫点之间若存在未连接的 needsRotor 接缝则不可达
  function makeReachable(connected) {
    return function reachable(sFrom, sTo) {
      const lo = Math.min(sFrom, sTo), hi = Math.max(sFrom, sTo);
      for (let i = 0; i < points.length; i++) {
        if (points[i].needsRotor && cum[i] > lo + 1e-6 && cum[i] < hi - 1e-6 && !connected()) return false;
      }
      return true;
    };
  }

  return { points, segLen, cum, TOTAL, rotorRange, posAt, makeReachable };
}
