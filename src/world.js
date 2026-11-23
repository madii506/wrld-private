// The WRLD world. A floating slab of the world's markets: the public city on top, a hidden pool cut into its face,
// and the same city hanging upside down underneath it, lit teal: the private side. Other market cities float around
// at odd angles wearing live prices, wired to the pool by dotted lines. On load the whole world assembles voxel by
// voxel while the camera circles it; Enter sweeps down into the city.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function startWorld(canvas, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(opts.fixedPr || Math.min(devicePixelRatio, mobile ? 0.85 : 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let seed = 31; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 600);

  // ---------- sky ----------
  {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, '#03050b'); gr.addColorStop(0.5, '#07101d'); gr.addColorStop(1, '#091626');
    g.fillStyle = gr; g.fillRect(0, 0, 1600, 900);
    const glow = (x, y, r, col) => { const q = g.createRadialGradient(x, y, 4, x, y, r); q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 1600, 900); };
    glow(900, 300, 700, 'rgba(255,170,80,0.07)'); glow(800, 640, 600, 'rgba(50,220,200,0.08)'); glow(300, 180, 500, 'rgba(110,80,200,0.06)');
    for (let i = 0; i < 620; i++) { const big = rnd() < 0.06; g.fillStyle = `rgba(226,236,255,${(0.14 + rnd() * 0.6).toFixed(2)})`; g.fillRect(Math.round(rnd() * 1600), Math.round(rnd() * 900), big ? 2 : 1, big ? 2 : 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  }
  scene.fog = new THREE.FogExp2(0x08111d, 0.0125);
  scene.add(new THREE.HemisphereLight(0x9db6ff, 0x0b1424, 1.05));
  const moonL = new THREE.DirectionalLight(0xd8e4ff, 1.25); moonL.position.set(-12, 26, 20); scene.add(moonL);
  const under = new THREE.DirectionalLight(0x56f0dc, 0.9); under.position.set(6, -30, 14); scene.add(under);   // lights the hanging city
  const fill = new THREE.DirectionalLight(0x9fb8ff, 0.45); fill.position.set(4, 4, 30); scene.add(fill);

  // ---------- voxel batches ----------
  const groups = new Map();
  const M = (key, extra) => { if (!groups.has(key)) groups.set(key, { mat: new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, roughness: 0.88, metalness: 0, flatShading: true }, extra || {})), list: [] }); };
  ['stone', 'asphalt', 'soil', 'rock', 'glass', 'roof', 'leaf', 'globe'].forEach(k => M(k));
  M('window', { emissive: 0xffaa50, emissiveIntensity: 1.5 }); M('windowC', { emissive: 0xbcd8ff, emissiveIntensity: 1.05 });
  M('gold', { roughness: 0.3, metalness: 0.8, emissive: 0x4a2c00, emissiveIntensity: 0.3 });
  M('crystal', { emissive: 0x2fd6c4, emissiveIntensity: 1.0, roughness: 0.4 });
  M('lamp', { emissive: 0xffc070, emissiveIntensity: 2.0 }); M('beacon', { emissive: 0xff6a3a, emissiveIntensity: 2.4 });
  M('ticker', { emissive: 0xf4b740, emissiveIntensity: 1.6 }); M('tickerW', { emissive: 0xe8f0ff, emissiveIntensity: 1.2 });
  M('clock', { emissive: 0xfff2d0, emissiveIntensity: 0.5 });
  // the private side: same city, cold light
  M('windowM', { emissive: 0x3ff0d8, emissiveIntensity: 1.5 }); M('windowCM', { emissive: 0xbff8ff, emissiveIntensity: 1.0 });
  M('lampM', { emissive: 0x3ff0d8, emissiveIntensity: 2.0 }); M('beaconM', { emissive: 0x3ff0d8, emissiveIntensity: 2.4 });
  M('tickerM', { emissive: 0x3ff0d8, emissiveIntensity: 1.6 }); M('clockM', { emissive: 0x9ff8ec, emissiveIntensity: 0.6 });
  const MKEY = { window: 'windowM', windowC: 'windowCM', lamp: 'lampM', beacon: 'beaconM', ticker: 'tickerM', tickerW: 'tickerM', clock: 'clockM' };
  const C3 = new THREE.Color(), Qid = new THREE.Quaternion(), tmp = new THREE.Vector3();
  const V = 0.38, BOT = 18, YM = -BOT * V / 2;                      // voxel, slab thickness, the mirror plane
  let MIRROR = false, XF = null;                                     // build modes: mirrored under the slab / rotated isle
  function vox(key, x, y, z, s, hex, jit = 0.07, q = Qid) {
    C3.set(hex); let k = 1 + (rnd() - 0.5) * 2 * jit;
    if (MIRROR) {
      y = 2 * YM - y;
      if (MKEY[key]) { key = MKEY[key]; C3.set(key === 'windowCM' ? 0xd6fbff : 0x53f5dd); }
      else if (key !== 'gold' && key !== 'globe') { C3.multiplyScalar(0.5); C3.b = Math.min(1, C3.b * 1.25 + 0.03); C3.g = Math.min(1, C3.g * 1.1 + 0.02); }
    }
    if (XF) { tmp.set(x, y, z).applyQuaternion(XF.q).add(XF.c); x = tmp.x; y = tmp.y; z = tmp.z; q = XF.q; }
    groups.get(key).list.push([x, y, z, s, C3.r * k, C3.g * k, C3.b * k, q]);
  }
  const O = new THREE.Vector3(0, 0, 0);
  const P = (i, j, k, o = O, v = V) => [o.x + i * v, o.y + j * v, o.z + k * v];
  const cell = (key, i, j, k, hex, jit) => vox(key, ...P(i, j, k), V, hex, jit);

  // ---------- the slab: street on top, a cave cut into the front, a flat underside the other city hangs from ----------
  const I0 = -31, I1 = 31, K0 = -12, K1 = 7, CI = 21;
  const caveCeil = i => -4 - Math.round(2.2 * (i / CI) ** 2);
  const caveFloor = i => -15 + Math.round(5.2 * (i / CI) ** 2);
  const CAVE_BACK = -8;
  const inCave = (i, j, k) => k > CAVE_BACK && Math.abs(i) <= CI && j <= caveCeil(i) && j > caveFloor(i);
  const SHAFT = [-14, -13];
  const inShaft = (i, j, k) => i >= SHAFT[0] && i <= SHAFT[1] && k >= 6 && j <= 0 && j > caveCeil(i);
  const solid = (i, j, k) => i >= I0 && i <= I1 && k >= K0 && k <= K1 && j <= 0 && j >= -BOT && !inCave(i, j, k) && !inShaft(i, j, k);
  const ROCK = [0x36425c, 0x3e4b66, 0x303b52], SOIL = [0x4c3836, 0x57423d], DEEP = [0x262f44, 0x2b3550];
  for (let i = I0; i <= I1; i++) for (let k = K0; k <= K1; k++) for (let j = 0; j >= -BOT; j--) {
    if (!solid(i, j, k)) continue;
    if (solid(i + 1, j, k) && solid(i - 1, j, k) && solid(i, j + 1, k) && solid(i, j - 1, k) && solid(i, j, k + 1) && solid(i, j, k - 1)) continue;
    if (j === 0) {
      if (k >= 5) cell('asphalt', i, j, k, k === 6 && ((i + 40) % 4 === 0) ? 0x8a7a40 : 0x1b1e26, 0.05);
      else if (k === 4) cell('stone', i, j, k, 0x9aa1b0, 0.04);
      else cell('stone', i, j, k, ((i + k) & 1) ? 0x5c6374 : 0x666e80, 0.05);
    } else if (j === -BOT) cell('stone', i, j, k, ((i + k) & 1) ? 0x2a3346 : 0x2f3a50, 0.05);         // the underside street
    else if (j >= -2) cell('soil', i, j, k, SOIL[(i + k + 9) & 1], 0.08);
    else if (j <= -BOT + 2) cell('soil', i, j, k, 0x283247, 0.08);
    else {
      const near = inCave(i + 1, j, k) || inCave(i - 1, j, k) || inCave(i, j + 1, k) || inCave(i, j - 1, k) || inCave(i, j, k + 1) || inCave(i, j, k - 1);
      if (near && rnd() < 0.06) cell('crystal', i, j, k, 0x2fd6c4, 0.1);
      else if (rnd() < 0.016 && j < -3) cell('gold', i, j, k, 0xd9a23a, 0.08);
      else cell('rock', i, j, k, j < -10 ? DEEP[(i + k) & 1] : ROCK[(i * 3 + j + k + 99) % 3], 0.07);
    }
  }
  for (let n = 0; n < 14; n++) { const i = Math.round(-CI + 2 + rnd() * (CI * 2 - 4)), k = Math.round(CAVE_BACK + 2 + rnd() * 10), len = 1 + Math.floor(rnd() * 3); for (let t = 1; t <= len; t++) cell('rock', i, caveCeil(i) - t + 1, k, ROCK[t % 3], 0.07); }
  for (let j = -1; j > caveCeil(SHAFT[0]); j -= 2) vox('gold', ...P(SHAFT[0] - 0.05, j, 6.5), V * 0.28, 0xd9a23a, 0.05);
  // private vault doors on the cave's back wall, above the water
  const WATER_Y = YM;                                                 // the water's surface is the mirror plane
  for (const di of [-15, -8, 0, 8, 15]) {
    const cj = (caveCeil(di) + YM / V) / 2 + 0.4, R = 1.7;
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; vox('gold', ...P(di + Math.cos(t) * R, cj + Math.sin(t) * R, CAVE_BACK + 0.55), V * 0.42, 0xe2ac44, 0.03); }
    vox('gold', ...P(di, cj, CAVE_BACK + 0.6), V * 0.6, 0xf4c86a, 0.03);
  }

  // ---------- builders (shared by the main city, its mirror and the far isles) ----------
  function shell(i0, i1, j0, j1, k0, k1, paint) { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) if (i === i0 || i === i1 || k === k0 || k === k1 || j === j1) paint(i, j, k); }
  function tower(i0, i1, j0, j1, k0, k1, lit = 'window', litHex = 0xffc47a, p = 0.6, glassHex = 0x141c2c, o = O, v = V) {
    shell(i0, i1, j0, j1, k0, k1, (i, j, k) => {
      const face = k === k1 ? i - i0 : i === i0 || i === i1 ? k - k0 : -1;
      const slot = j < j1 && face >= 0 && (j - j0) % 2 === 1 && face % 2 === 1;
      if (slot && rnd() < p) vox(lit, ...P(i, j, k, o, v), v, litHex, 0.05); else vox('glass', ...P(i, j, k, o, v), v, (i + j + k) & 1 ? glassHex : 0x1a2436, 0.05);
    });
  }
  function clockTower(ci, ck, h, o = O, v = V) {
    shell(ci - 2, ci + 2, 1, h, ck - 2, ck + 2, (i, j, k) => { const win = (k === ck + 2 || i === ci - 2) && j % 3 === 1 && j < h - 5 && (i === ci || k === ck) && rnd() < 0.8; vox(win ? 'window' : 'stone', ...P(i, j, k, o, v), v, win ? 0xffc47a : ((j + i) & 1 ? 0xa59a88 : 0xb3a895), 0.04); });
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) vox('clock', ...P(ci + dx, h - 3 + dy, ck + 2.55, o, v), v, 0xfff4dc, 0.02);
    for (let t = 0; t <= 4; t++) { const r = Math.floor(t / 2); shell(ci - 2 + r, ci + 2 - r, h + 1 + t, h + 1 + t, ck - 2 + r, ck + 2 - r, (i, j, k) => vox('roof', ...P(i, j, k, o, v), v, 0x3f7f6e, 0.06)); }
    vox('gold', ...P(ci, h + 7, ck, o, v), v * 0.7, 0xe2ac44, 0.02);
  }
  function pagoda(ci, ck, tiers, o = O, v = V) {
    let j = 1;
    for (let t = 0; t < tiers; t++) {
      const r = Math.max(1, 3 - Math.floor(t * 0.6)), hh = t === 0 ? 3 : 2;
      shell(ci - r, ci + r, j, j + hh - 1, ck - r, ck + r, (i, jj, k) => { const win = (k === ck + r) && Math.abs(i - ci) < r && (jj - j) % 2 === 0 && rnd() < 0.75; vox(win ? 'window' : 'stone', ...P(i, jj, k, o, v), v, win ? 0xffb060 : 0xd9cdb8, 0.05); });
      j += hh; const R = r + 1;
      for (let i = ci - R; i <= ci + R; i++) for (let k = ck - R; k <= ck + R; k++) {
        const corner = Math.abs(i - ci) === R && Math.abs(k - ck) === R, edge = Math.abs(i - ci) === R || Math.abs(k - ck) === R;
        vox('roof', ...P(i, j + (corner ? 1 : 0), k, o, v), v, edge ? 0x9e2f2a : 0x7d2420, 0.05);
      }
      j += 1;
    }
    for (let t = 0; t < 3; t++) vox('gold', ...P(ci, j + t, ck, o, v), v * (0.7 - t * 0.15), 0xe8b24a, 0.03);
  }
  function exchange(i0, i1, k0, k1, o = O, v = V) {
    shell(i0, i1, 1, 1, k0, k1, (i, j, k) => vox('stone', ...P(i, j, k, o, v), v, 0xbfc6d3, 0.04));
    for (let i = i0; i <= i1; i++) vox('stone', ...P(i, 1, k1 + 1, o, v), v, 0xaab2c1, 0.04);
    for (let i = i0; i <= i1; i += 2) for (let j = 2; j <= 6; j++) vox('stone', ...P(i, j, k1, o, v), v, 0xe2e7f0, 0.04);
    shell(i0 + 1, i1 - 1, 2, 6, k0, k1 - 2, (i, j, k) => (k === k1 - 2 && (j === 3 || j === 4) && (i - i0) % 2 === 0 && i > i0 + 1 && i < i1 - 1) ? vox('window', ...P(i, j, k, o, v), v, 0xffc47a) : vox('stone', ...P(i, j, k, o, v), v, 0xb3bac8, 0.05));
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) vox('stone', ...P(i, 7, k, o, v), v, 0xd3d9e4, 0.04);
    const half = Math.floor((i1 - i0) / 2);
    for (let t = 0; t <= half - 1; t++) for (let i = i0 + t; i <= i1 - t; i++) for (let k = k0; k <= k1; k++) if (k === k1 || t === half - 1 || i === i0 + t || i === i1 - t) vox('stone', ...P(i, 8 + t * 0.6, k, o, v), v, k === k1 ? 0xe6ebf3 : 0xaeb6c5, 0.04);
    vox('gold', ...P((i0 + i1) / 2, 9, k1 + 0.5, o, v), v, 0xf0b84a, 0.02);
  }
  function coinTower(ci, ck, h) {
    tower(ci - 2, ci + 1, 1, h, ck - 2, ck + 1, 'window', 0xffc47a, 0.55);
    const c = P(ci - 0.5, h + 4.6, ck - 0.5), R = 3.6 * V, s = V * 0.5;
    for (let x = -R; x <= R + 1e-6; x += s) for (let y = -R; y <= R + 1e-6; y += s) {
      const r = Math.hypot(x, y); if (r > R) continue;
      const rim = r > R - s * 1.2, inner = Math.abs(x) < s * 1.4 && Math.abs(y) < s * 1.4, ring = r > R * 0.55 && r < R * 0.55 + s;
      for (const dz of [-s / 2, s / 2]) vox('gold', c[0] + x, c[1] + y, c[2] + dz, s, rim ? 0xb8862a : inner ? 0x7a5512 : ring ? 0xc99a3a : 0xf0c060, 0.03);
    }
    for (let j = h + 1; j <= h + 1.6; j += 0.5) vox('gold', ...P(ci - 0.5, j, ck - 0.5), V * 0.5, 0xb8862a, 0.02);
  }
  function tree(i, k) { vox('asphalt', ...P(i, 1, k), V * 0.35, 0x4a3628); for (const [dx, dy, dz] of [[0, 0, 0], [0.4, 0, 0], [-0.4, 0, 0], [0, 0, 0.4], [0, 0, -0.4], [0, 0.4, 0]]) vox('leaf', ...P(i + dx, 1.9 + dy, k + dz), V * 0.55, rnd() < 0.5 ? 0x2f7a52 : 0x3a8f5e, 0.08); }
  function lamp(i, k) { for (let j = 1; j <= 3; j++) vox('asphalt', ...P(i, j, k), V * 0.32, 0x2a2e38); vox('lamp', ...P(i, 3.7, k), V * 0.66, 0xffd08a, 0.02); }
  // the plaza globe, as in the PFP: teal sea, green land, gold blindfold
  function blindGlobe(ci, cj, ck, Rc) {
    const c = P(ci, cj, ck), R = Rc * V, s = V * 0.34, tilt = -0.21, ca = Math.cos(tilt), sa = Math.sin(tilt);
    for (let x = -R; x <= R; x += s) for (let y = -R; y <= R; y += s) for (let z = -R; z <= R; z += s) {
      const r = Math.hypot(x, y, z); if (r > R || r < R - s * 1.6) continue;
      const yb = -x * sa + y * ca;
      if (Math.abs(yb) < R * 0.24 && z > -R * 0.6) { vox('gold', c[0] + x * 1.06, c[1] + y * 1.06, c[2] + z * 1.06, s, yb > R * 0.14 ? 0xffd680 : yb < -R * 0.14 ? 0xb87c1e : 0xf4b740, 0.03); continue; }
      const land = Math.sin(x * 4.6 + 1.3) + Math.cos(z * 4.1 - y * 3.0) + Math.sin(y * 5.4 - 0.4) > 0.7;
      vox('globe', c[0] + x, c[1] + y, c[2] + z, s, land ? 0x2e9684 : 0x145668, 0.06);
    }
  }
  function city() {
    clockTower(-27, -5, 16);
    tower(-31, -30, 1, 6, -9, -6, 'windowC', 0xd6e8ff, 0.5);
    tower(-23, -21, 1, 5, -10, -7, 'window', 0xffc47a, 0.5, 0x1b2230);
    exchange(-20, -12, -9, 1);
    shell(-10, -5, 1, 5, -10, -6, (i, j, k) => cell(j === 5 || i === -10 || i === -5 ? 'gold' : 'stone', i, j, k, j === 5 || i === -10 || i === -5 ? 0xd9a23a : 0x9aa2b2, 0.05));
    for (const [i, k] of [[-8, 1], [-7, 1], [-8, 2], [-7, 2]]) for (let j = 1; j <= 3; j++) cell('stone', i, j, k, j === 3 ? 0xe2ac44 : 0xcfd5e0, 0.04);
    blindGlobe(-7.5, 7.4, 1.5, 3.5);
    tower(-3, 1, 1, 18, -10, -6); tower(-2, 0, 19, 22, -9, -7);
    for (let j = 23; j <= 24; j++) cell('glass', -1, j, -8, 0x2a3446); vox('beacon', ...P(-1, 25, -8), V * 0.8, 0xff7a4a, 0.02);
    shell(-3, 1, 12, 12, -10, -6, (i, j, k) => cell((i + k) % 3 === 0 ? 'tickerW' : 'ticker', i, j, k, 0xf4b740, 0.02));
    tower(3, 6, 1, 12, -8, -4, 'windowC', 0xd6e8ff, 0.55, 0x172032);
    for (let j = 13; j <= 14; j++) cell('glass', 5, j, -5, 0x2a3446); vox('beacon', ...P(5, 15, -5), V * 0.8, 0xff7a4a, 0.02);
    pagoda(11, -6, 4);
    tower(15, 18, 1, 8, -11, -8, 'window', 0xffc47a, 0.5, 0x1b2230);
    shell(15, 18, 6, 6, -11, -8, (i, j, k) => cell((i + k) % 2 === 0 ? 'tickerW' : 'ticker', i, j, k, 0xf4b740, 0.02));
    coinTower(23, -6, 11);
    tower(18, 22, 1, 3, -2, 1, 'window', 0xffc47a, 0.7, 0x20283a);
    for (let i = 18; i <= 22; i++) cell(i & 1 ? 'gold' : 'stone', i, 4, 2, i & 1 ? 0xd9a23a : 0x2fb8a8, 0.03);
    tower(26, 30, 1, 5, -9, -3, 'windowC', 0xd6e8ff, 0.5);
    tower(8, 9, 1, 4, -1, 0, 'window', 0xffc47a, 0.6);
    for (const i of [-29, -23, -3, 3, 15, 27]) tree(i, 3);
    for (const i of [-26, -16, -6, 6, 17, 28]) lamp(i, 5);
  }
  city();                                     // the public side
  MIRROR = true; city(); MIRROR = false;      // the private side, hanging under the slab
  for (const i of [-6, 17]) { const l = new THREE.PointLight(0xffb060, 4, 6, 2); l.position.set(...P(i, 4.5, 6)); scene.add(l); }
  for (const i of [-12, 10]) { const l = new THREE.PointLight(0x3ff0d8, 6, 9, 2); l.position.set(i * V, 2 * YM - 4.5 * V, 6 * V); scene.add(l); }

  // ---------- far isles: other market cities, some tilted, some upside down ----------
  const isles = [];
  function isle(c, rot, w, d, v, build) {
    XF = { c, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)) };
    const o = new THREE.Vector3();
    const dep = (i, k) => Math.round(2 + 6 * Math.max(0, 1 - Math.hypot(i / (w / 2 + 1), k / (d / 2 + 1))) + rnd() * 1.5);
    for (let i = -w / 2; i <= w / 2; i++) for (let k = -d / 2; k <= d / 2; k++) {
      vox('stone', ...P(i, 0, k, o, v), v, (i + k) & 1 ? 0x4e5566 : 0x565e70, 0.05);
      const dd = dep(i, k); for (let j = -1; j >= -dd; j--) if (j === -dd || Math.abs(i) === w / 2 || Math.abs(k) === d / 2) vox('rock', ...P(i, j, k, o, v), v, ROCK[(j + i + 30) % 3], 0.07);
    }
    build(o, v); XF = null; isles.push({ c, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)) });
  }
  isle(new THREE.Vector3(-16, 10.5, -26), [0, 0.3, 0.12], 12, 7, 0.36, (o, v) => { pagoda(-2, -1, 3, o, v); tower(2, 3, 1, 9, -2, -1, 'window', 0xffc47a, 0.6, 0x141c2c, o, v); });
  isle(new THREE.Vector3(22, 12.5, -30), [0, -0.4, Math.PI], 12, 7, 0.36, (o, v) => { clockTower(-2, -1, 12, o, v); tower(2, 4, 1, 10, -2, 0, 'windowC', 0xd6e8ff, 0.55, 0x172032, o, v); });   // hanging upside down
  isle(new THREE.Vector3(27, -9, -14), [0, 0.5, 0.18], 10, 6, 0.36, (o, v) => { tower(-2, 0, 1, 12, -1, 1, 'window', 0xffc47a, 0.6, 0x141c2c, o, v); tower(2, 3, 1, 7, -1, 0, 'windowC', 0xd6e8ff, 0.55, 0x172032, o, v); });
  isle(new THREE.Vector3(-26, -10, -18), [0.2, 0.2, Math.PI / 2], 10, 6, 0.36, (o, v) => { exchange(-3, 3, -2, 1, o, v); });            // sideways
  isle(new THREE.Vector3(6, 22, -60), [0, 0, 0.1], 16, 8, 0.5, (o, v) => { tower(-4, -2, 1, 12, -2, 0, 'window', 0xffc47a, 0.6, 0x141c2c, o, v); tower(1, 3, 1, 8, -1, 1, 'window', 0xffc47a, 0.6, 0x141c2c, o, v); });
  isle(new THREE.Vector3(-8, -26, -40), [0, 0.6, Math.PI], 14, 8, 0.5, (o, v) => { pagoda(0, 0, 3, o, v); tower(3, 5, 1, 10, -1, 1, 'windowC', 0xd6e8ff, 0.55, 0x172032, o, v); });

  // ---------- the world assembles: every voxel falls (or, below the slab, rises) into place on load ----------
  // and the lit materials live: windows switch on and off, tickers run, beacons blink, lamps breathe
  const UB = { value: reduce ? 2 : 0 }, UT = { value: 0 };
  const FX = { window: 1, windowC: 1, windowM: 1, windowCM: 1, ticker: 2, tickerW: 2, tickerM: 2, beacon: 3, beaconM: 3, lamp: 4, lampM: 4 };
  const fxCode = {
    1: 'totalEmissiveRadiance *= mix(0.1, 1.0, step(0.17, fract(sin(dot(vIP.xy + floor(uT * 0.085 + h * 7.0), vec2(41.3, 17.9))) * 9123.17))) * (0.95 + 0.05 * sin(uT * 6.0 + h * 40.0));',
    2: 'totalEmissiveRadiance *= 0.25 + 0.75 * step(0.42, fract((vIP.x + vIP.z) * 0.9 - uT * 1.4));',
    3: 'totalEmissiveRadiance *= 0.08 + 0.92 * step(0.62, fract(uT * 0.8 + h));',
    4: 'totalEmissiveRadiance *= 0.86 + 0.14 * sin(uT * 11.0 + h * 50.0);',
  };
  for (const [key, g] of groups) {
    const fx = FX[key] || 0;
    g.mat.onBeforeCompile = sh => {
      sh.uniforms.uBuild = UB; sh.uniforms.uT = UT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBuild; uniform float uT; varying vec3 vIP;')
        .replace('#include <project_vertex>', `
          vec4 mvPosition = vec4( transformed, 1.0 );
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          vIP = ip;
          float hb = fract(sin(dot(ip, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float dl = clamp(length(ip.xz - vec2(0.0, -1.0)) / 40.0, 0.0, 1.0) * 0.6 + hb * 0.28;
          float tb = clamp((uBuild - dl) / 0.42, 0.0, 1.0);
          float eb = 1.0 - pow(1.0 - tb, 3.0);
          mvPosition.xyz *= max(eb, 0.0001);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif
          float side = ip.y < ${YM.toFixed(3)} ? -1.0 : 1.0;
          mvPosition.y += (1.0 - eb) * side * (5.0 + hb * 12.0);
          mvPosition.xz += (1.0 - eb) * (vec2(hb, fract(hb * 7.31)) - 0.5) * 7.0;
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`);
      if (fx) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; varying vec3 vIP;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { float h = fract(sin(dot(vIP, vec3(12.9898, 78.233, 37.719))) * 43758.5453); ${fxCode[fx]} }`);
    };
  }
  let buildT0 = null, buildHold = null;                              // buildHold freezes the assembly for screenshots
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  // ---------- shooting stars across the sky behind everything ----------
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const shoot = new THREE.Mesh(boxG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); scene.add(shoot);
  let shootAt = 2.5; const shootFrom = new THREE.Vector3(), shootDir = new THREE.Vector3();

  // ---------- traffic: cars along the front street, and their twins upside down under the slab ----------
  const NC = mobile ? 8 : 14, CARC = [0xf4b740, 0xe8eef8, 0xd8453a, 0x2fb8a8, 0x39415a, 0x8a5cf0, 0xe8eef8];
  const carB = new THREE.InstancedMesh(boxG, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, flatShading: true }), NC * 4);
  const carL = new THREE.InstancedMesh(boxG, new THREE.MeshBasicMaterial({ color: 0xffffff }), NC * 4);
  carB.frustumCulled = carL.frustumCulled = false; scene.add(carB, carL);
  const cars = [];
  for (let n = 0; n < NC; n++) {
    const lane = n % 2, c = CARC[n % CARC.length];
    cars.push({ lane, x: -12 + rnd() * 24, sp: (1.3 + rnd() * 1.4) * (lane ? -1 : 1), z: (lane ? 6.55 : 5.35) * V });
    const cc = new THREE.Color(c); carB.setColorAt(n * 2, cc); carB.setColorAt(n * 2 + 1, cc.clone().multiplyScalar(0.55));
    const m = new THREE.Color(c).multiplyScalar(0.35); m.b = Math.min(1, m.b + 0.25); m.g = Math.min(1, m.g + 0.18);
    carB.setColorAt(NC * 2 + n * 2, m); carB.setColorAt(NC * 2 + n * 2 + 1, m.clone().multiplyScalar(0.6));
    carL.setColorAt(n * 2, new THREE.Color(2.2, 2.0, 1.6)); carL.setColorAt(n * 2 + 1, new THREE.Color(2.0, 0.25, 0.2));
    carL.setColorAt(NC * 2 + n * 2, new THREE.Color(0.5, 2.2, 2.0)); carL.setColorAt(NC * 2 + n * 2 + 1, new THREE.Color(0.35, 1.4, 1.3));
  }

  // ---------- the market express: an elevated loop round the island, and its twin under the slab ----------
  const RX = 14.6, RZ = 6.4, RC = -1, RY = 1.15, NT = 6;
  const railMat = new THREE.PointsMaterial({ color: 0xf4b740, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  { const pts = []; for (let i = 0; i < 360; i++) { const a = i / 360 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * RX, RY - 0.22, RC + Math.sin(a) * RZ), new THREE.Vector3(Math.cos(a) * RX, 2 * YM - RY + 0.22, RC + Math.sin(a) * RZ)); }
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), railMat)); }
  const trainB = new THREE.InstancedMesh(boxG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.5, flatShading: true }), NT * 2);
  const trainW = new THREE.InstancedMesh(boxG, new THREE.MeshBasicMaterial({ color: 0xffffff }), NT * 2);
  trainB.frustumCulled = trainW.frustumCulled = false; scene.add(trainB, trainW);
  for (let n = 0; n < NT; n++) { trainB.setColorAt(n, new THREE.Color(n ? 0xdfe5ef : 0xf4b740)); trainB.setColorAt(NT + n, new THREE.Color(n ? 0x1d3a44 : 0x2fb8a8)); trainW.setColorAt(n, new THREE.Color(2.0, 1.55, 0.8)); trainW.setColorAt(NT + n, new THREE.Color(0.4, 2.0, 1.85)); }

  // ---------- drones over the city, blinking ----------
  const NDR = mobile ? 10 : 18;
  const drone = new THREE.InstancedMesh(boxG, new THREE.MeshBasicMaterial({ color: 0xffffff }), NDR * 2); drone.frustumCulled = false; scene.add(drone);
  const drones = []; for (let n = 0; n < NDR; n++) { drones.push({ cx: (rnd() - 0.5) * 16, cz: -1 + (rnd() - 0.5) * 6, r: 2 + rnd() * 6, y: 6.5 + rnd() * 6, sp: (0.2 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6.28 });
    drone.setColorAt(n * 2, new THREE.Color(0x10151f)); drone.setColorAt(n * 2 + 1, new THREE.Color(...(n % 3 === 0 ? [2.2, 0.3, 0.25] : n % 3 === 1 ? [0.3, 2.2, 0.8] : [2, 2, 2]))); }

  // ---------- the far isles are markets: each wears a live price and a beam that goes green or red with its day ----------
  const TAGS = ['NVDAx', 'GLDx', 'EURC', 'TSLAx', 'SPYx', 'cbBTC'];
  const tags = isles.map((s, i) => {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 96;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    const lift = s.c.y >= 0 ? 6 : -6.5; sp.position.copy(s.c).add(new THREE.Vector3(0, lift, 0)); sp.scale.set(6.4, 1.92, 1); scene.add(sp);
    const beam = new THREE.Mesh(boxG, new THREE.MeshBasicMaterial({ color: 0x3ff0d8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.scale.set(0.09, 40, 0.09); beam.position.copy(s.c).add(new THREE.Vector3(0, lift > 0 ? 20 + 3 : -20 - 3, 0)); scene.add(beam);
    return { sym: TAGS[i % TAGS.length], cv, tex, sp, beam, ch: 0, on: false };
  });
  function drawTag(tg, m) {
    const g = tg.cv.getContext('2d'), W2 = tg.cv.width, H2 = tg.cv.height, up = (m.ch24 || 0) >= 0;
    g.clearRect(0, 0, W2, H2);
    g.fillStyle = 'rgba(5,8,15,0.82)'; g.fillRect(0, 0, W2, H2);
    g.fillStyle = up ? '#45e39a' : '#ff6a5a'; g.fillRect(0, 0, 6, H2);
    g.strokeStyle = 'rgba(233,238,248,0.22)'; g.lineWidth = 2; g.strokeRect(1, 1, W2 - 2, H2 - 2);
    g.textBaseline = 'middle'; g.fillStyle = '#f4f6fc'; g.font = '700 34px Mono, monospace'; g.fillText(m.sym, 22, 32);
    const px = m.price >= 1000 ? '$' + Math.round(m.price).toLocaleString('en-US') : '$' + m.price.toFixed(m.price >= 100 ? 2 : 3);
    g.font = '500 26px Mono, monospace'; g.fillStyle = '#c9d2e3'; g.fillText(px, 22, 70);
    const ch = m.ch24 == null ? '' : (up ? '+' : '') + m.ch24.toFixed(2) + '%';
    g.font = '700 26px Mono, monospace'; g.fillStyle = up ? '#45e39a' : '#ff6a5a'; g.textAlign = 'right'; g.fillText(ch, W2 - 18, 70); g.textAlign = 'left';
    tg.tex.needsUpdate = true; tg.ch = m.ch24 || 0; tg.on = true;
    tg.beam.material.color.set(up ? 0x45e39a : 0xff6a5a);
  }
  function setMarkets(list) {
    const go = () => { for (const tg of tags) { const m = (list || []).find(x => x.sym === tg.sym && x.price > 0); if (m) drawTag(tg, m); } };
    (document.fonts && document.fonts.load ? document.fonts.load('700 34px Mono').then(go, go) : go());
  }

  // ---------- deposits: gold cubes drop down the shaft into the pool and go teal under the water ----------
  const NDP = 9, SX = (SHAFT[0] + 0.5) * V, SZ = 6.5 * V;
  const dep = new THREE.InstancedMesh(boxG, new THREE.MeshBasicMaterial({ color: 0xffffff }), NDP); dep.frustumCulled = false; scene.add(dep);
  const splash = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.5), transparent: true, opacity: 0, depthWrite: false }));
  splash.rotation.x = -Math.PI / 2; splash.position.set(SX, WATER_Y + 0.015, SZ); scene.add(splash);
  const goldC = new THREE.Color(2.0, 1.45, 0.45), tealC = new THREE.Color(0.35, 2.0, 1.8), dc = new THREE.Color();

  // ---------- the pool ----------
  const wx0 = -17.5, wx1 = 17.5, wTop = WATER_Y;
  const water = new THREE.Mesh(new THREE.BoxGeometry((wx1 - wx0) * V, 4 * V, (K1 - CAVE_BACK + 0.9) * V),
    new THREE.MeshStandardMaterial({ color: 0x041018, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.8, depthWrite: false }));
  water.position.set((wx0 + wx1) / 2 * V, wTop - 2 * V, ((K1 + CAVE_BACK) / 2 + 0.05) * V); scene.add(water);
  const box = new THREE.BoxGeometry(1, 1, 1), o3 = new THREE.Object3D(), col = new THREE.Color();
  const NO = mobile ? 90 : 160, orders = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), NO); scene.add(orders);
  const ordP = [];
  for (let n = 0; n < NO; n++) {
    const i = -16 + rnd() * 32, k = CAVE_BACK + 1 + rnd() * (K1 - CAVE_BACK - 0.6), jf = caveFloor(Math.round(i)) + 0.8;
    const j = Math.max(jf, wTop / V - 0.7 - rnd() * 3.0), g = rnd() < 0.3;
    ordP.push({ p: new THREE.Vector3(...P(i, j, k)), s: V * (0.28 + rnd() * 0.42), ph: rnd() * 6, sp: 0.3 + rnd() * 0.6 });
    orders.setColorAt(n, col.set(g ? 0xf4b740 : 0x43f0d8).multiplyScalar(1.6));
  }
  const ripples = [];
  for (const [ri, rk, s] of [[-9, 3.2, 1], [7.5, 0.5, 1.15], [1.5, -4.5, 0.7]]) for (let q = 0; q < 3; q++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 2.0), transparent: true, opacity: 0.6, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(...P(ri, 0, rk)); m.position.y = wTop + 0.012; scene.add(m); ripples.push({ m, s, ph: q / 3 });
  }
  { const l = new THREE.PointLight(0x3ff0d8, 80, 20, 1.5); l.position.set(...P(0, -8, 5)); scene.add(l); }
  { const l = new THREE.PointLight(0x3ff0d8, 36, 13, 1.5); l.position.set(...P(-13, -7, 3)); scene.add(l); }
  { const l = new THREE.PointLight(0x3ff0d8, 36, 13, 1.5); l.position.set(...P(13, -7, 3)); scene.add(l); }

  // ---------- wires: dots running from each far city into the pool ----------
  const poolPt = new THREE.Vector3(...P(0, wTop / V - 1, CAVE_BACK + 2));
  const wires = isles.slice(0, 4).map(({ c }) => { const a = c.clone(), b = poolPt.clone().add(new THREE.Vector3((rnd() - 0.5) * 8, 0, 0)); return { a, b, m: a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -4, 3)) }; });
  const ND = mobile ? 80 : 160, dots = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), ND); scene.add(dots);
  const dotP = []; for (let i = 0; i < ND; i++) { dotP.push({ w: i % wires.length, u: rnd(), sp: 0.04 + rnd() * 0.05 }); dots.setColorAt(i, col.set(i % 5 === 0 ? 0xf4b740 : 0x3ff0d8).multiplyScalar(1.5)); }
  const bez = (w, u, out) => out.copy(w.a).multiplyScalar((1 - u) ** 2).addScaledVector(w.m, 2 * u * (1 - u)).addScaledVector(w.b, u * u);

  // ---------- static meshes ----------
  for (const [, g] of groups) {
    if (!g.list.length) continue;
    const mesh = new THREE.InstancedMesh(box, g.mat, g.list.length);
    g.list.forEach(([x, y, z, s, r, gg, bb, q], i) => { o3.position.set(x, y, z); o3.quaternion.copy(q); o3.scale.setScalar(s * 0.985); o3.updateMatrix(); mesh.setMatrixAt(i, o3.matrix); mesh.setColorAt(i, col.setRGB(r, gg, bb)); });
    scene.add(mesh);
  }
  // motes: warm over the public city, cold rising from the private one
  const NM = mobile ? 220 : 420, mpos = new Float32Array(NM * 3), mcol = new Float32Array(NM * 3), mv = new Float32Array(NM);
  for (let i = 0; i < NM; i++) {
    const cold = i % 2 === 0;
    mpos.set([-14 + rnd() * 28, cold ? 2 * YM - rnd() * 9 : rnd() * 10, -6 + rnd() * 12], i * 3);
    mcol.set(cold ? [0.35, 1, 0.92] : [1, 0.8, 0.45], i * 3); mv[i] = (cold ? 1 : -1) * (0.15 + rnd() * 0.35);
  }
  const mgeo = new THREE.BufferGeometry(); mgeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3)); mgeo.setAttribute('color', new THREE.BufferAttribute(mcol, 3));
  scene.add(new THREE.Points(mgeo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.85 })));

  // postcards: every trade on the public side leaves the city as a little card anyone can read
  const PC_SPAWN = [[-27, 17, -5], [-30.5, 7, -7.5], [-22, 6, -8.5], [-16, 6, -6], [-7.5, 6, -8], [-1, 23, -8], [4.5, 13, -6], [11, 11, -6], [16.5, 9, -9.5], [23, 12, -6], [20, 5, -0.5], [28, 6, -6], [8.5, 5, -0.5]].map(a => new THREE.Vector3(...P(...a)));
  const NPC = mobile ? 22 : 40;
  const cards = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), NPC), stamps = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), NPC);
  cards.frustumCulled = stamps.frustumCulled = false; scene.add(cards, stamps);
  const pcs = [];
  const respawn = c => { c.base = PC_SPAWN[(rnd() * PC_SPAWN.length) | 0]; c.age = 0; c.life = 5 + rnd() * 2.5; c.sp = 0.45 + rnd() * 0.4; c.dx = (rnd() - 0.5) * 0.6; c.dz = (rnd() - 0.5) * 0.4; c.ph = rnd() * 6; };
  for (let i = 0; i < NPC; i++) { const c = {}; respawn(c); c.age = rnd() * c.life; pcs.push(c); cards.setColorAt(i, col.setRGB(0.95, 0.92, 0.86)); stamps.setColorAt(i, col.set(i % 3 ? 0xf4b740 : 0xff7a4a).multiplyScalar(1.3)); }
  const stampM = new THREE.Matrix4().compose(new THREE.Vector3(0.3, 0.2, 0.6), new THREE.Quaternion(), new THREE.Vector3(0.22, 0.34, 1.2));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.45, 0.86); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 0, H = 0, baseFov = 30, fovKick = 0;
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight; renderer.setSize(W, H, false); composer.setSize(W, H);
    cam.aspect = W / H; baseFov = W / H < 1.2 ? 50 : W / H < 1.7 ? 38 : 30; cam.fov = baseFov + fovKick; cam.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  // ---------- camera ----------
  const S = (pos, look, roll = 0) => ({ pos, look, roll });
  const SHOTS = {
    gate: S([0, 8, 54], [0, -3, -6]),
    hero: S([-21, 8.5, 31], [-10.5, 1.2, -3]),
    above: S([10, 9, 17], [-1, 2.4, -3]),
    markets: S([-14, 5.5, 14], [2, 3.5, -4]),
    descend: S([2, -1.2, 15], [0, -2.6, 0]),
    pool: S([1, YM + 1.2, 9.5], [0, YM - 0.6, -2]),
    flip: S([3, YM - 2.5, 19], [0, YM - 3, 0], 180),
    under: S([6, 2 * YM - 9, 22], [0, 2 * YM - 3.5, 0], 180),
    vaults: S([-10, 2 * YM - 6, 15], [-2, 2 * YM - 3, -3], 180),
    both: S([0, YM, 52], [0, YM, 0], 90),
    end: S([-6, YM + 2, 46], [2, YM, 0]),
  };
  // on a phone the island sits centred and high, with the copy under it
  const SHOTS_P = { hero: S([-3, 5, 40], [0, -3, -3]), above: S([4, 8, 20], [-1, 1.4, -3]) };
  const shotsNow = () => (W / H < 1.2 ? Object.assign({}, SHOTS, SHOTS_P) : SHOTS);
  let shot = opts.startShot || 'gate';
  const camPos = new THREE.Vector3(...SHOTS[shot].pos), camLook = new THREE.Vector3(...SHOTS[shot].look);
  let camRoll = SHOTS[shot].roll || 0;
  const tPos = new THREE.Vector3(), tLook = new THREE.Vector3();
  let ext = null, fly = null;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth - 0.5; ptr.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  let last = performance.now(), running = true, t = 0, frames = 0;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(loop); } });
  const fp = new THREE.Vector3();

  function frame(dt) {
    t += dt;
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 2.5); ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 2.5);
    if (buildT0 === null) buildT0 = performance.now();
    if (buildHold != null) UB.value = buildHold;
    else if (!reduce && UB.value < 2) UB.value = Math.min(2, (performance.now() - buildT0) / 1000 * 0.4);
    UT.value = t;
    const life = smooth(1.0, 1.32, UB.value);                         // the moving parts arrive once the world has landed
    const T = ext || shotsNow()[shot] || SHOTS.hero, portrait = W / H < 1.2;
    tPos.set(...T.pos); tLook.set(...T.look); let tRoll = T.roll || 0;
    const orbiting = shot === 'gate' && !ext;
    if (orbiting) {
      // the gate: circle the whole world slowly, coming in from far away while it assembles
      const a = -0.42 + t * 0.045, R = (portrait ? 64 : 52) + 30 * Math.exp(-t * 0.42), h = 6.5 + Math.sin(t * 0.13) * 2.2 + 8 * Math.exp(-t * 0.42);
      tPos.set(Math.sin(a) * R, h, -6 + Math.cos(a) * R); tLook.set(0, portrait ? -7.5 : -6.2, -6);
    } else if (portrait) tPos.sub(tLook).multiplyScalar(1.45).add(tLook);
    tPos.x += ptr.x * 2.0; tPos.y -= ptr.y * 1.2 * (Math.cos(camRoll * Math.PI / 180) >= 0 ? 1 : -1);
    if (fly) {
      const u = Math.min(1, (performance.now() - fly.t0) / 1000 / fly.dur);
      const e = u * u * (3 - 2 * u);
      const ie = 1 - e;
      camPos.copy(fly.p0).multiplyScalar(ie * ie).addScaledVector(fly.mid, 2 * ie * e).addScaledVector(fly.p1, e * e);
      camLook.copy(fly.l0).lerp(fly.l1, Math.min(1, e * 1.25));
      fovKick = Math.sin(u * Math.PI) * 16; cam.fov = baseFov + fovKick; cam.updateProjectionMatrix();
      if (u >= 0.82 && !fly.flashed) { fly.flashed = true; fly.onFlash && fly.onFlash(); }
      if (u >= 1) { const done = fly.onDone; fly = null; fovKick = 0; cam.fov = baseFov; cam.updateProjectionMatrix(); const D = ext || shotsNow().hero; camPos.set(...D.pos); camLook.set(...D.look); camRoll = D.roll || 0; shot = 'hero'; done && done(); }
    } else {
      const k = 1 - Math.exp(-dt * (reduce ? 8 : 2.4));
      camPos.lerp(tPos, k); camLook.lerp(tLook, k); camRoll += (tRoll - camRoll) * k;
    }
    cam.position.copy(camPos); cam.up.set(0, 1, 0); cam.lookAt(camLook); cam.rotateZ(camRoll * Math.PI / 180);
    // ---- the living world ----
    water.material.opacity = 0.8 * smooth(0.55, 1.05, UB.value);
    railMat.opacity = 0.3 * life;
    for (const r of ripples) r.m.visible = life > 0.02;
    // shooting stars
    shootAt -= dt;
    if (shootAt < 0) { shootAt = 2.5 + rnd() * 4.5; shootFrom.set(-45 + rnd() * 50, 18 + rnd() * 16, -75 + rnd() * 20); shootDir.set(1, -0.32 - rnd() * 0.3, 0.1).normalize(); shoot.userData.t = 0; }
    if (shoot.userData.t != null && shoot.userData.t < 1) {
      shoot.userData.t += dt / 0.85; const u = shoot.userData.t;
      shoot.position.copy(shootFrom).addScaledVector(shootDir, u * 40); shoot.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), shootDir);
      shoot.scale.set(5, 0.07, 0.07); shoot.material.opacity = Math.sin(u * Math.PI) * 0.9;
    } else shoot.material.opacity = 0;
    // cars, and their twins under the slab
    for (let n = 0; n < NC; n++) {
      const c = cars[n]; if (!reduce) c.x += c.sp * dt; if (c.x > 12.4) c.x = -12.4; if (c.x < -12.4) c.x = 12.4;
      const k = life * smooth(12.3, 11.5, Math.abs(c.x)), dir = Math.sign(c.sp);
      for (const mir of [0, 1]) {
        const yb = mir ? 2 * YM - 0.33 : 0.33, yc = mir ? 2 * YM - 0.6 : 0.6, base = mir ? NC * 2 : 0;
        o3.quaternion.identity();
        o3.position.set(c.x, yb, c.z); o3.scale.set(0.95 * k + 1e-4, 0.26 * k + 1e-4, 0.44 * k + 1e-4); o3.updateMatrix(); carB.setMatrixAt(base + n * 2, o3.matrix);
        o3.position.set(c.x - dir * 0.05, yc, c.z); o3.scale.set(0.5 * k + 1e-4, 0.22 * k + 1e-4, 0.4 * k + 1e-4); o3.updateMatrix(); carB.setMatrixAt(base + n * 2 + 1, o3.matrix);
        o3.position.set(c.x + dir * 0.48, yb, c.z); o3.scale.set(0.05 * k + 1e-4, 0.08 * k + 1e-4, 0.36 * k + 1e-4); o3.updateMatrix(); carL.setMatrixAt(base + n * 2, o3.matrix);
        o3.position.set(c.x - dir * 0.48, yb, c.z); o3.updateMatrix(); carL.setMatrixAt(base + n * 2 + 1, o3.matrix);
      }
    }
    carB.instanceMatrix.needsUpdate = carL.instanceMatrix.needsUpdate = true;
    // the market express, above and below
    for (let n = 0; n < NT; n++) {
      const a = t * 0.27 - n * 0.072, x = Math.cos(a) * RX, z = RC + Math.sin(a) * RZ, ang = Math.atan2(Math.cos(a) * RZ, -Math.sin(a) * RX);
      for (const mir of [0, 1]) {
        const y = mir ? 2 * YM - RY : RY, k = life;
        o3.position.set(x, y, z); o3.rotation.set(0, -ang, 0); o3.scale.set(0.98 * k + 1e-4, 0.36 * k + 1e-4, 0.42 * k + 1e-4); o3.updateMatrix(); trainB.setMatrixAt(mir * NT + n, o3.matrix);
        o3.scale.set(0.8 * k + 1e-4, 0.1 * k + 1e-4, 0.44 * k + 1e-4); o3.position.y = y + (mir ? -0.04 : 0.04); o3.updateMatrix(); trainW.setMatrixAt(mir * NT + n, o3.matrix);
      }
    }
    o3.rotation.set(0, 0, 0);
    trainB.instanceMatrix.needsUpdate = trainW.instanceMatrix.needsUpdate = true;
    // drones
    for (let n = 0; n < NDR; n++) {
      const d = drones[n], a = d.ph + t * d.sp, x = d.cx + Math.cos(a) * d.r, z = d.cz + Math.sin(a) * d.r * 0.55, y = d.y + Math.sin(t * 0.9 + d.ph) * 0.4, k = life;
      o3.quaternion.identity(); o3.position.set(x, y, z); o3.scale.set(0.22 * k + 1e-4, 0.06 * k + 1e-4, 0.22 * k + 1e-4); o3.updateMatrix(); drone.setMatrixAt(n * 2, o3.matrix);
      const blink = ((t * 1.1 + d.ph) % 1) < 0.22 ? 1 : 0.0001;
      o3.position.y = y - 0.06; o3.scale.setScalar(0.07 * k * blink + 1e-4); o3.updateMatrix(); drone.setMatrixAt(n * 2 + 1, o3.matrix);
    }
    drone.instanceMatrix.needsUpdate = true;
    // deposits sink into the Ring
    let sp = 0;
    for (let n = 0; n < NDP; n++) {
      const u = ((t / 4.2) + n / NDP) % 1; let x = SX, y, z = SZ, s2 = 0.16, mixT = 0;
      if (u < 0.42) { const f = u / 0.42; y = 1.4 - (1.4 - WATER_Y) * f * f; }
      else { const f = (u - 0.42) / 0.58; y = WATER_Y - f * 2.4; z = SZ - f * 3.6; x = SX + Math.sin(f * 6 + n) * 0.3; mixT = Math.min(1, f * 2.2); s2 = 0.16 * (1 - f * 0.85); if (f < 0.35) sp = Math.max(sp, 1 - f / 0.35); }
      o3.quaternion.setFromEuler(new THREE.Euler(t * 2 + n, t * 1.3 + n, 0)); o3.position.set(x, y, z); o3.scale.setScalar(s2 * life + 1e-4); o3.updateMatrix(); dep.setMatrixAt(n, o3.matrix);
      dep.setColorAt(n, dc.copy(goldC).lerp(tealC, mixT));
    }
    dep.instanceMatrix.needsUpdate = true; dep.instanceColor.needsUpdate = true;
    splash.scale.setScalar(0.2 + (1 - sp) * 0.9); splash.material.opacity = sp * 0.8 * life;
    // market tags and beams on the far isles
    for (const tg of tags) {
      const k = tg.on ? life : 0;
      tg.sp.material.opacity = k; tg.beam.material.opacity = k * (0.18 + Math.min(0.5, Math.abs(tg.ch) * 0.08)) * (0.75 + 0.25 * Math.sin(t * 2.4 + tg.ch));
    }
    // orders drift under the water
    for (let i = 0; i < NO; i++) { const p = ordP[i]; o3.position.copy(p.p); o3.position.x += Math.sin(t * p.sp + p.ph) * 0.12; o3.position.y += Math.sin(t * p.sp * 1.3 + p.ph) * 0.05; o3.quaternion.setFromEuler(new THREE.Euler(t * p.sp, t * p.sp * 0.7, 0)); o3.scale.setScalar(p.s * life + 1e-4); o3.updateMatrix(); orders.setMatrixAt(i, o3.matrix); }
    orders.instanceMatrix.needsUpdate = true;
    for (const r of ripples) { const u = (t * 0.25 + r.ph) % 1; r.m.scale.setScalar((0.3 + u * 1.5) * r.s); r.m.material.opacity = 0.7 * (1 - u); }
    for (let i = 0; i < ND; i++) { const d = dotP[i]; if (!reduce) d.u += dt * d.sp; if (d.u > 1) d.u -= 1; bez(wires[d.w], d.u, fp); o3.position.copy(fp); o3.quaternion.identity(); o3.scale.setScalar(0.09 * (1 - d.u * 0.5) * life + 1e-4); o3.updateMatrix(); dots.setMatrixAt(i, o3.matrix); }
    dots.instanceMatrix.needsUpdate = true;
    if (!reduce) { for (let i = 0; i < NM; i++) { let y = mpos[i * 3 + 1] + mv[i] * dt; if (mv[i] > 0 && y > YM - 0.4) y = 2 * YM - 9; if (mv[i] < 0 && y < 0.2) y = 10; mpos[i * 3 + 1] = y; } mgeo.attributes.position.needsUpdate = true; }
    const pcOn = camPos.y > YM + 0.5 && life > 0.02;
    cards.visible = stamps.visible = pcOn;
    if (pcOn) {
      for (let i = 0; i < NPC; i++) {
        const c = pcs[i]; if (!reduce) c.age += dt; if (c.age > c.life) respawn(c);
        const rise = c.age * c.sp, sc2 = Math.min(1, c.age / 0.4) * Math.min(1, Math.max(0, (c.life - c.age) / 0.9));
        o3.position.copy(c.base); o3.position.x += c.dx * rise + Math.sin(t * 1.3 + c.ph) * 0.25; o3.position.y += 0.3 + rise; o3.position.z += c.dz * rise;
        o3.rotation.set(Math.sin(t * 2 + c.ph) * 0.35, t * 0.8 + c.ph, Math.sin(t * 1.7 + c.ph) * 0.25);
        o3.scale.set(0.46 * sc2 * life + 1e-4, 0.31 * sc2 * life + 1e-4, 0.02);
        o3.updateMatrix(); cards.setMatrixAt(i, o3.matrix); o3.matrix.multiply(stampM); stamps.setMatrixAt(i, o3.matrix);
      }
      cards.instanceMatrix.needsUpdate = stamps.instanceMatrix.needsUpdate = true;
    }
    composer.render(); frames++;
    if (frames === 2 && opts.onReady) opts.onReady();
  }
  let lastDraw = 0, ema = 16, lastAdapt = performance.now();
  const maxPr = opts.fixedPr || Math.min(devicePixelRatio || 1, mobile ? 1 : 1.25); let pr = opts.fixedPr || Math.min(maxPr, mobile ? 0.85 : 1);
  function applyPr() { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); resize(); }
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const lvl = opts.active ? opts.active() : 1;
    if (lvl === 0 && !fly) { last = now; return; }
    if (lvl < 1 && now - lastDraw < 1000 / 10) return;
    if (opts.maxFps && now - lastDraw < 1000 / opts.maxFps - 2) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; lastDraw = now;
    ema = ema * 0.94 + dt * 1000 * 0.06;
    if (!opts.fixedPr && now - lastAdapt > 1500) {
      if (ema > 21 && pr > 0.55) { pr = Math.max(0.55, pr - 0.12); applyPr(); lastAdapt = now; }
      else if (ema > 24 && bloom.enabled) { bloom.enabled = false; lastAdapt = now; }
      else if (ema < 13 && pr < maxPr && now - lastAdapt > 5000) { pr = Math.min(maxPr, pr + 0.08); applyPr(); lastAdapt = now; }
    }
    frame(dt);
  }
  requestAnimationFrame(loop);
  setTimeout(() => { if (frames === 0) frame(0.016); }, 1500);
  function enter(o = {}) {
    // sweep down from the orbit into the city along a curve, the lens breathing out and back
    if (UB.value < 1.32) UB.value = 1.32;
    const D = shotsNow().hero, p1 = new THREE.Vector3(...D.pos), l1 = new THREE.Vector3(...D.look);
    const mid = camPos.clone().lerp(p1, 0.55).add(new THREE.Vector3(0, 9, 0));
    fly = { t0: performance.now(), dur: reduce ? 0.3 : (o.dur || 2.1), p0: camPos.clone(), mid, p1, l0: camLook.clone(), l1, onFlash: o.onFlash, onDone: () => { o.onDone && o.onDone(); } };
  }
  return {
    info: () => renderer.info.render, frame, enter, get shots() { return shotsNow(); },
    setMarkets,
    built: () => UB.value >= 1.32,
    holdBuild: v => { buildHold = v; },
    setTarget: (pos, look, roll = 0) => { ext = pos ? { pos, look, roll } : null; },
    setShot: (n, snap) => { const A = shotsNow(); if (!A[n]) return; shot = n; if (snap) { camPos.set(...A[n].pos); camLook.set(...A[n].look); camRoll = A[n].roll || 0; } },
  };
}
