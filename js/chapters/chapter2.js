/* ============================================================
   第二章「遗迹」（纪念碑谷2 开篇复刻，demo2.mp4）：
   白昼场景。方形井坑（内缩于塔楼中）+ 之字悬浮石径 + 四面等高
   墙体的塔楼，中央柱顶橙色转子（点击 → 行走桥绕竖直轴 90°），
   Ro（橙裙，1.64× 缩放）与红衣小孩沿链一前一后行走，镜头随爬升上移。

   相机模型（本章节专属，逐像素实测标定）：
     仰角 e≈51°（井坑投影高宽比 0.794 → sin e），方位角 45°，
     K≈28.6px/单位（艾达 30px=1.72 单位），半视高 halfH=22.4。
     dir=(0.445,0.777,0.445) right=(0.707,0,-0.707)
     竖直有效系数 cos e≈0.63（垂直高度渲染 = h·K·0.63）。
   实测尺寸：墙高 12.6、坑边 5.9、桥面高 7.1、门高 3.15、
     转子中心 11.9、小孩 1.2、跟随距离 ≈2。

   已核对视频段落：t=0-45（之字径→墙外沿→基座梯→拱门隧道→
   行走桥（0°）→FR 门洞→墙内换位→FR 外墙角梯→墙顶环廊→
   FL 端平台→转子两连转）。升塔段/沉塔结局（t=46-111）待续。
   ============================================================ */
import * as THREE from 'three';
import { box } from '../core/materials.js';

// 菱形纹贴图（纪念碑谷式表面纹样）：底色 + 亮色菱形（中心与四角，平铺连续）
function tileTexture(baseHex, motifHex) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = baseHex; g.fillRect(0, 0, 64, 64);
  g.fillStyle = motifHex;
  const dm = (cx, cy, r) => { g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill(); };
  dm(32, 32, 15); dm(0, 0, 11); dm(64, 0, 11); dm(0, 64, 11); dm(64, 64, 11);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// 顶面带菱形纹的盒体（其余面纯色）；tiles = 顶面两方向的纹理重复数
function patternedBox(world, baseHex, motifHex, x0, x1, y0, y1, z0, z1, tilesX, tilesZ) {
  const side = new THREE.MeshLambertMaterial({ color: baseHex });
  const topTex = tileTexture(baseHex, motifHex);
  topTex.repeat.set(tilesX, tilesZ);
  const top = new THREE.MeshLambertMaterial({ map: topTex });
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
    [side, side.clone(), top, side.clone(), side.clone(), side.clone()]);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  world.add(m); return m;}

/* ---------------- 调色板（视频取样） ---------------- */
const C = {
  wallLit: 0x7ea2ff, wallShade: 0x507ae2,
  wallTop: 0xa5c0f5, crenel: 0x8fadf0,
  walkTop: 0x33409a, walkTopHi: 0x8fa4e8, walkSide: 0x4a58b0,
  column: 0x8ca0e8, columnLit: 0x6f8fe0, columnCap: 0xadbdf2,
  pitWall: 0x2a2c3c, pitFloor: 0x191920,
  rim: 0x8aa6f2, rimLit: 0xb6d2ff, path: 0x81a7fc,
  orange: 0xfdc64b, orangeDeep: 0xf5a623, childRed: 0xd73c32,
};

/* ---------------- 布局常量（单位=本章世界单位） ---------------- */
const PIT = 5.9;            // 井坑边长（开口 x,z ∈ [0,5.9]，墙内侧面 5.75）
const WALK_Y = 8.2;         // 旋转桥顶面高度（拱门/门洞地面）
const TOP_Y = 14.2;         // 墙顶环廊面高度
const ROT_Y = 11.3;         // 转子中心高度
const COL = { x: 3.33, z: 3.33 };  // 中央柱中心
const ARM_HALF = 3.43;      // 旋转桥半长（端点入墙内门洞）
const DOOR_H = 3.12;        // 门洞高
const WI = 5.75, WO = 6.3;  // 墙内/外面
const S0 = -0.3, S1 = 6.3;  // 墙跨度
const OUT = 6.95;           // 墙外沿步行带外缘
const IDA_SCALE = 1.62;     // 本章艾达缩放（视频 30px 实测）

