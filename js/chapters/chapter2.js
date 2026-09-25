/* ============================================================
   第二章「遗迹」—— 纪念碑谷2 开篇复刻（demo2.mp4）
   实现方法与 fable 第一章完全一致：单一标定锚点 + 单位几何 +
   平面着色 + 链式行走 + 自包含线性结构。

   —— 标定（fable 式：一个锚点闭联全部尺寸）——
   锚点：Ro 像素高 ≈30px（与第一章艾达一致，同一人物模型 1.05 单位）。
   井坑投影高宽比 0.794 → 仰角 e=51°（方位角 45°）。
     ppu = 30 / (1.05·cos51°) = 45.4 px/单位（水平）
     CAM_HALF_H = 640 / 45.4 = 14.1
   实测换算：坑口 238px → 3.7 单位；墙外立面带 220px → 墙高 6.9；
     门洞 92px → 3.2；桥面高（门洞底）3.2；转子中心 5.0。
   视错觉 clearance：tan51°·(坑心到前角 3.4) = 4.2 > 墙高6.9−桥面3.2=3.7
     → 桥面恰好越过前墙顶边可见（与视频一致，桥线贴着前墙顶）。

   —— 结构 ——
   井坑 + 石环 + 之字悬浮石径 + 四面等高墙（前角敞开）+ 墙顶环廊
   + FL 端平台 + 中央柱（双尖拱托架）+ 橙色转子（点击 → 行走桥
   绕竖直轴 90°，桥上角色随转载运）+ FR 橙框门洞（桥对接）+ 门洞内
   换位 → 外墙角梯登顶 → 环廊 → FL 端平台。红衣小孩沿链跟随。

   待续（已测绘，demo2.mp4 t=46-111）：后角塔段升起、总成旋转、
   登顶、全结构沉坑金色花结局。
   ============================================================ */
import * as THREE from 'three';
import { box } from '../core/materials.js';

/* ---------------- 调色板（视频取样） ---------------- */
const C = {
  wallLit: 0x7ea2ff, wallShade: 0x507ae2,
  wallTop: 0xa5c0f5, crenel: 0x8fadf0,
  deckTop: 0x33409a, deckDot: 0x8fa4e8, deckSide: 0x4a58b0, deckEdge: 0x9db8f0,
  column: 0x8ca0e8, columnLit: 0x6f8fe0, columnCap: 0xadbdf2,
  pitWall: 0x2a2c3c, pitFloor: 0x191920,
  rim: 0x8aa6f2, rimLit: 0xb6d2ff, path: 0x81a7fc,
  orange: 0xfdc64b, orangeDeep: 0xf5a623, childRed: 0xd73c32,
};

/* ---------------- 世界常量（单位见头注释标定） ---------------- */
const PIT = 3.7;              // 井坑边长（开口 x,z ∈ [0,PIT]）
const WALL_T = 0.55;          // 墙厚
const TOP_Y = 6.9;            // 墙顶环廊面
const WALK_Y = 3.2;           // 桥面 / 门洞底
const DOOR_H = 3.2;           // 门洞高
const ROT_Y = 5.0;            // 转子中心
const COL = { x: 2.39, z: 2.39 };   // 中央柱中心（拱门中点与门洞中点连线的中点）
const ARM_HALF = 2.17;        // 旋转桥半长
const WI = PIT, WO = PIT + WALL_T;  // 墙内/外面
const CORNER = 2.6;           // 前角敞开截断位置：FL/FR 墙止于此，V 形开口让桥面/坑可见
const S0 = -0.3, S1 = WO;     // 墙跨度

// 旋转桥端点（随角度）：0° = FL 拱门 ↔ FR 门洞；90° = 前角 ↔ 后角
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
export const cameraTarget = new THREE.Vector3(COL.x, 4.5, COL.z);   // 取景中心 = 塔身中部（视频构图）
export const cameraHalfH = 14.1;
export const cameraDir = new THREE.Vector3(
  Math.cos(51 * Math.PI / 180) * Math.SQRT1_2, Math.sin(51 * Math.PI / 180),
  Math.cos(51 * Math.PI / 180) * Math.SQRT1_2).normalize();
export const skyMode = 'day';

/* ---------------- 菱形纹表面（纪念碑谷式纹样） ---------------- */
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
// 顶面带菱形纹的盒体（tilesX/Z = 顶面重复数）
function patternedBox(world, baseHex, motifHex, x0, x1, y0, y1, z0, z1, tilesX, tilesZ) {
  const side = new THREE.MeshLambertMaterial({ color: baseHex });
  const topTex = tileTexture(baseHex, motifHex);
  topTex.repeat.set(tilesX, tilesZ);
  const top = new THREE.MeshLambertMaterial({ map: topTex });
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
    [side, side.clone(), top, side.clone(), side.clone(), side.clone()]);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  world.add(m); return m;
}

