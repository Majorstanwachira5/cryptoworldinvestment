import { Candle, PriceLevel, TrendProfile, VolatilityProfile } from "@/types";
import { calculateATR, calculateEMA, calculateMACD, calculateRSI } from "./technical";

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const window = prices.slice(-period);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

export function calculateStdDev(prices: number[], period: number): number {
  if (prices.length < 2) return 0;
  const window = prices.slice(-period);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length;
  return Math.sqrt(variance);
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  multiplier: number = 2
): BollingerBands {
  if (prices.length < period) {
    const price = prices[prices.length - 1] || 0;
    return { upper: price, middle: price, lower: price, bandwidth: 0, percentB: 0.5 };
  }

  const middle = calculateSMA(prices, period);
  const stdDev = calculateStdDev(prices, period);
  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  const width = upper - lower;
  const price = prices[prices.length - 1];

  return {
    upper,
    middle,
    lower,
    bandwidth: middle === 0 ? 0 : (width / middle) * 100,
    percentB: width === 0 ? 0.5 : (price - lower) / width,
  };
}

export interface StochasticResult {
  k: number;
  d: number;
  signal: "OVERSOLD" | "OVERBOUGHT" | "NEUTRAL";
}

/**
 * Stochastic Oscillator (%K / %D) over the closing range of the lookback.
 */
export function calculateStochastic(
  candles: Candle[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): StochasticResult {
  if (candles.length < period) {
    return { k: 50, d: 50, signal: "NEUTRAL" };
  }

  const window = candles.slice(-period);
  const highest = Math.max(...window.map((c) => c.high));
  const lowest = Math.min(...window.map((c) => c.low));
  const close = candles[candles.length - 1].close;
  const range = highest - lowest;
  const rawK = range === 0 ? 50 : ((close - lowest) / range) * 100;

  // Approximate smoothing by averaging recent raw %K values
  const recentRaw: number[] = [];
  for (let i = Math.max(0, candles.length - smoothK); i < candles.length; i++) {
    const w = candles.slice(Math.max(0, i - period + 1), i + 1);
    const hi = Math.max(...w.map((c) => c.high));
    const lo = Math.min(...w.map((c) => c.low));
    const r = hi - lo;
    recentRaw.push(r === 0 ? 50 : ((candles[i].close - lo) / r) * 100);
  }
  const k = recentRaw.reduce((a, b) => a + b, 0) / recentRaw.length;

  const kSeries: number[] = [];
  for (let i = Math.max(0, candles.length - smoothD); i < candles.length; i++) {
    const w = candles.slice(Math.max(0, i - period + 1), i + 1);
    const hi = Math.max(...w.map((c) => c.high));
    const lo = Math.min(...w.map((c) => c.low));
    const r = hi - lo;
    kSeries.push(r === 0 ? 50 : ((candles[i].close - lo) / r) * 100);
  }
  const d = kSeries.reduce((a, b) => a + b, 0) / kSeries.length;

  let signal: StochasticResult["signal"] = "NEUTRAL";
  if (k < 20) signal = "OVERSOLD";
  else if (k > 80) signal = "OVERBOUGHT";

  return { k: Math.round(k * 100) / 100, d: Math.round(d * 100) / 100, signal };
}

export interface AdxResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

/**
 * Average Directional Index with Wilder smoothing.
 * ADX measures trend strength regardless of direction; +DI/-DI give direction.
 */
export function calculateADX(candles: Candle[], period: number = 14): AdxResult {
  if (candles.length < period * 2) {
    return { adx: 0, plusDI: 0, minusDI: 0 };
  }

  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];

    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close)
      )
    );

    const upMove = current.high - prev.high;
    const downMove = prev.low - current.low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder smoothing
  let trSum = 0;
  let plusSum = 0;
  let minusSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += trueRanges[i];
    plusSum += plusDM[i];
    minusSum += minusDM[i];
  }

  const dxValues: number[] = [];
  const computeDx = (tr: number, p: number, m: number) => {
    if (tr === 0) return 0;
    const plusDI = (p / tr) * 100;
    const minusDI = (m / tr) * 100;
    const sum = plusDI + minusDI;
    return sum === 0 ? 0 : (Math.abs(plusDI - minusDI) / sum) * 100;
  };

  dxValues.push(computeDx(trSum, plusSum, minusSum));

  for (let i = period; i < trueRanges.length; i++) {
    trSum = trSum - trSum / period + trueRanges[i];
    plusSum = plusSum - plusSum / period + plusDM[i];
    minusSum = minusSum - minusSum / period + minusDM[i];
    dxValues.push(computeDx(trSum, plusSum, minusSum));
  }

  const adxWindow = dxValues.slice(-period);
  const adx = adxWindow.reduce((a, b) => a + b, 0) / adxWindow.length;

  const tr = trueRanges.slice(-period).reduce((a, b) => a + b, 0);
  const p = plusDM.slice(-period).reduce((a, b) => a + b, 0);
  const m = minusDM.slice(-period).reduce((a, b) => a + b, 0);
  const plusDI = tr === 0 ? 0 : (p / tr) * 100;
  const minusDI = tr === 0 ? 0 : (m / tr) * 100;

  return {
    adx: Math.round(adx * 100) / 100,
    plusDI: Math.round(plusDI * 100) / 100,
    minusDI: Math.round(minusDI * 100) / 100,
  };
}

/**
 * Volume Weighted Average Price across the lookback.
 */
