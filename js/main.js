/* ============================================================
   入口 / 装配：引擎 + 章节注册表 + 玩法状态机 + UI + 调试接口。

   新增章节：在 chapters/ 下新建模块（接口见 chapter1.js 头注释），
   加入 CHAPTERS 表并把 chapter 指向它；后续可在此做章节选择/进度。

   运行环境约定：
   - index.html 提供三层画布 #bg/#gl/#fx 与 UI 元素（.hint/.chapter/.ui-circle）
   - 必须通过 HTTP 访问（importmap 不支持 file://）
   - 加载失败由 index.html 的内联脚本兜底（检测 __MV_BOOTED）
   ============================================================ */
import * as THREE from 'three';
import { createEngine } from './core/engine.js';
import { buildChain } from './core/chain.js';
import { buildIda } from './core/ida.js';
import { createSky } from './core/sky.js';
import { createFx } from './core/fx.js';
import { createUi } from './core/ui.js';
import chapter1 from './chapters/chapter1.js';
import chapter2 from './chapters/chapter2.js';
import { createGame } from './game.js';

const CHAPTERS = [chapter1, chapter2];   // 章节注册表
const chapter = CHAPTERS[(() => {
  const c = new URLSearchParams(location.hash.slice(1)).get('ch');
  const i = parseInt(c || '1', 10) - 1;
  return i >= 0 && i < CHAPTERS.length ? i : 0;
})()];                                   // 当前章节（#ch=N 选择，默认第一章）

// ------------------------------------------------------------ 引擎与画布层
const engine = createEngine();
const bgCanvas = document.getElementById('bg');
const fxCanvas = document.getElementById('fx');
const sky = createSky(bgCanvas, { mode: chapter.skyMode, moon: chapter.skyMoon });
const fx = createFx(fxCanvas);
const ui = createUi();
ui.setChapterText(chapter.META.title, chapter.META.subtitle);
if (chapter.META.hint) ui.setText(chapter.META.hint);

// 提示 12s 自动隐藏（真实时间）；上下文丢失/恢复的可见兜底
engine.onUpdate((dt, dtRaw) => ui.tick(dtRaw));
engine.onContextLost(() => { ui.setText('图形上下文丢失，请刷新页面'); ui.show(); });
engine.onContextRestored(() => ui.afterContextRestore());

// ------------------------------------------------------------ 章节内容
if (chapter.cameraHalfH) engine.camState.halfH = chapter.cameraHalfH;   // 章节级取景缩放
if (chapter.cameraDir) engine.camState.dir = chapter.cameraDir;         // 章节级相机方向
chapter.buildWorld(engine.scene);
const mech = chapter.buildMechanic
  ? chapter.buildMechanic(engine.scene)
  : chapter.buildRotor(engine.scene);
engine.camState.target.copy(chapter.cameraTarget);
engine.placeCamera();

const ida = buildIda(); engine.scene.add(ida.group);
const child = chapter.buildChild ? chapter.buildChild() : null;
if (child) engine.scene.add(child.group);
const chain = chapter.CHAIN ? buildChain(chapter.CHAIN) : null;

// ------------------------------------------------------------ 玩法状态机
const game = chapter.createPlay
  ? chapter.createPlay({ engine, chapter, ida, fx, ui, mech, child })
  : createGame({ engine, chapter, chain, ida, rotor: mech, fx, ui });
game.onDemoChange = running =>
  document.getElementById('btnAuto').classList.toggle('running', running);

// 画布尺寸联动（bg/fx 的设备像素尺寸）
engine.onResize(view => {
  sky.resize(Math.round(view.w * view.dpr), Math.round(view.h * view.dpr));
  fx.resize(Math.round(view.w * view.dpr), Math.round(view.h * view.dpr), view.dpr);
});
engine.resize();   // 画布层此时才就绪，再跑一次尺寸同步

// ------------------------------------------------------------ 渲染：背景 → WebGL 场景 → 前景
engine.onRender((dt, simT) => {
  const st = game.getState();
  sky.draw(dt, simT, {
    panU: engine.camState.panU,
    dark: st.finished ? Math.min(0.3, game.endingT() * 0.06) : 0,
    finished: st.finished,
    endT: game.endingT(),
    dpr: engine.view.dpr,
  });
  engine.renderer.render(engine.scene, engine.camera);
  fx.draw(simT, engine.camState.panU, engine.view.dpr);
});
engine.onUpdate((dt, dtRaw, simT) => game.update(dt, dtRaw, simT));

// ------------------------------------------------------------ 圆形按钮
ui.bindButton(document.getElementById('btnReset'), () => { game.cancelDemo(); game.reset(); });
ui.bindButton(document.getElementById('btnAuto'), () => game.startDemo());

// ------------------------------------------------------------ 调试 / 测试接口（window.MV）
window.MV = {
  THREE, scene: engine.scene, camera: engine.camera, renderer: engine.renderer,
  ida: ida.group, rotor: mech.group, crank: mech.crank || mech.group, camState: engine.camState,
  mech,
  TOTAL: game.TOTAL(), GOAL: chapter.GOAL || null,
  ROTOR_RANGE: chain ? chain.rotorRange : null,
  getTheta: game.getTheta,
  setTheta: game.setTheta,
  dock: game.dock,
  init: game.init,
  go: game.go,
  setS: game.setS,
  setTarget: game.setTarget,
  reset: game.reset,
  hubScreen: game.hubScreen,
  appOffset: () => ({ left: engine.view.left, top: engine.view.top }),
  hideHint: ui.hide,
  showHint: ui.show,
  state: game.getState,
};

// 调试/测试入口：#theta=-1.5708&s=12 直接设置状态；#demo 自动演示；
// #nohint 隐藏提示；#ff=秒 以固定步长快进模拟（无头截图/确定性测试）
{
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('theta')) game.setTheta(parseFloat(h.get('theta')));
  if (h.has('s')) game.setS(parseFloat(h.get('s')));
  if (h.has('target')) game.setTarget(parseFloat(h.get('target')));
  if (h.has('nohint')) ui.hide();
  if (h.has('demo')) game.startDemo();
  if (h.has('ff')) { const n = Math.round(parseFloat(h.get('ff')) / (1 / 60)); for (let i = 0; i < n; i++) game.update(1 / 60, 1 / 60, n / 60); }
}

window.__MV_BOOTED = true;
engine.start();
