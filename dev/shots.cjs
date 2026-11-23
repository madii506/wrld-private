// screenshots of the home page: the gate, then each section after entering
const { chromium } = require('playwright');
(async () => {
  const W = +(process.env.W || 1280), H = +(process.env.H || 720), tag = process.env.TAG || 'd';
  const which = (process.argv[2] || 'gate,public,markets,descend,flip,hidden,scan,how,status,faq,go').split(',');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: !!process.env.MOB, hasTouch: !!process.env.MOB });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (which.includes('gate')) {
    await p.goto('http://localhost:8844/'); await p.waitForTimeout(6000);
    await p.screenshot({ path: `/tmp/w-${tag}-gate.jpg`, type: 'jpeg', quality: 82 });
  }
  await p.goto('http://localhost:8844/?in'); await p.waitForTimeout(4000);
  for (const id of which.filter(x => x !== 'gate')) {
    const frac = id.includes(':') ? +id.split(':')[1] : 0.5, sid = id.split(':')[0];
    await p.evaluate(([sid, frac]) => { const el = document.getElementById(sid); const top = el.getBoundingClientRect().top + scrollY; const h = el.offsetHeight; scrollTo(0, top + Math.max(0, (h - innerHeight)) * frac); }, [sid, frac]);
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `/tmp/w-${tag}-${sid}${id.includes(':') ? '-' + id.split(':')[1] : ''}.jpg`, type: 'jpeg', quality: 82 });
  }
  const over = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.track'); }).slice(0, 8).map(e => e.tagName + '.' + e.className));
  console.log(JSON.stringify({ errs, over }));
  await b.close();
})();
