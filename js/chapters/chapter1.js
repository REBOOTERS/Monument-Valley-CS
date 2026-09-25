/* ============================================================
   第一章「曲柄」：几何搭建 / 旋转机关 / 行走链 / 自动演示脚本。

   —— 新增章节指南 ——
   参考本文件新建 chapters/chapterN.js，导出与这里相同的接口，
   然后在 main.js 的 CHAPTERS 表注册：

     META          { id, title, subtitle }   章节标题（通关时浮现）
     cameraTarget  相机注视点（决定取景；世界坐标）
     skyMoon       背景月亮配置（可省略）{ ox, oy, r }，参考取景 1280 高基准
     buildWorld(scene)               搭建静态几何与灯光
     buildRotor(world|scene)         搭建本章机关，返回机关 API（见下）
     CHAIN             行走链点列（core/chain.js 的标记语义）
     GOAL              终点（世界坐标，自动演示的点击目标）
     DEMO              自动演示脚本 { keys, spinStart, spinEnd, tapAt }

   机关 API（曲柄型章节通用）：
     group           随 theta 旋转的组（rotation.x = theta）
     hubLocal        曲柄毂在 crank 组内的局部坐标（拖拽热点的屏幕投影用）
     crank           毂所在的组（用于 localToWorld）
     setCrankExtension(ext)   辐条缩回/展开（艾达站上构件时锁定）
     armBEndMat      接缝视错觉用的末端面材质（连接态隐藏）
     dockTheta       停靠角；snapStep    吸附角步长
     connected(theta) 连接判定
   ============================================================ */
import * as THREE from 'three';
import { PAL, box } from '../core/materials.js';

export const META = {
  id: 'chapter1',
  title: '第 一 章',
  subtitle: '迷 途 的 公 主',
};

// 取景：使原点落在参考视频的 (175,766)
export const cameraTarget = new THREE.Vector3(0.775, 2.80, -3.575);

// 背景月亮：参考帧实测圆心 (530,680)、r≈14.5px（576×1280 参考取景）
export const skyMoon = { ox: 530 - 288, oy: 680, r: 14.5 };

// ------------------------------------------------------------ 布局常量（单位 = 1 方块边长）
const X0 = 0.5;                      // 左侧墙体/地板起点
const STAIR_X0 = X0, STAIR_X1 = X0 + 1, STAIR_Z0 = 0.5, STEPS = 28, STEP = 0.125, SLAB_T = 0.28;
const TOP_Y = 8 + STEP * STEPS;      // 11.5
// 终点 = 终点地砖中心（buildWorld 里按同一算式摆放地砖）
export const GOAL = new THREE.Vector3(2.5 - 0.08 - 0.7, TOP_Y, -5.05 + 0.08 + 0.7);

