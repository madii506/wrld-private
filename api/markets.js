// the world's markets on Solana: tokenized stocks and indexes (xStocks), gold, the euro and crypto, priced by Jupiter
const L = require('./_lib');
// every mint checked against Jupiter's verified token list (2026-11-23)
const LIST = [
  { sym: 'NVDAx', cat: 'stock', mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh' }, { sym: 'AAPLx', cat: 'stock', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp' },
  { sym: 'TSLAx', cat: 'stock', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB' }, { sym: 'MSFTx', cat: 'stock', mint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX' },
  { sym: 'GOOGLx', cat: 'stock', mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN' }, { sym: 'AMZNx', cat: 'stock', mint: 'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg' },
  { sym: 'METAx', cat: 'stock', mint: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu' }, { sym: 'COINx', cat: 'stock', mint: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu' },
  { sym: 'SPYx', cat: 'index', mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W' }, { sym: 'QQQx', cat: 'index', mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ' },
  { sym: 'GLDx', cat: 'metal', mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re' }, { sym: 'XAUt0', cat: 'metal', mint: 'AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P', dec: 6 },
  { sym: 'SLVx', cat: 'metal', mint: 'XsxAd6okt8y1RRK6gNg7iJaqiWNiq5Md5EDf3ZrF2dm' },
  { sym: 'EURC', cat: 'fx', mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', dec: 6 },
  { sym: 'SOL', cat: 'crypto', mint: 'So11111111111111111111111111111111111111112', dec: 9 },
  { sym: 'cbBTC', cat: 'crypto', mint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij', dec: 8 },
  { sym: 'ETH', cat: 'crypto', mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', dec: 8 },
];
let resolved = null, resolvedAt = 0, resolvedFull = false, last = null, lastAt = 0;
async function resolve() {
  // names, icons and decimals come from one Jupiter call for all mints; a failed read is retried after a minute, not cached for hours
  if (resolved && Date.now() - resolvedAt < (resolvedFull ? 6 * 3600e3 : 60e3)) return resolved;
  const meta = {};
  try { for (const t of await L.jup('/tokens/v2/search?query=' + LIST.map(x => x.mint).join(','))) meta[t.id] = t; } catch (e) {}
  resolved = LIST.map(it => { const t = meta[it.mint] || {}; return { sym: it.sym, cat: it.cat, mint: it.mint, name: t.name || it.sym, icon: t.icon || null, decimals: t.decimals != null ? t.decimals : (it.dec != null ? it.dec : 8) }; });
  resolvedFull = Object.keys(meta).length >= LIST.length - 1; resolvedAt = Date.now();
  return resolved;
}
module.exports = async (req, res) => {
  try {
    if (last && Date.now() - lastAt < 20000) return L.send(res, 200, last, 'public, max-age=15');
    const list = await resolve();
    const px = await L.prices(list.map(x => x.mint));
    const markets = list.map(x => ({ ...x, price: px[x.mint] ? px[x.mint].price : null, ch24: px[x.mint] ? px[x.mint].ch24 : null })).filter(x => x.price);
    last = { markets, at: Date.now(), source: 'jupiter' }; lastAt = Date.now();
    L.send(res, 200, last, 'public, max-age=15');
  } catch (e) { L.send(res, 502, { error: String(e.message || e), markets: [] }); }
};
