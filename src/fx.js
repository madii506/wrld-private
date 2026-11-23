// shared bits: the pixel wipe between pages, number formatting, count-ups
export function wipeTo(href) {
  const w = document.getElementById('wipe');
  if (!w || matchMedia('(prefers-reduced-motion: reduce)').matches) { location.href = href; return; }
  const cols = Math.ceil(innerWidth / 64), rows = Math.ceil(innerHeight / 64);
  w.style.gridTemplateColumns = `repeat(${cols},1fr)`; w.style.gridTemplateRows = `repeat(${rows},1fr)`;
  w.innerHTML = '';
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = document.createElement('i');
    // the wipe sweeps from the bottom left to the top right, corner to corner
    const d = ((c / cols) + (1 - r / rows)) / 2;
    i.style.transitionDelay = (d * 420 + Math.random() * 120).toFixed(0) + 'ms';
    w.appendChild(i); cells.push(i);
  }
  w.style.pointerEvents = 'auto';
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('on')));
  try { sessionStorage.setItem('wrld:wipe', '1'); } catch (e) {}
  setTimeout(() => { location.href = href; }, 820);
}
export function wipeIn() {
  let came = false; try { came = sessionStorage.getItem('wrld:wipe') === '1'; sessionStorage.removeItem('wrld:wipe'); } catch (e) {}
  const w = document.getElementById('wipe');
  if (!w || !came || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cols = Math.ceil(innerWidth / 64), rows = Math.ceil(innerHeight / 64);
  w.style.gridTemplateColumns = `repeat(${cols},1fr)`; w.style.gridTemplateRows = `repeat(${rows},1fr)`;
  w.innerHTML = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = document.createElement('i'); i.style.transform = 'scale(1.02)';
    const d = ((c / cols) + (1 - r / rows)) / 2;
    i.style.transitionDelay = (d * 460 + Math.random() * 140).toFixed(0) + 'ms';
    w.appendChild(i);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { for (const i of w.children) i.style.transform = 'scale(0)'; }));
  setTimeout(() => { w.innerHTML = ''; }, 1000);
}
export const fmt = {
  int: n => Math.round(n).toLocaleString('en-US'),
  usd: n => '$' + (n >= 10000 ? Math.round(n).toLocaleString('en-US') : n >= 100 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(n >= 1 ? 3 : 6)),
  sol: n => (n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(n >= 1 ? 3 : 5)),
  big: n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : (Math.round(n * 100) / 100).toString(),
  short: a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '',
};
export function countTo(el, to, render, ms = 1100) {
  const from = +(el.dataset.v || 0); el.dataset.v = to;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !isFinite(from)) { el.textContent = render(to); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = render(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => { el.textContent = render(to); }, ms + 200);
}
export async function getJSON(url, ms = 9000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || ('HTTP ' + r.status)), { status: r.status, body: j }); return j; }
  finally { clearTimeout(t); }
}
