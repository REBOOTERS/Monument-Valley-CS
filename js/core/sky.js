/* ============================================================
   背景层（#bg 2D 画布）：天空渐变（锚定世界，随镜头上移下滚）、
   结构下方柔光、小月亮（可选，章节配置）、飘落星点、结尾极光幕布。
   颜色/几何均按参考视频逐帧取样。
   ============================================================ */
import * as THREE from 'three';
import { REF_H, PX_PER_UP_UNIT } from './engine.js';

export function createSky(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random(), y: Math.random(),
    r: 0.6 + Math.random() * 1.4, a: 0.25 + Math.random() * 0.6,
    v: 0.004 + Math.random() * 0.01,
  }));
  // 月亮配置（参考取景 1280 高基准）：ox = 相对画面中心的水平偏移，oy = 中心高度，r = 半径
  const moon = opts.moon || null;

  function lerpColor(a, b, t) {
    const ca = new THREE.Color(a), cb = new THREE.Color(b);
    return '#' + ca.lerp(cb, t).getHexString();
  }

  // env: { panU(镜头上移量), dark(结尾压暗 0~0.3), finished, endT, dpr }
  function draw(dt, t, env) {
    const w = canvas.width, h = canvas.height;
    const g = ctx;
    g.clearRect(0, 0, w, h);
    const S = h / REF_H;                                   // 画布像素 / 参考取景像素
    const panPx = env.panU * PX_PER_UP_UNIT * S;           // 镜头上移量（画布像素）
    const dark = env.dark || 0;

    // 天空渐变锚定在世界上：镜头上移时整体随之下滚，并轻微变暗（按视频逐帧取色）
    const grad = g.createLinearGradient(0, panPx - h * 1.2, 0, panPx + h);
    const stops = [[0, '#352e3c'], [0.42, '#352e3c'], [0.5, '#2e2f38'], [0.545, '#303339'], [0.77, '#55666e'], [1, '#7a97aa']];
    for (const [o, c] of stops) grad.addColorStop(o, lerpColor(c, '#1c2230', dark));
    g.fillStyle = grad; g.fillRect(0, 0, w, h);

    // 结构下方的柔光
    const gy = h * 0.72 + panPx;
    const rg = g.createRadialGradient(w * 0.42, gy, 0, w * 0.42, gy, h * 0.42);
    rg.addColorStop(0, `rgba(190,215,230,${0.22 * (1 - dark)})`); rg.addColorStop(1, 'rgba(190,215,230,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);

    // 小月亮：世界锚定（相对画面中心偏移随高度缩放），随镜头滚动
    if (moon) {
      const mx = w / 2 + moon.ox * S, my = moon.oy * S + panPx, mr = moon.r * S;
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, 'rgba(206,211,221,1)');
      mg.addColorStop(0.55, 'rgba(206,211,221,0.95)');
      mg.addColorStop(0.82, 'rgba(206,211,221,0.4)');
      mg.addColorStop(1, 'rgba(206,211,221,0)');
      g.globalAlpha = 1 - dark;
      g.fillStyle = mg;
      g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }

    // 缓缓飘落的星点（随世界一起滚动）
    g.fillStyle = '#ffffff';
    for (const s of stars) {
      s.y += s.v * dt; if (s.y > 1.02) { s.y = -0.02; s.x = Math.random(); }
      g.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(t * 2 + s.x * 20)) * (1 - dark * 1.5);
      const sy = ((s.y * h + panPx) % (h * 1.04) + h * 1.04) % (h * 1.04) - h * 0.02;
      g.beginPath(); g.arc(s.x * w, sy, s.r * env.dpr, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    if (env.finished) drawAurora(g, w, h, t, S, env);
  }

  // 结尾极光：倒 V 幕布（几何按视频 19.5s 帧量取）+ 波浪亮绿光带 + 白色光柱
  function drawAurora(g, w, h, t, S, env) {
    const k = THREE.MathUtils.smoothstep(env.endT, 0.6, 2.6);
    if (k <= 0) return;
    // 极光幕布比结构下落得更快（约 1.4 倍），顶点从画面上方进入
    const apexY = (-131 + 1.4 * env.panU * PX_PER_UP_UNIT) * S;
    const ax = w * 0.46;
    const dpr = env.dpr;
    g.save(); g.globalAlpha = k;
    const curtain = (cx, cy, lx, ly, rx, ry, alpha, withBand) => {
      g.save(); g.globalAlpha = k * alpha;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + lx * 6, cy + ly * 6); g.lineTo(cx + rx * 6, cy + ry * 6); g.closePath(); g.clip();
      const body = g.createLinearGradient(0, cy - 420 * S, 0, cy);
      body.addColorStop(0, 'rgba(55,56,65,1)'); body.addColorStop(0.55, 'rgba(60,66,68,1)'); body.addColorStop(0.85, 'rgba(76,100,80,1)'); body.addColorStop(1, 'rgba(90,120,88,1)');
      g.fillStyle = body; g.fillRect(0, 0, w, h);
      if (withBand) {
        // 波浪形亮绿光带（在幕布内、顶点上方约 265px 处），带缓慢起伏
        const yc = x => cy - (265 + 30 * (x - cx) / (200 * S)) * S + Math.sin((x / (125 * S)) + t * 0.4) * 22 * S;
        // 上缘清晰、下缘柔和渐隐
        const band = (half, color) => {
          g.beginPath(); g.moveTo(-w, yc(-w) - 14 * S);
          for (let x = -w; x <= w * 2; x += 8 * dpr) g.lineTo(x, yc(x) - 14 * S);
          for (let x = w * 2; x >= -w; x -= 8 * dpr) g.lineTo(x, yc(x) + half);
          g.closePath(); g.fillStyle = color; g.fill();
        };
        band(70 * S, 'rgba(57,116,99,0.18)'); band(45 * S, 'rgba(57,116,99,0.3)'); band(22 * S, 'rgba(60,122,104,0.75)');
        g.shadowColor = 'rgba(70,140,115,0.6)'; g.shadowBlur = 14 * S; band(12 * S, 'rgba(64,128,108,0.5)'); g.shadowBlur = 0;
      }
      g.restore();
    };
    curtain(ax - 250 * S, apexY - 40 * S, -60 * S, -280 * S, 130 * S, -300 * S, 0.55, true); // 左侧被遮住的第二道幕
    curtain(ax, apexY, -215 * S, -280 * S, 185 * S, -305 * S, 1, true);
    // 细长的白色光柱
    const ly = THREE.MathUtils.smoothstep(env.endT, 2.6, 4.2);
    g.strokeStyle = `rgba(240,248,250,${0.9 * ly})`; g.lineWidth = 2.2 * S; g.lineCap = 'round';
    const sx = w * 0.246, sy0 = apexY - 45 * S, sy1 = apexY + 70 * S;
    g.beginPath(); g.moveTo(sx, sy0 + (sy1 - sy0) * (1 - ly) * 0.5); g.lineTo(sx, sy1 - (sy1 - sy0) * (1 - ly) * 0.5); g.stroke();
    g.restore();
  }

  function resize(w, h) { canvas.width = w; canvas.height = h; }

  return { draw, resize };
}
