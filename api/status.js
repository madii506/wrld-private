// is Solana Privacy Rings live? read the program, the address registry and the default ring straight from mainnet
const L = require('./_lib');
const ADDR = { ring: 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW', registry: 'regy3WAeRXMYuMYxr5iK3Bf9Arr3PcxGxyzAddbiqDQ', tree: '777pvSGe5LaBd9nCczvE2FXEauiwtfGJ5XRpjKyniGor' };
module.exports = async (req, res) => {
  try {
    const [acc, slot] = await Promise.all([L.rpc('getMultipleAccounts', [Object.values(ADDR), { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }]), L.rpc('getSlot', [{ commitment: 'confirmed' }])]);
    const out = { slot, relay: L.MOVES(), at: Date.now() };
    Object.keys(ADDR).forEach((k, i) => { const a = acc.value[i]; out[k] = { address: ADDR[k], ok: !!a, executable: a ? !!a.executable : false, owner: a ? a.owner : null }; });
    L.send(res, 200, out, 'public, max-age=10');
  } catch (e) { L.send(res, 502, { error: String(e.message || e), relay: L.MOVES() }); }
};
