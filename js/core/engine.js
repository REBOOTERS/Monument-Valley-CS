/* ============================================================
   引擎层：渲染器 / 正交相机 / 尺寸自适应 / 主循环。
   与具体章节无关；章节通过 onUpdate/onRender 注册每帧逻辑。

   世界尺度约定（全章节共享，与人物/机关建模一致）：
     1 世界单位 = 1 个方块边长；参考取景（1280 高）下
     竖直方向 1 单位 = PX_PER_UNIT 像素；相机竖直视高固定为
     CAM_HALF_H——窗口变宽只增两侧天空，不改变结构大小。
   ============================================================ */
import * as THREE from 'three';

export const PX_PER_UNIT = 30;          // 参考取景(1280高)下 1 单位的像素高
export const REF_H = 1280;              // 参考取景高度
export const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
export const PX_PER_UP_UNIT = PX_PER_UNIT / 0.816496580927726; // 相机 up 方向 1 单位的像素数
export const CAM_HALF_H = (REF_H / 2) / PX_PER_UP_UNIT;        // 相机竖直半视高（世界单位）

export function createEngine() {
  const app = document.getElementById('app');
  const glCanvas = document.getElementById('gl');
  if (!app || !glCanvas) throw new Error('DOM 未就绪');

  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  // 结尾镜头平移量（沿相机 up / right，由章节的结局演出驱动）
  // halfH：竖直半视高，可被章节覆盖（cameraHalfH）实现每章的取景缩放
  // dir：相机偏移方向，可被章节覆盖（cameraDir）实现每章的投影仰角
  const camState = {
    target: new THREE.Vector3(), panU: 0, panR: 0, halfH: CAM_HALF_H,
    dir: ISO_DIR.clone(),
  };

  // 视口：画布 CSS 尺寸 / dpr / #app 在视口中的偏移（指针坐标换算用）
  const view = { w: 576, h: 1280, dpr: 1, left: 0, top: 0 };
  const resizeFns = [];

  function placeCamera() {
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const t = camState.target.clone().addScaledVector(camState.dir, 60)
      .addScaledVector(right, camState.panR);
    // panU 沿"屏幕上方向"平移：视方向与世界上方向的正交分解
    const upScr = new THREE.Vector3(0, 1, 0).sub(
      camState.dir.clone().multiplyScalar(camState.dir.y)).normalize();
    t.addScaledVector(upScr, camState.panU);
    camera.position.copy(t);
    camera.up.set(0, 1, 0);
    camera.lookAt(camState.target.clone()
      .addScaledVector(right, camState.panR).addScaledVector(upScr, camState.panU));
    camera.updateMatrixWorld();
  }

  function resize() {
    view.w = app.clientWidth || window.innerWidth;
    view.h = app.clientHeight || window.innerHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(view.dpr);
    renderer.setSize(view.w, view.h, false);   // 不写内联 style，布局始终由 CSS 接管
    const aspect = view.w / view.h;
    const halfH = camState.halfH || CAM_HALF_H;
    camera.top = halfH; camera.bottom = -halfH;
    camera.left = -halfH * aspect; camera.right = halfH * aspect;
    camera.updateProjectionMatrix();
    const r = glCanvas.getBoundingClientRect();
    view.left = r.left; view.top = r.top;
    for (const f of resizeFns) f(view);
  }

  // WebGL 上下文丢失/恢复（headless swiftshader 等环境可能瞬时 lost→restored）
  const lostFns = [], restoredFns = [];
  glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); for (const f of lostFns) f(); });
  glCanvas.addEventListener('webglcontextrestored', () => { for (const f of restoredFns) f(); });

  const updateFns = [];
  const renderFns = [];
  let simT = 0;

  function start() {
    const clock = new THREE.Clock();
    (function frame() {
      requestAnimationFrame(frame);
      const dtRaw = clock.getDelta();
      const dt = Math.min(dtRaw, 0.05);
      simT += dt;
      for (const f of updateFns) f(dt, dtRaw, simT);
      for (const f of renderFns) f(dt, simT);
    })();
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    app, glCanvas, renderer, scene, camera, camState, view,
    placeCamera, resize,
    onUpdate: f => updateFns.push(f),
    onRender: f => renderFns.push(f),
    onResize: f => resizeFns.push(f),
    onContextLost: f => lostFns.push(f),
    onContextRestored: f => restoredFns.push(f),
    start,
  };
}
