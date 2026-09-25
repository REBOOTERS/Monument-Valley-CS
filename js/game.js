/* ============================================================
   玩法状态机：通用于「曲柄机关 + 行走链」型章节。
   状态 / 输入语义（拖拽曲柄、点选行走）/ 每帧更新 / 自动演示 / 重置。
   章节内容来自 chapters/*（几何、机关、链、演示脚本），
   引擎与画布层来自 core/*。装配见 main.js。
   ============================================================ */
import * as THREE from 'three';
import { attachInput } from './core/input.js';

export function createGame({ engine, chapter, chain, ida, rotor, fx, ui }) {
  const { camera, camState, view, glCanvas } = engine;
  const reachable = chain.makeReachable(() => rotor.connected(state.theta));

  const state = {
    theta: 0,                 // rotor.rotation.x；目标状态 = dockTheta（机关连接）
    snapping: null,
    dragging: null,
    s: 0.0, sTarget: 0.0,     // 艾达在链上的弧长位置
    facing: new THREE.Vector3(-1, 0, 0),
    walkPhase: 0,
    crankExt: 1,
    finished: false, endT: 0,
    demo: null,
  };

  // 艾达站在旋转构件上的区间（此时曲柄锁定、辐条缩回）
  const idaOnRotor = () => !!chain.rotorRange &&
    state.s > chain.rotorRange[0] - 1e-6 && state.s < chain.rotorRange[1] + 1e-6;

  // ------------------------------------------------------------ 坐标换算 / 拾取
  function toScreen(v) { // 世界坐标 → 画布 CSS 像素（相对 #app）
    const p = v.clone().project(camera);
    return { x: (p.x + 1) / 2 * view.w, y: (1 - p.y) / 2 * view.h };
  }
  function hubScreen() {
    const v = rotor.hubLocal.clone(); rotor.crank.localToWorld(v);
    return toScreen(v);
  }

  // 点击 → 链上最近的可达点（屏幕空间距离）
  function pickChain(px, py) {
    let best = null;
    for (let i = 0; i < chain.segLen.length; i++) {
      if (chain.segLen[i] === 0) continue;
      const a = toScreen(chain.points[i].p), b = toScreen(chain.points[i + 1].p);
      const abx = b.x - a.x, aby = b.y - a.y, L2 = abx * abx + aby * aby;
      let t = L2 > 0 ? ((px - a.x) * abx + (py - a.y) * aby) / L2 : 0; t = THREE.MathUtils.clamp(t, 0, 1);
      const qx = a.x + abx * t, qy = a.y + aby * t;
      const d = Math.hypot(px - qx, py - qy);
      if (!best || d < best.d) best = { d, s: chain.cum[i] + chain.segLen[i] * t, i };
    }
    const thresh = 0.045 * view.h;
    if (!best || best.d > thresh) return null;
    return best;
  }

  // ------------------------------------------------------------ 输入语义
  const lastPointer = { x: -1e4, y: -1e4 };   // 悬停光标检测（画布坐标）
  let pointerDown = null;

  function onDown(p, e) {
    if (state.demo) cancelDemo();            // 自动演示中用户接管
    if (state.finished) return;
    lastPointer.x = p.x; lastPointer.y = p.y;
    const hs = hubScreen();
    const dHub = Math.hypot(p.x - hs.x, p.y - hs.y);
    if (dHub < 0.06 * view.h && !idaOnRotor()) {
      state.snapping = null;
      state.dragging = { a0: Math.atan2(p.y - hs.y, p.x - hs.x), prevA: null };
      glCanvas.setPointerCapture(e.pointerId);
      ui.hide();
    } else {
      pointerDown = p;
    }
  }
  function onMove(p) {
    lastPointer.x = p.x; lastPointer.y = p.y;
    if (!state.dragging) return;
    const hs = hubScreen();
    const a = Math.atan2(p.y - hs.y, p.x - hs.x);
    // 以增量方式累积，处理跨越 ±π
    const prevA = state.dragging.prevA ?? state.dragging.a0;
    let step = a - prevA; step = Math.atan2(Math.sin(step), Math.cos(step));
    state.dragging.prevA = a;
    state.theta -= step;                    // 屏幕上顺时针拖动 → θ 减小（竖臂向 +z 方向摆出）
  }
  function endDrag() {
    if (!state.dragging) return;
    state.dragging = null;
    const target = Math.round(state.theta / rotor.snapStep) * rotor.snapStep;
    state.snapping = { from: state.theta, to: target, t: 0 };
  }
  function onUp(p) {
    if (state.dragging) { endDrag(); return; }
    if (pointerDown && Math.hypot(p.x - pointerDown.x, p.y - pointerDown.y) < 12 && !state.finished) {
      const hit = pickChain(p.x, p.y);
      if (hit && reachable(state.s, hit.s)) { state.sTarget = hit.s; fx.ripple(p.x, p.y); ui.hide(); }
    }
    pointerDown = null;
  }
  // 手势接管/来电等系统中断：复位拖拽并吸附
  attachInput(glCanvas, view, { down: onDown, move: onMove, up: onUp, cancel: () => endDrag() });

  // ------------------------------------------------------------ 结尾 / 自动演示 / 重置
  function finish() {
    state.finished = true; state.endT = 0;
    ui.hide();
  }

  function startDemo() {
    if (state.demo || state.finished) return;
    reset();
    ui.hide();
    state.demo = { t: 0 };
    if (game.onDemoChange) game.onDemoChange(true);
  }
  function cancelDemo() {
    if (!state.demo) return;
    state.demo = null;
    if (game.onDemoChange) game.onDemoChange(false);
  }
  function stepDemo(dt) {
    const d = state.demo; d.t += dt;
    // 转曲柄阶段：按关键帧插值（模拟视频中先转过头、再回一点、再对齐）
    const keys = chapter.DEMO.keys;
    if (d.t >= keys[0][0] && d.t <= keys[keys.length - 1][0]) {
      for (let i = 0; i < keys.length - 1; i++) {
        if (d.t >= keys[i][0] && d.t <= keys[i + 1][0]) {
          const k = THREE.MathUtils.smoothstep(d.t, keys[i][0], keys[i + 1][0]);
          state.theta = THREE.MathUtils.lerp(keys[i][1], keys[i + 1][1], k);
        }
      }
    }
    if (d.t > chapter.DEMO.spinEnd) state.theta = rotor.dockTheta;
    if (d.t > chapter.DEMO.tapAt && !d.tapped) {
      d.tapped = true;
      const sp = toScreen(chapter.GOAL);
      fx.ripple(sp.x, sp.y);
      state.sTarget = chain.TOTAL;
    }
  }

  function reset() {
    state.theta = 0; state.snapping = null; state.dragging = null;
    state.s = 0; state.sTarget = 0; state.finished = false; state.endT = 0; state.demo = null; state.crankExt = 1;
    state.facing.set(-1, 0, 0);
    camState.panU = 0; camState.panR = 0; engine.placeCamera();
    ui.hideChapter();
    ui.reset();
    rotor.setCrankExtension(1);
    fx.clearRipples();
    if (game.onDemoChange) game.onDemoChange(false);
  }

  // ------------------------------------------------------------ 每帧更新
  function update(dt, dtRaw, simT) {
    fx.update(dt);
    if (state.demo) stepDemo(dt);

    // 曲柄吸附到最近整档
    if (state.snapping) {
      state.snapping.t += dt / 0.28;
      const k = THREE.MathUtils.smoothstep(state.snapping.t, 0, 1);
      state.theta = THREE.MathUtils.lerp(state.snapping.from, state.snapping.to, k);
      if (state.snapping.t >= 1) { state.theta = state.snapping.to; state.snapping = null; }
    }
    state.theta = Math.atan2(Math.sin(state.theta), Math.cos(state.theta));
    rotor.group.rotation.x = state.theta;
    rotor.armBEndMat.visible = !rotor.connected(state.theta);

    // 艾达行走
    const onRotor = idaOnRotor();
    if (!rotor.connected(state.theta) && state.sTarget !== state.s) {
      // 行进途中断开（理论上不会发生：站在构件上时曲柄被锁）——停在原地保护
      if (!reachable(state.s, state.sTarget)) state.sTarget = state.s;
    }
    let moving = false;
    if (Math.abs(state.sTarget - state.s) > 1e-4) {
      const info = chain.posAt(state.s);
      const speed = info.meta.stairs ? 2.65 : 3.4;
      const dir = Math.sign(state.sTarget - state.s);
      let ns = state.s + dir * speed * dt;
      if ((dir > 0 && ns > state.sTarget) || (dir < 0 && ns < state.sTarget)) ns = state.sTarget;
      state.s = ns; moving = true;
      state.walkPhase += dt * 11;
      const after = chain.posAt(state.s);
      if (after.dir) state.facing.copy(after.dir).multiplyScalar(dir);
      if (state.s >= chain.TOTAL - 1e-4 && !state.finished) finish();
    } else {
      state.walkPhase = THREE.MathUtils.lerp(state.walkPhase, Math.round(state.walkPhase / Math.PI) * Math.PI, 0.2);
    }
    const cur = chain.posAt(state.s);
    ida.group.position.copy(cur.p);
    ida.group.rotation.y = Math.atan2(state.facing.x, state.facing.z);
    const swing = moving ? Math.sin(state.walkPhase) * 0.55 : Math.sin(state.walkPhase) * 0.55 * 0.2;
    ida.parts.legL.rotation.x = swing; ida.parts.legR.rotation.x = -swing;
    ida.parts.body.position.y = moving ? Math.abs(Math.sin(state.walkPhase)) * 0.035 : 0;
    ida.parts.body.rotation.x = moving ? 0.05 : 0;

    // 曲柄缩回/展开（艾达在构件上时锁定）
    const extTarget = onRotor ? 0 : 1;
    state.crankExt = THREE.MathUtils.damp(state.crankExt, extTarget, 8, dt);
    rotor.setCrankExtension(state.crankExt);

    // 光标：拖拽 grabbing / 毂附近 grab / 其余 default
    if (state.dragging) glCanvas.style.cursor = 'grabbing';
    else {
      const hs = hubScreen();
      glCanvas.style.cursor = (!state.demo && !state.finished && !onRotor &&
        Math.hypot(lastPointer.x - hs.x, lastPointer.y - hs.y) < 0.06 * view.h) ? 'grab' : 'default';
    }

    // 自动演示结束（通关）→ 复位按钮态
    if (state.demo && state.finished) cancelDemo();

    // 结尾：镜头向上平移，天空变暗，出现极光与章节标题
    if (state.finished) {
      state.endT += dt;
      // 视频实测：到达后立即起步，约 1s 内加速到 ~106px/s（1280 高基准）匀速上移，并略向左漂移
      const e = state.endT, ramp = e - 1 + Math.exp(-e);
      camState.panU = Math.min(2.885 * ramp, 30); camState.panR = Math.min(0.136 * ramp, 1.4); engine.placeCamera();
      if (state.endT > 6.5) ui.showChapter();
    }
  }

  // ------------------------------------------------------------ 对外接口（main / 调试 / 测试用）
  function getState() {
    return {
      theta: state.theta, connected: rotor.connected(state.theta),
      s: state.s, sTarget: state.sTarget,
      moving: Math.abs(state.sTarget - state.s) > 1e-4,
      onRotor: idaOnRotor(), finished: state.finished, demo: !!state.demo,
    };
  }
  const getTheta = () => state.theta;
  function setTheta(rad) { state.theta = rad; state.snapping = null; }
  function dock() { state.theta = rotor.dockTheta; state.snapping = null; }
  function init() { state.theta = 0; state.snapping = null; }
  function go(s) { const ok = reachable(state.s, s); if (ok) state.sTarget = s; return ok; }
  function setS(v) { state.s = state.sTarget = v; }
  function setTarget(v) { if (reachable(state.s, v)) state.sTarget = v; }

  const game = {
    state, update, getState, getTheta, setTheta, dock, init, go, setS, setTarget,
    reset, startDemo, cancelDemo, hubScreen,
    TOTAL: () => chain.TOTAL,
    endingT: () => state.endT,
    onDemoChange: null,   // main 注入：自动演示启停时同步按钮态
  };
  return game;
}
