// the postcard (both faces), under the hood, and the phone menu
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8844/?in'); await p.waitForTimeout(3500);
  await p.evaluate(() => document.getElementById('write').scrollIntoView({ block: 'center' })); await p.waitForTimeout(2500);
  await p.click('#pcA [data-a="1000"]'); await p.click('#pcM [data-s="TSLAx"]'); await p.waitForTimeout(400);
  const got = await p.textContent('#pcGot');
  await p.screenshot({ path: '/tmp/w-n-write-front.jpg', type: 'jpeg', quality: 82 });
  await p.click('#pcMode [data-mode="ring"]'); await p.waitForTimeout(1300);
  const ring = await p.$eval('#pc', e => e.classList.contains('ring'));
  await p.screenshot({ path: '/tmp/w-n-write-back.jpg', type: 'jpeg', quality: 82 });
  await p.evaluate(() => document.getElementById('hood').scrollIntoView({ block: 'start' })); await p.waitForTimeout(2500);
  await p.screenshot({ path: '/tmp/w-n-hood.jpg', type: 'jpeg', quality: 82 });
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  m.on('pageerror', e => errs.push('m: ' + e.message));
  await m.goto('http://localhost:8844/?in&noworld'); await m.waitForTimeout(1200);
  await m.click('#menuBtn'); await m.waitForTimeout(400);
  await m.screenshot({ path: '/tmp/w-n-menu.jpg', type: 'jpeg', quality: 82 });
  await m.click('#sheet a[href="#write"]'); await m.waitForTimeout(800);
  await m.screenshot({ path: '/tmp/w-n-write-m.jpg', type: 'jpeg', quality: 82 });
  const over = await m.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.track'); }).slice(0, 6).map(e => e.tagName + '.' + e.className));
  const small = await m.evaluate(() => [...document.querySelectorAll('#site button, #site a, #nav button, #nav a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 38) && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.sheet:not(.open)'); }).slice(0, 8).map(e => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().height)}`));
  console.log(JSON.stringify({ got, ring, errs, over, small }));
  await b.close();
})();
