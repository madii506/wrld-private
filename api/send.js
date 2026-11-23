// forwards a transaction the user's wallet already signed (used only when a wallet can sign but not send)
const L = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  let body = ''; for await (const c of req) body += c; if (body.length > 20000) return L.send(res, 413, { error: 'too large' });
  try {
    const { tx } = JSON.parse(body || '{}');
    if (typeof tx !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(tx)) return L.send(res, 400, { error: 'signed transaction required' });
    const sig = await L.rpc('sendTransaction', [tx, { encoding: 'base64', skipPreflight: false, maxRetries: 3 }]);
    L.send(res, 200, { signature: sig });
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
