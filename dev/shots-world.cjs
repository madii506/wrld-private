const { chromium } = require('playwright');
(async () => {
  const shots = (process.argv[2] || 'gate,hero').split(',');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8844/dev/worldtest.html?shot=' + shots[0]);
  await p.waitForFunction(() => window.W, null, { timeout: 60000 });
  for (const s of shots) {
    await p.evaluate(s => { W.setShot(s, true); for (let i = 0; i < 3; i++) W.frame(0.016); }, s);
    await p.screenshot({ path: `/tmp/wrld-${s}.jpg`, type: 'jpeg', quality: 80 });
  }
  console.log(JSON.stringify({ errs, info: await p.evaluate(() => W.info()) }));
  await b.close();
})();