// 旋转桥端点（随角度）：0° = FL拱门 ↔ FR门洞；90° = 前角 ↔ 后角
function walkEnds(turns) {
  const a = turns * Math.PI / 2;
  const dx = (Math.cos(a) - Math.sin(a)) * ARM_HALF * Math.SQRT1_2;
  const dz = (-Math.cos(a) - Math.sin(a)) * ARM_HALF * Math.SQRT1_2;
  return [{ x: COL.x + dx, z: COL.z + dz }, { x: COL.x - dx, z: COL.z - dz }];
}

export const META = {
  id: 'chapter2', title: '第 二 章', subtitle: '遗 迹',
  hint: '点击中央转子旋转机关 · 点击地面让罗尔行走',
};
export const cameraTarget = new THREE.Vector3(2.95, 7.1, 2.95);   // 取景中心 = 桥面高度（视频构图）
export const cameraHalfH = 22.4;
export const cameraDir = new THREE.Vector3(0.434, 0.788, 0.434).normalize();
export const skyMode = 'day';

/* ---------------- 静态几何 ---------------- */
export function buildWorld(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.92));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(4, 12, 2); scene.add(sun);

  const world = new THREE.Group(); scene.add(world);
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const lit = [mat(C.wallLit), mat(C.wallLit), mat(C.wallShade), mat(C.wallShade), mat(C.wallTop), mat(C.wallLit)];  // 内侧面同样受光
const litFR = [mat(C.wallLit), mat(C.wallLit), mat(C.wallShade), mat(C.wallLit), mat(C.wallTop), mat(C.wallShade)];

  // 基座整板（顶面 y=0）：坑口内缩，四周石环；墙外沿留步行带
  patternedBox(world, '#8aa6f2', '#c8dcff', -0.35, OUT + 0.35, -0.5, 0, -0.5, OUT + 0.5, 10, 10);
  // 井坑竖井内壁（背/左两面可见）+ 底
  world.add(box(mat(C.wallShade), 0, PIT, -1.6, -0.48, -0.08, 0.08));
  world.add(box(mat(C.pitWall), 0, PIT, -2.7, -1.6, -0.08, 0.08));
  world.add(box(mat(C.wallShade), -0.08, 0.08, -1.6, -0.48, 0, PIT));
  world.add(box(mat(C.pitWall), -0.08, 0.08, -2.7, -1.6, 0, PIT));
  world.add(box(mat(C.pitFloor), 0, PIT, -2.85, -2.7, 0, PIT));

  // 之字悬浮石径（从墙外沿前角向画面外右前延伸，远端出画）
  const stones = [
    [6.5, 6.5], [7.2, 6.9], [6.9, 7.8], [7.7, 8.2], [7.4, 9.1],
    [8.2, 9.5], [7.9, 10.4], [8.7, 10.8], [8.4, 11.7], [9.2, 12.1],
    [8.9, 13.0], [9.7, 13.4], [9.4, 14.3], [10.0, 14.7], [9.7, 15.6],
    [10.3, 16.0], [10.0, 16.9], [10.6, 17.3], [10.3, 18.2], [10.9, 18.6],
  ];
  for (const [x, z] of stones) {
    const st = box(mat(C.path), x - 0.6, x + 0.6, -0.16, 0.04, z - 0.38, z + 0.38);
    st.rotation.y = (x + z) % 2 > 1 ? 0.15 : -0.12;
    world.add(st);
  }

  // 四面墙（等高 TOP_Y）：FL(z≈6 侧，含高拱门隧道)、FR(x≈6 侧，含橙色门洞)、BL、BR
  const zA = WI, zB = WO, ax0 = 0.2, ax1 = 1.6;              // FL 拱门隧道 x∈[0.2,1.6]
  const xA = WI, xB = WO, dz0 = 0.2, dz1 = 1.6;              // FR 门洞隧道 z∈[0.2,1.6]
  world.add(box(lit, S0, 4.2, 0, TOP_Y - 0.25, zA, zB));
  world.add(box(lit, ax1, 4.2, 0, TOP_Y - 0.25, zA, zB));
  world.add(box(lit, ax0, ax1, 7.5, TOP_Y - 0.25, zA, zB));
  world.add(box(litFR, xA, xB, 0, TOP_Y - 0.25, S0, 4.2));
  world.add(box(litFR, xA, xB, 0, TOP_Y - 0.25, 4.2, S1));
  world.add(box(litFR, xA, xB, WALK_Y + DOOR_H, TOP_Y - 0.25, dz0, dz1));
  // FR 橙色门框（内侧面）
  const of = mat(C.orange);
  world.add(box(of, xA - 0.05, xA, WALK_Y, WALK_Y + DOOR_H + 0.12, dz0 - 0.09, dz0));
  world.add(box(of, xA - 0.05, xA, WALK_Y, WALK_Y + DOOR_H + 0.12, dz1, dz1 + 0.09));
  world.add(box(of, xA - 0.05, xA, WALK_Y + DOOR_H - 0.09, WALK_Y + DOOR_H + 0.21, dz0 - 0.09, dz1 + 0.09));
  // BL / BR 墙
  world.add(box(lit, S0, S1, 0, TOP_Y - 0.25, -0.3, 0.25));
  world.add(box(lit, -0.3, 0.25, 0, TOP_Y - 0.25, S0, S1));

  // 墙顶环廊压顶（出檐）+ 外沿垛口
  const capMat = mat(C.wallTop), crMat = mat(C.crenel);
  const caps = [
    [S0 - 0.07, 4.27, zA - 0.07, zB + 0.07],
    [xA - 0.07, xB + 0.07, S0 - 0.07, 4.27],
    [S0 - 0.07, S1 + 0.07, -0.37, 0.32],
    [-0.37, 0.32, S0 - 0.07, S1 + 0.07],
  ];
  for (const [x0, x1, z0, z1] of caps)
    patternedBox(world, '#a5c0f5', '#dbe8ff', x0, x1, TOP_Y - 0.25, TOP_Y, z0, z1, (x1 - x0) / 0.8, (z1 - z0) / 0.8);
  for (let t = 0; t <= 4.2; t += 0.62) {
    world.add(box(crMat, t - 0.11, t + 0.11, TOP_Y, TOP_Y + 0.18, zB, zB + 0.18));
    world.add(box(crMat, xB, xB + 0.18, TOP_Y, TOP_Y + 0.18, t - 0.11, t + 0.11));
  }
  // 檐口带（墙顶下方深色收边）
  for (const [x0, x1, z0, z1, c] of [
    [S0, 4.27, zA, zB, C.wallShade], [xA, xB, S0, 4.27, C.wallShade],
    [S0, S1, -0.3, 0.32, C.wallShade], [-0.3, 0.32, S0, S1, C.wallShade],
  ]) world.add(box(mat(c), x0, x1, TOP_Y - 0.55, TOP_Y - 0.25, z0, z1));

  // FL 端平台（墙顶左端向外突出）
  patternedBox(world, '#a5c0f5', '#dbe8ff', -1.4, 0.32, TOP_Y - 0.25, TOP_Y, zA - 0.07, OUT + 0.2, 2, 2);
  world.add(box(crMat, -1.4, -1.26, TOP_Y, TOP_Y + 0.18, zA - 0.07, OUT + 0.2));
  world.add(box(crMat, -1.4, 0.32, TOP_Y, TOP_Y + 0.18, OUT + 0.04, OUT + 0.2));

  // FL 基座梯（拱门隧道内，14 级，井沿 0 → 桥面 8.2；上段在拱门开口可见）
  for (let i = 0; i < 8; i++) {
    const y = i * (WALK_Y / 13);
    world.add(box(mat(C.rimLit), ax0 + 0.05, ax1 - 0.05, y, y + WALK_Y / 13,
      zB - 0.4 + i * 0.05, zB - 0.4 + i * 0.05 + 0.75));
  }
  // FR 外墙角楼梯（贴前角上行，14 级）
  for (let i = 0; i < 14; i++) {
    const y = WALK_Y + i * (TOP_Y - 0.25 - WALK_Y) / 7;
    world.add(box(mat(C.columnCap), xB, xB + 0.36, y - 0.07, y + (TOP_Y - 0.25 - WALK_Y) / 13,
      zB - i * 0.06 - 0.46, zB - i * 0.06 + 0.46));
  }

  // 中央柱：井底升出，柱础 + 柱身 + 拱形托架 + 顶帽
  world.add(box(mat(C.columnLit), COL.x - 0.7, COL.x + 0.7, -2.85, WALK_Y - 0.18, COL.z - 0.7, COL.z + 0.7));
  world.add(box(mat(C.columnCap), COL.x - 0.92, COL.x + 0.92, WALK_Y - 0.18, WALK_Y + 0.28, COL.z - 0.92, COL.z + 0.92));
  world.add(box(mat(C.column), COL.x - 0.42, COL.x + 0.42, WALK_Y + 0.28, ROT_Y - 0.75, COL.z - 0.42, COL.z + 0.42));
  for (const dx of [-0.45, 0.45]) {
    world.add(box(mat(C.columnLit), COL.x + dx - 0.21, COL.x + dx + 0.21, 0.3, 1.8, COL.z - 0.45, COL.z - 0.4));
  }

  // 橙色碎屑（石环装饰，确定性伪随机）
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) {
    const side = i % 4;
    const t = 0.3 + rnd() * (PIT - 0.2);
    const s = 0.09 + rnd() * 0.16;
    let x, z;
    if (side === 0) { x = t; z = WI + 0.12 + rnd() * 0.5; }
    else if (side === 1) { x = t; z = -0.35 + rnd() * 0.5; }
    else if (side === 2) { x = -0.35 + rnd() * 0.5; z = t; }
    else { x = WI + 0.12 + rnd() * 0.5; z = t; }
    world.add(box(mat(rnd() > 0.5 ? C.orange : C.orangeDeep), x - s, x + s, -0.02, 0.04 + s * 0.4, z - s, z + s));
  }

  return world;
}

