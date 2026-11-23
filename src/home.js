// WRLD home: the blindfolded globe gate, the dive, and a scroll that walks the camera across the public city,
// down through the pool, over the flip and along the hanging private city. Every number on the page is read live.
import { startWorld } from './world.js';
import * as WS from './wallet.js';
import { fmt, getJSON, countTo, wipeTo } from './fx.js';
import { decode, cipher, pointerLife, stagger } from './alive.js';
import { walletMenu, closeMenusOnOutside, runScan as scanInto, loadStatus } from './shared.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const Q = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let entered = false;
let mkts = [], pcSym = 'NVDAx', pcAmt = 250, solSlot = null;   // live markets, the postcard's picks, the last Solana slot read

// ---------- the world ----------
let world = null, worldLevel = 1;
if (!Q.has('noworld')) {
  try { world = startWorld($('#world'), { startShot: Q.get('shot') || 'gate', active: () => worldLevel }); window.__w = world; }
  catch (e) { document.body.classList.add('noworld'); }
}

// ---------- the gate ----------
function openSite(instant) {
  if (entered) return; entered = true;
  document.body.classList.remove('locked'); document.body.classList.add('in');
  setTimeout(() => decode($('#heroH'), 1100), instant ? 120 : 400);
  $('#gate').classList.add('gone');
  measure(); onScroll();
  if (instant && world) { const s = camAt(scrollY); if (s) world.setTarget(s.pos, s.look, s.roll); }
}
function enter() {
  if (entered) return;
  $('#gate').classList.add('gone');
  let done = false;
  const finish = () => { if (done) return; done = true; openSite(true); };
  if (!world || reduce) return finish();
  world.enter({ onDone: () => setTimeout(finish, 60) });             // sweep down from the orbit into the city
  setTimeout(finish, 3600);                                          // never strand anyone on the gate
}
$('#gEnter').addEventListener('click', enter);
// the name glitches now and then, the way the header flickered on H3LIX
const mark = $('#mark');
(function glitch() { if (!entered) { mark.classList.add('glitch'); setTimeout(() => mark.classList.remove('glitch'), 80 + Math.random() * 110); } setTimeout(glitch, 1400 + Math.random() * 2600); })();
addEventListener('keydown', e => { if (!entered && e.key === 'Enter' && !e.target.closest('input,button,a')) enter(); });

// ---------- wallet menus ----------
const scanMe = addr => { if (!entered) openSite(true); $('#scanIn').value = addr; $('#scan').scrollIntoView({ behavior: 'smooth' }); runScan(addr); };
walletMenu($('#gConnect'), $('#gMenu'), null, { onScan: scanMe, privateHref: '/app#private' });
walletMenu($('#nConnect'), $('#nMenu'), $('#nConnect'), { onScan: scanMe, privateHref: '/app#private' });
closeMenusOnOutside();
WS.reconnect();

