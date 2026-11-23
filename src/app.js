// WRLD app: buy the world through Jupiter with your own wallet, derive your private wallet from one signature,
// check the registry, scan any address and watch the live checks. Nothing here holds or sends your funds for you.
import * as WS from './wallet.js';
import { fmt, getJSON, wipeIn, wipeTo } from './fx.js';
import { walletMenu, closeMenusOnOutside, runScan, loadStatus, b58, esc } from './shared.js';
import { pointerLife, decode } from './alive.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
wipeIn();

// ---------- tabs ----------
const TABS = ['markets', 'private', 'scan', 'live'];
let liveTimer = null;
function show(tab, push) {
  if (!TABS.includes(tab)) tab = 'markets';
  $$('.tabs [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === tab));
  if (push) history.replaceState(null, '', '#' + tab);
  const h = $(`.pane[data-pane="${tab}"] h1`); if (h) { delete h.dataset.dec; decode(h, 700); }
  clearInterval(liveTimer);
  if (tab === 'live') { loadStatus(); liveTimer = setInterval(() => { if (!document.hidden) loadStatus(); }, 20000); }
}
$$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => show(b.dataset.tab, true)));
addEventListener('hashchange', () => show(location.hash.slice(1)));

// ---------- wallet ----------
walletMenu($('#conn'), $('#connMenu'), $('#conn'), { onScan: a => { show('scan', true); $('#scanIn').value = a; runScan(a, $('#scanOut')); } });
closeMenusOnOutside();
const openWallet = () => setTimeout(() => $('#conn').click(), 0);

// ---------- markets ----------
const SOL = 'So11111111111111111111111111111111111111112', USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAY = { SOL: { mint: SOL, dec: 9, sym: 'SOL' }, USDC: { mint: USDC, dec: 6, sym: 'USDC' } };
const CAT = { stock: 'Stocks', index: 'Index', metal: 'Metals', fx: 'Currencies', crypto: 'Crypto' };
let markets = [], sel = null, side = 'buy', pay = 'SOL', filter = 'all', quote = null, qAt = 0, qSeq = 0, busy = false, qErr = '';