export function buildWorld(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(3, 6, 4); scene.add(sun);

  const world = new THREE.Group(); scene.add(world);

  world.add(box(PAL.stone, X0, 8, 0, 1, 0, 1));           // 底部地板
  world.add(box(PAL.stone, X0, 3, 0, 1, -1, 0));          // 拱廊后方的地台（延伸地板，支撑小平台）
  world.add(box(PAL.stone, 8, 9, 0, 4, 0, 1));            // 右侧底座立柱（旋转臂原本落在它上面）
  world.add(box(PAL.beam, X0, 4, 7, 8, 0, 1));            // 固定横梁（x=4 处与旋转臂接缝）
  world.add(box(PAL.ledge, 2, 3, 1, 2, -2.03, 0));        // 小平台：投影上与旋转后的臂端完全重合（多出 0.03 用于消除接缝处的抗锯齿细线）

  // 拱廊立面（薄墙 + 两个拱门，三根立柱）
  {
    const shape = new THREE.Shape();
    shape.moveTo(X0, 1); shape.lineTo(X0 + 2, 1); shape.lineTo(X0 + 2, 7); shape.lineTo(X0, 7); shape.closePath();
    const cols = [[X0, X0 + 0.15], [X0 + 0.925, X0 + 1.075], [X0 + 1.85, X0 + 2]];
    for (let i = 0; i < 2; i++) {
      const a = cols[i][1], b = cols[i + 1][0], r = (b - a) / 2, cx = (a + b) / 2, yTop = 6.7;
      const hole = new THREE.Path();
      hole.moveTo(a, 1); hole.lineTo(a, yTop - r);
      hole.absarc(cx, yTop - r, r, Math.PI, 0, true);
      hole.lineTo(b, 1); hole.closePath();
      shape.holes.push(hole);
    }
    const FACADE_T = 0.12;
    const g = new THREE.ExtrudeGeometry(shape, { depth: FACADE_T, bevelEnabled: false, curveSegments: 12 });
    const facade = new THREE.Mesh(g, PAL.wall);
    facade.position.z = 1 - FACADE_T;
    world.add(facade);
  }

  // 楼梯：一块薄斜板上开 28 级细小台阶（每级 0.125），从横梁顶（y=8, z=0.5）向 -z 爬升到 y=11.5, z=-3。
  // 整体是一个沿 x 方向拉伸的单一多边形，斜板底边落在横梁顶面上（z∈[0.15,0.5]），不与横梁相交。
  {
    const sh = new THREE.Shape(); // 坐标 (u=z, v=y)
    sh.moveTo(STAIR_Z0, 8);
    for (let k = 1; k <= STEPS; k++) {
      sh.lineTo(STAIR_Z0 - STEP * (k - 1), 8 + STEP * k);   // 竖板
      sh.lineTo(STAIR_Z0 - STEP * k, 8 + STEP * k);         // 踏面
    }
    const zTop = STAIR_Z0 - STEP * STEPS;                    // -3
    sh.lineTo(zTop, TOP_Y - SLAB_T);
    sh.lineTo(STAIR_Z0 - SLAB_T, 8);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: STAIR_X1 - STAIR_X0, bevelEnabled: false });
    const stairs = new THREE.Mesh(g, PAL.stair);
    stairs.rotation.y = -Math.PI / 2;      // shape-X → 世界 z，拉伸方向 → 世界 -x
    stairs.position.x = STAIR_X1;
    world.add(stairs);
  }
  // 终点平台（楼梯宽度的小过廊 + 带同心方纹的方形地砖）
  world.add(box(PAL.goal, STAIR_X0, STAIR_X1, TOP_Y - 0.4, TOP_Y, -3.3, -3));
  world.add(box(PAL.goal, X0, 2.5, TOP_Y - 0.4, TOP_Y, -5.05, -3.3));
  {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#e2fdfe'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#b0c4c9'; g.lineWidth = 12;
    for (let i = 0; i < 4; i++) { const s = 226 - i * 52; g.strokeRect(128 - s / 2, 128 - s / 2, s, s); }
    g.fillStyle = '#b0c4c9'; g.fillRect(118, 118, 20, 20);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const size = 1.4;
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(GOAL.x, TOP_Y + 0.004, GOAL.z);
    world.add(tile);
  }
  return world;
}

