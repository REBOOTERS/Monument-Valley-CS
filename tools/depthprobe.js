// List raycaster intersections (distance, point, colors) at screen pixels
const { chromium } = require('playwright-core');
const px = process.argv.slice(2).map(Number);
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 576, height: 1280 } });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForFunction(() => !!(window.MV && window.MV.renderer));
  await new Promise(r => setTimeout(r, 600));
  const out = await page.evaluate((px) => {
    const res = [];
    const ray = new THREE.Raycaster();
    for (let i = 0; i < px.length; i += 2) {
      const ndc = new THREE.Vector2(px[i] / 576 * 2 - 1, -(px[i + 1] / 1280 * 2 - 1));
      ray.setFromCamera(ndc, MV.camera);
      const all = ray.intersectObjects(MV.scene.children, true);
      const hits = all.filter(h => h.object.isMesh
        && !(h.object.material && h.object.material.colorWrite === false)).slice(0, 6);
      res.push({ px: [px[i], px[i + 1]], hits: hits.map(h => {
        const wp = new THREE.Vector3(); h.object.getWorldPosition(wp);
        return {
        d: +h.distance.toFixed(3),
        p: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
        geo: h.object.geometry.type,
        name: h.object.name || h.object.parent.name || '',
        objPos: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
        col: h.object.material && h.object.material.color ? '#' + h.object.material.color.getHexString() : '',
      }; }) });
    }
    return res;
  }, px);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
