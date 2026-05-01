// Crypto prices via CoinGecko public API (no key required, ~30 req/min free tier).
// Replaces the YFinance crypto path for these specific tokens because YF has
// inconsistent coverage (RNDR/RENDER ticker migration, AR listing gaps, etc.).
//
// Coverage: BTC, ETH, SOL, AVAX, RNDR (Render), AR (Arweave).
// Output shape matches the client's markets.crypto consumer:
//   { crypto: [{ symbol, name, price, change, changePct, marketCap }], count, timestamp }

const COINS = [
  { symbol: 'BTC',   cgId: 'bitcoin',      name: 'Bitcoin' },
  { symbol: 'ETH',   cgId: 'ethereum',     name: 'Ethereum' },
  { symbol: 'SOL',   cgId: 'solana',       name: 'Solana' },
  { symbol: 'AVAX',  cgId: 'avalanche-2',  name: 'Avalanche' },
  { symbol: 'RNDR',  cgId: 'render-token', name: 'Render' },
  { symbol: 'AR',    cgId: 'arweave',      name: 'Arweave' },
];

const BASE = 'https://api.coingecko.com/api/v3';

export async function briefing() {
  const ids = COINS.map(c => c.cgId).join(',');
  const url = `${BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'SON-OSINT/1.0' },
    });
    clearTimeout(t);
    if (!r.ok) {
      return {
        source: 'Crypto/CoinGecko',
        timestamp: new Date().toISOString(),
        status: 'error',
        error: `HTTP ${r.status}`,
        crypto: [],
      };
    }
    const j = await r.json();
    const crypto = COINS.map(c => {
      const d = j[c.cgId];
      if (!d) return null;
      const price = d.usd;
      const changePct = d.usd_24h_change;
      const prevClose = price && changePct != null ? price / (1 + changePct / 100) : null;
      const change = prevClose != null ? price - prevClose : null;
      return {
        symbol: c.symbol,
        name: c.name,
        price: Number(price?.toFixed(price > 1000 ? 2 : price > 1 ? 3 : 6)),
        change: change != null ? Number(change.toFixed(2)) : null,
        changePct: changePct != null ? Number(changePct.toFixed(2)) : null,
        marketCap: d.usd_market_cap ? Math.round(d.usd_market_cap) : null,
      };
    }).filter(Boolean);

    return {
      source: 'Crypto/CoinGecko',
      timestamp: new Date().toISOString(),
      status: 'ok',
      crypto,
      count: crypto.length,
    };
  } catch (e) {
    clearTimeout(t);
    return {
      source: 'Crypto/CoinGecko',
      timestamp: new Date().toISOString(),
      status: 'error',
      error: e.message,
      crypto: [],
    };
  }
}

// Run standalone: `node apis/sources/crypto.mjs`
if (process.argv[1]?.endsWith('crypto.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
