// clicks every control on the home page (without WebGL, so it runs fast) and reports anything that does nothing
const { chromium } = require('playwright');
(async () => {
  const W = +(process.env.W || 1280), H = +(process.env.H || 800), mob = !!process.env.MOB;
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, reducedMotion: 'reduce' });
  const errs = [], log = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8844/?noworld'); await p.waitForTimeout(800);
  await p.click('#gConnect'); await p.waitForTimeout(200);
  log.push('gate menu open: ' + await p.$eval('#gMenu', m => m.classList.contains('open')));
  await p.keyboard.press('Escape');
  await p.click('#gEnter'); await p.waitForTimeout(600);
  log.push('entered: ' + await p.evaluate(() => document.body.classList.contains('in')));
  if (!mob) for (const href of ['#markets', '#descend', '#hidden', '#scan', '#status', '#faq']) {
    await p.click(`#nav .links a[href="${href}"]`); await p.waitForTimeout(500);
    const ok = await p.evaluate(h => { const r = document.querySelector(h).getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, href);
    log.push(`nav ${href}: ${ok ? 'ok' : 'NOT IN VIEW'}`);
  }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.click('.hero a[href="#descend"]'); await p.waitForTimeout(500);
  log.push('hero see-how: ' + await p.evaluate(() => { const r = document.querySelector('#descend').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  const n = await p.$$eval('.faq summary', s => s.length);
  for (let i = 0; i < n; i++) { await p.locator('.faq summary').nth(i).scrollIntoViewIfNeeded(); await p.locator('.faq summary').nth(i).click(); }
  log.push('faq open: ' + await p.$$eval('.faq details', d => d.filter(x => x.open).length) + '/' + n);
  await p.locator('#scanIn').scrollIntoViewIfNeeded(); await p.fill('#scanIn', 'FV89AzpqVCFofosY114feU1Gg21aviGCcaVrRmJJCZkT'); await p.click('#scanGo'); await p.waitForTimeout(1500);
  log.push('scan: ' + (await p.textContent('#scanOut')).replace(/\s+/g, ' ').trim().slice(0, 60));
  await p.fill('#scanIn', 'nope'); await p.click('#scanGo'); await p.waitForTimeout(300);
  log.push('scan bad: ' + (await p.textContent('#scanOut')).trim());
  await p.click('#scanMine'); await p.waitForTimeout(300);
  log.push('scan mine without wallet opens menu: ' + await p.$eval('#nMenu', m => m.classList.contains('open')));
  await p.keyboard.press('Escape');
  await p.click('.cue'); await p.waitForTimeout(400);
  await p.locator('#go a[href="/app"]').scrollIntoViewIfNeeded(); await p.click('#go a[href="/app"]'); await p.waitForTimeout(1500);
  log.push('open app → ' + new URL(p.url()).pathname);
  await p.goBack(); await p.waitForTimeout(600);
  await p.click('#toTop').catch(() => {});
  const over = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.track'); }).slice(0, 6).map(e => e.tagName + '.' + e.className));
  console.log(JSON.stringify({ log, errs, over }, null, 1));
  await b.close();
})();
