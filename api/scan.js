// what anyone can read about a wallet, right now: SOL, tokens, priced holdings, how many transactions, how far back
const L = require('./_lib');
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PE6TbtDAy3ByQSm';
module.exports = async (req, res) => {
  const addr = new URL(req.url, 'http://x').searchParams.get('addr');
  if (!L.isAddr(addr)) return L.send(res, 400, { error: 'not a Solana address' });
  try {
    const [bal, a, b, sigs] = await Promise.all([
      L.rpc('getBalance', [addr]),
      L.rpc('getTokenAccountsByOwner', [addr, { programId: TOKEN }, { encoding: 'jsonParsed' }]).catch(() => ({ value: [] })),
      L.rpc('getTokenAccountsByOwner', [addr, { programId: T22 }, { encoding: 'jsonParsed' }]).catch(() => ({ value: [] })),
      L.rpc('getSignaturesForAddress', [addr, { limit: 1000 }]).catch(() => []),
    ]);
    const held = {};
    for (const v of [...a.value, ...b.value]) { const i = v.account.data.parsed.info; const amt = +i.tokenAmount.uiAmount || 0; if (amt > 0) held[i.mint] = (held[i.mint] || 0) + amt; }
    const SOL = 'So11111111111111111111111111111111111111112', sol = bal.value / 1e9;
    const mints = Object.keys(held).sort((x, y) => held[y] - held[x]).slice(0, 49);
    let px = {}, meta = {};
    try { px = await L.prices([SOL, ...mints]); } catch (e) {}
    const top = mints.filter(m => px[m]).map(m => ({ mint: m, amount: held[m], usd: held[m] * px[m].price })).sort((x, y) => y.usd - x.usd).slice(0, 6);
    try { if (top.length) for (const t of await L.jup('/tokens/v2/search?query=' + top.map(t => t.mint).join(','))) meta[t.id] = t; } catch (e) {}
    top.forEach(t => { t.sym = (meta[t.mint] && meta[t.mint].symbol) || t.mint.slice(0, 4) + '…'; });
    const solUsd = px[SOL] ? sol * px[SOL].price : null;
    const usd = (solUsd || 0) + mints.reduce((s, m) => s + (px[m] ? held[m] * px[m].price : 0), 0);
    const oldest = sigs.length ? sigs[sigs.length - 1].blockTime : null;
    L.send(res, 200, { address: addr, sol, solUsd, usd, tokens: Object.keys(held).length, top, txs: sigs.length, txCapped: sigs.length >= 1000, firstSeen: oldest, at: Date.now() });
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