async function loadMarkets() {
  try {
    const j = await getJSON('/api/markets');
    const list = (j.markets || []).filter(m => m.price > 0 && m.mint);
    if (!list.length) throw new Error('no prices');
    const prev = Object.fromEntries(markets.map(m => [m.mint, m.price]));
    markets = list;
    renderFilters(); renderList(prev);
    const sp = $('[data-k="prices"] .v'); if (sp) { sp.textContent = list.length + ' live'; sp.className = 'v mono ok'; }
    if (sel) { const m = markets.find(x => x.mint === sel.mint); if (m) { sel = m; renderSel(); } }
    else pick(markets[0], false);
  } catch (e) {
    const sp = $('[data-k="prices"] .v'); if (sp) { sp.textContent = 'offline'; sp.className = 'v mono bad'; }
    if (!markets.length) $('#mlist').innerHTML = `<div class="ph mono">Prices could not be read from Jupiter right now. <button class="btn sm" id="mRetry">Retry</button></div>`;
    const r = $('#mRetry'); r && r.addEventListener('click', loadMarkets);
  }
}
function renderFilters() {
  const cats = ['all', ...new Set(markets.map(m => m.cat))];
  $('#mfilt').innerHTML = cats.map(c => `<button class="${c === filter ? 'on' : ''}" data-f="${c}">${c === 'all' ? 'All' : CAT[c] || c}</button>`).join('');
}
$('#mfilt').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; renderFilters(); renderList(); });
function renderList(prev = {}) {
  const rows = markets.filter(m => filter === 'all' || m.cat === filter);
  $('#mlist').innerHTML = rows.map(m => {
    const up = (m.ch24 || 0) >= 0, ch = m.ch24 == null ? '—' : (up ? '+' : '') + m.ch24.toFixed(2) + '%';
    const moved = prev[m.mint] && prev[m.mint] !== m.price ? (m.price > prev[m.mint] ? ' tick-up' : ' tick-dn') : '';
    return `<button class="mrow spot${sel && sel.mint === m.mint ? ' on' : ''}${moved}" data-m="${m.mint}" type="button">
      <span class="ico">${m.icon ? `<img src="${esc(m.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<i>${esc(m.sym[0])}</i></span>
      <span class="nm"><b class="pix">${esc(m.sym)}</b><small>${esc(m.name)}</small></span>
      <span class="px mono">${fmt.usd(m.price)}</span><span class="ch mono ${m.ch24 == null ? '' : up ? 'up' : 'dn'}">${ch}</span></button>`;
  }).join('') || '<div class="ph mono">Nothing in this group right now.</div>';
}
$('#mlist').addEventListener('click', e => { const b = e.target.closest('.mrow'); if (!b) return; const m = markets.find(x => x.mint === b.dataset.m); if (m) pick(m, true); });
function pick(m, scroll) {
  sel = m;
  if (sel.mint === PAY[pay].mint) pay = pay === 'SOL' ? 'USDC' : 'SOL';
  $$('#mlist .mrow').forEach(r => r.classList.toggle('on', r.dataset.m === m.mint));
  renderSel(); requote();
  if (scroll && innerWidth < 900) $('#trade').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderSel() {
  $('#tSym').textContent = sel ? sel.sym : '—';
  $('#tPx').textContent = sel ? fmt.usd(sel.price) : '';
  $('#tPayL').textContent = side === 'buy' ? `Pay with` : `Sell ${sel ? sel.sym : ''}, receive`;
  $('#tAmt').placeholder = side === 'buy' ? `0.00 ${pay}` : `0.00 ${sel ? sel.sym : ''}`;
  $$('#tPay [data-pay]').forEach(b => { b.classList.toggle('on', b.dataset.pay === pay); b.disabled = !!(sel && PAY[b.dataset.pay].mint === sel.mint); });
  $$('.tside [data-side]').forEach(b => b.classList.toggle('on', b.dataset.side === side));
  renderBal(); goState();
}
// ---------- what the connected wallet holds: shown under the amount, and Max fills it in ----------
let hold = null, holdFor = null;
const USDC_M = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
function have() {
  if (!hold || !sel) return null;
  if (side === 'sell') return { amt: hold.tokens[sel.mint] || 0, sym: sel.sym };
  if (pay === 'SOL') return { amt: hold.sol, sym: 'SOL', keep: 0.02 };
  return { amt: hold.tokens[USDC_M] || 0, sym: 'USDC' };
}
function renderBal() {
  const h = have(), box = $('#tBal');
  if (!h) { box.hidden = true; return; }
  box.hidden = false; $('#tBalTxt').textContent = `In your wallet: ${h.amt >= 1000 ? fmt.int(h.amt) : (+h.amt.toFixed(4)).toString()} ${h.sym}`;
  $('#tMax').disabled = !(h.amt - (h.keep || 0) > 0);
}
async function loadHold() {
  const a = WS.state().address; if (!a) { hold = null; holdFor = null; renderBal(); return; }
  try { const j = await getJSON('/api/holdings?addr=' + a, 12000); if (WS.state().address === a) { hold = j; holdFor = a; renderBal(); } } catch (e) { hold = null; renderBal(); }
}
$('#tMax').addEventListener('click', () => { const h = have(); if (!h) return; const v = Math.max(0, h.amt - (h.keep || 0)); $('#tAmt').value = v >= 1 ? (+v.toFixed(6)).toString() : (+v.toPrecision(6)).toString(); $('#tAmt').dispatchEvent(new Event('input')); });
$$('.tside [data-side]').forEach(b => b.addEventListener('click', () => { side = b.dataset.side; $('#tAmt').value = ''; quote = null; renderSel(); requote(); }));
$$('#tPay [data-pay]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; pay = b.dataset.pay; renderSel(); requote(); }));
let qTimer = null;
$('#tAmt').addEventListener('input', () => { const v = $('#tAmt').value.replace(',', '.').replace(/[^0-9.]/g, ''); if (v !== $('#tAmt').value) $('#tAmt').value = v; clearTimeout(qTimer); qTimer = setTimeout(requote, 380); quote = null; goState(); });

const amt = x => x >= 1000 ? fmt.big(x) : x >= 1 ? (+x.toFixed(4)).toString() : x > 0 ? (+x.toPrecision(4)).toString() : '0';
const amountRaw = () => {
  const v = parseFloat($('#tAmt').value); if (!(v > 0) || !sel) return null;
  const dec = side === 'buy' ? PAY[pay].dec : (sel.decimals != null ? sel.decimals : 8);
  const raw = BigInt(Math.floor(v * 10 ** Math.min(dec, 9))) * 10n ** BigInt(Math.max(0, dec - 9));
  return raw > 0n ? raw : null;
};
async function requote() {
  const raw = amountRaw(); const my = ++qSeq; quote = null; qErr = '';
  if (!raw) { $('#tQuote').innerHTML = sel ? 'Enter an amount for a live quote.' : 'Pick a market.'; goState(); return; }
  const inM = side === 'buy' ? PAY[pay].mint : sel.mint, outM = side === 'buy' ? sel.mint : PAY[pay].mint;
  $('#tQuote').innerHTML = '<span class="dots">Getting a live quote</span>'; goState(true);
  try {
    const q = await getJSON(`/api/quote?in=${inM}&out=${outM}&amount=${raw}&slip=100`, 12000);
    if (my !== qSeq) return;
    if (!q || !q.outAmount) throw new Error(q && q.error || 'no route');
    quote = q; qAt = Date.now();
    const outDec = side === 'buy' ? (sel.decimals != null ? sel.decimals : 8) : PAY[pay].dec, outSym = side === 'buy' ? sel.sym : pay;
    const out = Number(q.outAmount) / 10 ** outDec, min = Number(q.otherAmountThreshold || q.outAmount) / 10 ** outDec;
    const imp = q.priceImpactPct != null ? (Number(q.priceImpactPct) * 100) : null;
    const route = [...new Set((q.routePlan || []).map(r => r.swapInfo && r.swapInfo.label).filter(Boolean))].slice(0, 3).join(' → ');
    $('#tQuote').innerHTML = `<div class="qrow"><span>You get about</span><b>${amt(out)} ${esc(outSym)}</b></div>
      <div class="qrow"><span>At least</span><em>${amt(min)} ${esc(outSym)}</em></div>
      ${imp != null ? `<div class="qrow"><span>Price impact</span><em class="${imp > 1 ? 'warn' : ''}">${imp < 0.01 ? '<0.01' : imp.toFixed(2)}%</em></div>` : ''}
      ${route ? `<div class="qrow"><span>Route</span><em>${esc(route)}</em></div>` : ''}`;
  } catch (e) {
    if (my !== qSeq) return;
    qErr = String(e.message || e);
    $('#tQuote').innerHTML = `<span class="bad">No route for this amount right now.</span> <small>${esc(qErr.slice(0, 80))}</small>`;
  }
  goState();
}
setInterval(() => { if (quote && !busy && !document.hidden && Date.now() - qAt > 15000) requote(); }, 5000);
function goState(loading) {
  const b = $('#tGo'), addr = WS.state().address;
  b.classList.toggle('gold', true);
  if (busy) return;
  if (!addr) { b.disabled = false; b.textContent = 'Connect a wallet to trade'; b.dataset.act = 'connect'; return; }
  b.dataset.act = '';
  if (!sel) { b.disabled = true; b.textContent = 'Pick a market'; return; }
  if (!amountRaw()) { b.disabled = true; b.textContent = 'Enter an amount'; return; }
  if (loading || (!quote && !qErr)) { b.disabled = true; b.textContent = 'Getting a quote…'; return; }
  if (!quote) { b.disabled = true; b.textContent = 'No route'; return; }
  b.disabled = false; b.textContent = `${side === 'buy' ? 'Buy' : 'Sell'} ${sel.sym}`; b.dataset.act = 'swap';
}
$('#tGo').addEventListener('click', async e => {
  e.stopPropagation();
  const b = $('#tGo');
  if (b.dataset.act === 'connect') return openWallet();
  if (b.dataset.act !== 'swap' || busy) return;
  const res = $('#tRes');
  busy = true; b.disabled = true;
  try {
    if (Date.now() - qAt > 20000) { busy = false; await requote(); busy = true; if (!quote) throw new Error('The quote expired and no new route came back'); }
    b.textContent = 'Building the transaction…';
    const r = await fetch('/api/swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote, user: WS.state().address }) }).then(r => r.json());
    if (!r.tx) throw new Error(r.error || 'No transaction came back');
    const bytes = Uint8Array.from(atob(r.tx), c => c.charCodeAt(0));
    b.textContent = 'Check your wallet…';
    const out = await WS.signAndSend(bytes);
    let sig = out.signature ? (typeof out.signature === 'string' ? out.signature : b58(out.signature)) : null;
    if (!sig) {
      b.textContent = 'Sending…';
      let bin = ''; for (const x of out.signed) bin += String.fromCharCode(x);
      const s = await fetch('/api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tx: btoa(bin) }) }).then(r => r.json());
      if (!s.signature) throw new Error(s.error || 'The network did not accept it');
      sig = s.signature;
    }
    res.className = 'tres mono ok';
    res.innerHTML = `Sent. <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">View on Solscan ↗</a><br><span>To hide it from here on, move it into your private balance.</span>`;
    $('#tAmt').value = ''; quote = null;
    setTimeout(loadHold, 6000); setTimeout(loadHold, 20000);
  } catch (err) {
    res.className = 'tres mono bad';
    res.textContent = /reject|denied|cancel/i.test(String(err.message || err)) ? 'You cancelled it in your wallet. Nothing was sent.' : 'Not sent: ' + String(err.message || err).slice(0, 140);
  }
  busy = false; goState();
});

