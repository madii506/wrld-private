# WRLD

Trade worldwide markets privately. Stocks, gold, currencies and crypto on Solana, held in a balance only your key can read.

Two pages and a handful of serverless functions:

- `/` is the home page: a voxel world in three.js. A blindfolded globe gate, a dive through it, and a scroll that walks the camera over the public city, down through the pool and along the upside-down private city.
- `/app` is the app:
  - **Markets** buys and sells xStocks, gold, EURC and crypto through Jupiter. Your own wallet signs and sends every swap.
  - **Private** derives your Privacy Rings private wallet from one signature, in the tab. It also checks whether you have published it to the registry.
  - **Scan** reads what the chain already knows about any address.
  - **Live** checks the Rings programs, the registry, the default ring and the Solana slot.

## Honest limits

- A swap through Jupiter is public, like any swap. Only what sits inside the Ring is private: the balance, and what you send from it and how much. Wallet addresses stay visible on today's Ring.
- Private moves (publish, move in, send privately, take out) stay closed in the UI until two things are true: `HELIUS_API_KEY` is set, and `PRIVATE_MOVES=1` is set after those flows have passed a live mainnet test.
- xStocks are third-party tokens that track a stock. They may not be offered where you live.

## Environment

| Variable | Needed | What it does |
| --- | --- | --- |
| `HELIUS_API_KEY` | recommended | Faster RPC for scans and status. Privacy Rings needs it for private moves. |
| `RPC_URL` | optional | Any other Solana RPC to try first. |
| `PRIVATE_MOVES` | not yet | Set to `1` only once the private moves have shipped and passed a live test. |

Without a key, reads fall back to public Solana RPCs.

## Files

- `index.html`, `app.html`, `assets/`: the static site. `assets/js/*.js` is built from `src/` with `sh build.sh` (esbuild). `rings.js` is the Privacy Rings SDK chunk. It loads only when someone derives a private wallet.
- `api/`: Vercel Node functions.
  - `markets`: prices and the market list from Jupiter.
  - `quote` and `swap`: the Jupiter quote and the unsigned transaction.
  - `send`: forwards a transaction your wallet already signed, for wallets that sign but don't send.
  - `scan`, `status`, `registered`, `config`.
  - `rpc`: an allowlisted relay for private moves.
- `dev/`: the local server (`MOCK=1` answers `/api` from fixtures) plus the screenshot and click tests.

## Local

```sh
npm install
sh build.sh
PORT=8844 MOCK=1 node dev/server.cjs
```

WRLD is independent. It is not part of Helius or Jupiter.
