// turns a quote into an unsigned transaction for the user's wallet; the server never signs anything
const L = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  let body = ''; for await (const c of req) body += c; if (body.length > 200000) return L.send(res, 413, { error: 'too large' });
  try {
    const { quote, user } = JSON.parse(body || '{}');
    if (!quote || !L.isAddr(user)) return L.send(res, 400, { error: 'quote and user required' });
    const j = await L.jup('/swap/v1/swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: quote, userPublicKey: user, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 'auto' }) });
    L.send(res, 200, { tx: j.swapTransaction, lastValid: j.lastValidBlockHeight });
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