/* ---------------- 静态结构 ---------------- */
export function buildWorld(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.92));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(4, 12, 2); scene.add(sun);

  const world = new THREE.Group(); scene.add(world);
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const lit = [mat(C.wallLit), mat(C.wallLit), mat(C.wallTop), mat(C.wallShade), mat(C.wallShade), mat(C.wallLit)];       // FL：+z 外面=深蓝（左墙），-z 内面=浅
  const litFR = [mat(C.wallLit), mat(C.wallLit), mat(C.wallTop), mat(C.wallShade), mat(C.wallLit), mat(C.wallLit)];       // FR：+x 外面=浅蓝（右墙），-x 内面=浅

  // 基座整板（石环，顶面 y=0，菱形纹）
  patternedBox(world, '#8aa6f2', '#c8dcff', -0.3, WO + 0.35, -0.5, 0, -0.5, WO + 0.35, 9, 9);
  // 井坑竖井内壁（上段墙体色、下段深）+ 底
  world.add(box(mat(C.wallShade), 0, PIT, -1.5, -0.48, -0.06, 0.06));
  world.add(box(mat(C.pitWall), 0, PIT, -2.6, -1.5, -0.06, 0.06));
  world.add(box(mat(C.wallShade), -0.06, 0.06, -1.5, -0.48, 0, PIT));
  world.add(box(mat(C.pitWall), -0.06, 0.06, -2.6, -1.5, 0, PIT));
  world.add(box(mat(C.pitFloor), 0, PIT, -2.75, -2.6, 0, PIT));

  // 之字悬浮石径（从墙外沿前角延伸出画）
  const stones = [
    [6.5, 6.5], [7.6, 6.8], [7.2, 7.9], [8.3, 8.2], [7.9, 9.3],
    [9.0, 9.6], [8.6, 10.7], [9.7, 11.0], [9.3, 12.1], [10.4, 12.4],
    [10.0, 13.5], [11.1, 13.8], [10.7, 14.9], [11.8, 15.2], [11.4, 16.3],
    [12.5, 16.6], [12.1, 17.7], [13.2, 18.0],
  ];
  for (const [x, z] of stones) {
    const st = patternedBox(world, '#8fb2f5', '#d3e4ff', x - 0.6, x + 0.6, -0.16, 0.04, z - 0.38, z + 0.38, 2, 1);
    st.rotation.y = (x + z) % 2 > 1 ? 0.15 : -0.12;
  }

  // 四面墙。FL(z∈[WI,WO]，通高拱门隧道 x∈[0.35,1.45])、
  // FR(x∈[WI,WO]，门洞 z∈[0.35,1.45])——两墙在前角前截断（CORNER，敞开）；
  // BL / BR 通长。
  const zA = WI, zB = WO, ax0 = 0.35, ax1 = 1.45;
  const xA = WI, xB = WO, dz0 = 0.35, dz1 = 1.45;
  world.add(box(lit, S0, ax0, 0, TOP_Y - 0.25, zA, zB));
  world.add(box(lit, ax1, CORNER, 0, TOP_Y - 0.25, zA, zB));
  world.add(box(lit, ax0, ax1, 5.4, TOP_Y - 0.25, zA, zB));            // 拱门上方墙
  world.add(box(litFR, xA, xB, 0, TOP_Y - 0.25, S0, dz0));
  world.add(box(litFR, xA, xB, 0, TOP_Y - 0.25, dz1, CORNER));
  world.add(box(litFR, xA, xB, WALK_Y + DOOR_H, TOP_Y - 0.25, dz0, dz1));
  // FR 橙色门框（内侧面）
  world.add(box(mat(C.orange), xA - 0.05, xA, WALK_Y, WALK_Y + DOOR_H + 0.12, dz0 - 0.09, dz0));
  world.add(box(mat(C.orange), xA - 0.05, xA, WALK_Y, WALK_Y + DOOR_H + 0.12, dz1, dz1 + 0.09));
  world.add(box(mat(C.orange), xA - 0.05, xA, WALK_Y + DOOR_H - 0.09, WALK_Y + DOOR_H + 0.21, dz0 - 0.09, dz1 + 0.09));
  // BL / BR 墙
  world.add(box(lit, S0, S1, 0, TOP_Y - 0.25, -0.3, 0.25));
  world.add(box(lit, -0.3, 0.25, 0, TOP_Y - 0.25, S0, S1));

  // 檐口收边带（墙顶下方深色，四面）
  for (const [x0, x1, z0, z1] of [
    [S0, CORNER, zA, zB], [xA, xB, S0, CORNER],
    [S0, S1, -0.3, 0.25], [-0.3, 0.25, S0, S1],
  ]) world.add(box(mat(C.wallShade), x0, x1, TOP_Y - 0.5, TOP_Y - 0.25, z0, z1));

  // 墙顶环廊压顶（菱形纹顶面 + 出檐）
  patternedBox(world, '#a5c0f5', '#dbe8ff', S0 - 0.07, CORNER + 0.07, TOP_Y - 0.25, TOP_Y, zA - 0.07, zB + 0.07, 7, 1);
  patternedBox(world, '#a5c0f5', '#dbe8ff', xA - 0.07, xB + 0.07, TOP_Y - 0.25, TOP_Y, S0 - 0.07, CORNER + 0.07, 1, 7);
  patternedBox(world, '#a5c0f5', '#dbe8ff', S0 - 0.07, S1 + 0.07, TOP_Y - 0.25, TOP_Y, -0.37, 0.32, 8, 1);
  patternedBox(world, '#a5c0f5', '#dbe8ff', -0.37, 0.32, TOP_Y - 0.25, TOP_Y, S0 - 0.07, S1 + 0.07, 1, 8);
  // 垛口（外沿）
  for (let t = 0; t <= CORNER; t += 0.62) {
    world.add(box(mat(C.crenel), t - 0.11, t + 0.11, TOP_Y, TOP_Y + 0.18, zB, zB + 0.18));
    world.add(box(mat(C.crenel), xB, xB + 0.18, TOP_Y, TOP_Y + 0.18, t - 0.11, t + 0.11));
  }
  // FL 端平台（墙顶左端向外突出，终点）
  const platZ = WO + 0.85;
  patternedBox(world, '#a5c0f5', '#dbe8ff', -1.4, 0.32, TOP_Y - 0.25, TOP_Y, zA - 0.07, platZ, 2, 2);
  world.add(box(mat(C.crenel), -1.4, -1.26, TOP_Y, TOP_Y + 0.18, zA - 0.07, platZ));
  world.add(box(mat(C.crenel), -1.4, 0.32, TOP_Y, TOP_Y + 0.18, platZ - 0.15, platZ));

  // FL 基座梯（拱门隧道内 10 级：井沿 0 → 桥面 WALK_Y，穿墙上行）
  for (let i = 0; i < 10; i++) {
    const y = i * (WALK_Y / 10);
    world.add(box(mat(C.rimLit), ax0 + 0.04, ax1 - 0.04, y, y + WALK_Y / 10,
      WO - 0.15 + (9 - i) * 0.05 - 0.35, WO - 0.15 + (9 - i) * 0.05 + 0.4));
  }
  // FR 外墙角楼梯（贴前角上行 10 级：门洞底 → 墙顶）
  for (let i = 0; i < 10; i++) {
    const y = WALK_Y + i * (TOP_Y - WALK_Y) / 9;
    world.add(box(mat(C.columnCap), xB, xB + 0.36, y - 0.05, y + (TOP_Y - WALK_Y) / 9,
      4.3 - i * 0.17 - 0.44, 4.3 - i * 0.17 + 0.44));
  }

  // 中央柱：井底升出，柱础 + 双尖拱托架 + 柱身 + 顶帽
  world.add(box(mat(C.columnLit), COL.x - 0.42, COL.x + 0.42, -2.6, WALK_Y - 0.12, COL.z - 0.42, COL.z + 0.42));
  {
    // 双尖拱托架（柱顶与桥面之间）
    const sh = new THREE.Shape();
    sh.moveTo(-0.78, 0); sh.lineTo(0.78, 0); sh.lineTo(0.78, 1.35); sh.lineTo(-0.78, 1.35); sh.closePath();
    for (const cx of [-0.39, 0.39]) {
      const h = new THREE.Path();
      const w = 0.27, top = 1.1;
      h.moveTo(cx - w, 0); h.lineTo(cx - w, top - w);
      h.quadraticCurveTo(cx, top + 0.14, cx + w, top - w);
      h.lineTo(cx + w, 0); h.closePath();
      sh.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: false });
    g.translate(0, 0, -0.21);
    const trestle = new THREE.Mesh(g, mat(C.deckSide));
    trestle.position.set(COL.x, WALK_Y - 1.35, COL.z);
    world.add(trestle);
  }
  world.add(box(mat(C.column), COL.x - 0.32, COL.x + 0.32, WALK_Y, ROT_Y - 0.5, COL.z - 0.32, COL.z + 0.32));
  world.add(box(mat(C.columnCap), COL.x - 0.42, COL.x + 0.42, ROT_Y - 0.5, ROT_Y, COL.z - 0.42, COL.z + 0.42));

  // 橙色控制台（右墙外沿基座，视频 t=8 右侧）
  world.add(box(mat(C.columnCap), WO + 0.1, WO + 0.85, -0.28, 0.3, 2.6, 3.35));
  world.add(box(mat(C.orange), WO + 0.22, WO + 0.73, 0.3, 0.42, 2.72, 3.23));
  world.add(box(mat(C.orangeDeep), WO + 0.32, WO + 0.63, 0.42, 0.48, 2.82, 3.13));

  // 橙色碎屑（石环装饰，确定性伪随机）
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 36; i++) {
    const side = i % 4;
    const t = 0.2 + rnd() * (PIT + 0.3);
    const s = 0.08 + rnd() * 0.15;
    let x, z;
    if (side === 0) { x = t; z = WI + 0.15 + rnd() * 0.55; }
    else if (side === 1) { x = t; z = -0.4 + rnd() * 0.55; }
    else if (side === 2) { x = -0.4 + rnd() * 0.55; z = t; }
    else { x = WI + 0.15 + rnd() * 0.55; z = t; }
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
  const deckTex = tileTexture('#33409a', '#8fa4e8');
  deckTex.repeat.set(9, 1);
  const deckTop = new THREE.MeshLambertMaterial({ map: deckTex });
  const deckSide = mat(C.deckSide);
  const deck = (y) => {
    walk.add(box([deckSide, deckSide, deckTop, deckSide, deckSide, deckSide],
      -ARM_HALF, ARM_HALF, y - 0.5, y, -0.4, 0.4));
    for (const zz of [-0.34, 0.34]) {
      walk.add(box(mat(C.deckEdge), -ARM_HALF + 0.1, ARM_HALF - 0.1, y - 0.02, y + 0.04, zz - 0.07, zz + 0.07));
    }
  };
  deck(WALK_Y);           // 下桥（行走面）
  deck(WALK_Y + 1.6);     // 上桥（同轴同步旋转）
  for (let i = -4; i <= 4; i++) {
    for (const y of [WALK_Y, WALK_Y + 1.6]) {
      walk.add(box(mat(C.deckDot), i * 0.44 - 0.18, i * 0.44 + 0.18, y, y + 0.02, -0.19, 0.19));
    }
  }
  for (const ex of [-ARM_HALF + 0.15, ARM_HALF - 0.15]) {
    for (const y of [WALK_Y, WALK_Y + 1.6]) {
      walk.add(box(mat(C.columnCap), ex - 0.1, ex + 0.1, y - 0.36, y, -0.32, 0.32));
    }
  }

  // 顶部转子：橙色十字 + 端块（点击目标，指示朝向）
  const rotor = new THREE.Group(); rotor.position.y = ROT_Y; group.add(rotor);
  rotor.add(box(mat(C.orange), -0.19, 0.19, -0.19, 0.19, -0.19, 0.19));
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    rotor.add(box(mat(C.orangeDeep),
      d[0] * 0.42 - 0.13 * Math.abs(d[1]) - 0.13 * Math.abs(d[0]), d[0] * 0.42 + 0.13 * Math.abs(d[1]) + 0.13 * Math.abs(d[0]),
      -0.12, 0.12,
      d[1] * 0.42 - 0.13 * Math.abs(d[0]) - 0.13 * Math.abs(d[1]), d[1] * 0.42 + 0.13 * Math.abs(d[0]) + 0.13 * Math.abs(d[1])));
    rotor.add(box(mat(C.orange), d[0] * 0.74 - 0.14, d[0] * 0.74 + 0.14, -0.14, 0.14, d[1] * 0.74 - 0.14, d[1] * 0.74 + 0.14));
  }

  return {
    group, walk, rotor,
    hubWorld: new THREE.Vector3(COL.x, ROT_Y, COL.z),
    setAngle(turns) { group.rotation.y = Math.PI / 4 - turns * Math.PI / 2; },
  };
}

