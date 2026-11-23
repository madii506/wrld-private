// try camera framings on the live page: node dev/cam.cjs '[[pos],[look],roll]' ... → /tmp/w-cam-N.jpg
const { chromium } = require('playwright');
(async () => {
  const W = +(process.env.W || 1280), H = +(process.env.H || 720);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('http://localhost:8844/?in'); await p.waitForTimeout(3000);
  const cands = process.argv.slice(2).map(a => JSON.parse(a));
  for (let i = 0; i < cands.length; i++) {
    await p.evaluate(c => { window.__w.setTarget(c[0], c[1], c[2] || 0); }, cands[i]);
    await p.waitForTimeout(4500);
    await p.screenshot({ path: `/tmp/w-cam-${i}.jpg`, type: 'jpeg', quality: 80 });
  }
  await b.close();
})();
