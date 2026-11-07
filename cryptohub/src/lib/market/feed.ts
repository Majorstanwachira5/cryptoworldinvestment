import {
  AssetClass,
  Candle,
  FeedSource,
  FreshnessState,
  MarketAsset,
  Ticker,
} from "@/types";
import { DEFAULT_ASSETS } from "./assets";
import { db } from "@/lib/db";

/**
 * Market data feed.
 *
 * Resolves real prices and real historical candles:
 *  - CRYPTO comes from Binance public REST API (real-time).
 *  - FOREX uses Twelve Data when TWELVE_DATA_API_KEY is configured (intraday quotes and bars).
 *  - Without TWELVE_DATA_API_KEY, forex falls back to European Central Bank reference
 *    rate from Frankfurter (updated once per business day, explicitly flagged `delayed`).
 *  - Every quote carries an explicit `freshness` ("live" | "stale" | "delayed" | "unavailable")
 *    and epoch `timestamp`.
 *  - Stale prices are NEVER labeled "live".
 */

const BINANCE_BASE = "https://api.binance.com";
const TWELVE_DATA_BASE = "https://api.twelvedata.com";
const FRANKFURTER_BASE = "https://api.frankfurter.app";

const REQUEST_TIMEOUT_MS = 8000;
const KLINE_ATTEMPTS = 2;

/** How long a resolved ticker value may be reused before a fresh fetch is initiated. */
export const TICKER_TTL_MS = 5_000;
export const CANDLES_TTL_MS = 30_000;

/** Tick size for a decimal precision accepted by lightweight-charts. */
export function tickSizeFor(digits: number): number {
  return Number(`1e-${Math.max(0, Math.min(8, digits))}`);
}

/**
 * Validates candle array integrity:
 * - OHLC relationship: high >= low, high >= open, high >= close, low <= open, low <= close
 * - Monotonically increasing time
 * - No duplicate timestamps
 * - Positive prices
 */
export function validateCandles(candles: Candle[], digits = 2): Candle[] {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const valid: Candle[] = [];
  const seen = new Set<number>();

  for (const c of candles) {
    if (
      !c ||
      typeof c.time !== "number" ||
      !Number.isFinite(c.time) ||
      c.time <= 0 ||
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      c.open <= 0 ||
      c.high <= 0 ||
      c.low <= 0 ||
      c.close <= 0 ||
      c.high < c.low ||
      c.high < c.open ||
      c.high < c.close ||
      c.low > c.open ||
      c.low > c.close
    ) {
      continue;
    }

    if (seen.has(c.time)) continue;
    seen.add(c.time);

    valid.push({
      time: Math.floor(c.time),
      open: round(c.open, digits),
      high: round(c.high, digits),
      low: round(c.low, digits),
      close: round(c.close, digits),
      volume: Number.isFinite(c.volume) && c.volume >= 0 ? c.volume : 0,
    });
  }

  valid.sort((a, b) => a.time - b.time);
  return valid;
}

export interface CandleSeries {
  symbol: string;
  interval: string;
  /**
   * False when the provider could only supply a coarser series than the one
   * requested, so the caller can say so instead of quietly substituting it.
   */
  timeframeHonoured: boolean;
  candles: Candle[];
  source: FeedSource;
  delayed: boolean;
}