export function calculateVWAP(candles: Candle[], period: number = 20): number {
  if (candles.length === 0) return 0;
  const window = candles.slice(-period);
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (const c of window) {
    const typical = (c.high + c.low + c.close) / 3;
    cumulativePV += typical * c.volume;
    cumulativeVolume += c.volume;
  }

  return cumulativeVolume === 0 ? window[window.length - 1].close : cumulativePV / cumulativeVolume;
}

/**
 * Swing-pivot support and resistance.
 *
 * Locates local highs/lows, then clusters levels that fall within a tolerance
 * band so repeatedly-tested prices are reported as single strong zones.
 */
export function findSupportResistance(candles: Candle[], lookback: number = 5): PriceLevel[] {
  if (candles.length < lookback * 2 + 5) return [];

  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) highs.push(candles[i].high);
    if (isLow) lows.push(candles[i].low);
  }

  const price = candles[candles.length - 1].close;
  const tolerance = price * 0.006;
  const cluster = (values: number[], kind: "SUPPORT" | "RESISTANCE") => {
    if (values.length === 0) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const groups: number[][] = [];

    for (const v of sorted) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && Math.abs(v - lastGroup[lastGroup.length - 1]) <= tolerance) {
        lastGroup.push(v);
      } else {
        groups.push([v]);
      }
    }

    return groups.map((g) => {
      const levelPrice = g.reduce((a, b) => a + b, 0) / g.length;
      const touches = g.length;
      const strength = touches >= 4 ? "STRONG" : touches >= 2 ? "MODERATE" : "WEAK";
      return { price: levelPrice, kind, touches, strength } as PriceLevel;
    });
  };

  return [...cluster(highs, "RESISTANCE"), ...cluster(lows, "SUPPORT")].sort(
    (a, b) => b.price - a.price
  );
}

/**
 * Classify the volatility regime from ATR as a percentage of price.
 */
export function buildVolatilityProfile(candles: Candle[], digits: number): VolatilityProfile {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1] || 0;
  const atr = calculateATR(candles, 14);
  const atrPercent = price === 0 ? 0 : (atr / price) * 100;
  const bollinger = calculateBollingerBands(closes, 20, 2);

  let regime: VolatilityProfile["regime"] = "NORMAL";
  if (atrPercent < 0.15) regime = "COMPRESSED";
  else if (atrPercent < 1.2) regime = "NORMAL";
  else if (atrPercent < 3) regime = "ELEVATED";
  else regime = "EXTREME";

  const description =
    regime === "COMPRESSED"
      ? "Volatility is compressed. Breakouts often follow tight ranges, but the direction is unresolved until price leaves the band."
      : regime === "NORMAL"
        ? "Volatility sits in its typical range. Standard stop distances are appropriate."
        : regime === "ELEVATED"
          ? "Volatility is elevated. Widen stops or reduce size to hold risk per trade constant."
          : "Volatility is extreme. Stops are prone to being swept by noise; size down sharply.";

  return {
    atr: Number(atr.toFixed(digits)),
    atrPercent: Math.round(atrPercent * 100) / 100,
    regime,
    bollinger: {
      upper: Number(bollinger.upper.toFixed(digits)),
      middle: Number(bollinger.middle.toFixed(digits)),
      lower: Number(bollinger.lower.toFixed(digits)),
      bandwidth: Math.round(bollinger.bandwidth * 100) / 100,
      percentB: Math.round(bollinger.percentB * 1000) / 1000,
    },
    description,
  };
}

/**
 * Trend strength and moving-average structure.
 */
export function buildTrendProfile(candles: Candle[], digits: number): TrendProfile {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1] || 0;
  const ema50Series = calculateEMA(closes, 50);
  const ema200Series = calculateEMA(closes, 200);
  const ema50 = ema50Series[ema50Series.length - 1] || price;
  const ema200 = ema200Series[ema200Series.length - 1] || price;
  const adx = calculateADX(candles, 14);

  let regime: TrendProfile["regime"] = "RANGING";
  if (adx.adx >= 25) regime = "TRENDING";
  else if (adx.adx >= 18) regime = "EMERGING";

  const emaSpreadPercent = ema200 === 0 ? 0 : ((ema50 - ema200) / ema200) * 100;

  const structure =
    ema50 > ema200 && price > ema50
      ? "EMA 50 above EMA 200 with price leading: intact uptrend structure."
      : ema50 < ema200 && price < ema50
        ? "EMA 50 below EMA 200 with price lagging: intact downtrend structure."
        : "Price and moving averages are interleaved: no clean trend structure.";

  const directional =
    regime === "TRENDING"
      ? adx.plusDI > adx.minusDI
        ? "Directional pressure favours buyers."
        : "Directional pressure favours sellers."
      : regime === "EMERGING"
        ? "Trend is forming but is not yet confirmed."
        : "No dominant trend; mean reversion conditions dominate.";

  return {
    adx: adx.adx,
    plusDI: adx.plusDI,
    minusDI: adx.minusDI,
    regime,
    ema50: Number(ema50.toFixed(digits)),
    ema200: Number(ema200.toFixed(digits)),
    emaSpreadPercent: Math.round(emaSpreadPercent * 100) / 100,
    description: `${structure} ADX ${adx.adx} indicates ${regime.toLowerCase()} conditions. ${directional}`,
  };
}

export { calculateATR, calculateEMA, calculateMACD, calculateRSI };