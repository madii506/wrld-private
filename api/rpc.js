// relay for the Privacy Rings SDK in the browser: forwards a short list of JSON-RPC reads and sends to Helius,
// so the API key stays on the server. Off until private moves open (HELIUS_API_KEY and PRIVATE_MOVES=1).
const L = require('./_lib');
const ALLOW = new Set(['getAccountInfo', 'getMultipleAccounts', 'getLatestBlockhash', 'getSlot', 'getBalance', 'getTokenAccountsByOwner', 'getSignatureStatuses', 'sendTransaction', 'simulateTransaction', 'getMinimumBalanceForRentExemption', 'getEpochInfo', 'getBlockHeight', 'getFeeForMessage', 'getRecentPrioritizationFees', 'isBlockhashValid', 'getTransaction']);
module.exports = async (req, res) => {
  if (!L.MOVES()) return L.send(res, 503, { error: 'private moves are not open yet' });
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  let body = ''; for await (const c of req) body += c; if (body.length > 300000) return L.send(res, 413, { error: 'too large' });
  let j; try { j = JSON.parse(body); } catch (e) { return L.send(res, 400, { error: 'bad json' }); }
  const calls = Array.isArray(j) ? j : [j];
  if (!calls.length || calls.length > 20 || calls.some(c => !ALLOW.has(c && c.method))) return L.send(res, 403, { error: 'method not allowed' });
  try {
    const r = await L.fetchT(`https://mainnet.helius-rpc.com/?api-key=${L.KEY()}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }, 15000);
    res.statusCode = r.status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(await r.text());
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
