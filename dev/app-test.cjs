// drives the app with a test wallet: a real ed25519 key made here signs in Node, so the Privacy Rings derivation
// runs for real in the page. Swaps hit the local mock (the sandbox cannot reach Jupiter), so only the flow is real.
const { chromium } = require('playwright');
const crypto = require('crypto');
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = buf => { let n = 0n; for (const b of buf) n = n * 256n + BigInt(b); let s = ''; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } for (const b of buf) { if (b === 0) s = '1' + s; else break; } return s; };
(async () => {
  const W = +(process.env.W || 1280), H = +(process.env.H || 800), tag = process.env.TAG || 'a', mob = !!process.env.MOB;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const addr = b58(raw);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: mob, hasTouch: mob });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.exposeFunction('__nodeSign', arr => [...crypto.sign(null, Buffer.from(arr), privateKey)]);
  await p.addInitScript(addr => {
    const wallet = {
      version: '1.0.0', name: 'Testwallet', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMzZmYwZDgiLz48L3N2Zz4=', chains: ['solana:mainnet'], accounts: [],
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => { wallet.accounts = [{ address: addr, publicKey: new Uint8Array(32), chains: ['solana:mainnet'], features: [] }]; return { accounts: wallet.accounts }; } },
        'standard:disconnect': { version: '1.0.0', disconnect: async () => { wallet.accounts = []; } },
        'standard:events': { version: '1.0.0', on: () => () => {} },
        'solana:signMessage': { version: '1.0.0', signMessage: async ({ message }) => [{ signedMessage: message, signature: new Uint8Array(await window.__nodeSign([...message])) }] },
        'solana:signAndSendTransaction': { version: '1.0.0', signAndSendTransaction: async () => [{ signature: new Uint8Array(64).fill(9) }] },
      },
    };
    window.addEventListener('wallet-standard:app-ready', ({ detail: api }) => api.register(wallet));
  }, addr);
  const shot = n => p.screenshot({ path: `/tmp/w-${tag}-${n}.jpg`, type: 'jpeg', quality: 84 });
  const log = [];
  await p.goto('http://localhost:8844/app'); await p.waitForTimeout(1500);
  await shot('1-markets');
  // connect
  await p.click('#conn'); await p.waitForTimeout(300);
  log.push('menu: ' + (await p.textContent('#connMenu')).replace(/\s+/g, ' ').slice(0, 80));
  await p.click('#connMenu [data-w="Testwallet"]'); await p.waitForTimeout(500);
  log.push('chip: ' + (await p.textContent('#conn')).trim());
  // a buy
  await p.click('#mlist .mrow[data-m]'); await p.fill('#tAmt', '0.5'); await p.waitForTimeout(1200);
  log.push('quote: ' + (await p.textContent('#tQuote')).replace(/\s+/g, ' ').trim().slice(0, 120));
  log.push('go: ' + (await p.textContent('#tGo')));
  await shot('2-quote');
  await p.click('#tGo'); await p.waitForTimeout(900);
  log.push('result: ' + (await p.textContent('#tRes')).replace(/\s+/g, ' ').trim().slice(0, 140));
  await shot('3-sent');
  // filters
  await p.click('#mfilt [data-f="metal"]'); await p.waitForTimeout(200);
  log.push('metals: ' + (await p.$$eval('#mlist .mrow b', b => b.map(x => x.textContent).join(','))));
  // sell side flips the labels
  await p.click('.tside [data-side="sell"]'); await p.waitForTimeout(200);
  log.push('sell label: ' + (await p.textContent('#tPayL')));
  // private: derive for real
  await p.click('.tabs [data-tab="private"]'); await p.waitForTimeout(400);
  await p.click('#derive');
  await p.waitForFunction(() => !document.getElementById('pAddr').hidden, null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(500);
  log.push('derive: ' + (await p.textContent('#pAddr')).replace(/\s+/g, ' ').trim().slice(0, 140));
  log.push('registry: ' + (await p.textContent('#regState')));
  await shot('4-private');
  // scan
  await p.click('.tabs [data-tab="scan"]'); await p.waitForTimeout(300);
  await p.click('#scanMine'); await p.waitForTimeout(1800);
  await shot('5-scan');
  // live
  await p.click('.tabs [data-tab="live"]'); await p.waitForTimeout(1500);
  await shot('6-live');
  const over = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 6).map(e => e.tagName + '.' + e.className));
  const small = mob ? await p.evaluate(() => [...document.querySelectorAll('button,a,input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && (r.height < 40 || r.width < 40) && !e.closest('.wmenu:not(.open)'); }).slice(0, 10).map(e => `${e.tagName}#${e.id}.${e.className} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)) : [];
  console.log(JSON.stringify({ addr, log, errs, over, small }, null, 1));
  await b.close();
})();
