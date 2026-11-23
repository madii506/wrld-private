// Pieces the home page and the app share: the wallet menu, the chain scan and the live checks.
import * as WS from './wallet.js';
import { fmt, getJSON, countTo } from './fx.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const A58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58(bytes) {
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ''; while (n > 0n) { s = A58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
  return s;
}
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- the wallet menu: detected wallets first, then install or open-in-app links ----------
export function walletMenu(btn, menu, chip, opts = {}) {
  const render = () => {
    const st = WS.state(), inst = WS.list();
    if (st.address) {
      menu.innerHTML = `<div class="h">Connected · ${esc(st.wallet.name)}</div><div class="addr">${st.address}</div>
        <button data-a="copy"><span class="ic">⧉</span>Copy address</button>${opts.privateHref ? `<a href="${opts.privateHref}"><span class="ic">◐</span>Open your private wallet</a>` : ''}${opts.onScan ? '<button data-a="scan"><span class="ic">◎</span>Scan this wallet</button>' : ''}<button data-a="off"><span class="ic">×</span>Disconnect</button>`;
    } else {
      const names = new Set(inst.map(w => w.name));
      const rows = inst.map(w => `<button data-w="${esc(w.name)}"><span class="ic">${w.icon ? `<img src="${w.icon}" alt="">` : esc(w.name[0])}</span>${esc(w.name)}<span class="tag">detected</span></button>`);
      for (const k of WS.KNOWN) if (!names.has(k.name)) {
        const mobileDeep = /Android|iPhone|iPad/i.test(navigator.userAgent) && k.deep;
        rows.push(`<a href="${mobileDeep ? k.deep(location.href) : k.url}" target="_blank" rel="noopener"><span class="ic">${k.name[0]}</span>${k.name}<span class="tag">${mobileDeep ? 'open in app' : 'install'}</span></a>`);
      }
      menu.innerHTML = `<div class="h">Connect a wallet</div>${rows.join('')}`;
    }
    if (chip) { const s = chip.querySelector('span'); chip.classList.toggle('on', !!st.address); s.textContent = st.address ? fmt.short(st.address) : 'Connect'; }
    else btn.textContent = st.address ? fmt.short(st.address) : 'Connect';
  };
  btn.addEventListener('click', e => { e.stopPropagation(); render(); $$('.wmenu.open').forEach(m => m !== menu && m.classList.remove('open')); menu.classList.toggle('open'); });
  menu.addEventListener('click', async e => {
    e.stopPropagation();
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.w) { b.lastChild.textContent = 'connecting…'; try { await WS.connect(b.dataset.w); menu.classList.remove('open'); } catch (err) { b.lastChild.textContent = String(err.message || err).slice(0, 40); return; } }
    if (b.dataset.a === 'copy') { try { await navigator.clipboard.writeText(WS.state().address); b.lastChild.textContent = 'Copied'; } catch (e2) {} return; }
    if (b.dataset.a === 'off') { await WS.disconnect(); menu.classList.remove('open'); }
    if (b.dataset.a === 'scan') { menu.classList.remove('open'); opts.onScan(WS.state().address); }
    render();
  });
  WS.onChange(render); render();
  return render;
}
let menusWired = false;
export function closeMenusOnOutside() {
  if (menusWired) return; menusWired = true;
  document.addEventListener('click', () => $$('.wmenu.open').forEach(m => m.classList.remove('open')));
  addEventListener('keydown', e => { if (e.key === 'Escape') $$('.wmenu.open').forEach(m => m.classList.remove('open')); });
}

// ---------- scan: what the chain already knows about an address ----------
export async function runScan(addr, out) {
  addr = (addr || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) { out.innerHTML = '<div class="ph mono">That is not a Solana address.</div>'; return; }
  out.innerHTML = '<div class="ph mono scanning">Reading the chain<i></i></div>';
  try {
    const j = await getJSON('/api/scan?addr=' + addr, 15000);
    const first = j.firstSeen ? new Date(j.firstSeen * 1000).toISOString().slice(0, 10) : '—';
    out.innerHTML = `<div class="kv">
      <div><span>Visible value</span><b data-c="usd">$0</b></div><div><span>SOL</span><b>${fmt.sol(j.sol || 0)}</b></div>
      <div><span>Tokens held</span><b>${j.tokens}</b></div><div><span>Transactions${j.txCapped ? ' (last 1,000)' : ''}</span><b>${fmt.int(j.txs)}</b></div>
      <div><span>Oldest seen</span><b style="font-size:16px">${first}</b></div><div><span>Priced holdings</span><b>${(j.top || []).length}</b></div></div>
      <div class="hold">${(j.top || []).map(t => `<div><span>${esc(t.sym)}</span><em>${fmt.big(t.amount)}</em><span>${t.usd != null ? fmt.usd(t.usd) : '—'}</span></div>`).join('') || '<div><span>No priced tokens</span><em></em><span></span></div>'}</div>
      <div class="verdict">All of this is readable by anyone, right now. Inside the Ring, balances and what you send are encrypted.</div>`;
    countTo(out.querySelector('[data-c="usd"]'), j.usd || 0, v => '$' + fmt.int(v));
    return j;
  } catch (e) { out.innerHTML = `<div class="ph mono">Could not read the chain (${esc(String(e.message || e).slice(0, 60))}). Try again.</div>`; }
}

// ---------- live checks from Solana mainnet ----------
export async function loadStatus() {
  const set = (k, txt, cls, small) => { const c = $(`[data-k="${k}"]`); if (!c) return; const v = c.querySelector('.v'); v.textContent = txt; v.className = 'v mono ' + cls; let sm = c.querySelector('small'); if (small) { if (!sm) { sm = document.createElement('small'); c.appendChild(sm); } sm.textContent = small; } };
  try {
    const j = await getJSON('/api/status');
    for (const k of ['ring', 'registry', 'tree']) { const a = j[k] || {}; set(k, a.ok ? 'live on mainnet' : 'not found', a.ok ? 'ok' : 'bad', a.address ? fmt.short(a.address) : ''); }
    if (j.slot) {
      set('slot', fmt.int(j.slot), 'ok', 'read just now');
      const v = $('[data-k="slot"] .v');
      if (v) { if (v.dataset.v) { v.textContent = fmt.int(+v.dataset.v); countTo(v, j.slot, n => fmt.int(Math.round(n)), 1600); } else v.dataset.v = j.slot; }
    }
    set('relay', j.relay ? 'open' : 'not set yet', j.relay ? 'ok' : 'wait', j.relay ? 'deposits and private sends are open' : 'private moves open once the relay is set');
    return j;
  } catch (e) { for (const k of ['ring', 'registry', 'tree', 'slot', 'relay']) set(k, 'offline', 'bad'); }
}
