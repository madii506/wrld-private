// shared helpers for the serverless functions (Vercel, Node 20+)
const KEY = () => process.env.HELIUS_API_KEY || '';
// private moves (register, deposit, send, withdraw) open only once the key is set AND they have passed a live test
const MOVES = () => !!(KEY() && process.env.PRIVATE_MOVES === '1');
const RPCS = () => [process.env.RPC_URL, KEY() && `https://mainnet.helius-rpc.com/?api-key=${KEY()}`, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
async function fetchT(url, opts = {}, ms = 8000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}
async function rpc(method, params = []) {
  let last;
  for (const url of RPCS()) {
    try {
      const r = await fetchT(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'rpc error');
      return j.result;
    } catch (e) { last = e; }
  }
  throw last || new Error('no rpc');
}
const isAddr = s => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
function send(res, code, body, cache = 'no-store') {
  res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', cache);
  res.end(JSON.stringify(body));
}
const JUP = 'https://lite-api.jup.ag';
async function jup(path, opts) { const r = await fetchT(JUP + path, opts, 9000); const j = await r.json().catch(() => null); if (!r.ok) throw Object.assign(new Error((j && (j.error || j.message)) || 'jupiter ' + r.status), { status: r.status }); return j; }
async function prices(mints) {
  const out = {};
  for (let i = 0; i < mints.length; i += 50) {
    const j = await jup('/price/v3?ids=' + mints.slice(i, i + 50).join(','));
    for (const [m, v] of Object.entries(j || {})) if (v && v.usdPrice) out[m] = { price: v.usdPrice, ch24: typeof v.priceChange24h === 'number' ? v.priceChange24h : null };
  }
  return out;
}
module.exports = { rpc, fetchT, isAddr, send, jup, prices, KEY, MOVES };