// ---------- scroll: the camera path and the pinned scenes ----------
let anchors = [], pins = [];
const SH = () => (world ? world.shots : {});
function measure() {
  const vh = innerHeight, out = [];
  for (const el of $$('[data-cam]')) {
    const r = el.getBoundingClientRect(), top = r.top + scrollY, h = r.height;
    const [a, b] = el.dataset.cam.split('>');
    let s = top - vh * 0.15, e = top + h - vh * 0.85; if (el.dataset.hold) { s = top; e = top + h * +el.dataset.hold; } if (e < s) e = s;
    if (SH()[a]) out.push({ y: s, s: SH()[a] });
    if (SH()[b || a]) out.push({ y: e, s: SH()[b || a] });
  }
  anchors = out;
  pins = $$('.pin').map(el => ({ el, top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function camAt(y) {
  if (!anchors.length) return null;
  if (y <= anchors[0].y) return anchors[0].s;
  for (let i = 0; i < anchors.length - 1; i++) {
    const A = anchors[i], B = anchors[i + 1];
    if (y >= A.y && y <= B.y) {
      const t = B.y === A.y ? 1 : (y - A.y) / (B.y - A.y), e = t * t * (3 - 2 * t);
      return { pos: lerp3(A.s.pos, B.s.pos, e), look: lerp3(A.s.look, B.s.look, e), roll: (A.s.roll || 0) + ((B.s.roll || 0) - (A.s.roll || 0)) * e };
    }
  }
  return anchors[anchors.length - 1].s;
}
const handlers = {
  public(p) {
    const w = $$('#postcard span'); w.forEach((s, i) => s.classList.toggle('on', p > 0.04 + i * 0.038));
    $$('#public .line').forEach(l => l.classList.toggle('on', p > +l.dataset.at));
  },
  markets(p, el) { const tr = $('#mtrack'); const max = Math.max(0, tr.scrollWidth - innerWidth); tr.style.transform = `translateX(${-p * max}px)`; },
  descend(p) { $$('#descend .steps li').forEach(li => li.classList.toggle('on', p > +li.dataset.at)); },
  flip(p, el) { el.style.setProperty('--p', Math.min(1, Math.max(0, (p - 0.15) / 0.6)).toFixed(3)); },
  how(p) { const tr = $('#howTrack'); const max = Math.max(0, tr.scrollWidth - innerWidth); tr.style.transform = `translateX(${-p * max}px)`; },
};
let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false; if (!entered) return;
    const y = scrollY, vh = innerHeight;
    for (const P of pins) {
      const p = Math.min(1, Math.max(0, (y - P.top) / Math.max(1, P.h - vh)));
      const f = handlers[P.el.id]; if (f && y > P.top - vh && y < P.top + P.h) f(p, P.el);
    }
    const s = camAt(y + vh * 0.5);
    if (s && world) world.setTarget(s.pos, s.look, s.roll);
    // the dip through the water tints the screen on the way over
    const roll = s ? Math.abs(s.roll || 0) : 0;
    $('#tide').style.opacity = (roll > 2 && roll < 178 ? Math.sin(roll * Math.PI / 180) * 0.85 : 0).toFixed(3);
    // keep the world running at full rate only where it is the scene
    let full = false; for (const el of $$('.pin')) { const r = el.getBoundingClientRect(); if (r.top < vh * 0.6 && r.bottom > vh * 0.4) { full = true; break; } }
    worldLevel = full ? 1 : 0.5;
    // nav state
    let cur = ''; for (const a of $$('#nav .links a')) { const t = $(a.getAttribute('href')); if (t) { const r = t.getBoundingClientRect(); if (r.top < vh * 0.5 && r.bottom > vh * 0.5) cur = a.getAttribute('href'); } }
    $$('#nav .links a').forEach(a => a.classList.toggle('act', a.getAttribute('href') === cur));
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { measure(); onScroll(); });
$('#toTop').addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });

// reveals: groups pop in one after another, headings decode as they arrive, hidden cells never sit still
stagger(['#sgrid', '.faq', '.kvwrap', '#go .center', '.rstats']);
$$('#hidden h2, #scan h2, #status h2, #faq h2, #clock h2, #ringlive h2, #hidden .eyebrow, #scan .eyebrow, #status .eyebrow, #faq .eyebrow, #clock .eyebrow, #ringlive .eyebrow, #ringlive .sub, #ringlive .rlist, #clock .note, #scan .sub, #scan .scanbox, #scan .link').forEach(el => el.classList.add('rv'));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { threshold: 0.15 });
$$('.rv').forEach(el => io.observe(el));
const dio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { decode(e.target); dio.unobserve(e.target); } }), { threshold: 0.55 });
$$('#site h2.pix:not(.words):not(#heroH), #site .eyebrow, .flipword span').forEach(el => dio.observe(el));
cipher($$('.tr .h').filter(c => c.textContent.trim() === 'Hidden'));
pointerLife();