// ---------- private ----------
let cfg = { relay: false }, privAddr = null;
const privKey = a => 'wrld:p:' + a;
function renderPriv() {
  const addr = WS.state().address, d = $('#derive'), box = $('#pAddr');
  if (!addr) { d.disabled = false; d.textContent = 'Connect a wallet first'; d.dataset.act = 'connect'; box.hidden = true; $('#regState').textContent = '—'; $('#regState').className = 'stat mono'; }
  else {
    try { privAddr = sessionStorage.getItem(privKey(addr)); } catch (e) { privAddr = null; }
    d.dataset.act = 'derive'; d.disabled = false; d.textContent = privAddr ? 'Derive it again' : 'Derive my private wallet';
    d.classList.toggle('gold', !privAddr);
    if (privAddr) { box.hidden = false; box.innerHTML = `<span>Your private address</span><b>${privAddr}</b><button class="btn sm" id="pCopy" type="button">Copy</button>`; }
    else box.hidden = true;
  }
  const open = !!cfg.relay && !!addr && !!privAddr;
  $('#register').disabled = !open; $$('[data-op]').forEach(b => { b.disabled = !open; });
  $$('[data-relay]').forEach(n => { n.textContent = cfg.relay ? (addr && privAddr ? '' : 'Derive your private wallet first.') : 'Opens once the private moves relay is set.'; n.hidden = !n.textContent; });
}
$('#pAddr').addEventListener('click', async e => { if (e.target.id !== 'pCopy') return; try { await navigator.clipboard.writeText(privAddr); e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = 'Copy'; }, 1400); } catch (err) {} });
$('#derive').addEventListener('click', async e => {
  e.stopPropagation();
  const d = $('#derive');
  if (d.dataset.act === 'connect') return openWallet();
  const addr = WS.state().address; if (!addr) return;
  d.disabled = true; d.textContent = 'Loading Privacy Rings…';
  try {
    const url = '/assets/js/rings.js';
    const R = await import(url);
    d.textContent = 'Sign the message in your wallet…';
    const sig = await WS.signMessage(R.derivationMessage(addr));
    d.textContent = 'Deriving in this tab…';
    const priv = await R.derivePrivateWallet(addr, sig);
    sig.fill && sig.fill(0);
    try { sessionStorage.setItem(privKey(addr), priv); } catch (err) {}
    renderPriv(); checkRegistry();
  } catch (err) {
    renderPriv();
    const box = $('#pAddr'); box.hidden = false;
    box.innerHTML = `<span class="bad">${/reject|denied|cancel/i.test(String(err.message || err)) ? 'You cancelled the signature. Nothing was derived.' : esc('Could not derive: ' + String(err.message || err).slice(0, 140))}</span>`;
  }
});
async function checkRegistry() {
  const addr = WS.state().address, el = $('#regState');
  if (!addr) { el.textContent = '—'; el.className = 'stat mono'; return; }
  el.textContent = 'checking…'; el.className = 'stat mono';
  try {
    const j = await getJSON('/api/registered?addr=' + addr);
    if (WS.state().address !== addr) return;
    el.textContent = j.registered ? 'Published on the registry' : 'Not published yet'; el.className = 'stat mono ' + (j.registered ? 'ok' : 'wait');
  } catch (e) { el.textContent = 'Could not check right now'; el.className = 'stat mono bad'; }
}
const pmsg = $('#pMsg');
$$('[data-op], #register').forEach(b => b.addEventListener('click', () => { if (pmsg) { pmsg.hidden = false; pmsg.textContent = 'Private moves are being tested on mainnet before they open here.'; } }));
getJSON('/api/config').then(c => { cfg = c || cfg; renderPriv(); }).catch(() => renderPriv());

