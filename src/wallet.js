// Wallet Standard discovery and the two things the terminal ever asks a wallet for: connect and sign a message.
const wallets = new Map();
const listeners = new Set();
function register(...ws) {
  for (const w of ws) {
    if (!w || !w.features || !w.features['standard:connect']) continue;
    if (!(w.chains || []).some(c => String(c).startsWith('solana:'))) continue;
    wallets.set(w.name, w);
  }
  listeners.forEach(f => f());
  return () => {};
}
const api = Object.freeze({ register });
try {
  window.addEventListener('wallet-standard:register-wallet', ({ detail: cb }) => { try { cb(api); } catch (e) {} });
  window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
} catch (e) {}

export const KNOWN = [
  { name: 'Phantom', url: 'https://phantom.app/download', deep: u => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}` },
  { name: 'Solflare', url: 'https://solflare.com/download', deep: u => `https://solflare.com/ul/v1/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}` },
  { name: 'Backpack', url: 'https://backpack.app/download', deep: null },
];
export function list() { return [...wallets.values()]; }
export function onChange(f) { listeners.add(f); return () => listeners.delete(f); }

let current = null, account = null;
export function state() { return { wallet: current, address: account ? account.address : null }; }
export async function connect(name, silent = false) {
  const w = wallets.get(name); if (!w) throw new Error(name + ' is not installed');
  const res = await w.features['standard:connect'].connect(silent ? { silent: true } : undefined);
  const acc = (res && res.accounts && res.accounts[0]) || (w.accounts && w.accounts[0]);
  if (!acc) throw new Error('The wallet returned no account');
  current = w; account = acc;
  try { localStorage.setItem('wrld:w', w.name); } catch (e) {}
  const ev = w.features['standard:events'];
  if (ev) ev.on('change', ({ accounts }) => { if (accounts && accounts[0]) { account = accounts[0]; listeners.forEach(f => f()); } else if (accounts) { current = null; account = null; listeners.forEach(f => f()); } });
  listeners.forEach(f => f());
  return acc.address;
}
export async function reconnect() {
  let name = null; try { name = localStorage.getItem('wrld:w'); } catch (e) {}
  if (!name) return null;
  for (let i = 0; i < 10 && !wallets.has(name); i++) await new Promise(r => setTimeout(r, 200));
  if (!wallets.has(name)) return null;
  try { return await connect(name, true); } catch (e) { return null; }
}
export async function disconnect() {
  try { const f = current && current.features['standard:disconnect']; if (f) await f.disconnect(); } catch (e) {}
  current = null; account = null;
  try { localStorage.removeItem('wrld:w'); } catch (e) {}
  listeners.forEach(f => f());
}
export async function signMessage(bytes) {
  if (!current || !account) throw new Error('Connect a wallet first');
  const f = current.features['solana:signMessage'];
  if (!f) throw new Error(current.name + ' cannot sign messages');
  const [out] = await f.signMessage({ account, message: bytes });
  return out.signature;
}

// buy and sell: the wallet signs and sends the Jupiter transaction itself; WRLD never signs or sends for you
export async function signAndSend(txBytes) {
  if (!current || !account) throw new Error('Connect a wallet first');
  const f = current.features['solana:signAndSendTransaction'];
  if (f) { const [out] = await f.signAndSendTransaction({ account, transaction: txBytes, chain: 'solana:mainnet' }); return { signature: out.signature }; }
  const g = current.features['solana:signTransaction'];
  if (!g) throw new Error(current.name + ' cannot sign transactions');
  const [out] = await g.signTransaction({ account, transaction: txBytes, chain: 'solana:mainnet' });
  return { signed: out.signedTransaction };
}