// ---------- markets ----------
const CAT = { stock: 'Stock', index: 'Index', metal: 'Metal', fx: 'Currency', crypto: 'Crypto' };
let lastPx = {};
async function loadMarkets() {
  const st = $('#mstate');
  try {
    const j = await getJSON('/api/markets');
    const list = (j.markets || []).filter(m => m.price > 0);
    mkts = list; pcChips();
    if (world && world.setMarkets) world.setMarkets(list);
    if (!list.length) throw new Error('no prices');
    $('#mtrack').innerHTML = list.map(m => {
      const up = (m.ch24 || 0) >= 0, ch = m.ch24 == null ? '—' : (up ? '+' : '') + m.ch24.toFixed(2) + '%';
      return `<article class="mc" data-m="${m.mint}"><div class="cat">${CAT[m.cat] || m.cat}</div><div class="sym">${m.icon ? `<img src="${m.icon}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${m.sym}</div><div class="nm">${m.name}</div><div class="px">${fmt.usd(m.price)}</div><div class="ch ${m.ch24 == null ? '' : up ? 'up' : 'dn'}">${ch} <span style="color:var(--dim)">24h</span></div></article>`;
    }).join('');
    for (const m of list) { if (lastPx[m.mint] && lastPx[m.mint] !== m.price) { const c = $(`.mc[data-m="${m.mint}"]`); c && c.classList.add('flash'); } lastPx[m.mint] = m.price; }
    st.textContent = 'live · ' + list.length + ' markets'; st.className = 'mono state live';
    const sp = $('[data-k="prices"] .v'); if (sp) { sp.textContent = list.length + ' live'; sp.className = 'v mono ok'; }
    measure();
  } catch (e) {
    st.textContent = 'offline'; st.className = 'mono state off';
    if (!$('#mtrack .mc')) $('#mtrack').innerHTML = `<article class="mc msg"><div class="cat">Market data</div><p style="margin:10px 0 14px;color:var(--mute)">Prices could not be read from Jupiter right now.</p><button class="btn sm" id="mRetry">Retry</button></article>`;
    const r = $('#mRetry'); r && r.addEventListener('click', loadMarkets);
    const sp = $('[data-k="prices"] .v'); if (sp) { sp.textContent = 'offline'; sp.className = 'v mono bad'; }
  }
}
loadMarkets(); setInterval(() => { if (!document.hidden) loadMarkets(); }, 30000);

