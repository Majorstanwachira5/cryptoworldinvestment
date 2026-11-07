import { MarketAsset, Candle } from "@/types";

export const DEFAULT_ASSETS: MarketAsset[] = [
  {
    symbol: "BTCUSDT",
    name: "Bitcoin / Tether",
    assetClass: "CRYPTO",
    currentPrice: 64520.0,
    change24h: 3.42,
    high24h: 65180.0,
    low24h: 62410.0,
    volume24h: "3.2B",
    digits: 2,
    spread: 0.5,
  },
  {
    symbol: "ETHUSDT",
    name: "Ethereum / Tether",
    assetClass: "CRYPTO",
    currentPrice: 3485.5,
    change24h: 4.18,
    high24h: 3540.0,
    low24h: 3320.0,
    volume24h: "1.8B",
    digits: 2,
    spread: 0.2,
  },
  {
    symbol: "SOLUSDT",
    name: "Solana / Tether",
    assetClass: "CRYPTO",
    currentPrice: 158.4,
    change24h: 6.85,
    high24h: 162.1,
    low24h: 147.5,
    volume24h: "840M",
    digits: 2,
    spread: 0.05,
  },
  {
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    assetClass: "FOREX",
    currentPrice: 1.08642,
    change24h: 0.35,
    high24h: 1.0891,
    low24h: 1.0821,
    volume24h: "98.4B",
    digits: 5,
    spread: 0.00012,
  },
  {
    symbol: "GBPUSD",
    name: "British Pound / US Dollar",
    assetClass: "FOREX",
    currentPrice: 1.3045,
    change24h: 0.52,
    high24h: 1.3092,
    low24h: 1.2985,
    volume24h: "62.1B",
    digits: 5,
    spread: 0.00018,
  },
  {
    symbol: "USDJPY",
    name: "US Dollar / Japanese Yen",
    assetClass: "FOREX",
    currentPrice: 154.28,
    change24h: -0.42,
    high24h: 155.1,
    low24h: 153.85,
    volume24h: "74.8B",
    digits: 3,
    spread: 0.015,
  },
  {
    symbol: "GBPJPY",
    name: "British Pound / Japanese Yen",
    assetClass: "FOREX",
    currentPrice: 201.34,
    change24h: 0.61,
    high24h: 202.15,
    low24h: 199.82,
    volume24h: "28.4B",
    digits: 3,
    spread: 0.022,
  },
  {
    symbol: "EURJPY",
    name: "Euro / Japanese Yen",
    assetClass: "FOREX",
    currentPrice: 167.62,
    change24h: 0.08,
    high24h: 168.4,
    low24h: 166.75,
    volume24h: "41.2B",
    digits: 3,
    spread: 0.019,
  },
  {
    symbol: "AUDUSD",
    name: "Australian Dollar / US Dollar",
    assetClass: "FOREX",
    currentPrice: 0.66842,
    change24h: -0.18,
    high24h: 0.67215,
    low24h: 0.6658,
    volume24h: "54.6B",
    digits: 5,
    spread: 0.00014,
  },
  {
    symbol: "USDCAD",
    name: "US Dollar / Canadian Dollar",
    assetClass: "FOREX",
    currentPrice: 1.3582,
    change24h: 0.11,
    high24h: 1.3614,
    low24h: 1.3548,
    volume24h: "37.9B",
    digits: 5,
    spread: 0.00016,
  },
  {
    symbol: "NZDUSD",
    name: "New Zealand Dollar / US Dollar",
    assetClass: "FOREX",
    currentPrice: 0.61185,
    change24h: -0.24,
    high24h: 0.6152,
    low24h: 0.6093,
    volume24h: "12.8B",
    digits: 5,
    spread: 0.00018,
  },
  {
    symbol: "EURGBP",
    name: "Euro / British Pound",
    assetClass: "FOREX",
    currentPrice: 0.83264,
    change24h: -0.14,
    high24h: 0.8361,
    low24h: 0.8302,
    volume24h: "21.7B",
    digits: 5,
    spread: 0.00013,
  },
  {
    symbol: "XRPUSDT",
    name: "XRP / Tether",
    assetClass: "CRYPTO",
    currentPrice: 0.6214,
    change24h: 2.74,
    high24h: 0.638,
    low24h: 0.601,
    volume24h: "412M",
    digits: 4,
    spread: 0.0002,
  },
  {
    symbol: "ADAUSDT",
    name: "Cardano / Tether",
    assetClass: "CRYPTO",
    currentPrice: 0.4482,
    change24h: -1.36,
    high24h: 0.459,
    low24h: 0.441,
    volume24h: "286M",
    digits: 4,
    spread: 0.0002,
  },
  {
    symbol: "LINKUSDT",
    name: "Chainlink / Tether",
    assetClass: "CRYPTO",
    currentPrice: 14.72,
    change24h: 4.02,
    high24h: 15.08,
    low24h: 14.05,
    volume24h: "524M",
    digits: 2,
    spread: 0.02,
  },
  {
    symbol: "AVAXUSDT",
    name: "Avalanche / Tether",
    assetClass: "CRYPTO",
    currentPrice: 27.94,
    change24h: -2.88,
    high24h: 28.86,
    low24h: 27.31,
    volume24h: "198M",
    digits: 2,
    spread: 0.03,
  },
  {
    symbol: "DOTUSDT",
    name: "Polkadot / Tether",
    assetClass: "CRYPTO",
    currentPrice: 6.185,
    change24h: 1.22,
    high24h: 6.34,
    low24h: 6.02,
    volume24h: "164M",
    digits: 3,
    spread: 0.008,
  },
  {
    symbol: "LTCUSDT",
    name: "Litecoin / Tether",
    assetClass: "CRYPTO",
    currentPrice: 82.46,
    change24h: 0.94,
    high24h: 83.62,
    low24h: 80.95,
    volume24h: "342M",
    digits: 2,
    spread: 0.08,
  },
  {
    symbol: "DOGEUSDT",
    name: "Dogecoin / Tether",
    assetClass: "CRYPTO",
    currentPrice: 0.13842,
    change24h: 5.61,
    high24h: 0.1421,
    low24h: 0.1302,
    volume24h: "676M",
    digits: 5,
    spread: 0.00012,
  },
  {
    symbol: "BNBUSDT",
    name: "BNB / Tether",
    assetClass: "CRYPTO",
    currentPrice: 592.4,
    change24h: 1.63,
    high24h: 601.2,
    low24h: 581.7,
    volume24h: "1.1B",
    digits: 2,
    spread: 0.6,
  },
];

