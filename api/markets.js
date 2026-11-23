// the world's markets on Solana: tokenized stocks and indexes (xStocks), gold, the euro and crypto, priced by Jupiter
const L = require('./_lib');
const LIST = [
  { sym: 'NVDAx', cat: 'stock' }, { sym: 'AAPLx', cat: 'stock' }, { sym: 'TSLAx', cat: 'stock' }, { sym: 'MSFTx', cat: 'stock' },
  { sym: 'GOOGLx', cat: 'stock' }, { sym: 'AMZNx', cat: 'stock' }, { sym: 'METAx', cat: 'stock' }, { sym: 'COINx', cat: 'stock' },
  { sym: 'SPYx', cat: 'index' }, { sym: 'QQQx', cat: 'index' },
  { sym: 'GLDx', cat: 'metal' }, { sym: 'XAUt0', cat: 'metal' }, { sym: 'SLVx', cat: 'metal' },
  { sym: 'EURC', cat: 'fx', mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr' },
  { sym: 'SOL', cat: 'crypto', mint: 'So11111111111111111111111111111111111111112' },
  { sym: 'cbBTC', cat: 'crypto', mint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij' },
  { sym: 'ETH', cat: 'crypto', mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs' },
];
let resolved = null, resolvedAt = 0, last = null, lastAt = 0;
async function resolve() {
  if (resolved && Date.now() - resolvedAt < 6 * 3600e3) return resolved;
  const known = LIST.filter(x => x.mint), meta = {};
  try { for (const t of await L.jup('/tokens/v2/search?query=' + known.map(x => x.mint).join(','))) meta[t.id] = t; } catch (e) {}
  const found = await Promise.all(LIST.map(async it => {
    if (it.mint) { const t = meta[it.mint] || {}; return { ...it, name: t.name || it.sym, icon: t.icon || null, decimals: t.decimals != null ? t.decimals : ({ SOL: 9, EURC: 6, cbBTC: 8, ETH: 8 })[it.sym] }; }
    try {
      const arr = await L.jup('/tokens/v2/search?query=' + encodeURIComponent(it.sym));
      const xs = it.sym.endsWith('x');
      const hits = (arr || []).filter(t => (t.symbol || '').toLowerCase() === it.sym.toLowerCase() && (!xs || String(t.id).startsWith('Xs')) && (xs || t.isVerified));
      hits.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
      const t = hits[0]; return t ? { ...it, mint: t.id, name: t.name, icon: t.icon || null, decimals: t.decimals } : null;
    } catch (e) { return null; }
  }));
  resolved = found.filter(Boolean); resolvedAt = Date.now();
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