/* ---------------- 红衣小孩（跟随者，尖顶红帽） ---------------- */
export function buildChild() {
  const group = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.155, 0.52, 10),
    new THREE.MeshLambertMaterial({ color: C.childRed }));
  robe.position.y = 0.26; group.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0x2a2c3c }));
  head.position.y = 0.62; group.add(head);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 10),
    new THREE.MeshLambertMaterial({ color: C.childRed }));
  hood.position.y = 0.76; group.add(hood);
  return { group };
}

/* ---------------- 行走链 ---------------- */
// 桥面段（点23→24）端点随机关角度变化，艾达在桥上时随转动被载运。
// 门洞段（桥尾→外梯脚，穿墙）需桥处于 0°（对接门洞）。
function chainPoints() {
  const P = (x, y, z, extra) => Object.assign({ p: new THREE.Vector3(x, y, z) }, extra);
  const e0 = walkEnds(0);
  return [
    P(13.2, 0, 18.0), P(12.1, 0, 17.7), P(12.5, 0, 16.6), P(11.4, 0, 16.3),
    P(11.8, 0, 15.2), P(10.7, 0, 14.9), P(11.1, 0, 13.8), P(10.0, 0, 13.5),
    P(10.4, 0, 12.4), P(9.3, 0, 12.1), P(9.7, 0, 11.0), P(8.6, 0, 10.7),
    P(9.0, 0, 9.6), P(7.9, 0, 9.3), P(8.3, 0, 8.2), P(7.2, 0, 7.9),
    P(7.6, 0, 6.8), P(6.5, 0, 6.5),                                   // 之字径 0-17
    P(6.3, 0, 6.3),                                                   // 18 前角（墙外沿）
    P(1.3, 0, 6.75),                                                  // 19 墙外沿左行
    P(1.0, 0, 6.55), { stairs: true },                                // 20 隧道口外（基座梯脚）
    P(0.9, 0, 4.6),                                                   // 21 隧道内梯脚
    P(0.88, WALK_Y, 3.95),                                            // 22 梯顶（隧道内口）
    P(e0[1].x, WALK_Y, e0[1].z),                                      // 23 桥头（拱门端）
    P(e0[0].x, WALK_Y, e0[0].z),                                      // 24 桥尾（FR 门洞端）
    P(3.95, WALK_Y, 0.9), { door: true, seam: true },                 // 25 门洞内口（墙内换位）
    P(4.62, WALK_Y, 4.3), { door: true, stairs: true },               // 26 外梯脚（贴前角上行）
    P(4.5, TOP_Y, 2.72),                                              // 27 外梯顶（FR 压顶边缘）
    P(4.2, TOP_Y, 2.5),                                               // 28 登 FR 压顶
    P(4.2, TOP_Y, 0.3),                                               // 29 FR 顶 → 后角
    P(0, TOP_Y, 0.3),                                                 // 30 BR 顶
    P(0, TOP_Y, 4.0),                                                 // 31 BL 顶
    P(0.9, TOP_Y, 4.15),                                              // 32 FL 压顶
    P(-0.9, TOP_Y, 4.3),                                              // 33 端平台（终点）
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
  const WALK_SEG = 23;        // 桥面段（点23→24）
  const AT_ARCH = cum[22] + 0.05, AT_DOOR = cum[25] + 0.05;

  const state = {
    s: 0, sTarget: 0, moving: false,
    angle: 0, anim: null,
    finished: false, endT: 0,
    walkPhase: 0, facing: new THREE.Vector3(-1, 0, 0),
    demo: null,
  };

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

  function onDown(p, e) {
    if (state.finished) return;
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
  const rect = () => glCanvas.getBoundingClientRect();
  glCanvas.addEventListener('pointerdown', e => onDown({ x: e.clientX - rect().left, y: e.clientY - rect().top }, e));
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
      const speed = info.meta.stairs ? 3.0 : 4.2;
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
    ida.parts.body.position.y = moving ? Math.abs(Math.sin(state.walkPhase)) * 0.035 : 0;
    ida.parts.body.rotation.x = moving ? 0.05 : 0;
    // 红衣小孩跟随（落后固定弧长）
    const sChild = Math.max(0, state.s - 1.9);
    child.group.position.copy(posAt(sChild).p);
    child.group.rotation.y = ida.group.rotation.y;
    child.group.position.y += moving ? Math.abs(Math.sin(state.walkPhase - 0.6)) * 0.03 : 0;
    state.moving = moving;

    // 镜头随爬升上移
    const panTarget = Math.max(0, ida.group.position.y - 2.6) * 0.8;
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
      { at: 9.0, go: AT_DOOR },      // FR 门洞
      { at: 15.5, go: TOTAL },       // 端平台
      { at: 22.0, rotate: true },    // 转子两连转（视频 t=20-23 演示动作）
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
