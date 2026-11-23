// has this wallet published a private address on the Privacy Rings registry? (the record is a PDA of the owner)
const L = require('./_lib');
module.exports = async (req, res) => {
  const addr = new URL(req.url, 'http://x').searchParams.get('addr');
  if (!L.isAddr(addr)) return L.send(res, 400, { error: 'not a Solana address' });
  try {
    const { getUserRecordAddress } = await import('@heliuslabs/zolana/addresses');
    const rec = await getUserRecordAddress(addr);
    const a = await L.rpc('getAccountInfo', [rec, { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }]);
    L.send(res, 200, { address: addr, record: rec, registered: !!(a && a.value) });
  } catch (e) { L.send(res, 502, { error: String(e.message || e) }); }
};
