// a Jupiter quote for a world-market buy or sell (proxied so the page can keep its strict CSP)
const L = require('./_lib');
module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const inM = q.get('in'), outM = q.get('out'), amt = q.get('amount'), slip = Math.min(300, Math.max(10, +q.get('slip') || 100));
  if (!L.isAddr(inM) || !L.isAddr(outM) || !/^\d{1,20}$/.test(amt || '')) return L.send(res, 400, { error: 'bad quote request' });
  try { L.send(res, 200, await L.jup(`/swap/v1/quote?inputMint=${inM}&outputMint=${outM}&amount=${amt}&slippageBps=${slip}&restrictIntermediateTokens=true`)); }
  catch (e) { L.send(res, e.status === 400 ? 400 : 502, { error: String(e.message || e) }); }
};