// ------------------------------------------------------------ 旋转机关（绕曲柄 x 轴旋转）
export function buildRotor(world) {
  const PIVOT = new THREE.Vector3(0, 7.5, 0.5);
  const rotor = new THREE.Group(); rotor.position.copy(PIVOT); world.add(rotor);
  const addToRotor = mesh => { mesh.position.sub(PIVOT); rotor.add(mesh); return mesh; };
  const armA = addToRotor(box(PAL.rotor, 4, 9, 7, 8, 0, 1));            // 横臂（含顶角块），绕自身轴自转
  const ARM_B_LEN = 3;
  // 竖臂；0.04 间隙保证转动时角部不会切入底座。
  // 其末端面（初始为底面，转到位后朝 +z）单独用一个材质：对齐到位时隐藏——此时小平台的顶面与右侧面在投影上
  // 恰好完全覆盖该区域，形成原作中“接缝只剩色调差”的无缝视错觉，同时避免它遮住站在小平台末端的艾达。
  const armBEndMat = PAL.rotor.clone();
  const armB = addToRotor(box([PAL.rotor, PAL.rotor, PAL.rotor, armBEndMat, PAL.rotor, PAL.rotor], 8, 9, 7 - ARM_B_LEN + 0.04, 7, 0, 1));

  // 曲柄（平滑着色）
  const crank = new THREE.Group(); rotor.add(crank);
  const crankMat = new THREE.MeshLambertMaterial({ color: '#5f8fae' });
  const knobMat = new THREE.MeshLambertMaterial({ color: '#7fb5cc' });
  const axleMat = new THREE.MeshLambertMaterial({ color: '#b9dbea' });
  {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 16), axleMat);
    axle.rotation.z = Math.PI / 2; axle.position.set(9 + 0.85, 0, 0); crank.add(axle);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), crankMat);
    hub.position.set(10.95, 0, 0); crank.add(hub);
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.26, 20), crankMat);
    socket.rotation.z = Math.PI / 2; socket.position.set(11.27, 0, 0); crank.add(socket);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), new THREE.MeshBasicMaterial({ color: '#2d4a60' }));
    hole.rotation.y = Math.PI / 2; hole.position.set(11.402, 0, 0); crank.add(hole);
  }
  // 4 根辐条 + 把手；艾达站在旋转构件上时会缩回（与原作一致，表示锁定）
  const spokes = [];
  for (const dir of [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const d = new THREE.Vector3(...dir);
    const grp = new THREE.Group(); grp.position.set(10.95, 0, 0);
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 12), axleMat);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 16), knobMat);
    // 让圆柱沿 dir 方向
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    spoke.quaternion.copy(q); knob.quaternion.copy(q);
    grp.add(spoke, knob); crank.add(grp);
    spokes.push({ spoke, knob, d });
  }
  function setCrankExtension(ext) { // ext: 0 缩回, 1 展开
    const len = 0.32 + 0.68 * ext;
    for (const s of spokes) {
      s.spoke.scale.y = Math.max(len, 0.01);
      s.spoke.position.copy(s.d).multiplyScalar(len / 2);
      s.knob.position.copy(s.d).multiplyScalar(len + 0.17 - 0.05 * (1 - ext));
    }
  }
  setCrankExtension(1);

  return {
    group: rotor, crank, spokes, setCrankExtension, armBEndMat,
    hubLocal: new THREE.Vector3(10.95, 0, 0),
    dockTheta: -Math.PI / 2,   // 竖臂转到 +z 方向，与小平台连成一线
    snapStep: Math.PI / 2,     // 松手吸附到最近的 90°
    connected: theta =>
      Math.abs(THREE.MathUtils.euclideanModulo(theta + Math.PI / 2 + Math.PI, Math.PI * 2) - Math.PI) < 0.02,
  };
}

// ------------------------------------------------------------ 行走路线
// 一条链；"seam" 表示投影重合的两点之间的“视错觉”跳接：
//   A 地板右端 → B 拱廊前地板角 → C 地台尽头 ≡ C' 小平台前缘 → D 小平台尽头 ≡ D' 旋转臂末端
//   → F 顶角 → G 横梁左端 → 楼梯 → 终点
export const CHAIN = [
  { p: new THREE.Vector3(7.4, 1, 0.5) },
  { p: new THREE.Vector3(1.15, 1, 0.5) },
  { p: new THREE.Vector3(1.15, 1, -1.0), seam: true },
  { p: new THREE.Vector3(2.15, 2, 0.0) },
  { p: new THREE.Vector3(2.5, 2, -0.7) },
  { p: new THREE.Vector3(2.5, 2, -1.7), seam: true, needsRotor: true },
  { p: new THREE.Vector3(8.5, 8, 3.7) },
  { p: new THREE.Vector3(8.5, 8, 0.5) },
  { p: new THREE.Vector3(X0 + 0.5, 8, 0.5), rotorEnd: true },
  { p: new THREE.Vector3(X0 + 0.5, 8, STAIR_Z0 + STEP), stairs: true },   // 起步点：沿台阶前沿连线以 45° 上行
  { p: new THREE.Vector3(X0 + 0.5, TOP_Y, STAIR_Z0 - STEP * STEPS + STEP) }, // 最后一级前沿
  { p: new THREE.Vector3(X0 + 0.5, TOP_Y, -3.45) },
  { p: GOAL.clone() },
];

// ------------------------------------------------------------ 自动演示（复现参考视频中的操作序列）
export const DEMO = {
  keys: [[1.0, 0], [2.0, -0.5], [3.0, -2.0], [4.2, -1.2], [5.6, -Math.PI / 2]],
  spinStart: 1.0,   // 开始转曲柄：先转过头，再回一点，再对齐 —— 模拟视频中来回拖动
  spinEnd: 5.6,     // 此后锁定在 dockTheta
  tapAt: 6.3,       // 点击终点、开始行走
};

export default { META, cameraTarget, skyMoon, buildWorld, buildRotor, CHAIN, GOAL, DEMO };
