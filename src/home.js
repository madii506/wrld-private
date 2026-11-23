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

// ---------- the world ----------
let world = null, worldLevel = 1, enterHover = false;
if (!Q.has('noworld')) {
  try { world = startWorld($('#world'), { startShot: Q.get('shot') || 'gate', active: () => worldLevel, hoverEnter: () => enterHover }); window.__w = world; }
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
  const flash = $('#flash');
  let done = false;
  const finish = () => { if (done) return; done = true; flash.classList.remove('on'); openSite(true); };
  if (!world || reduce) return finish();
  world.enter({ onFlash: () => flash.classList.add('on'), onDone: () => setTimeout(finish, 80) });
  setTimeout(finish, 4800);                                         // never strand anyone on the gate
}
$('#gEnter').addEventListener('click', enter);
$('#gEnter').addEventListener('pointerenter', () => { enterHover = true; });
$('#gEnter').addEventListener('pointerleave', () => { enterHover = false; });
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
stagger(['#sgrid', '.faq', '.kvwrap', '#go .center']);
$$('#hidden h2, #scan h2, #status h2, #faq h2, #hidden .eyebrow, #scan .eyebrow, #status .eyebrow, #faq .eyebrow, #scan .sub, #scan .scanbox, #scan .link').forEach(el => el.classList.add('rv'));
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

// ---------- live status ----------
loadStatus(); setInterval(() => { if (!document.hidden) loadStatus(); }, 20000);

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
