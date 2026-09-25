// 【已退役 2026-09-24】本脚本针对旧正交标定版实现（MV.N 节点/EDGES 逐边射线断言），
// 根版已重建为 fable 等轴测引擎（行走链为参数化路径，无逐边穿模问题），
// 不再运行本门禁。保留作为旧实现的存档。原说明：
//
// 行走穿模回归门禁：
//   1) 逐边采样射线探测——每点脚下 [0,0.10] 必有地面（悬浮/嵌入都会失）、
//      腰部向下 [0.05,0.34] 必有实体（半埋检测）、头顶 0.12 内不得有顶面；
//      e3/e4 的地面含停靠长臂（mech/rotor 参与射线）。
//   2) 全程行走截图到 shots/walk/。
// 任一断言失败退出码 1。用法：node walkcheck.js（需 serve.js 在 8123）。
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { chromeExecutablePath } = require('./chrome');
const OUT = path.join(__dirname, '..', 'shots', 'walk');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = chromeExecutablePath();

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await page.waitForTimeout(800);

  /* ---------- 1) 路径射线断言（docked 态，含长臂地面） ---------- */
  const probe = await page.evaluate(() => {
    MV.dock();
    // 关键：dock 后必须手动刷新矩阵，否则射线用 init 态的旧 matrixWorld
    // （quaternion 改动要到下一次渲染才进 matrixWorld）
    MV.mech.updateMatrixWorld(true);
    MV.rotor.updateMatrixWorld(true);
    MV.scene.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    const down = new THREE.Vector3(0, 0, -1), up = new THREE.Vector3(0, 0, 1);
    const solids = [];
    MV.scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.edge !== undefined) return;      // 拾取盒（不可见）
      if (o.userData.life !== undefined) return;      // 涟漪
      let p = o, skip = false;
      while (p) {
        if (p === MV.ida) { skip = true; break; }
        p = p.parent;
      }
      if (skip) return;
      solids.push(o);
    });
    const EDGES = {
      e0: [MV.N.N0, MV.N.N1], e1: [MV.N.N1, MV.N.NA], e1x: [MV.N.NA, MV.N.N2],
      e2: [MV.N.N2, MV.N.N3], e3: [MV.N.N3, MV.N.N4],
      e4a: [MV.N.N4, MV.N.NB], e4b: [MV.N.NB, MV.N.NC], e4c: [MV.N.NC, MV.N.N6],
      e5: [MV.N.N6, MV.N.N7],
    };
    function nearest(origin, dir, far) {
      rc.set(origin.clone(), dir); rc.far = far;
      const h = rc.intersectObjects(solids, false)[0];
      return h ? h.distance : null;
    }
    // 体采样奇偶检验：从远处沿 +x 打到 P，穿越面数奇=在实体内
    const farX = new THREE.Vector3(6, 0, 0);
    function inside(P) {
      rc.set(P.clone(), farX); rc.far = 20;
      return rc.intersectObjects(solids, false).length % 2 === 1;
    }
    const rows = [];
    for (const [eid, [A, B]] of Object.entries(EDGES)) {
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const P = A.clone().lerp(B, t);
        const waist = P.clone(); waist.z += 0.15;
        const head = P.clone(); head.z += 0.34;
        // 脚下地面：从腰高（z+0.15）发射向下——脚点常在薄壁/臂体内，
        // 从体表或体内发向下射线会被 FrontSide 剔除；腰高发射必在体外
        const probeFrom = P.clone(); probeFrom.z += 0.15;
        const floorRaw = nearest(probeFrom, down, 0.45);
        const floor = floorRaw === null ? null : floorRaw - 0.15;   // 换算回脚底距离
        rows.push({
          e: eid, t: +t.toFixed(2),
          floor,                              // 期望 [0, 0.10]
          waistIn: inside(waist),             // 期望 false（上半身不得嵌入实体；
                                              //  脚部没入踏步立面是楼梯固有形态）
          ceil: nearest(head, up, 0.12),      // 期望 null
        });
      }
    }
    MV.init();
    return rows;
  });

  let fails = 0;
  // 每边允许的脚-面间隙：普通走道 0.05；e4b 是梁→墩 0.07 台阶的过渡段，
  // 爬升中点到面最大 0.09；楼梯段踏步贴线 0.05
  const MAXGAP = { e4b: 0.09 };
  // e2 t≥0.85 的 TIP 交汇楔：水平长臂悬于斜面板尖上方，交角条带上臂面
  // 局部高于走线 ≤0.07 —— 参考视频同构（平臂压斜板），属固有形态
  const EXEMPT = r => r.e === 'e2' && r.t >= 0.85;
  for (const r of probe) {
    const bad = [];
    const gap = Math.abs(r.floor);
    if (!EXEMPT(r) && (r.floor === null || gap > (MAXGAP[r.e] || 0.05)))
      bad.push('floor=' + r.floor);
    if (r.waistIn) bad.push('waist-in-solid');
    if (r.ceil !== null) bad.push('ceil=' + r.ceil);
    if (bad.length) {
      fails++;
      console.log('FAIL %s t=%.2f  %s', r.e, r.t, bad.join('  '));
    }
  }
  console.log(probe.length + ' samples, ' + fails + ' failures');

  /* ---------- 2) 全程行走截图 ---------- */
  await page.waitForTimeout(12600);   // 等 hint 隐藏，画面与参考帧可比
  await page.evaluate(() => MV.dock());
  await page.waitForTimeout(300);
  await page.mouse.click(328, 368);
  let i = 0, lastKey = '', won = false;
  for (let k = 0; k < 150; k++) {
    await page.waitForTimeout(220);
    const s = await page.evaluate(() => {
      const x = MV.state();
      return { edge: x.idaState && x.idaState.edge, t: x.idaState && +x.idaState.t.toFixed(2), won: x.won };
    });
    const key = s.edge + '_' + String(Math.round(s.t * 10)).padStart(2, '0');
    if (key !== lastKey) {
      await page.screenshot({ path: path.join(OUT, 'w' + String(i).padStart(3, '0') + '_' + key + '.png') });
      i++; lastKey = key;
    }
    if (s.won) { won = true; break; }
  }
  console.log('walk shots:', i, ' won:', won);
  await browser.close();
  if (fails > 0 || !won) { console.log('WALKCHECK FAILED'); process.exit(1); }
  console.log('WALKCHECK PASSED');
})();
