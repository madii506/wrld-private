// the enter sequence: hover Enter, click, frames through the untie, the dive and the landing
const { chromium } = require('playwright');
(async () => {
  const W = +(process.env.W || 1280), H = +(process.env.H || 720), tag = process.env.TAG || 'e';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8844/'); await p.waitForTimeout(5500);
  await p.hover('#gEnter'); await p.waitForTimeout(800);
  await p.screenshot({ path: `/tmp/w-${tag}-0hover.jpg`, type: 'jpeg', quality: 82 });
  await p.click('#gEnter');
  for (const ms of [500, 1400, 2400, 5200]) { await p.waitForTimeout(ms - (p._last || 0)); p._last = ms; await p.screenshot({ path: `/tmp/w-${tag}-${ms}.jpg`, type: 'jpeg', quality: 82 }); }
  const st = await p.evaluate(() => ({ cls: document.body.className, gate: document.getElementById('gate').className }));
  console.log(JSON.stringify({ errs, st }));
  await b.close();
})();
