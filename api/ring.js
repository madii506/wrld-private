// the Privacy Rings program, live: how many transactions touched it lately and the latest few (signature, time, slot).
// This is exactly what anyone can read from the chain; nothing here decrypts anything.
const L = require('./_lib');
const RING = 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW';
let cache = null, at = 0;
module.exports = async (req, res) => {
  try {
    if (cache && Date.now() - at < 15000) return L.send(res, 200, cache, 'public, max-age=10');
    const sigs = (await L.rpc('getSignaturesForAddress', [RING, { limit: 1000 }])) || [];
    const now = Math.floor(Date.now() / 1000), ok = sigs.filter(s => !s.err);
    const within = sec => ok.filter(s => s.blockTime && now - s.blockTime < sec).length;
    const oldest = sigs.length ? sigs[sigs.length - 1].blockTime : null;
    cache = {
      program: RING, hour: within(3600),
      capped: sigs.length >= 1000 && oldest != null && now - oldest < 86400,      // more than the 1,000 a single read returns
      day: sigs.length >= 1000 && oldest != null && now - oldest < 86400 ? 1000 : within(86400),
      last: ok.slice(0, 6).map(s => ({ sig: s.signature, t: s.blockTime, slot: s.slot })),
      at: Date.now(),
    };
    at = Date.now();
    L.send(res, 200, cache, 'public, max-age=10');
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