function digitsFor(symbol: string): number {
  return DEFAULT_ASSETS.find((a) => a.symbol === symbol)?.digits ?? 2;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True for failures that are worth one more attempt: a dropped connection, a DNS
 * timeout, or a request that ran out of time is momentary, and treating any of
 * them as a dead provider is what pushed assets onto the fallback.
 */
function isTransient(error: unknown): boolean {
  const code = (error as { cause?: { code?: string } })?.cause?.code;
  const name = (error as { name?: string })?.name;
  return (
    error instanceof TypeError ||
    name === "AbortError" ||
    code === "EAI_AGAIN" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_FAIL"
  );
}

async function fetchJson<T>(
  url: string,
  headers: Record<string, string> = {},
  attempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`provider responded ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      const retriable = isTransient(error) || /provider responded 5\d\d/.test(String(error));
      if (!retriable || attempt === attempts) throw error;
      await sleep(200 * attempt);
    }
  }

  throw lastError;
}

/** Maps the platform's timeframe buttons to Binance interval codes. */
export function toBinanceInterval(timeframe: string): string {
  switch (timeframe.toUpperCase()) {
    case "1M":
      return "1m";
    case "5M":
      return "5m";
    case "15M":
      return "15m";
    case "1H":
      return "1h";
    case "4H":
      return "4h";
    case "1D":
      return "1d";
    default:
      return "1h";
  }
}

/** Maps the platform's timeframe buttons to Twelve Data interval codes. */
function toTwelveInterval(timeframe: string): string {
  return toBinanceInterval(timeframe);
}

// ---------------------------------------------------------------- crypto

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
}

/**
 * Binance returns klines as positional tuples, not objects:
 * `[openTime, open, high, low, close, volume, closeTime, ...]`.
 *
 * Reading named fields off them yields undefined for every value, which is why
 * the crypto chart was rendering empty bars before this was mapped by index.
 */
type BinanceKline = [number, string, string, string, string, string, number, ...unknown[]];

/**
 * Binance returns every listed pair from one request, so the whole crypto book
 * costs a single call. Fetching per symbol raced twenty connections at the same
 * host and the queue behind them timed out, leaving every asset on the fallback.
 *
 * The snapshot expires: holding the resolved promise forever froze every price
 * at the first fetch while the UI kept labelling it live.
 */
let binanceTickers: { map: Map<string, BinanceTicker>; expiresAt: number } | null = null;
let allTickersInflight: Promise<Map<string, BinanceTicker>> | null = null;

function loadBinanceTickers(): Promise<Map<string, BinanceTicker>> {
  if (binanceTickers && binanceTickers.expiresAt > Date.now()) {
    return Promise.resolve(binanceTickers.map);
  }
  if (allTickersInflight) return allTickersInflight;

  allTickersInflight = fetchJson<BinanceTicker[]>(`${BINANCE_BASE}/api/v3/ticker/24hr`)
    .then((rows) => {
      const map = new Map(rows.map((row) => [row.symbol, row]));
      binanceTickers = { map, expiresAt: Date.now() + TICKER_TTL_MS };
      return map;
    })
    .finally(() => {
      allTickersInflight = null;
    });

  return allTickersInflight;
}

async function fetchBinanceTicker(symbol: string): Promise<Ticker> {
  const data = (await loadBinanceTickers()).get(symbol);
  if (!data) throw new Error(`no Binance market for ${symbol}`);

  const digits = digitsFor(symbol);
  const now = Date.now();
  return {
    symbol,
    price: round(Number(data.lastPrice), digits),
    change24h: round(Number(data.priceChangePercent), 2),
    high24h: round(Number(data.highPrice), digits),
    low24h: round(Number(data.lowPrice), digits),
    volume24h: Number(data.quoteVolume),
    source: "binance" as FeedSource,
    delayed: false,
    timestamp: now,
    freshness: "live" as FreshnessState,
  };
}

async function fetchBinanceCandles(
  symbol: string,
  timeframe: string,
  limit = 200
): Promise<Candle[]> {
  const interval = toBinanceInterval(timeframe);
  const rows = await fetchJson<BinanceKline[]>(
    `${BINANCE_BASE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${interval}&limit=${limit}`,
    {},
    KLINE_ATTEMPTS
  );

  const digits = digitsFor(symbol);
  return rows.map((k) => ({
    // Binance returns milliseconds; the platform works in seconds.
    time: Math.floor(k[0] / 1000),
    open: round(Number(k[1]), digits),
    high: round(Number(k[2]), digits),
    low: round(Number(k[3]), digits),
    close: round(Number(k[4]), digits),
    volume: Number(k[5]),
  }));
}

// ------------------------------------------------------------------ forex

function twelveKey(): string | null {
  return process.env.TWELVE_DATA_API_KEY || null;
}

/**
 * Twelve Data expects explicit pairs. The platform's symbols are already in
 * the `BASEQUOTE` form the provider uses.
 */
function toTwelveSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

interface TwelveQuote {
  status?: string;
  code?: number;
  close?: string;
  percent_change?: string;
  fifty_two_week_high?: string;
  fifty_two_week_low?: string;
  volume?: string;
  message?: string;
}

interface TwelveTimeSeries {
  status?: string;
  code?: number;
  message?: string;
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
}

async function fetchTwelveTicker(symbol: string): Promise<Ticker> {
  const key = twelveKey();
  if (!key) throw new Error("TWELVE_DATA_API_KEY is not configured");

  const url =
    `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(toTwelveSymbol(symbol))}` +
    `&apikey=${encodeURIComponent(key)}`;
  const data = await fetchJson<TwelveQuote>(url);

  if (data.status === "error" || data.code) {
    throw new Error(data.message || `Twelve Data error ${data.code}`);
  }
  if (!data.close) throw new Error("Twelve Data returned no close price");

  const digits = digitsFor(symbol);
  const now = Date.now();
  return {
    symbol,
    price: round(Number(data.close), digits),
    change24h: round(Number(data.percent_change || 0), 2),
    high24h: round(Number(data.fifty_two_week_high || data.close), digits),
    low24h: round(Number(data.fifty_two_week_low || data.close), digits),
    volume24h: Number(data.volume || 0),
    source: "twelvedata" as FeedSource,
    delayed: false,
    timestamp: now,
    freshness: "live" as FreshnessState,
  };
}

async function fetchTwelveCandles(
  symbol: string,
  timeframe: string,
  limit = 200
): Promise<Candle[]> {
  const key = twelveKey();
  if (!key) throw new Error("TWELVE_DATA_API_KEY is not configured");

  const url =
    `${TWELVE_DATA_BASE}/time_series?symbol=${encodeURIComponent(toTwelveSymbol(symbol))}` +
    `&interval=${toTwelveInterval(timeframe)}&outputsize=${limit}&apikey=${encodeURIComponent(key)}`;

  const data = await fetchJson<TwelveTimeSeries>(url);
  if (data.status === "error" || data.code || !data.values) {
    throw new Error(data.message || `Twelve Data error ${data.code}`);
  }

  const digits = digitsFor(symbol);
  return data.values.map((v) => ({
    // Twelve Data returns "YYYY-MM-DD HH:mm:ss" in UTC for intraday.
    time: Math.floor(Date.parse(v.datetime.replace(" ", "T") + "Z") / 1000),
    open: round(Number(v.open), digits),
    high: round(Number(v.high), digits),
    low: round(Number(v.low), digits),
    close: round(Number(v.close), digits),
    volume: Number(v.volume || 0),
  }));
}

/**
 * ECB reference rates, quoted against EUR.
 *
 * Used only when no paid forex feed is configured. These publish once per
 * business day, so cross rates are derived from EUR rather than fetched
 * directly, and the result is always flagged delayed.
 */
interface FrankfurterResponse {
  date: string;
  rates: Record<string, number>;
}

/** Shared across every forex pair, which is how eight pairs cost one call. */
let ecbRatesInflight: Promise<Record<string, number>> | null = null;

function loadEcbRates(): Promise<Record<string, number>> {
  if (ecbRatesInflight) return ecbRatesInflight;

  ecbRatesInflight = fetchJson<FrankfurterResponse>(
    `${FRANKFURTER_BASE}/latest?from=EUR&to=USD,GBP,JPY,AUD,CAD,NZD`
  )
    .then((data) => data.rates)
    .catch((error) => {
      ecbRatesInflight = null;
      throw error;
    });

  return ecbRatesInflight;
}

/** Derives a cross rate from ECB EUR-based quotes. */
function crossRate(eur: Record<string, number>, base: string, quote: string): number | null {
  const perEur = (c: string) => (c === "EUR" ? 1 : eur[c]);
  const basePerEur = perEur(base);
  const quotePerEur = perEur(quote);
  if (!basePerEur || !quotePerEur) return null;
  // 1 base = (1/basePerEur EUR) = (1/basePerEur) * quotePerEur quote
  return quotePerEur / basePerEur;
}

async function fetchEcbTicker(symbol: string): Promise<Ticker> {
  const eur = await loadEcbRates();
  const [base, quote] = [symbol.slice(0, 3), symbol.slice(3, 6)];
  const rate = crossRate(eur, base, quote);
  if (!rate) throw new Error(`ECB does not publish ${symbol}`);

  const digits = digitsFor(symbol);
  const now = Date.now();
  return {
    symbol,
    price: round(rate, digits),
    change24h: 0,
    high24h: round(rate, digits),
    low24h: round(rate, digits),
    volume24h: 0,
    source: "ecb" as FeedSource,
    delayed: true,
    timestamp: now,
    freshness: "delayed" as FreshnessState,
  };
}

/**
 * Daily-rate bars for forex when no intraday feed exists.
 *
 * The ECB publishes one fix per business day, so there is no intraday series to
 * return. Rather than fabricate one, this returns the published daily history.
 * The chart therefore shows a real daily line rather than an intraday chart that
 * was invented, and the UI states that forex is on a daily reference rate until
 * a feed key is configured.
 */
const ECB_HISTORY_DAYS = 180;

interface FrankfurterSeriesResponse {
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
}

async function fetchEcbCandles(symbol: string): Promise<Candle[]> {
  const end = new Date();
  const start = new Date(end.getTime() - ECB_HISTORY_DAYS * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const data = await fetchJson<FrankfurterSeriesResponse>(
    `${FRANKFURTER_BASE}/${iso(start)}..${iso(end)}?from=EUR&to=USD,GBP,JPY,AUD,CAD,NZD`
  );

  const [base, quote] = [symbol.slice(0, 3), symbol.slice(3, 6)];
  const digits = digitsFor(symbol);
  const candles: Candle[] = [];

  for (const [date, rates] of Object.entries(data.rates)) {
    const rate = crossRate(rates, base, quote);
    if (!rate) continue;

    const price = round(rate, digits);
    candles.push({
      time: Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000),
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
    });
  }

  candles.sort((a, b) => a.time - b.time);
  return candles;
}

// ------------------------------------------------------------- resolution

function fallbackTicker(symbol: string): Ticker {
  const asset = DEFAULT_ASSETS.find((a) => a.symbol === symbol) || DEFAULT_ASSETS[0];
  const now = Date.now();
  return {
    symbol,
    price: asset.currentPrice,
    change24h: asset.change24h,
    high24h: asset.high24h,
    low24h: asset.low24h,
    volume24h: 0,
    source: "fallback" as FeedSource,
    delayed: true,
    timestamp: now,
    freshness: "unavailable" as FreshnessState,
  };
}

export async function resolveTicker(symbol: string, assetClass: AssetClass): Promise<Ticker> {
  try {
    if (assetClass === "CRYPTO") return await fetchBinanceTicker(symbol);
    if (twelveKey()) return await fetchTwelveTicker(symbol);
    return await fetchEcbTicker(symbol);
  } catch (error) {
    // The cause is what distinguishes a provider outage from a network or DNS
    // failure here, and those need different fixes.
    const cause = (error as { cause?: { message?: string; code?: string } }).cause;
    console.warn(
      `[feed] ticker ${symbol} unavailable:`,
      (error as Error).message,
      cause ? `(${cause.code ?? ""} ${cause.message ?? ""})` : ""
    );
    return fallbackTicker(symbol);
  }
}

export async function resolveCandles(
  symbol: string,
  assetClass: AssetClass,
  timeframe: string,
  limit = CHART_BARS
): Promise<CandleSeries> {
  try {
    if (assetClass === "CRYPTO") {
      return {
        symbol,
        interval: toBinanceInterval(timeframe),
        timeframeHonoured: true,
        candles: await fetchBinanceCandles(symbol, timeframe, limit),
        source: "binance",
        delayed: false,
      };
    }

    if (twelveKey()) {
      return {
        symbol,
        interval: toTwelveInterval(timeframe),
        timeframeHonoured: true,
        candles: await fetchTwelveCandles(symbol, timeframe, limit),
        source: "twelvedata",
        delayed: false,
      };
    }

    // Daily reference rates are the only forex series available without a key,
    // so the returned interval is 1d whatever was asked for. Reporting the
    // request here would let the chart claim an intraday resolution it lacks.
    return {
      symbol,
      interval: "1d",
      timeframeHonoured: false,
      candles: await fetchEcbCandles(symbol),
      source: "ecb",
      delayed: true,
    };
  } catch (error) {
    console.warn(`[feed] candles ${symbol} unavailable:`, (error as Error).message);
    return {
      symbol,
      interval: timeframe,
      timeframeHonoured: false,
      candles: [],
      source: "fallback",
      delayed: true,
    };
  }
}

/**
 * Real bars for several timeframes at once, for the analysis engine.
 *
 * Returns whatever the feed can supply. Any timeframe it cannot fill is simply
 * absent from the result, and the caller falls back to generated history for
 * that one, so a partial outage degrades instead of failing the report.
 */
export async function getSeriesForAnalysis(
  symbol: string,
  assetClass: AssetClass,
  timeframes: string[]
): Promise<Partial<Record<string, Candle[]>>> {
  const settled = await Promise.all(
    timeframes.map(async (tf) => {
      try {
        const series = await getCandles(symbol, assetClass, tf, ANALYSIS_BARS);
        if (series.candles.length === 0) return [tf, null] as const;

        // A daily reference rate is still real data, so `delayed` does not
        // disqualify it. What disqualifies it is being filed under an interval
        // it does not represent: without this, the ECB would hand the same
        // daily bars back for 1H and 4H and those would be replayed as though
        // they were intraday history.
        const requested = toBinanceInterval(tf);
        const usable = series.timeframeHonoured || series.interval === requested;
        return [tf, usable ? series.candles : null] as const;
      } catch {
        return [tf, null] as const;
      }
    })
  );

  const out: Partial<Record<string, Candle[]>> = {};
  for (const [tf, candles] of settled) {
    if (candles) out[tf] = candles;
  }
  return out;
}

// ------------------------------------------------------------------ cache

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  pending?: Promise<T>;
}

const tickerCache = new Map<string, CacheEntry<Ticker>>();
const candleCache = new Map<string, CacheEntry<CandleSeries>>();

/**
 * Cached, de-duplicated fetch.
 *
 * A single in-flight request is shared by all concurrent callers, which matters
 * because every browser tab polls the ticker and the provider will rate-limit
 * a burst of identical requests.
 */
async function cached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttl: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && hit.expiresAt > now) return hit.value;
  if (hit?.pending) return hit.pending;

  const pending = loader()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { value: hit?.value as T, expiresAt: 0, pending });
  return pending;
}

/** Bars the chart renders. Enough to fill the viewport without a heavy payload. */
const CHART_BARS = 200;

/**
 * Bars the analysis engine replays.
 *
 * The strategy needs 120 warmup bars before its first eligible position and 260
 * bars of lookback per evaluation, so 200 bars left too few trades to measure
 * anything. Binance serves up to 1000 klines per request.
 */
const ANALYSIS_BARS = 1000;

export function getTicker(symbol: string, assetClass: AssetClass): Promise<Ticker> {
  return cached(tickerCache, `${symbol}:t`, TICKER_TTL_MS, () => resolveTicker(symbol, assetClass));
}

export function getCandles(
  symbol: string,
  assetClass: AssetClass,
  timeframe: string,
  limit = CHART_BARS
): Promise<CandleSeries> {
  // The limit is part of the cache key: a 200-bar chart response must never be
  // handed to a caller that asked for 1000.
  return cached(candleCache, `${symbol}:${timeframe}:${limit}:c`, CANDLES_TTL_MS, () =>
    resolveCandles(symbol, assetClass, timeframe, limit)
  );
}

/** Resolves the full asset list with live prices merged in. */
export async function getLiveAssets(): Promise<{
  assets: MarketAsset[];
  sources: Record<string, FeedSource>;
  delayed: string[];
}> {
  const settled = await Promise.all(
    DEFAULT_ASSETS.map(async (asset) => ({
      asset,
      ticker: await getTicker(asset.symbol, asset.assetClass),
    }))
  );

  const sources: Record<string, FeedSource> = {};
  const delayed: string[] = [];

  const assets = settled.map(({ asset, ticker }) => {
    sources[asset.symbol] = ticker.source;
    if (ticker.delayed) delayed.push(asset.symbol);

    return {
      ...asset,
      currentPrice: ticker.price,
      change24h: ticker.change24h,
      high24h: ticker.high24h,
      low24h: ticker.low24h,
      volume24h: formatVolume(ticker.volume24h, asset.volume24h),
    };
  });

  return { assets, sources, delayed };
}

function formatVolume(value: number, fallback: string): string {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  if (value >= 1e9) return `${round(value / 1e9, 1)}B`;
  if (value >= 1e6) return `${round(value / 1e6, 1)}M`;
  if (value >= 1e3) return `${round(value / 1e3, 1)}K`;
  return String(round(value, 0));
}