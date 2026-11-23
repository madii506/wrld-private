// what a wallet holds right now: SOL and every token balance by mint (the app uses it for "in your wallet" and Max)
const L = require('./_lib');
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PE6TbtDAy3ByQSm';
module.exports = async (req, res) => {
  const addr = new URL(req.url, 'http://x').searchParams.get('addr');
  if (!L.isAddr(addr)) return L.send(res, 400, { error: 'not a Solana address' });
  try {
    const [bal, a, b] = await Promise.all([
      L.rpc('getBalance', [addr]),
      L.rpc('getTokenAccountsByOwner', [addr, { programId: TOKEN }, { encoding: 'jsonParsed' }]).catch(() => ({ value: [] })),
      L.rpc('getTokenAccountsByOwner', [addr, { programId: T22 }, { encoding: 'jsonParsed' }]).catch(() => ({ value: [] })),
    ]);
    const tokens = {};
    for (const v of [...a.value, ...b.value]) { const i = v.account.data.parsed.info; const amt = +i.tokenAmount.uiAmount || 0; if (amt > 0) tokens[i.mint] = (tokens[i.mint] || 0) + amt; }
    L.send(res, 200, { address: addr, sol: bal.value / 1e9, tokens, at: Date.now() });
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