/* ---------------- 旋转机关（双层行走桥 + 顶部转子，绕竖直轴） ---------------- */
export function buildMechanic(scene) {
  const group = new THREE.Group();
  group.position.set(COL.x, 0, COL.z);
  scene.add(group);
  const mat = c => new THREE.MeshLambertMaterial({ color: c });

  const walk = new THREE.Group(); group.add(walk);
  const deck = (y, topC, sideC) => {
    walk.add(box([mat(sideC), mat(sideC), mat(sideC), mat(sideC), mat(topC), mat(sideC)],
      -ARM_HALF, ARM_HALF, y - 0.5, y, -0.42, 0.42));
  };
  deck(WALK_Y, C.walkTop, C.walkSide);          // 下桥（行走面）
  deck(WALK_Y + 1.85, C.walkTop, C.walkSide);   // 上桥（同轴同步旋转）
  for (let i = -4; i <= 4; i++) {
    for (const y of [WALK_Y, WALK_Y + 1.85]) {
      walk.add(box(mat(C.walkTopHi), i * 0.78 - 0.19, i * 0.78 + 0.19, y, y + 0.016, -0.2, 0.2));
    }
  }
  for (const ex of [-ARM_HALF + 0.16, ARM_HALF - 0.16]) {
    for (const y of [WALK_Y, WALK_Y + 1.85]) {
      walk.add(box(mat(C.columnCap), ex - 0.1, ex + 0.1, y - 0.38, y, -0.34, 0.34));
    }
  }

  // 顶部转子：橙色十字 + 端块（点击目标，指示朝向）
  const rotor = new THREE.Group(); rotor.position.y = ROT_Y; group.add(rotor);
  rotor.add(box(mat(C.orange), -0.24, 0.24, -0.24, 0.24, -0.2, 0.2));
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    rotor.add(box(mat(C.orangeDeep),
      d[0] * 0.5 - 0.14 * Math.abs(d[1]) - 0.14 * Math.abs(d[0]), d[0] * 0.5 + 0.14 * Math.abs(d[1]) + 0.14 * Math.abs(d[0]),
      -0.13, 0.13,
      d[1] * 0.5 - 0.14 * Math.abs(d[0]) - 0.14 * Math.abs(d[1]), d[1] * 0.5 + 0.14 * Math.abs(d[0]) + 0.14 * Math.abs(d[1])));
    rotor.add(box(mat(C.orange), d[0] * 0.9 - 0.15, d[0] * 0.9 + 0.15, -0.15, 0.15, d[1] * 0.9 - 0.15, d[1] * 0.9 + 0.15));
  }

  return {
    group, walk, rotor,
    hubWorld: new THREE.Vector3(COL.x, ROT_Y, COL.z),
    setAngle(turns) { group.rotation.y = Math.PI / 4 - turns * Math.PI / 2; },
  };
}

