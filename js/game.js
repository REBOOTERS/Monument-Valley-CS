/* ============================================================
   Monument Valley —— "曲柄之章" 单关卡复刻
   three.js r128 (UMD)，固定正交视角
   投影（由 demo1.mp4 像素级标定）：
     方位角 228.6°，仰角 41°，154px/世界单位（VIEW_W=3.74）
     世界 +x 投影为左上 slope .575（顶梁/底梁方向）；
     世界 +y 投影为左下 slope −.75（拱墙进深/祭坛梯方向）
   ============================================================ */
(function () {
  'use strict';
  const THREE = window.THREE;

  /* ---------------- 配色（视频帧采样） ---------------- */
  const COL = {
    top: 0xd6f0fb,
    sideL: 0xa7c9df,
    sideM: 0x7ea6c0,
    sideD: 0x5e8da9,
    under: 0x5d7e97,
    crank: 0x6f94b6,
    crankDark: 0x587b9c,
    crankHi: 0xe7f4fc,
    rod: 0xd6ebf6,
    idaDark: 0x121c2b,
    idaTop: 0x1d2f43,
    dress: 0xff9a5e,
  };

  /* ---------------- 关卡尺寸（由 f_001/f_015 像素标定，k=154px/单位） ----------------
     世界 +x 投影为左上（slope .575，底梁/顶梁方向）；
     世界 +y 投影为左下（拱墙进深 / 祭坛梯方向）；
     拱墙在 +y 深处（y≈.85 为带三个尖拱的后墙），Ida 穿过最左尖拱爬升。 */
  const T = 0.3;            // 梁高
  const H = 2.2;            // 顶梁顶面高 / 转子轴点 Q 高度
  const L_TOP = 1.28;       // 顶梁长（沿 x）
  const L1 = 0.994;         // 转子长臂长（初始与顶梁重合，停靠搭到悬臂端）
  // 悬臂高端 = 停靠时长臂端点 B'（f_015 像素反解：与 Q 等高，沿 +y 偏转 91.9°）
  const TIP = new THREE.Vector3(-0.03, 0.89, H);

  /* 转子最终解（本会话逆向工程结论，tools/verify_final.py + probe13-16 raycast
     + rank_f3v2 缝安全检验）：轴为竖直 n=(0,0,1)。此前"斜轴"推断源于把 f003/
     频闪的 px 观测当作硬上限——实际上那些方位的手臂远端被拱廊/檐台遮挡，
     r96 只是可见截断（竖直轴 f3 px=143，掩膜 96 止于拱廊边缘 ✓）。竖直轴：
     init 长臂完全藏于顶梁内（f001 空掩膜 ✓）、dock 摆到 +y 搭接 TIP ✓、
     az 递减 = θ 正向（拖拽手感不变）。短杆带圆头帽为独立运动件（刚性双臂
     模型被否决：f003 短臂 az120.2 同时性与 init 双臂隐藏在全部严格轴上互斥），
     三点键控：init 垂于立柱后(不可见) → f003 az120.2(px60) → dock az105.6(px57,
     f_012 实证)，随 θ/Θ 分段插值。 */
  const ROTOR_FIT = {
    n: [0, 0, 1],
    thetaDock: 91.7 * Math.PI / 180, t3: 69.0 * Math.PI / 180,
    a0: [1, 0, 0],
    b0i: [0, 0, -1],
    b0d: [-0.4743, 0.8613, -0.1813],
    Lb: 0.466,
  };
  const Q_W = new THREE.Vector3(0, -0.10, H);
  const ROT_AXIS = new THREE.Vector3(...ROTOR_FIT.n).normalize();
  const THETA_DOCK = ROTOR_FIT.thetaDock;
  const VIEW_N = new THREE.Vector3(-0.499, 0.566, 0.656);

  // 路径节点（均为可踩面的顶面点；屏幕锚点由 f_001/f_015 逐像素反解，k=154）
  const N0 = new THREE.Vector3(0.70, 0.05, 0.60);                 // Ida 起点（底梁）
  const N1 = new THREE.Vector3(1.10, 0.18, 0.60);                 // 拱廊底部（爬升入口）
  const N2 = new THREE.Vector3(0.81, 0.85, 1.37);                 // 尖拱出口 / 悬臂根
  const N3 = TIP.clone();                                         // 悬臂端（=B'，z2.2）
  const N6 = new THREE.Vector3(1.59, 0.55, 2.30);                 // TL 角墩 / 祭坛梯起点
  const N7 = new THREE.Vector3(1.76, -1.05, 2.62);                // 祭坛
  // N4 = Q=TR（旋转轴过 Q，位置不变）

  /* ---------------- renderer / scene / camera ---------------- */
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x6e8798, 18, 42);

  // 576px 对应 3.74 世界单位（154px/单位），固定水平视宽
  const VIEW_W = 3.74;
  const camera = new THREE.OrthographicCamera(-2, 2, 4, -4, 0.1, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(-8.90, 11.05, 14.59);   // az ≈ -48.6°，el 41°
  camera.lookAt(1.054, -0.242, 1.508);
  camera.updateMatrixWorld();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    const aspect = w / h;
    camera.left = -VIEW_W / 2;
    camera.right = VIEW_W / 2;
    camera.top = VIEW_W / aspect / 2;
    camera.bottom = -VIEW_W / aspect / 2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- 灯光 ---------------- */
  scene.add(new THREE.HemisphereLight(0xe8f3fb, 0x4d6678, 0.62));
  const sun = new THREE.DirectionalLight(0xffffff, 0.58);
  sun.position.set(-6, 7, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 10, bottom: -6, near: 1, far: 34 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd9ef, 0.18);
  fill.position.set(6, -4, 4);
  scene.add(fill);

  /* ---------------- 材质 / 建造工具 ---------------- */
  function lambert(color) { return new THREE.MeshLambertMaterial({ color }); }
  const MAT = {
    top: lambert(COL.top),
    sideL: lambert(COL.sideL),
    sideM: lambert(COL.sideM),
    sideD: lambert(COL.sideD),
    under: lambert(COL.under),
  };
  const BOX_FACES = [MAT.sideD, MAT.sideL, MAT.sideM, MAT.sideD, MAT.top, MAT.under];

  function box(w, d, h, material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), material || BOX_FACES);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  // 沿世界 x 的水平梁
  function beamX(x0, x1, y, top, w, h) {
    w = w || 0.3; h = h || T;
    const m = box(Math.abs(x1 - x0), w, h);
    m.position.set((x0 + x1) / 2, y, top - h / 2);
    return m;
  }
  // 任意水平方向梁（z 向截面 T）
  function beamAlong(p0, p1, top, w, h, material) {
    w = w || 0.3; h = h || T;
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    const m = box(len, w, h, material);
    const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
    m.position.set(mid.x, mid.y, top - h / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
    return m;
  }
  // 三维斜坡梁（顶面两端点 p0/p1，厚度沿斜坡法线竖直向下）
  function beamSlab(p0, p1, w, h, material) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    const eX = dir.clone().normalize();
    const horiz = new THREE.Vector3(dir.x, dir.y, 0);
    const eY = new THREE.Vector3(-horiz.y, horiz.x, 0).normalize(); // 水平横向
    const eZ = new THREE.Vector3().crossVectors(eX, eY).normalize(); // 斜面法线（朝上）
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, w, h), material || BOX_FACES);
    m.geometry.translate(0, 0, -h / 2);   // 局部顶面 z=0 对齐 p0→p1
    const basis = new THREE.Matrix4().makeBasis(eX, eY, eZ);
    m.quaternion.setFromRotationMatrix(basis);
    m.position.copy(new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5))
      .addScaledVector(eZ, -h / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  // 上升悬臂：顶面为沿 p0→p1 的斜面，侧壁【竖直】（参考帧中是一块薄板，
  // 不是垂直于斜面的棱柱），厚度沿世界 −z
  function slabRise(p0, p1, w, h, material) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    const eX = dir.clone().multiplyScalar(1 / len);
    const eY = new THREE.Vector3(-eX.y, eX.x, 0).normalize();
    const L = len / 2, W = w / 2, mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
    const cc = [
      [-L, -W, 0], [L, -W, 0], [L, W, 0], [-L, W, 0],
      [-L, -W, -h], [L, -W, -h], [L, W, -h], [-L, W, -h],
    ];
    const pos = [];
    for (const q of cc) {
      pos.push(mid.x + q[0] * eX.x + q[1] * eY.x,
        mid.y + q[0] * eX.y + q[1] * eY.y,
        mid.z + q[0] * eX.z + q[2]);
    }
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex([
      0, 1, 2, 0, 2, 3, 6, 5, 4, 6, 4, 7, 4, 5, 1, 4, 1, 0,
      1, 5, 6, 1, 6, 2, 3, 2, 6, 3, 6, 7, 4, 0, 3, 4, 3, 7]);
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();
    // 三角面顺序：顶、底、四个侧面；材质索引对齐 BOX_FACES 约定
    const faceMats = [4, 5, 2, 2, 1, 0];
    faceMats.forEach((mi, i) => geo.addGroup(i * 6, 6, mi));
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  // 沿任意方向的长条（用于倾斜立柱）
  function barAlong(p0, p1, w, d, material) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    const m = box(w, d, len, material);
    m.position.copy(new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    return m;
  }

  // 白色露天台阶：实心踏步 + 两道极矮边梁
  function stairs(a, b, steps, width, cheekColor) {
    const g = new THREE.Group();
    const dir = new THREE.Vector3().subVectors(b, a);
    const horiz = new THREE.Vector3(dir.x, dir.y, 0);
    const hLen = horiz.length();
    const uH = horiz.clone().normalize();
    const alpha = Math.atan2(uH.y, uH.x);
    const tread = hLen / steps;
    const riser = dir.z / steps;
    for (let i = 0; i < steps; i++) {
      const s = box(tread * 1.04, width, riser);
      const c = uH.clone().multiplyScalar(tread * (i + 0.5));
      s.position.set(a.x + c.x, a.y + c.y, a.z + riser * (i + 0.5) - riser / 2);
      s.rotation.z = alpha;
      g.add(s);
    }
    return g;
  }
  function radialTexture(stops, size) {
    size = size || 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(s => grad.addColorStop(s[0], s[1]));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(cv);
  }

  /* ---------------- 地面阴影 / 雾光 ---------------- */
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShadowMaterial({ opacity: 0.12 })
  );
  shadowPlane.position.set(1.0, -0.6, -0.02);
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  /* 背景光晕板已移除：参考视频背景 = 纯 CSS 渐变（实测 f001 天空列与
     style.css 渐变逐点吻合），任何全屏加色都会破坏色调匹配。 */

  /* ================================================================
     静态框架
     ================================================================ */
  const level = new THREE.Group();
  scene.add(level);

  // 底层步道（沿世界 x）：右端没入立柱，左端伸入拱廊（透过尖拱可见亮地面，f_001）
  level.add(beamX(-0.12, 1.5, 0.07, 0.57, 0.30, 0.42));
  // 基座：拱墙进深内的暗台，藏在底梁之后，仅左段/下端隐约没入雾中
  const foundMat = lambert(0x5d7e97);
  const foundation = box(1.55, 0.62, 0.58, [foundMat, foundMat, foundMat, foundMat, foundMat, foundMat]);
  foundation.position.set(0.69, 0.61, -0.11);
  level.add(foundation);
  // 右侧整根静态立柱：自雾中 z-.35 一直立到肘部 z2.37（f_001/f_015 全程不变，
  // 旋转臂的短臂始终竖直藏在它内部）
  const pillar = box(0.36, 0.34, 2.72,
    [MAT.sideD, MAT.sideL, MAT.sideM, MAT.sideD, MAT.top, MAT.under]);
  pillar.position.set(0, -0.10, 1.01);
  level.add(pillar);

  // 拱廊：深处一片薄墙板（y≈.79-.85）开三个哥特尖拱，仅浅进深；
  // 棂条位置/洞口比例由 f_001 像素标定（世界 x .45→1.11，z .30→3.00），
  // 板顶被更近的顶梁/TL 角墩遮挡（视错觉连接，画面上无顶边）
  (function buildArcade() {
    const WW = 0.66, CX = 0.78, TH = 0.06, Z0 = 0.30, WL = 2.70;
    const SILL = 1.42 - Z0, SPRING = 2.35 - Z0, APEX = 2.85 - Z0;
    // 三个尖洞（局部 x，0 对应世界 x=.45）：中心/洞宽
    const HOLES = [
      { c: 1.005 - CX + WW / 2, w: 0.139 },
      { c: 0.797 - CX + WW / 2, w: 0.139 },
      { c: 0.572 - CX + WW / 2, w: 0.173 },
    ];
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(WW, 0); sh.lineTo(WW, WL); sh.lineTo(0, WL); sh.lineTo(0, 0);
    HOLES.forEach(h => {
      const x0 = h.c - h.w / 2, x1 = x0 + h.w, xm = h.c;
      const hp = new THREE.Path();
      hp.moveTo(x0, 0);
      hp.lineTo(x0, SILL);
      hp.lineTo(x0, SPRING);
      hp.quadraticCurveTo(x0, APEX, xm, APEX);
      hp.quadraticCurveTo(x1, APEX, x1, SPRING);
      hp.lineTo(x1, 0);
      hp.lineTo(x0, 0);
      sh.holes.push(hp);
    });
    const geo = new THREE.ExtrudeGeometry(sh, { depth: TH, bevelEnabled: false, curveSegments: 12 });
    geo.translate(-WW / 2, 0, 0);
    // 局部 (x, 升高, 挤出) → 世界 (x, z, −y)
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, -1, 0)));
    const wall = new THREE.Mesh(geo, [
      new THREE.MeshLambertMaterial({ color: COL.sideL }),
      new THREE.MeshLambertMaterial({ color: COL.sideM }),
    ]);
    wall.position.set(CX, 0.85, Z0);    // 墙板占据 y .79→.85
    wall.castShadow = true;
    wall.receiveShadow = true;
    level.add(wall);
  })();

  // 顶层静态梁：Q(TR) → TL（沿世界 x，y∈[-.27,.07]，z1.9→2.2），转子长臂初始藏于其内
  level.add(beamX(0, L_TOP, -0.10, H, 0.34, T));

  // 悬臂：自拱墙中部棂洞（N2，z1.37）斜向伸到 N3（z2.2）的"不可能斜坡"，
  // 窄板（屏宽 ~.26 单位）；停靠时长臂顶面与高端 N3 齐平，连成一条步道（f_015）
  const cant = slabRise(N2, N3, 0.26, 0.30,
    [MAT.sideM, MAT.sideM, MAT.sideL, MAT.sideM, MAT.top, MAT.sideM]);
  level.add(cant);

  // 通往祭坛的大斜梯
  level.add(stairs(N6, N7, 24, 0.36, 0x7ea3bd));
  // TL 角墩（压在拱墙上方、遮住墙板顶边；祭坛梯起步平台，顶 z2.5）
  const tlCap = box(0.50, 0.50, 0.30);
  tlCap.position.set(1.50, 0.35, H + 0.15);
  level.add(tlCap);
  // TR 角墩（Q：转子肘部小冠，遮挡旋转拼缝）
  const trCap = box(0.30, 0.30, 0.24);
  trCap.position.set(0, -0.10, H + 0.12);
  level.add(trCap);

  // 祭坛（同心方纹）
  const padTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f2fbff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#9dbccf';
    ctx.lineWidth = 7;
    for (let i = 0; i < 5; i++) {
      const m = 24 + i * 23;
      ctx.strokeRect(m, m, 256 - m * 2, 256 - m * 2);
    }
    return new THREE.CanvasTexture(cv);
  })();
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.62, 0.08),
    [MAT.sideM, MAT.sideL, MAT.sideM, MAT.sideD, new THREE.MeshLambertMaterial({ map: padTex }), MAT.under]
  );
  pad.position.set(N7.x, N7.y, N7.z - 0.04);
  pad.castShadow = true;
  pad.receiveShadow = true;
  level.add(pad);

  /* ================================================================
     旋转机关：轴点在 Q=TR，绕斜轴 ROT_AXIS 旋转
     ================================================================ */
  const mech = new THREE.Group();
  mech.position.copy(Q_W);
  scene.add(mech);
  const rotor = new THREE.Group();
  mech.add(rotor);

  // R_OFF：臂网格微移 −V，避免与梁/柱共面闪烁；rotor 组原点保持精确（B 点反解用）
  const R_OFF = new THREE.Vector3(-0.499, 0.566, 0.656).multiplyScalar(-0.02);
  const LEG_FACES = [MAT.sideD, MAT.sideL, MAT.sideM, MAT.sideD, MAT.top, MAT.under];
  const LONG_FACES = LEG_FACES;

  // θ=0 基准姿态：局部 +x → a0（init 长臂方向）；setRotorAngle 再绕斜轴转 θ
  const A0 = new THREE.Vector3(...ROTOR_FIT.a0).normalize();
  const Q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), A0);

  // 短杆（独立运动件，非刚性第二臂）：枢轴在 Q，带圆头帽。姿态由转角键控：
  // init 藏于顶梁后方(az190, raycast 验证全遮挡) → dock 拐角下方(az105.6,
  // px57, f_012 实证)。方向对 b0i→b0d 随 θ/Θ 插值。
  const B0I = new THREE.Vector3(...ROTOR_FIT.b0i).normalize();
  const B0D = new THREE.Vector3(...ROTOR_FIT.b0d).normalize();
  const Lb = ROTOR_FIT.Lb;
  const shortLeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, Lb, 10), MAT.sideM);
  shortLeg.castShadow = true;
  mech.add(shortLeg);
  const shortCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.09, 12), MAT.sideL);
  shortCap.castShadow = true;
  mech.add(shortCap);
  function setShortPose(d) {
    shortLeg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    shortLeg.position.copy(d).multiplyScalar(Lb / 2).add(R_OFF);
    shortCap.quaternion.copy(shortLeg.quaternion);
    shortCap.position.copy(d).multiplyScalar(Lb - 0.045).add(R_OFF);
  }
  // 长臂（θ=0 沿 a0；停靠后摆到 +y 搭接悬臂高端 TIP）。
  // 几何整体下移 T/2：逻辑端点 B=(L1,0,0) 是臂【顶面】线，
  // 停靠到 TIP 时与悬臂顶面齐平
  const longLeg = box(L1, 0.22, T, LONG_FACES);
  longLeg.geometry.translate(0, 0, -T / 2);
  longLeg.position.copy(R_OFF);
  longLeg.position.x = L1 / 2;
  rotor.add(longLeg);
  // 长臂外端（与梁齐平）
  const endB = box(0.22, 0.22, T, LONG_FACES);
  endB.geometry.translate(0, 0, -T / 2);
  endB.position.copy(R_OFF);
  endB.position.x = L1;
  rotor.add(endB);

  // 曲柄（短轴杆自肘部 −y 侧伸出 + 深色球毂 + 外侧圆环 + 四辐鼓形帽手柄）
  // 球毂屏幕约 (443,696)：立柱之右前方
  const HUB = new THREE.Vector3(-0.20, -0.34, 1.68);
  // 轴杆没入立柱 −y 侧面（视频中球到肘部的短横杆）
  const ENTRY_PT = new THREE.Vector3(-0.02, -0.27, 1.85);
  const ROD_N = ENTRY_PT.clone().sub(HUB).normalize();
  const ROD_LEN = HUB.distanceTo(ENTRY_PT);
  // 轮面法线（装饰轮不必严格 ⊥ 轴杆）：辐条在屏幕上呈"竖直 + 右上 25°"
  const WHEEL_N = new THREE.Vector3(0.901, 0.228, -0.369).normalize();
  const ENTRY = HUB.clone().addScaledVector(ROD_N, ROD_LEN);
  const crank = new THREE.Group();
  scene.add(crank);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, ROD_LEN, 16), lambert(COL.rod));
  rod.position.copy(new THREE.Vector3().addVectors(ENTRY, HUB).multiplyScalar(0.5));
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ROD_N);
  rod.castShadow = true;
  crank.add(rod);
  const hubMat = new THREE.MeshLambertMaterial({ color: COL.crankDark });
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.082, 24, 18), hubMat);
  hub.position.copy(HUB);
  hub.castShadow = true;
  crank.add(hub);
  // 圆环位于球毂右前侧，孔朝观察者（视频中的"垫圈"）
  const ringAxis = WHEEL_N.clone().multiplyScalar(-0.45).addScaledVector(VIEW_N, 0.55).normalize();
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.017, 10, 28), lambert(COL.crank));
  hubRing.position.copy(HUB)
    .addScaledVector(ringAxis, 0.077)
    .addScaledVector(new THREE.Vector3(-0.750, -0.661, 0), 0.035);
  hubRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringAxis);
  crank.add(hubRing);

  // 手柄：轮面 ⊥ ROD_N，两轴在屏幕上约呈"竖直 + 斜向"，辐端为蓝色鼓形短柱
  const spokes = new THREE.Group();
  spokes.position.copy(HUB);
  crank.add(spokes);
  const spokeMat = lambert(0xdcebf5);
  const capMat = lambert(COL.crank);
  // 竖直辐距 .28；右上鼓距 .45；左下鼓距 .25（屏幕像素标定，k=154）
  const a = new THREE.Vector3(0.434, -0.492, 0.755);
  const bRU = new THREE.Vector3(0.051, -0.901, -0.433);
  const bLD = new THREE.Vector3(-0.075, 0.938, 0.334);
  const spokeDirs = [
    { v: a, d: 0.28 }, { v: a.clone().negate(), d: 0.28 },
    { v: bRU, d: 0.45 }, { v: bLD, d: 0.25 },
  ];
  spokeDirs.forEach(({ v, d }) => {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, d * 0.66, 10), spokeMat);
    sp.position.copy(v).multiplyScalar(d * 0.67);
    sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    sp.castShadow = true;
    spokes.add(sp);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.095, 16), capMat);
    cap.position.copy(v).multiplyScalar(d);
    cap.quaternion.copy(sp.quaternion);
    cap.castShadow = true;
    spokes.add(cap);
  });
  const wheel = spokes; // 命中拾取别名

  let rotorTheta = 0;
  const KF1 = 69.0 / 91.7;                    // f003 关键帧位置（θ/Θ）
  const KFM = new THREE.Vector3(-0.272, 0.944, -0.1856).normalize();
  function setRotorAngle(rad) {
    rotorTheta = rad;
    rotor.quaternion.setFromAxisAngle(ROT_AXIS, rad).multiply(Q0);
    const k = THREE.MathUtils.clamp(rad / THETA_DOCK, 0, 1);
    let d;
    if (k <= KF1) d = B0I.clone().lerp(KFM, k / KF1);
    else d = KFM.clone().lerp(B0D, (k - KF1) / (1 - KF1));
    setShortPose(d.normalize());
  }
  setRotorAngle(0);

  function getDockNodes() {
    rotor.updateMatrixWorld(true);
    const b = rotor.localToWorld(new THREE.Vector3(L1, 0, 0));
    return { Q: Q_W.clone(), B: b };
  }

  /* ================================================================
     雪花
     ================================================================ */
  const snowTex = radialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.4, 'rgba(255,255,255,0.7)'],
    [1, 'rgba(255,255,255,0)'],
  ], 64);
  const bokehTex = radialTexture([
    [0, 'rgba(255,255,255,0.9)'],
    [0.35, 'rgba(255,255,255,0.32)'],
    [1, 'rgba(255,255,255,0)'],
  ], 64);
  function makeSnow(count, size, opacity, tex, spdLo, spdHi) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const drift = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -4 + Math.random() * 9;
      pos[i * 3 + 1] = -5 + Math.random() * 9;
      pos[i * 3 + 2] = 0.2 + Math.random() * 8.8;
      spd[i] = spdLo + Math.random() * (spdHi - spdLo);
      drift[i] = 0.06 + Math.random() * 0.16;
      phase[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: tex, size, transparent: true, opacity,
      depthWrite: false, sizeAttenuation: true, color: 0xffffff, fog: false,
    }));
    scene.add(points);
    return {
      update(dt, t) {
        const a = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          a[i * 3 + 2] -= spd[i] * dt;
          a[i * 3] += Math.sin(t * 0.8 + phase[i]) * drift[i] * dt;
          a[i * 3 + 1] += Math.cos(t * 0.6 + phase[i]) * drift[i] * 0.6 * dt;
          if (a[i * 3 + 2] < -0.2) {
            a[i * 3 + 2] = 8 + Math.random() * 2;
            a[i * 3] = -4 + Math.random() * 9;
            a[i * 3 + 1] = -5 + Math.random() * 9;
          }
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  }
  // 两层：细密小雪花 + 少量近处虚化大雪点
  const snowFine = makeSnow(380, 0.075, 0.95, snowTex, 0.22, 0.55);
  const snowBokeh = makeSnow(30, 0.30, 0.15, bokehTex, 0.14, 0.3);
  function updateSnow(dt, t) {
    snowFine.update(dt, t);
    snowBokeh.update(dt, t);
  }

  /* 静态星野（参考视频夜空有细小星点）：正交相机屏幕位置与深度无关，
     放到结构后方远平面上即可被建筑自然遮挡；不参与雾与射线拾取。 */
  {
    const NS = 150, pos = new Float32Array(NS * 3);
    const anchor = new THREE.Vector3(1.054, -0.242, 1.508)
      .addScaledVector(new THREE.Vector3(-0.499, 0.566, 0.656), 12);
    const rr = new THREE.Vector3(-0.750, -0.661, 0);
    const uu = new THREE.Vector3(0.434, -0.492, 0.755);
    for (let i = 0; i < NS; i++) {
      const a = (Math.random() - 0.5) * 4.2;
      const b = (Math.random() * Math.random()) * 8.0 - 3.8;   // 偏屏幕上半
      pos[i * 3] = anchor.x + a * rr.x - b * uu.x;
      pos[i * 3 + 1] = anchor.y + a * rr.y - b * uu.y;
      pos[i * 3 + 2] = anchor.z + a * rr.z - b * uu.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xdde8f2, size: 2.0, sizeAttenuation: false,
      transparent: true, opacity: 0.7, fog: false, depthWrite: false,
    }));
    stars.renderOrder = -1;
    scene.add(stars);
  }

  /* ================================================================
     Ida
     ================================================================ */
  const IDA_SCALE = 1.05;
  function buildIda() {
    const root = new THREE.Group();
    root.scale.setScalar(IDA_SCALE);
    const tilt = new THREE.Group();
    root.add(tilt);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.085, 0.15, 12),
      new THREE.MeshLambertMaterial({ color: COL.dress }));
    skirt.position.z = 0.09;
    skirt.castShadow = true;
    tilt.add(skirt);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.07, 10),
      lambert(COL.idaTop));
    body.position.z = 0.195;
    body.castShadow = true;
    tilt.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), lambert(COL.idaDark));
    head.position.z = 0.262;
    head.castShadow = true;
    tilt.add(head);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), lambert(COL.idaDark));
    bun.position.set(0.016, -0.032, 0.292);
    tilt.add(bun);
    const legGeo = new THREE.CylinderGeometry(0.013, 0.012, 0.075, 8);
    const legL = new THREE.Group();
    const lm = new THREE.Mesh(legGeo, lambert(COL.idaDark));
    lm.position.z = -0.037; lm.castShadow = true;
    legL.add(lm); legL.position.set(-0.024, 0, 0.038);
    tilt.add(legL);
    const legR = new THREE.Group();
    const rm = new THREE.Mesh(legGeo.clone(), lambert(COL.idaDark));
    rm.position.z = -0.037; rm.castShadow = true;
    legR.add(rm); legR.position.set(0.024, 0, 0.038);
    tilt.add(legR);
    root.userData = { tilt, legL, legR };
    return root;
  }
  const ida = buildIda();
  scene.add(ida);

  /* ================================================================
     步行图
     ================================================================ */
  const N4 = new THREE.Vector3(0.06, -0.10, H + 0.03);   // 拐角 Q=TR（顶梁/悬臂臂端交接）
  const EDGES = {
    e0: { a: N0, b: N1, type: 'walk' },
    e1: { a: N1, b: N2, type: 'stairs' },
    e2: { a: N2, b: N3, type: 'walk' },   // 悬浮悬臂
    e3: { a: N3, b: N4, type: 'walk', gate: 'dock' },   // 停靠长臂
    e4: { a: N4, b: N6, type: 'walk', gate: 'dock' },   // 顶梁右段 → TL
    e5: { a: N6, b: N7, type: 'stairs' },
  };
  const ADJ = {
    N0: ['e0'], N1: ['e0', 'e1'], N2: ['e1', 'e2'], N3: ['e2', 'e3'],
    N4: ['e3', 'e4'], N6: ['e4', 'e5'], N7: ['e5'],
  };
  const VEC = () => ({ N0, N1, N2, N3, N4, N6, N7 });
  const NODE_KEYS = ['N0', 'N1', 'N2', 'N3', 'N4', 'N6', 'N7'];

  let idaState = { edge: 'e0', t: 0 };
  let won = false, docked = false, idaOnArm = false;

  function edgeOpen(e) { return !e.gate || (e.gate === 'dock' && docked); }
  function edgePoint(e, t) { return new THREE.Vector3().lerpVectors(e.a, e.b, t); }

  function bfs(s, t) {
    const V = VEC();
    const seen = { [s]: null };
    const q = [s];
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === t) {
        const path = [];
        let c = t;
        while (seen[c]) { path.unshift(seen[c].edge); c = seen[c].from; }
        return path;
      }
      for (const eid of (ADJ[cur] || [])) {
        const e = EDGES[eid];
        if (!edgeOpen(e) || !e.a || !e.b) continue;
        const curV = V[cur];
        const other = e.a === curV ? e.b : (e.b === curV ? e.a : null);
        if (!other) continue;
        let on = null;
        for (const k of NODE_KEYS) if (V[k] === other) on = k;
        if (on === null || on in seen) continue;
        seen[on] = { from: cur, edge: eid };
        q.push(on);
      }
    }
    return null;
  }

  let moves = null, mi = 0;
  let mFrom, mTo, mEdge, mEdgeId;
  const mk = (edge, f, t) => ({ edge, f, t });

  function startRoute(list) {
    list = list.filter(m => Math.abs(m.t - m.f) > 1e-4);
    if (!list.length) return;
    moves = list; mi = 0;
    loadMove();
  }
  function loadMove() {
    const mv = moves[mi];
    mEdge = EDGES[mv.edge]; mEdgeId = mv.edge;
    mFrom = edgePoint(mEdge, mv.f);
    mTo = edgePoint(mEdge, mv.t);
  }

  function nodeOf(v) {
    const V = VEC();
    for (const k of NODE_KEYS) if (V[k] === v) return k;
    return null;
  }
  function planRoute(targetEdgeId, u) {
    const te = EDGES[targetEdgeId];
    if (!edgeOpen(te) || !te.a || !te.b) return false;
    if (targetEdgeId === idaState.edge) {
      startRoute([mk(targetEdgeId, idaState.t, u)]);
      return true;
    }
    const cur = EDGES[idaState.edge];
    const starts = [[cur.a, 0], [cur.b, 1]];
    const ends = [[te.a, 0], [te.b, 1]];
    let best = null;
    for (const [sv, stp] of starts) {
      const sn = nodeOf(sv);
      for (const [ev, etp] of ends) {
        const en = nodeOf(ev);
        const path = bfs(sn, en);
        if (!path) continue;
        const list = [];
        if (Math.abs(idaState.t - stp) > 1e-4) list.push(mk(idaState.edge, idaState.t, stp));
        let nodeV = sv;
        for (const eid of path) {
          const e = EDGES[eid];
          const forward = e.a === nodeV;
          list.push(mk(eid, forward ? 0 : 1, forward ? 1 : 0));
          nodeV = forward ? e.b : e.a;
        }
        if (Math.abs(u - etp) > 1e-4) list.push(mk(targetEdgeId, etp, u));
        if (!best || list.length < best.length) best = list;
      }
    }
    if (best) { startRoute(best); return true; }
    return false;
  }

  /* ---------------- 行走驱动 ---------------- */
  let walkPhase = 0;
  function updateIda(dt) {
    const p = ida.userData;
    if (moves) {
      const mv = moves[mi];
      const spd = mEdge.type === 'stairs' ? 0.95 : 1.5;
      const remain = mFrom.distanceTo(mTo);
      const step = Math.min(spd * dt, remain);
      mFrom.add(new THREE.Vector3().subVectors(mTo, mFrom).normalize().multiplyScalar(step));
      ida.position.copy(mFrom);
      // 实时进度（供状态查询/截图；也让途中改点以当前位置起步）
      const dhx = mEdge.b.x - mEdge.a.x, dhy = mEdge.b.y - mEdge.a.y;
      const l2 = dhx * dhx + dhy * dhy;
      if (l2 > 1e-8) {
        idaState.edge = mEdgeId;
        idaState.t = THREE.MathUtils.clamp(
          ((mFrom.x - mEdge.a.x) * dhx + (mFrom.y - mEdge.a.y) * dhy) / l2, 0, 1);
      } else if (Math.abs(mEdge.b.z - mEdge.a.z) > 1e-8) {
        // 纯竖直的隐藏爬升：用 z 分量报告实时进度
        idaState.edge = mEdgeId;
        idaState.t = THREE.MathUtils.clamp((mFrom.z - mEdge.a.z) / (mEdge.b.z - mEdge.a.z), 0, 1);
      }
      const segDir = new THREE.Vector3().subVectors(mTo, edgePoint(mEdge, mv.f));
      const segFlat = new THREE.Vector3(segDir.x, segDir.y, 0);
      if (segFlat.lengthSq() > 1e-8) {
        ida.rotation.z = -Math.atan2(segFlat.y, segFlat.x);
      }
      if (segDir.lengthSq() > 1e-8) {
        // 倾角按水平分量折算：竖直爬升时身体保持直立
        const pitch = Math.asin(THREE.MathUtils.clamp(segDir.z / segDir.length(), -1, 1));
        const horizRatio = segFlat.length() / segDir.length();
        p.tilt.rotation.y = ((mEdge.type === 'stairs') ? pitch * 0.5 : pitch * 0.35) * horizRatio;
      }
      walkPhase += dt * 9;
      p.legL.rotation.y = Math.sin(walkPhase) * 0.5;
      p.legR.rotation.y = -Math.sin(walkPhase) * 0.5;
      ida.position.z += Math.abs(Math.sin(walkPhase * 2)) * 0.008;
      if (remain - step <= 0.001) {
        idaState.edge = mEdgeId;
        idaState.t = mv.t;
        mi++;
        if (mi < moves.length) loadMove();
        else {
          moves = null;
          ida.position.copy(edgePoint(EDGES[idaState.edge], idaState.t));
          if (idaState.edge === 'e5' && idaState.t >= 0.95 && !won) winLevel();
        }
      }
    } else {
      p.legL.rotation.y *= 0.8;
      p.legR.rotation.y *= 0.8;
      p.tilt.rotation.y *= 0.8;
    }
    idaOnArm = (idaState.edge === 'e3' || idaState.edge === 'e4');
  }

  /* ---------------- 点击涟漪 ---------------- */
  const ripples = [];
  function spawnRipple(pos) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.06, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    m.position.copy(pos);
    m.position.z += 0.03;
    m.userData.life = 0;
    scene.add(m);
    ripples.push(m);
  }
  function updateRipples(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.userData.life += dt;
      const k = r.userData.life / 0.7;
      r.scale.setScalar(1 + k * 3);
      r.material.opacity = 0.85 * (1 - k);
      if (k >= 1) { scene.remove(r); ripples.splice(i, 1); }
    }
  }

  /* ---------------- 通关：夜幕拉开（DOM/SVG 覆盖层） ----------------
     两块暗紫幕布自天顶分开，中间倒泪形缝隙露出墨绿极光夜空，
     3D 场景始终可见、仅整体压暗。 */
  const finaleEl = document.getElementById('finale');
  const finReveal = document.getElementById('finReveal');
  const finOpenP = document.getElementById('finOpenP');
  const finPanelL = document.getElementById('finPanelL');
  const finPanelR = document.getElementById('finPanelR');
  const finCurtainG = document.getElementById('finCurtainG');
  const finRimPurple = document.getElementById('finRimPurple');
  const finRimGreen = document.getElementById('finRimGreen');
  const finTipEl = document.getElementById('finTipEl');
  let winState = false, winT = 0;
  function winLevel() {
    won = true; winState = true; winT = 0;
    finaleEl.classList.add('on');
  }
  function setFinGeo(e) {
    // 缝隙几何：顶端在屏幕外，尖端下行；闭合时是一道细楔
    const T = 108 + 227 * e;                 // 尖端 y（最大 ~335，止于祭坛台阶上方）
    const Lx = 252 - 392 * e, Rx = 324 + 392 * e;
    const CLx = Lx + (288 - Lx) * 0.35 - 40 * e, CLy = T * 0.5;
    const CRx = Rx - (Rx - 288) * 0.35 + 40 * e, CRy = T * 0.5;
    const TOPY = -24;
    const open =
      'M ' + Lx + ' ' + TOPY + ' L ' + Rx + ' ' + TOPY +
      ' Q ' + CRx + ' ' + CRy + ' 288 ' + T +
      ' Q ' + CLx + ' ' + CLy + ' ' + Lx + ' ' + TOPY + ' Z';
    const edge =
      'M ' + Lx + ' ' + TOPY +
      ' Q ' + CLx + ' ' + CLy + ' 288 ' + T +
      ' Q ' + CRx + ' ' + CRy + ' ' + Rx + ' ' + TOPY;
    finReveal.setAttribute('d', open);
    finOpenP.setAttribute('d', open);
    finRimPurple.setAttribute('d', edge);
    finRimGreen.setAttribute('d', edge);
    finTipEl.setAttribute('cy', T - 42);
    // 幕布：沿泪形边缘采样成折线，在屏幕侧边裁断；
    // 缝隙未张开到侧边时，尖端以下拖一段淡出的“尾巴”
    finCurtainG.setAttribute('y1', (T - 150).toFixed(1));
    finCurtainG.setAttribute('y2', (T + 128).toFixed(1));
    var qp = function (p0, c, p1, t) {
      var u = 1 - t;
      return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
              u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
    };
    var panelPath = function (side) {
      var A = side < 0 ? [Lx, TOPY] : [Rx, TOPY];
      var C = side < 0 ? [CLx, CLy] : [CRx, CRy];
      var sx = side < 0 ? -60 : 636;
      var d = 'M ' + sx + ' ' + TOPY + ' L ' + A[0] + ' ' + A[1] + ' L ';
      var prev = A, end = null;
      for (var i = 1; i <= 36; i++) {
        var cur = qp(A, C, [288, T], i / 36);
        var out = side < 0 ? cur[0] <= 0 : cur[0] >= 576;
        if (out) {
          var k = side < 0 ? prev[0] / (prev[0] - cur[0])
                           : (576 - prev[0]) / (cur[0] - prev[0]);
          end = [prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k];
          d += end[0].toFixed(1) + ' ' + end[1].toFixed(1);
          break;
        }
        d += cur[0].toFixed(1) + ' ' + cur[1].toFixed(1) + ' ';
        prev = cur;
        if (i === 36) {
          // 尖端之后弯向屏幕外侧并消散
          var C2 = [side < 0 ? 138 : 438, T + 58];
          for (var j = 1; j <= 24; j++) {
            var t2 = qp([288, T], C2, [sx, T + 128], j / 24);
            var out2 = side < 0 ? t2[0] <= 0 : t2[0] >= 576;
            if (out2) {
              var k2 = side < 0 ? prev[0] / (prev[0] - t2[0])
                                : (576 - prev[0]) / (t2[0] - prev[0]);
              end = [prev[0] + (t2[0] - prev[0]) * k2, prev[1] + (t2[1] - prev[1]) * k2];
              d += end[0].toFixed(1) + ' ' + end[1].toFixed(1);
              break;
            }
            d += t2[0].toFixed(1) + ' ' + t2[1].toFixed(1) + ' ';
            prev = t2;
          }
        }
      }
      d += ' L ' + sx + ' ' + end[1].toFixed(1) + ' Z';
      return d;
    };
    finPanelL.setAttribute('d', panelPath(-1));
    finPanelR.setAttribute('d', panelPath(1));
  }
  setFinGeo(0);
  function updateWin(dt) {
    if (!winState) return;
    winT += dt;
    const g = Math.min(winT / 3.2, 1);
    setFinGeo(1 - Math.pow(1 - g, 2.2));
  }

  /* ================================================================
     曲柄拖拽
     ================================================================ */
  let dragging = false, lastAngle = 0, snapTween = null, handleScale = 1;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hubHits = [hub, hubRing, wheel];

  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function hubScreen() {
    const v = hub.getWorldPosition(new THREE.Vector3()).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top };
  }
  function onDown(e) {
    if (won) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hubHits, true);
    if (hits.length && !idaOnArm) {
      dragging = true;
      const hs = hubScreen();
      lastAngle = Math.atan2(e.clientY - hs.y, e.clientX - hs.x);
      snapTween = null;
      canvas.style.cursor = 'grabbing';
      document.getElementById('hint').classList.add('hidden');
      e.preventDefault();
    }
  }
  function onMove(e) {
    if (!dragging) {
      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      canvas.style.cursor = raycaster.intersectObjects(hubHits, true).length ? 'grab' : 'default';
      return;
    }
    const hs = hubScreen();
    const a = Math.atan2(e.clientY - hs.y, e.clientX - hs.x);
    let d = a - lastAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    lastAngle = a;
    setRotorAngle(rotorTheta + d * 0.9);
    spokes.rotateOnAxis(VIEW_N, d * 0.9);
    hubMat.color.setHex(COL.crankHi);
    e.preventDefault();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    hubMat.color.setHex(COL.crank);
    canvas.style.cursor = 'default';
    const a = rotorTheta;
    const dDock = Math.atan2(Math.sin(a - THETA_DOCK), Math.cos(a - THETA_DOCK));
    const dInit = Math.atan2(Math.sin(a), Math.cos(a));
    const target = Math.abs(dDock) < Math.abs(dInit) ? THETA_DOCK : 0;
    snapTween = { from: a, to: target, t: 0, dur: 0.38, prev: a };
  }
  function updateMech(dt) {
    if (snapTween) {
      snapTween.t += dt / snapTween.dur;
      const k = Math.min(snapTween.t, 1);
      const ang = snapTween.from + (snapTween.to - snapTween.from) * (1 - Math.pow(1 - k, 3));
      spokes.rotateOnAxis(VIEW_N, ang - snapTween.prev);
      snapTween.prev = ang;
      setRotorAngle(ang);
      if (k >= 1) snapTween = null;
    }
    const nowDocked = Math.abs(rotorTheta - THETA_DOCK) < 0.06;
    if (nowDocked !== docked) docked = nowDocked;
    const target = idaOnArm ? 0 : 1;
    handleScale += (target - handleScale) * Math.min(1, dt * 10);
    spokes.scale.set(handleScale, handleScale, handleScale);
  }

  /* ================================================================
     路面拾取
     ================================================================ */
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  pickMat.colorWrite = false;
  const pickables = [];
  function addPick(eid) {
    const e = EDGES[eid];
    if (!e.a || !e.b) return;
    const dir = new THREE.Vector3().subVectors(e.b, e.a);
    const len = dir.length();
    const uH = new THREE.Vector3(dir.x, dir.y, 0).normalize();
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.5), pickMat);
    m.position.copy(new THREE.Vector3().addVectors(e.a, e.b).multiplyScalar(0.5));
    // 两端各外扩 0.2（祭坛台等端点目标也可点中），u 仍钳制到 [0,1]
    m.position.addScaledVector(uH, 0.2);
    m.position.z += 0.1;
    m.rotation.z = Math.atan2(uH.y, uH.x);
    m.scale.set(len + 0.4, 1, 1);
    m.userData.edge = eid;
    scene.add(m);
    pickables.push(m);
  }

  function onTap(e) {
    if (won) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    if (!hits.length) return;
    const m = hits[0].object;
    const eid = m.userData.edge;
    const ed = EDGES[eid];
    if (!edgeOpen(ed)) return;
    // 直接把命中点投影到边的参数 u（拾取盒有外扩，不能用 local.x）
    const dh = new THREE.Vector3(ed.b.x - ed.a.x, ed.b.y - ed.a.y, 0);
    const u = THREE.MathUtils.clamp(
      new THREE.Vector3(hits[0].point.x - ed.a.x, hits[0].point.y - ed.a.y, 0).dot(dh) / dh.lengthSq(), 0, 1);
    spawnRipple(edgePoint(ed, u));
    document.getElementById('hint').classList.add('hidden');
    planRoute(eid, u);
  }
  let downXY = null;
  canvas.addEventListener('pointerdown', e => { downXY = [e.clientX, e.clientY]; onDown(e); });
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', e => {
    const wasDragging = dragging;
    onUp();
    if (!wasDragging && downXY) {
      const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
      if (dx * dx + dy * dy < 36) onTap(e);
    }
    downXY = null;
  });
  document.getElementById('btnReset').addEventListener('click', () => location.reload());

  /* ================================================================
     初始化 + 主循环
     ================================================================ */
  ida.position.copy(N0);
  ida.rotation.z = -Math.atan2(N1.y - N0.y, N1.x - N0.x);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    updateSnow(dt, t);
    updateMech(dt);
    updateIda(dt);
    updateRipples(dt);
    updateWin(dt);
    if (t > 12) document.getElementById('hint').classList.add('hidden');
    renderer.render(scene, camera);
  })();

  /* ---------------- 调试 / 自动截图接口 ---------------- */
  window.MV = {
    scene, camera, mech, rotor, ida, renderer, hubWorld: HUB.clone(),
    N: { N0, N1, N2, N3, N4, N6, N7 },
    THETA_DOCK, THETA_F3: ROTOR_FIT.t3, ROT_AXIS: ROT_AXIS.clone(), QW: Q_W.clone(),
    setTheta(rad) { setRotorAngle(rad); },
    dock() { setRotorAngle(THETA_DOCK); docked = true; },
    init() { setRotorAngle(0); docked = false; },
    plan: planRoute,
    testHub(x, y) {
      pointer.set((x / 576) * 2 - 1, -(y / 1280) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hs = raycaster.intersectObjects(hubHits, true);
      return hs.map(h => h.object.geometry.type + '@' + h.object.parent.type);
    },
    win: winLevel,
    state: () => ({ docked, idaState, moving: !!moves, won }),
  };
  ['e0', 'e1', 'e2', 'e3', 'e4', 'e5'].forEach(addPick);
})();
