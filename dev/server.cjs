// local dev server: static files + /api. MOCK=1 answers /api from fixtures (the sandbox cannot reach Solana or Jupiter).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PORT = +process.env.PORT || 8844, MOCK = process.env.MOCK === '1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const M = (sym, cat, mint, name, price, ch24) => ({ sym, cat, mint, name, icon: null, price, ch24, decimals: sym === 'SOL' ? 9 : cat === 'fx' ? 6 : 8 });
const FIX = {
  markets: () => ({ markets: [M('NVDAx', 'stock', 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', 'NVIDIA xStock', 181.42 + Math.random(), 1.84), M('AAPLx', 'stock', 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', 'Apple xStock', 232.1, -0.42), M('TSLAx', 'stock', 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', 'Tesla xStock', 412.5, 3.1), M('MSFTx', 'stock', 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX', 'Microsoft xStock', 508.2, 0.35), M('GOOGLx', 'stock', 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN', 'Alphabet xStock', 251.3, -1.2), M('SPYx', 'index', 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', 'SP500 xStock', 668.4, 0.52), M('QQQx', 'index', 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ', 'Nasdaq xStock', 603.7, 0.8), M('GLDx', 'metal', 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re', 'Gold xStock', 372.9, 0.21), M('XAUt0', 'metal', 'AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P', 'Tether Gold', 4012.6, 0.18), M('EURC', 'fx', 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', 'EURC', 1.161, -0.05), M('SOL', 'crypto', 'So11111111111111111111111111111111111111112', 'Wrapped SOL', 141.37, -2.4), M('cbBTC', 'crypto', 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij', 'Coinbase Wrapped BTC', 98211, -1.1), M('ETH', 'crypto', '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', 'Ether (Wormhole)', 3420.5, -1.9)], at: Date.now(), source: 'mock' }),
  status: () => ({ slot: 383112908 + Math.floor((Date.now() / 400) % 100000), relay: false, ring: { address: 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW', ok: true, executable: true }, registry: { address: 'regy3WAeRXMYuMYxr5iK3Bf9Arr3PcxGxyzAddbiqDQ', ok: true, executable: true }, tree: { address: '777pvSGe5LaBd9nCczvE2FXEauiwtfGJ5XRpjKyniGor', ok: true } }),
  scan: () => ({ address: 'x', sol: 3.214, solUsd: 454.4, usd: 6120.55, tokens: 23, top: [{ sym: 'NVDAx', amount: 12.5, usd: 2267.7 }, { sym: 'USDC', amount: 1830.2, usd: 1830.2 }, { sym: 'JUP', amount: 2100, usd: 1012.3 }, { sym: 'BONK', amount: 31000000, usd: 556.1 }], txs: 1000, txCapped: true, firstSeen: 1667260800, at: Date.now() }),
  ring: () => { const now = Math.floor(Date.now() / 1000), A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const sig = () => Array.from({ length: 88 }, () => A[Math.floor(r() * 58)]).join(''); return { program: 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW', hour: 37, day: 812, capped: false, last: [14, 51, 96, 170, 260, 402].map((d, i) => ({ sig: sig(), t: now - d, slot: 383120000 - i * 120 })), at: Date.now() }; },
  holdings: () => ({ address: 'x', sol: 1.284, tokens: { EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 312.5, Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh: 0.75 }, at: Date.now() }),
  config: () => ({ relay: false, indexer: 'https://dgcj4pjarvo65.cloudfront.net', prover: 'https://d3ky2kt0ntqxt1.cloudfront.net' }),
  swap: () => ({ tx: 'AQID', lastValid: 1 }),
  registered: () => ({ registered: false, record: '4rqiNrQgfty4Yfy81zrwUANqMsnCQN7NwnXwZUN9ZpX2' }),
  quote: () => ({ inAmount: '1000000000', outAmount: '777214', priceImpactPct: '0.0012', routePlan: [{ swapInfo: { label: 'Meteora DLMM' } }, { swapInfo: { label: 'xStocks' } }], otherAmountThreshold: '769442' }),
};
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const name = u.pathname.slice(5).replace(/\/$/, '');
    if (MOCK && FIX[name]) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(FIX[name]())); }
    try { return require(path.join(ROOT, 'api', name + '.js'))(req, res); } catch (e) { res.statusCode = 404; return res.end('{}'); }
  }
  const p = u.pathname === '/' ? '/index.html' : u.pathname === '/app' ? '/app.html' : u.pathname;
  const f = path.join(ROOT, decodeURIComponent(p));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  // the same security headers Vercel sends, so the local run catches anything the CSP would block
  try { for (const h of JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers[0].headers) res.setHeader(h.key, h.value); } catch (e) {}
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('dev on', PORT, MOCK ? '(mock api)' : ''));