/* ---------------- 红衣小孩（跟随者，1.2 单位高） ---------------- */
export function buildChild() {
  const group = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.145, 0.5, 10),
    new THREE.MeshLambertMaterial({ color: C.childRed }));
  robe.position.y = 0.25; group.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0x2a2c3c }));
  head.position.y = 0.6; group.add(head);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.3, 10),
    new THREE.MeshLambertMaterial({ color: C.childRed }));
  hood.position.y = 0.72; group.add(hood);
  return { group };
}

/* ---------------- 行走链 ---------------- */
// 桥面段（点18→19）端点随机关角度变化，艾达在桥上时随转动被载运。
// 门洞段（桥尾→门洞→外梯脚）需桥处于 0°（对接门洞）。
function chainPoints() {
  const P = (x, y, z, extra) => Object.assign({ p: new THREE.Vector3(x, y, z) }, extra);
  const e0 = walkEnds(0);
  return [
    P(10.9, 0, 18.6), P(10.3, 0, 18.2), P(10.6, 0, 17.3), P(10.0, 0, 16.9),
    P(9.7, 0, 15.6), P(10.0, 0, 14.7), P(9.4, 0, 14.3), P(9.7, 0, 13.4),
    P(8.9, 0, 13.0), P(9.2, 0, 12.1), P(8.4, 0, 11.7), P(8.7, 0, 10.8),
    P(7.9, 0, 10.4), P(7.4, 0, 9.1), P(7.7, 0, 8.2), P(6.9, 0, 7.8),
    P(7.2, 0, 6.9), P(6.5, 0, 6.5),                                   // 之字径 0-17
    P(6.4, 0, 6.4),                                                   // 18 井沿前角（外沿）
    P(1.35, 0, 6.85),                                                 // 19 墙外沿左行
    P(1.05, 0, 6.95), { stairs: true },                               // 20 梯脚（基座梯）
    P(0.95, WALK_Y, 6.45),                                           // 21 梯顶（隧道口）
    P(0.95, WALK_Y, 5.9),                                            // 22 隧道内口
    P(e0[0].x, WALK_Y, e0[0].z),                                      // 23 桥头（拱门端）
    P(e0[1].x, WALK_Y, e0[1].z),                                      // 24 桥尾（FR 门洞端）
    P(5.9, WALK_Y, 0.9), { door: true, seam: true },                  // 25 门洞内口（墙内换位）
    P(6.72, WALK_Y, 6.1), { door: true, stairs: true },               // 26 外梯脚（贴前角上行）
    P(6.72, TOP_Y - 0.25, 5.95),                                      // 27 外梯顶
    P(6.15, TOP_Y, 5.9),                                              // 28 登墙顶
    P(6.15, TOP_Y, 0.4),                                              // 29 FR 顶 → 后角
    P(0.4, TOP_Y, 0.4),                                               // 30 BR 顶
    P(0.4, TOP_Y, 5.9),                                               // 31 BL 顶
    P(0.75, TOP_Y, 6.25),                                             // 32 FL 顶
    P(-0.95, TOP_Y, 6.95),                                            // 33 端平台（终点）
  ].reduce((acc, el) => {
    if (!el.p) { Object.assign(acc[acc.length - 1], el); } else acc.push(el);
    return acc;
  }, []);
}