// ---------- scan ----------
$('#scanForm').addEventListener('submit', e => { e.preventDefault(); runScan($('#scanIn').value, $('#scanOut')); });
$('#scanMine').addEventListener('click', e => { e.stopPropagation(); const a = WS.state().address; if (!a) return openWallet(); $('#scanIn').value = a; runScan(a, $('#scanOut')); });

// ---------- the Ring, live: a line on the private tab and three cards on the live tab ----------
const ago = t => { const d = Math.max(0, Math.floor(Date.now() / 1000 - t)); return d < 60 ? d + 's ago' : d < 3600 ? Math.floor(d / 60) + 'm ago' : d < 86400 ? Math.floor(d / 3600) + 'h ago' : Math.floor(d / 86400) + 'd ago'; };
let ringT = null;
async function loadRing() {
  const set = (k, txt, cls) => { const v = $(`[data-k="${k}"] .v`); if (v) { v.textContent = txt; v.className = 'v mono ' + cls; } };
  try {
    const j = await getJSON('/api/ring', 12000);
    ringT = j.last && j.last[0] ? j.last[0].t : null;
    set('ringh', fmt.int(j.hour || 0), 'ok'); set('ringd', fmt.int(j.day || 0) + (j.capped ? '+' : ''), 'ok'); set('ringl', ringT ? ago(ringT) : '—', 'ok');
    const l = $('#ringLine'); l.innerHTML = `<i></i><span>The Ring right now: ${fmt.int(j.hour || 0)} transactions in the last hour${ringT ? `, the latest <b id="ringAgo">${ago(ringT)}</b>` : ''}.</span>`;
  } catch (e) { set('ringh', 'offline', 'bad'); set('ringd', 'offline', 'bad'); set('ringl', 'offline', 'bad'); $('#ringLine').textContent = ''; }
}
loadRing(); setInterval(() => { if (!document.hidden) loadRing(); }, 20000);
setInterval(() => { if (document.hidden || !ringT) return; const a = $('#ringAgo'); if (a) a.textContent = ago(ringT); const v = $('[data-k="ringl"] .v'); if (v && v.classList.contains('ok')) v.textContent = ago(ringT); }, 1000);

// ---------- start ----------
WS.onChange(() => { renderSel(); renderPriv(); checkRegistry(); if (WS.state().address !== holdFor) loadHold(); });
show(location.hash.slice(1) || 'markets');
loadMarkets(); setInterval(() => { if (!document.hidden) loadMarkets(); }, 30000);
renderSel(); renderPriv();
WS.reconnect();
pointerLife();
$$('a[href^="/?"],a[href="/"]').forEach(a => a.addEventListener('click', ev => { if (ev.metaKey || ev.ctrlKey) return; ev.preventDefault(); wipeTo(a.getAttribute('href')); }));
window.__app = { show, pick: sym => { const m = markets.find(x => x.sym === sym); m && pick(m); } };