// ---------- write one: the same money as a public postcard and as a sealed one ----------
const PCPICK = ['NVDAx', 'TSLAx', 'SPYx', 'GLDx', 'EURC', 'cbBTC'];
function pcChips() {
  const have = PCPICK.filter(x => mkts.some(m => m.sym === x)), list = have.length ? have : mkts.slice(0, 6).map(m => m.sym);
  if (!list.includes(pcSym)) pcSym = list[0];
  $('#pcM').innerHTML = list.map(x => `<button type="button" data-s="${x}" class="${x === pcSym ? 'on' : ''}">${x}</button>`).join('');
  renderPc();
}
const tokAmt = x => x >= 1000 ? fmt.int(x) : x >= 1 ? (+x.toFixed(4)).toString() : x > 0 ? (+x.toPrecision(4)).toString() : '0';
function renderPc() {
  const m = mkts.find(x => x.sym === pcSym), addr = WS.state().address, from = addr ? fmt.short(addr) : 'your wallet';
  $('#pcFrom').textContent = from; $('#pcFrom2').textContent = from;
  $('#pcGot').textContent = m ? `${tokAmt(pcAmt / m.price)} ${m.sym}` : '—';
  $('#pcPaid').textContent = `${fmt.int(pcAmt)} USDC`;
  const when = solSlot ? `slot ${fmt.int(solSlot)}` : new Date().toTimeString().slice(0, 5);
  $('#pcWhen').textContent = when; $('#pcWhen2').textContent = when;
}
$('#pcM').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; pcSym = b.dataset.s; $$('#pcM button').forEach(x => x.classList.toggle('on', x === b)); renderPc(); });
$('#pcA').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; pcAmt = +b.dataset.a; $$('#pcA button').forEach(x => x.classList.toggle('on', x === b)); renderPc(); });
$('#pcMode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; $$('#pcMode button').forEach(x => x.classList.toggle('on', x === b)); $('#pc').classList.toggle('ring', b.dataset.mode === 'ring'); });
$('#pc').addEventListener('click', () => { const ring = !$('#pc').classList.contains('ring'); $('#pc').classList.toggle('ring', ring); $$('#pcMode button').forEach(x => x.classList.toggle('on', (x.dataset.mode === 'ring') === ring)); });
WS.onChange(renderPc);
cipher($$('.pc .back b.h'));

// ---------- live status ----------
const status = async () => { const j = await loadStatus(); if (j && j.slot) { solSlot = j.slot; renderPc(); } };
status(); setInterval(() => { if (!document.hidden) status(); }, 20000);

// ---------- around the clock: six exchanges in their own local time, and Solana, which never closes ----------
const EX = [
  { city: 'New York', ex: 'NYSE · Nasdaq', tz: 'America/New_York', s: [[570, 960]] },
  { city: 'London', ex: 'LSE', tz: 'Europe/London', s: [[480, 990]] },
  { city: 'Frankfurt', ex: 'Xetra', tz: 'Europe/Berlin', s: [[540, 1050]] },
  { city: 'Tokyo', ex: 'TSE', tz: 'Asia/Tokyo', s: [[540, 690], [750, 930]] },
  { city: 'Hong Kong', ex: 'HKEX', tz: 'Asia/Hong_Kong', s: [[570, 720], [780, 960]] },
  { city: 'Sydney', ex: 'ASX', tz: 'Australia/Sydney', s: [[600, 960]] },
];
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmts = {};
function localAt(tz, d) {
  const f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { wd: WD[p.weekday], min: +p.hour * 60 + +p.minute + +p.second / 60, txt: `${p.hour}:${p.minute}:${p.second}` };
}
const span = m => m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor(m % 1440 / 60)}h` : `${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`;
function session(e, L) {
  const wk = L.wd >= 1 && L.wd <= 5;
  if (wk) for (const [a, b] of e.s) if (L.min >= a && L.min < b) return { open: true, left: b - L.min };
  if (wk) for (const [a] of e.s) if (L.min < a) return { open: false, left: a - L.min };
  let days = 1; while ((L.wd + days) % 7 === 0 || (L.wd + days) % 7 === 6) days++;
  return { open: false, left: days * 1440 - L.min + e.s[0][0] };
}
const cells = () => Array.from({ length: 48 }, () => '<i></i>').join('');
$('#clocks').innerHTML = EX.map((e, i) => `<article class="ck spot" data-i="${i}"><span class="city">${e.city}</span><span class="ex">${e.ex}</span><b class="tm">--:--:--</b><span class="st"><i></i><em>—</em></span><span class="in"></span><div class="day">${cells()}</div></article>`).join('')
  + `<article class="ck sol spot"><span class="city">Solana</span><span class="ex">xStocks, gold, the euro, crypto</span><b class="tm" id="solTm">--:--:--</b><span class="st"><i></i><em>always open</em></span><span class="in" id="solIn">every day, every hour</span><div class="day">${cells()}</div></article>`;
function tickClocks() {
  const d = new Date();
  $$('#clocks .ck[data-i]').forEach(el => {
    const e = EX[+el.dataset.i], L = localAt(e.tz, d), st = session(e, L), wk = L.wd >= 1 && L.wd <= 5;
    el.classList.toggle('open', st.open);
    el.querySelector('.tm').textContent = L.txt;
    el.querySelector('.st em').textContent = st.open ? 'open' : 'closed';
    el.querySelector('.in').textContent = (st.open ? 'closes in ' : 'opens in ') + span(st.left);
    const now = Math.floor(L.min / 30);
    el.querySelectorAll('.day i').forEach((c, k) => { c.className = (wk && e.s.some(([a, b]) => k * 30 < b && k * 30 + 30 > a) ? 't' : '') + (k === now ? ' now' : ''); });
  });
  const u = localAt('UTC', d); $('#solTm').textContent = u.txt + ' UTC';
  $('#solIn').textContent = solSlot ? `slot ${fmt.int(solSlot)}, every day, every hour` : 'every day, every hour';
  const nowU = Math.floor(u.min / 30); $$('#clocks .sol .day i').forEach((c, k) => { c.className = k === nowU ? 'now' : ''; });
}
stagger(['#clocks']); $$('#clocks .ck').forEach(el => io.observe(el));
tickClocks(); setInterval(() => { if (!document.hidden) tickClocks(); }, 1000);

// ---------- the Ring, live: what the chain shows of the latest transactions on the program ----------
const seen = new Set(); let ringLatest = null;
const ago = t => { const d = Math.max(0, Math.floor(Date.now() / 1000 - t)); return d < 60 ? d + 's ago' : d < 3600 ? Math.floor(d / 60) + 'm ago' : d < 86400 ? Math.floor(d / 3600) + 'h ago' : Math.floor(d / 86400) + 'd ago'; };
async function loadRing() {
  try {
    const j = await getJSON('/api/ring', 12000);
    countTo($('#rHour'), j.hour || 0, n => fmt.int(n)); countTo($('#rDay'), j.day || 0, n => fmt.int(n) + (j.capped ? '+' : ''));
    const first = seen.size === 0, last = j.last || [];
    $('#rList').innerHTML = last.map(x => `<a class="rtx${!first && !seen.has(x.sig) ? ' new' : ''}" href="https://solscan.io/tx/${x.sig}" target="_blank" rel="noopener"><i class="dot"></i><span class="sig mono">${x.sig.slice(0, 6)}…${x.sig.slice(-6)}</span><span class="ago mono" data-t="${x.t || ''}">${x.t ? ago(x.t) : '—'}</span><span class="go">↗</span></a>`).join('') || '<div class="ph mono">No transactions in the latest read.</div>';
    last.forEach(x => seen.add(x.sig)); ringLatest = last[0] && last[0].t;
    $('#rLast').textContent = ringLatest ? ago(ringLatest) : '—';
  } catch (e) {
    $('#rList').innerHTML = '<div class="ph mono">The Ring could not be read right now. <button class="btn sm" id="rRetry" type="button">Retry</button></div>';
    const r = $('#rRetry'); r && r.addEventListener('click', loadRing);
  }
}
loadRing(); setInterval(() => { if (!document.hidden) loadRing(); }, 20000);
setInterval(() => { if (document.hidden) return; if (ringLatest) $('#rLast').textContent = ago(ringLatest); $$('#rList .ago[data-t]').forEach(a => { if (a.dataset.t) a.textContent = ago(+a.dataset.t); }); }, 1000);

// ---------- the section menu on narrow screens ----------
$('#menuBtn').addEventListener('click', e => { e.stopPropagation(); const o = $('#sheet').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', o ? 'true' : 'false'); });
$('#sheet').addEventListener('click', e => { if (e.target.closest('a')) { $('#sheet').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('click', e => { if (!e.target.closest('#sheet')) $('#sheet').classList.remove('open'); });

// ---------- scan ----------
const runScan = addr => scanInto(addr, $('#scanOut'));
$('#scanForm').addEventListener('submit', e => { e.preventDefault(); runScan($('#scanIn').value); });
$('#scanMine').addEventListener('click', e => { e.stopPropagation(); const a = WS.state().address; if (!a) { $('#nConnect').click(); return; } $('#scanIn').value = a; runScan(a); });

// app links leave with the pixel wipe
$$('a[href="/app"],a[href^="/app#"]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); wipeTo(a.getAttribute('href')); }));
window.__home = { measure, camAt, enter };
// deep links and ?in skip the gate
if (Q.has('in') || location.hash.length > 1) { if (world) world.setShot('hero', true); openSite(true); if (location.hash.length > 1) setTimeout(() => { const t = $(location.hash); t && t.scrollIntoView(); }, 60); }
setTimeout(() => { measure(); onScroll(); }, 300);