/**
 * Deterministic pseudo-random generator (mulberry32).
 * Analysis output must be reproducible: a user refreshing the panel should not
 * see a different verdict each time, and backtests must replay identically.
 */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string hash, used to derive per-symbol seeds. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Box-Muller transform: uniform noise into a normal distribution. */
function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generates realistic candlestick history for TradingView charts.
 *
 * Walks forward from a seed price with mean-reverting drift and gaussian noise
 * so the series has the autocorrelation and volatility clustering of a traded
 * market rather than pure white noise. When `seed` is omitted the series is
 * derived from basePrice, making it reproducible across requests.
 */
export function generateCandleHistory(
  basePrice: number,
  volatility: number,
  count: number = 120,
  intervalSeconds: number = 3600,
  seed?: number
): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  const digits = basePrice > 1000 ? 2 : basePrice > 10 ? 2 : basePrice > 1 ? 5 : 3;

  const effectiveSeed =
    seed ?? hashSeed(`${basePrice.toFixed(6)}:${volatility}:${count}:${intervalSeconds}`);
  const rand = createSeededRandom(effectiveSeed);

  // Per-step volatility, drifting around the requested base volatility
  let volState = volatility;
  let close = basePrice * (1 - volatility * 0.35);

  // Two slow-moving components shape the walk:
  //  - `trend` is an AR(1) drift that persists for roughly a hundred bars, so
  //    the series contains genuine trends rather than pure noise.
  //  - `pull` is a very gentle pull back toward the anchor price, with a
  //    half-life of ~170 bars. Without it a long series wanders far enough
  //    that the final rescale would flatten the earlier history; with a short
  //    half-life instead the series becomes a damped oscillation and momentum
  //    signals stop carrying any information at all.
  let trend = 0;

  // Walk forward in time so bar N is the most recent
  for (let i = 0; i < count; i++) {
    const time = now - (count - 1 - i) * intervalSeconds;

    // Volatility clustering: occasional regime shifts that decay back to mean
    volState = volState * 0.94 + volatility * 0.06;
    const shock = rand() < 0.04 ? 2.6 : 1;
    const stepVol = volState * shock;

    trend = trend * 0.99 + gaussian(rand) * volatility * 0.05;
    const pull = Math.log(basePrice / close) * 0.004;
    const change = gaussian(rand) * stepVol + trend + pull;
    const open = close;
    close = Math.max(0.0001, open * (1 + change));

    const wick = Math.abs(gaussian(rand)) * stepVol * 0.6;
    const high = Math.max(open, close) * (1 + Math.abs(wick) * 0.5);
    const low = Math.min(open, close) * (1 - Math.abs(wick) * 0.5);
    const volume = Math.floor(rand() * 50000 + 10000);

    candles.push({
      time,
      open: Number(open.toFixed(digits)),
      high: Number(high.toFixed(digits)),
      low: Number(low.toFixed(digits)),
      close: Number(close.toFixed(digits)),
      volume,
    });
  }

  // Anchor the final close to the live quoted price so analysis matches the UI
  const last = candles[candles.length - 1];
  if (last) {
    const scale = basePrice / last.close;
    for (const c of candles) {
      c.open = Number((c.open * scale).toFixed(digits));
      c.high = Number((c.high * scale).toFixed(digits));
      c.low = Number((c.low * scale).toFixed(digits));
      c.close = Number((c.close * scale).toFixed(digits));
    }
  }

  return candles;
}
