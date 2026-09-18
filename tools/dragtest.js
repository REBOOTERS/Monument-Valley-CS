const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 500));
  const rect = await page.evaluate(() => {
    const c = document.querySelector('#game').getBoundingClientRect();
    return { l: c.left, t: c.top, w: c.width, h: c.height };
  });
  console.log('rect', rect);
  // raycast test: what does hub ray hit at several points
  const hits = await page.evaluate(() => {
    const out = [];
    const ray = new THREE.Raycaster();
    const v2 = new THREE.Vector2();
    for (const [x, y] of [[438, 702], [438, 660], [470, 695], [438, 745], [405, 720]]) {
      v2.set((x / 576) * 2 - 1, -(y / 1280) * 2 + 1);
      ray.setFromCamera(v2, MV.camera);
      // hub not exposed; intersect whole scene and list types
      const all = ray.intersectObjects(MV.scene.children, true).slice(0, 3)
        .map(h => (h.object.geometry.type + '@' + h.point.toArray().map(n => n.toFixed(2))));
      out.push([x, y, all]);
    }
    return out;
  });
  console.log(JSON.stringify(hits, null, 1));
  // dispatch synthetic pointer drag and observe rotor quaternion angle
  const res = await page.evaluate(() => {
    const c = document.querySelector('#game');
    const fire = (type, x, y, target) => {
      const ev = new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, button: 0 });
      (target || c).dispatchEvent(ev);
    };
    const ang = () => {
      const q = MV.rotor.quaternion;
      // angle from quaternion
      return 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI;
    };
    const a0 = ang();
    fire('pointerdown', 438, 660, c);
    const steps = [];
    for (let i = 1; i <= 10; i++) {
      const a = -Math.PI / 2 + (105 * Math.PI / 180) * (i / 10);
      fire('pointermove', 438 + Math.cos(a) * 46, 702 + Math.sin(a) * 46, window);
      steps.push(ang());
    }
    fire('pointerup', 470, 720, window);
    return { a0, steps, cursor: c.style.cursor };
  });
  console.log('rotor angles', res.a0.toFixed(1), res.steps.map(s => s.toFixed(0)), 'cursor', res.cursor);
  await new Promise(r => setTimeout(r, 700));
  console.log('state', JSON.stringify(await page.evaluate(() => MV.state())));
  await browser.close();
})();
