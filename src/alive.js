// Small things that keep the page moving: headings that decode as they arrive, ciphertext that never sits still,
// a pixel trail behind the pointer, buttons that lean toward it and cards lit where it points.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const GLYPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=?';
const HEX = '0123456789abcdef';
const pick = s => s[(Math.random() * s.length) | 0];

// ---------- decode: letters roll through glyphs and land left to right ----------
export function decode(el, dur = 900) {
  if (reduce || el.dataset.dec) return;
  el.dataset.dec = '1';
  const nodes = [];
  const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3 && c.nodeValue.trim()) nodes.push({ n: c, t: c.nodeValue }); else if (c.nodeType === 1) walk(c); } };
  walk(el);
  const total = nodes.reduce((a, b) => a + b.t.length, 0);
  if (!total) return;
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const t0 = performance.now();
  const step = now => {
    const u = Math.min(1, (now - t0) / dur);
    let k = 0;
    for (const o of nodes) {
      let s = '';
      for (const ch of o.t) {
        const at = k / total; k++;
        if (ch === ' ' || /[.,!?'’/\-]/.test(ch) || u >= Math.min(1, at * 0.75 + 0.25)) s += ch;
        else { const g = pick(GLYPH); s += ch === ch.toLowerCase() ? g.toLowerCase() : g; }
      }
      o.n.nodeValue = s;
    }
    if (u < 1) requestAnimationFrame(step); else for (const o of nodes) o.n.nodeValue = o.t;
  };
  requestAnimationFrame(step);
  setTimeout(() => { for (const o of nodes) o.n.nodeValue = o.t; }, dur + 400);   // backstop if rAF is paused
}

// ---------- ciphertext cells: roll as hex, settle on the word, roll again ----------
export function cipher(cells) {
  cells.forEach((c, i) => {
    const word = c.textContent.trim(); c.setAttribute('aria-label', word);
    c.textContent = ''; const s = document.createElement('span'); s.textContent = word; s.setAttribute('aria-hidden', 'true'); c.appendChild(s);
    if (reduce) return;
    let rolling = false, until = 0;
    const tick = () => {
      const now = performance.now();
      if (!document.hidden && rolling) {
        s.textContent = Array.from(word, () => pick(HEX)).join('');
        if (now > until) { rolling = false; s.textContent = word; c.classList.remove('roll'); setTimeout(start, 2600 + Math.random() * 2600); return; }
      }
      setTimeout(tick, 70);
    };
    const start = () => { rolling = true; until = performance.now() + 900 + Math.random() * 700; c.classList.add('roll'); tick(); };
    setTimeout(start, 600 + i * 260);
  });
}

// ---------- the pointer: trail, magnets, spotlights, tilt ----------
export function pointerLife() {
  if (!fine) return;
  const cv = document.getElementById('trail');
  const ctx = cv && cv.getContext('2d');
  const P = [];
  let run = false, lx = -1, ly = -1;
  const size = () => { if (cv) { cv.width = innerWidth; cv.height = innerHeight; } };
  size(); addEventListener('resize', size);
  const draw = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const now = performance.now();
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i], a = 1 - (now - p.t) / p.life;
      if (a <= 0) { P.splice(i, 1); continue; }
      p.y += p.vy; p.x += p.vx;
      ctx.globalAlpha = Math.round(a * 4) / 4;                     // four steps, so it fades like a sprite
      ctx.fillStyle = p.c;
      const s = p.s;
      ctx.fillRect(Math.round(p.x / 3) * 3 - s / 2, Math.round(p.y / 3) * 3 - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    if (P.length) requestAnimationFrame(draw); else { run = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  };
  const mags = [...document.querySelectorAll('.btn.gold,.btn.ghost,.chip')];
  addEventListener('pointermove', e => {
    const x = e.clientX, y = e.clientY;
    // trail
    if (ctx && !reduce && (Math.abs(x - lx) + Math.abs(y - ly) > 7)) {
      lx = x; ly = y;
      P.push({ x, y, vx: (Math.random() - 0.5) * 0.5, vy: 0.25 + Math.random() * 0.35, s: Math.random() < 0.3 ? 6 : 3, c: Math.random() < 0.55 ? '#3ff0d8' : '#f4b740', t: performance.now(), life: 380 + Math.random() * 260 });
      if (P.length > 70) P.shift();
      if (!run) { run = true; requestAnimationFrame(draw); }
    }
    // spotlight
    const sp = e.target.closest && e.target.closest('.spot');
    if (sp) { const r = sp.getBoundingClientRect(); sp.style.setProperty('--mx', (x - r.left) + 'px'); sp.style.setProperty('--my', (y - r.top) + 'px'); }
    // magnets
    if (!reduce) for (const b of mags) {
      const r = b.getBoundingClientRect(); if (!r.width) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), R = Math.max(r.width, r.height) * 0.9 + 30;
      b.style.translate = d < R ? `${(dx / R * 7).toFixed(1)}px ${(dy / R * 5).toFixed(1)}px` : '';
    }
  }, { passive: true });
  // market cards lean toward the pointer
  const track = document.getElementById('mtrack');
  if (track && !reduce) {
    track.addEventListener('pointermove', e => { const c = e.target.closest('.mc'); if (!c) return; const r = c.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5; c.style.transform = `perspective(700px) rotateY(${(u * 12).toFixed(2)}deg) rotateX(${(-v * 10).toFixed(2)}deg) translateZ(6px)`; c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    track.addEventListener('pointerout', e => { const c = e.target.closest('.mc'); if (c && !c.contains(e.relatedTarget)) c.style.transform = ''; });
  }
}

// ---------- staggered arrivals ----------
export function stagger(groups) {
  for (const sel of groups) document.querySelectorAll(sel).forEach(g => [...g.children].forEach((c, i) => { c.classList.add('rv'); c.style.transitionDelay = (i * 0.07).toFixed(2) + 's'; }));
}