/* ---------------- 玩法模块 ---------------- */
export function createPlay({ engine, chapter, ida, fx, ui, mech, child }) {
  const { camera, camState, view, glCanvas } = engine;
  const points = chainPoints();
  const segLen = [], cum = [0];
  for (let i = 0; i < points.length - 1; i++) {
    segLen.push(points[i].seam ? 0 : points[i].p.distanceTo(points[i + 1].p));
    cum.push(cum[i] + segLen[i]);
  }
  const TOTAL = cum[cum.length - 1];
  const WALK_SEG = 23;        // 桥面段（点23→24：整条桥，端点随角度变化）
  const AT_ARCH = cum[22] + 0.05, AT_DOOR = cum[25] + 0.05;

  const state = {
    s: 0, sTarget: 0, moving: false,
    angle: 0, anim: null,
    finished: false, endT: 0,
    walkPhase: 0, facing: new THREE.Vector3(-1, 0, 0),
    demo: null,
  };
  ida.group.scale.setScalar(IDA_SCALE);   // 本章艾达放大（视频实测 30px）

  function ends() {
    const frac = state.anim ? state.anim.k : state.angle;
    return walkEnds(frac);
  }
  function walkPoint(frac) {
    const [a, b] = ends();
    return new THREE.Vector3(a.x + (b.x - a.x) * frac, WALK_Y, a.z + (b.z - a.z) * frac);
  }

  function posAt(s) {
    s = THREE.MathUtils.clamp(s, 0, TOTAL);
    let i = 0; while (i < segLen.length - 1 && s > cum[i + 1]) i++;
    while (segLen[i] === 0 && i < segLen.length - 1) i++;
    const t = segLen[i] > 0 ? (s - cum[i]) / segLen[i] : 0;
    if (i === WALK_SEG) return { p: walkPoint(t), seg: i, t, meta: {} };
    const a = points[i].p, b = points[i + 1].p;
    return { p: a.clone().lerp(b, t), seg: i, t, meta: points[i] };
  }

  const HUB = new THREE.Vector3(COL.x, ROT_Y, COL.z);
  function toScreen(v) {
    const p = v.clone().project(camera);
    return { x: (p.x + 1) / 2 * view.w, y: (1 - p.y) / 2 * view.h };
  }

  const lastPointer = { x: -1e4, y: -1e4 };
  function onDown(p, e) {
    if (state.finished) return;
    lastPointer.x = p.x; lastPointer.y = p.y;
    const hs = toScreen(HUB);
    if (Math.hypot(p.x - hs.x, p.y - hs.y) < 0.075 * view.h) {
      rotate();
      glCanvas.setPointerCapture(e.pointerId);
      ui.hide();
      return;
    }
    const hit = pickChain(p.x, p.y);
    if (hit) { state.sTarget = hit.s; fx.ripple(p.x, p.y); ui.hide(); }
  }
  function onMove(p) { lastPointer.x = p.x; lastPointer.y = p.y; }

  const rect = () => glCanvas.getBoundingClientRect();
  glCanvas.addEventListener('pointerdown', e => onDown({ x: e.clientX - rect().left, y: e.clientY - rect().top }, e));
  glCanvas.addEventListener('pointermove', e => onMove({ x: e.clientX - rect().left, y: e.clientY - rect().top }));
  glCanvas.addEventListener('pointerup', () => {});

  function pickChain(px, py) {
    // 可达范围：桥/门洞边界在桥未对接(非0°)时封闭
    const onWalk = state.s >= cum[WALK_SEG] - 1e-6 && state.s <= cum[WALK_SEG + 1] + 1e-6;
    const open = state.angle === 0;
    let lo = 0, hi = TOTAL;
    if (!open) {
      if (onWalk) { lo = cum[WALK_SEG]; hi = cum[WALK_SEG + 1]; }
      else if (state.s > cum[WALK_SEG + 1]) lo = cum[WALK_SEG + 1];
      else hi = cum[WALK_SEG];
    }
    let best = null;
    for (let i = 0; i < segLen.length; i++) {
      if (segLen[i] === 0) continue;
      if (cum[i + 1] < lo - 1e-6 || cum[i] > hi + 1e-6) continue;
      const a = i === WALK_SEG ? walkPoint(0) : points[i].p;
      const b = i === WALK_SEG ? walkPoint(1) : points[i + 1].p;
      const sa = toScreen(a), sb = toScreen(b);
      const abx = sb.x - sa.x, aby = sb.y - sa.y, L2 = abx * abx + aby * aby;
      let t = L2 > 0 ? ((px - sa.x) * abx + (py - sa.y) * aby) / L2 : 0;
      t = THREE.MathUtils.clamp(t, 0, 1);
      const d = Math.hypot(px - (sa.x + abx * t), py - (sa.y + aby * t));
      if (!best || d < best.d) best = { d, s: cum[i] + segLen[i] * t, i };
    }
    if (!best || best.d > 0.05 * view.h) return null;
    return best;
  }

  function rotate() {
    if (state.anim) return;
    const from = state.angle, to = 1 - from;
    state.anim = { from, to, t: 0, k: from };
    state.angle = to;
  }

  function update(dt, dtRaw, simT) {
    fx.update(dt);
    if (state.demo) stepDemo(dt);
    if (state.anim) {
      state.anim.t += dt / 0.9;
      const k = Math.min(state.anim.t, 1);
      const e = 1 - Math.pow(1 - k, 3);
      state.anim.k = state.anim.from + (state.anim.to - state.anim.from) * e;
      if (k >= 1) { state.angle = state.anim.to; state.anim = null; }
    }
    mech.setAngle(state.anim ? state.anim.k : state.angle);

    let moving = false;
    if (Math.abs(state.sTarget - state.s) > 1e-4) {
      const info = posAt(state.s);
      const speed = info.meta.stairs ? 3.2 : 4.6;
      const dir = Math.sign(state.sTarget - state.s);
      let ns = state.s + dir * speed * dt;
      if ((dir > 0 && ns > state.sTarget) || (dir < 0 && ns < state.sTarget)) ns = state.sTarget;
      state.s = ns; moving = true;
      state.walkPhase += dt * 10;
      const cur = posAt(state.s);
      const nxt = posAt(THREE.MathUtils.clamp(state.s + dir * 0.3, 0, TOTAL));
      const d = nxt.p.clone().sub(cur.p); d.y = 0;
      if (d.lengthSq() > 1e-8) state.facing.copy(d.normalize());
      if (state.s >= TOTAL - 1e-4 && !state.finished) finish();
    } else {
      state.walkPhase = THREE.MathUtils.lerp(state.walkPhase, Math.round(state.walkPhase / Math.PI) * Math.PI, 0.2);
    }
    const cur = posAt(state.s);
    ida.group.position.copy(cur.p);
    ida.group.rotation.y = Math.atan2(state.facing.x, state.facing.z);
    const swing = moving ? Math.sin(state.walkPhase) * 0.55 : Math.sin(state.walkPhase) * 0.55 * 0.2;
    ida.parts.legL.rotation.x = swing; ida.parts.legR.rotation.x = -swing;
    ida.parts.body.position.y = moving ? Math.abs(Math.sin(state.walkPhase)) * 0.045 : 0;
    ida.parts.body.rotation.x = moving ? 0.05 : 0;
    // 红衣小孩跟随（落后固定弧长）
    const sChild = Math.max(0, state.s - 2.1);
    child.group.position.copy(posAt(sChild).p);
    child.group.rotation.y = ida.group.rotation.y;
    child.group.position.y += moving ? Math.abs(Math.sin(state.walkPhase - 0.6)) * 0.035 : 0;
    state.moving = moving;

    // 镜头随爬升上移
    const panTarget = Math.max(0, ida.group.position.y - 3.4) * 0.85;
    camState.panU = THREE.MathUtils.damp(camState.panU, panTarget, 2.0, dt);
    engine.placeCamera();

    if (state.finished) state.endT += dt;
  }

  function finish() {
    state.finished = true; state.endT = 0;
    ui.hide();
  }
  function reset() {
    state.s = 0; state.sTarget = 0; state.finished = false; state.endT = 0;
    state.angle = 0; state.anim = null; state.walkPhase = 0;
    state.facing.set(-1, 0, 0); state.demo = null;
    camState.panU = 0; engine.placeCamera();
    fx.clearRipples();
    ui.reset();
    if (play.onDemoChange) play.onDemoChange(false);
  }
  function startDemo() {
    if (state.demo) return;
    reset();
    ui.hide();
    state.demo = { t: 0, steps: [
      { at: 0.6, go: AT_ARCH },      // 拱门槛
      { at: 8.5, go: AT_DOOR },      // FR 门洞
      { at: 15.0, go: TOTAL },       // 端平台
      { at: 22.0, rotate: true },    // 转子两连转（视频中 t=20-23 的演示动作）
      { at: 25.5, rotate: true },
    ] };
    if (play.onDemoChange) play.onDemoChange(true);
  }
  function stepDemo(dt) {
    const d = state.demo; d.t += dt;
    for (const st of d.steps) {
      if (d.t >= st.at && !st.done) {
        st.done = true;
        if (st.rotate) rotate(); else state.sTarget = st.go;
      }
    }
    if (d.t > 32) { state.demo = null; if (play.onDemoChange) play.onDemoChange(false); }
  }

  const play = {
    state, update,
    getState: () => ({
      theta: state.angle * Math.PI / 2, connected: state.angle === 0,
      s: state.s, sTarget: state.sTarget, moving: state.moving,
      finished: state.finished, demo: !!state.demo,
    }),
    getTheta: () => state.angle * Math.PI / 2,
    setTheta: rad => { state.angle = Math.round(rad / (Math.PI / 2)) % 4; state.anim = null; },
    dock: () => { state.angle = 0; state.anim = null; },
    init: () => { state.angle = 0; state.anim = null; },
    go: s => { state.sTarget = THREE.MathUtils.clamp(s, 0, TOTAL); return true; },
    setS: v => { state.s = state.sTarget = THREE.MathUtils.clamp(v, 0, TOTAL); },
    setTarget: v => { state.sTarget = THREE.MathUtils.clamp(v, 0, TOTAL); },
    reset, startDemo, cancelDemo: () => { state.demo = null; if (play.onDemoChange) play.onDemoChange(false); },
    hubScreen: () => toScreen(HUB),
    TOTAL: () => TOTAL,
    endingT: () => state.endT,
    onDemoChange: null,
  };
  return play;
}

export default { META, cameraTarget, cameraHalfH, cameraDir, skyMode, buildWorld, buildMechanic, buildChild, createPlay };
