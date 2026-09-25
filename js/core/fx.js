/* ============================================================
   前景层（#fx 2D 画布）：点击涟漪 + 前景虚化雪片。
   均以参考视频为准：点击 = 细白圈自点击点扩张至 ~55px 后消散
   （6.1-6.5s 实测）；大颗柔焦雪片在镜头与结构之间缓缓飘落。
   ============================================================ */
import { REF_H, PX_PER_UP_UNIT } from './engine.js';

export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  const ripples = [];
  const bokeh = Array.from({ length: 7 }, () => ({
    x0: Math.random(), y: Math.random(),
    r: 8 + Math.random() * 10, a: 0.06 + Math.random() * 0.08,
    v: 0.02 + Math.random() * 0.02, ph: Math.random() * Math.PI * 2,
  }));
  let dpr = 1;

  // x,y：画布 CSS 像素（相对 #app）
  function ripple(x, y) { ripples.push({ x, y, t: 0 }); }
  function clearRipples() { ripples.length = 0; }

  function update(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; if (r.t >= 0.55) ripples.splice(i, 1); }
    for (const f of bokeh) { f.y += f.v * dt; if (f.y > 1.05) { f.y = -0.05; f.x0 = Math.random(); } }
  }

  function draw(simT, panU) {
    const w = canvas.width, h = canvas.height;
    const g = ctx;
    g.clearRect(0, 0, w, h);
    const S = h / REF_H;
    const panPx = panU * PX_PER_UP_UNIT * S;
    for (const r of ripples) {
      const k = r.t / 0.55;
      g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      g.lineWidth = 2 * S;
      g.beginPath(); g.arc(r.x * dpr, r.y * dpr, (6 + 50 * k) * S, 0, Math.PI * 2); g.stroke();
    }
    // 虚化雪片：柔边圆斑，随镜头平移一起滚动
    for (const f of bokeh) {
      const fx = (f.x0 + Math.sin(simT * 0.3 + f.ph) * 0.015) * w;
      const fy = ((f.y * h + panPx) % (h * 1.1) + h * 1.1) % (h * 1.1) - h * 0.05;
      const fr = f.r * S;
      const fg = g.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, `rgba(235,242,248,${f.a})`);
      fg.addColorStop(0.7, `rgba(235,242,248,${f.a * 0.5})`);
      fg.addColorStop(1, 'rgba(235,242,248,0)');
      g.fillStyle = fg;
      g.beginPath(); g.arc(fx, fy, fr, 0, Math.PI * 2); g.fill();
    }
  }

  function resize(w, h, d) { canvas.width = w; canvas.height = h; dpr = d; }

  return { ripple, clearRipples, update, draw, resize };
}
