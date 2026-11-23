// the new gate: the world assembling, the orbit with the name, and the sweep into the city
const { chromium } = require('playwright');
(async () => {
  const W = +(process.env.W || 1280), H = +(process.env.H || 720), tag = process.env.TAG || 'gt';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: !!process.env.MOB, hasTouch: !!process.env.MOB });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8844/');
  const at = [...(process.env.AT || '900,2000,7000').split(',').map(Number)];
  const t0 = Date.now();
  for (const ms of at) { const w = ms - (Date.now() - t0); if (w > 0) await p.waitForTimeout(w); await p.screenshot({ path: `/tmp/w-${tag}-${ms}.jpg`, type: 'jpeg', quality: 84 }); }
  if (!process.env.NOENTER) { await p.click('#gEnter'); await p.waitForTimeout(4500); await p.screenshot({ path: `/tmp/w-${tag}-in.jpg`, type: 'jpeg', quality: 84 }); }
  console.log(JSON.stringify({ errs, built: await p.evaluate(() => window.__w && window.__w.built()), cls: await p.evaluate(() => document.body.className) }));
  await b.close();
})();
