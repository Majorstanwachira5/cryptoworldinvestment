import { Bias, Candle, IndicatorSignal, TimeframeConfluence } from "@/types";
import {
  buildTrendProfile,
  calculateBollingerBands,
  calculateStochastic,
  calculateVWAP,
  findSupportResistance,
} from "./analytics";
import { calculateATR, calculateEMA, calculateMACD, calculateRSI } from "./technical";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const round = (value: number, digits: number) =>
  Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits);

/**
 * Maps a directional value in [-1, 1] onto a Bias, with a dead zone so that
 * noise around zero is reported as NEUTRAL instead of a weak opinion.
 */
export function biasFromStrength(strength: number, deadZone = 0.12): Bias {
  if (strength > deadZone) return "BULLISH";
  if (strength < -deadZone) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Individual technical signals with an explicit bias, magnitude and weight.
 *
 * Each `strength` is signed and normalised to [-1, 1] so signals are directly
 * comparable before weighting. `weight` encodes how much independent evidence
 * the signal carries; the confluence score is the weighted mean.
 */
export function buildSignals(candles: Candle[], digits: number): IndicatorSignal[] {
  if (candles.length < 30) return [];

  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const atr = calculateATR(candles, 14);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const bollinger = calculateBollingerBands(closes, 20, 2);
  const stochastic = calculateStochastic(candles, 14, 3, 3);
  const trend = buildTrendProfile(candles, digits);
  const vwap = calculateVWAP(candles, 20);

  const last20 = ema20[ema20.length - 1] ?? price;
  const last50 = ema50[ema50.length - 1] ?? price;
  const last200 = ema200.length > 0 ? ema200[ema200.length - 1] : price;

  // --- Moving average structure -------------------------------------------
  // Separation is expressed in ATR units so the same thresholds work for a
  // $64k BTC chart and a 1.0864 EURUSD chart.
  const atrSafe = atr > 0 ? atr : price * 0.001;
  const spread = last50 - last200;
  const spreadAtr = spread / atrSafe;
  const maStrength = clamp(spreadAtr / 2.5, -1, 1);
  const priceVsMa = (price - last20) / atrSafe;
  const priceStrength = clamp(priceVsMa / 2.5, -1, 1);

  // --- Momentum ------------------------------------------------------------
  // RSI is treated as a mean-reversion input in extremes and a momentum
  // input in the middle of the range, which is how it is actually used.
  let rsiStrength: number;
  let rsiDetail: string;
  if (rsi >= 70) {
    rsiStrength = -clamp((rsi - 70) / 20, 0, 1) * 0.9;
    rsiDetail = `RSI ${rsi} is overbought; stretched conditions invite profit-taking.`;
  } else if (rsi <= 30) {
    rsiStrength = clamp((30 - rsi) / 20, 0, 1) * 0.9;
    rsiDetail = `RSI ${rsi} is oversold; downside momentum is exhausting.`;
  } else {
    rsiStrength = clamp((rsi - 50) / 20, -1, 1) * 0.7;
    rsiDetail = `RSI ${rsi} shows ${rsi >= 50 ? "positive" : "negative"} momentum.`;
  }

  const macdScale = atrSafe * 0.35;
  const macdStrength = clamp(macd.histogram / (macdScale || 1), -1, 1);

  const stochStrength =
    stochastic.signal === "OVERSOLD"
      ? clamp((30 - stochastic.k) / 30, 0, 1)
      : stochastic.signal === "OVERBOUGHT"
        ? -clamp((stochastic.k - 70) / 30, 0, 1)
        : clamp((stochastic.k - 50) / 50, -1, 1) * 0.5;

  // --- Mean reversion ------------------------------------------------------
  // %B near a band with a weak trend is treated as a reversion signal; in a
  // strong trend it is discounted because bands keep riding with price.
  const trendDiscount = trend.regime === "TRENDING" ? 0.4 : 1;
  const percentBStrength =
    bollinger.percentB > 1
      ? -clamp((bollinger.percentB - 1) * 3, 0, 1)
      : bollinger.percentB < 0
        ? clamp(-bollinger.percentB * 3, 0, 1)
        : clamp((bollinger.percentB - 0.5) * -2, -1, 1) * 0.5;

  // --- Structural ----------------------------------------------------------
  const vwapStrength = clamp((price - vwap) / (atrSafe * 1.5 || 1), -1, 1);
  const adxStrength = clamp((trend.plusDI - trend.minusDI) / 30, -1, 1);

  const levels = findSupportResistance(candles, 5);
  const supports = levels.filter((l) => l.kind === "SUPPORT" && l.price < price).sort((a, b) => b.price - a.price);
  const resistances = levels.filter((l) => l.kind === "RESISTANCE" && l.price > price).sort((a, b) => a.price - b.price);
  const nearestSupport = supports[0]?.price ?? null;
  const nearestResistance = resistances[0]?.price ?? null;
  const roomToResistance =
    nearestResistance === null ? 0 : (nearestResistance - price) / (atrSafe || 1);
  const roomToSupport = nearestSupport === null ? 0 : (price - nearestSupport) / (atrSafe || 1);
  // Asymmetric room caps the payoff: a short into immediate resistance is
  // worse than a long with clear space above.
  const roomStrength = clamp((roomToResistance - roomToSupport) / 4, -1, 1);

  const signals: IndicatorSignal[] = [
    {
      id: "ema_structure",
      label: "Moving Average Structure",
      bias: biasFromStrength(maStrength),
      strength: round(maStrength, 3),
      weight: 1.4,
      value: `EMA50 ${round(last50, digits)} / EMA200 ${round(last200, digits)}`,
      detail: `${trend.description}`,
    },
    {
      id: "price_vs_ma",
      label: "Price vs EMA 20",
      bias: biasFromStrength(priceStrength),
      strength: round(priceStrength, 3),
      weight: 0.9,
      value: `${priceVsMa >= 0 ? "+" : ""}${round(priceVsMa, 2)} ATR from EMA20`,
      detail:
        priceVsMa > 0.75
          ? "Price is extended above its short-term mean; pullback risk increases."
          : priceVsMa < -0.75
            ? "Price is extended below its short-term mean; mean reversion pressure is upward."
            : "Price is holding close to its short-term mean.",
    },
    {
      id: "rsi",
      label: "RSI (14)",
      bias: biasFromStrength(rsiStrength),
      strength: round(rsiStrength, 3),
      weight: 1.1,
      value: rsi.toFixed(2),
      detail: rsiDetail,
    },
    {
      id: "macd",
      label: "MACD (12,26,9)",
      bias: biasFromStrength(macdStrength),
      strength: round(macdStrength, 3),
      weight: 1.2,
      value: `hist ${round(macd.histogram, digits > 3 ? 5 : 2)}`,
      detail: `Histogram ${macd.histogram >= 0 ? "above" : "below"} signal line${
        macd.cross === "NEUTRAL" ? ", no fresh cross." : `, ${macd.cross === "BULLISH_CROSS" ? "bullish" : "bearish"} cross.`
      }`,
    },
    {
      id: "stochastic",
      label: "Stochastic (14,3,3)",
      bias: biasFromStrength(stochStrength),
      strength: round(stochStrength, 3),
      weight: 0.8,
      value: `%K ${stochastic.k} / %D ${stochastic.d}`,
      detail: `Stochastic is ${stochastic.signal.toLowerCase()}.`,
    },
    {
      id: "bollinger",
      label: "Bollinger Bands (20,2)",
      bias: biasFromStrength(percentBStrength * trendDiscount),
      strength: round(percentBStrength * trendDiscount, 3),
      weight: 0.8,
      value: `%B ${round(bollinger.percentB, 2)}`,
      detail: `Price sits at ${round(bollinger.percentB * 100, 0)}% of the band${
        trendDiscount < 1 ? "; discounted because the market is trending." : "."
      }`,
    },
    {
      id: "vwap",
      label: "VWAP (20)",
      bias: biasFromStrength(vwapStrength),
      strength: round(vwapStrength, 3),
      weight: 0.7,
      value: round(vwap, digits).toString(),
      detail:
        price >= vwap
          ? "Price is trading at or above VWAP; session buyers are in control."
          : "Price is trading below VWAP; session sellers are in control.",
    },
    {
      id: "adx",
      label: "ADX / DMI (14)",
      bias: biasFromStrength(adxStrength),
      strength: round(adxStrength, 3),
      weight: 0.9,
      value: `ADX ${trend.adx} (+DI ${trend.plusDI} / -DI ${trend.minusDI})`,
      detail: `Trend strength is ${trend.regime.toLowerCase()}.`,
    },
    {
      id: "structure",
      label: "Support / Resistance Room",
      bias: biasFromStrength(roomStrength),
      strength: round(roomStrength, 3),
      weight: 1.0,
      value:
        nearestSupport !== null || nearestResistance !== null
          ? `S ${nearestSupport ?? "-"} / R ${nearestResistance ?? "-"}`
          : "No clean pivots",
      detail:
        nearestResistance !== null && roomToResistance < 1
          ? "Resistance sits within one ATR overhead, limiting upside room."
          : nearestSupport !== null && roomToSupport < 1
            ? "Support sits within one ATR below, leaving little downside cushion."
            : "Price has structural room in both directions.",
    },
  ];

  return signals;
}

export interface ConfluenceResult {
  /** Weighted mean of signed signal strengths, scaled to -100..100. */
  score: number;
  bias: Bias;
  /** Share of total weight agreeing with the resolved bias, 0..100. */
  agreement: number;
  /** Signal coherence 0..100, combining magnitude and agreement. */
  confidence: number;
  signals: IndicatorSignal[];
}

/**
 * Reduces the signal set to a single scored opinion.
 *
 * `score` is directional conviction in [-100, 100]. `confidence` is a
 * measure of how coherent the evidence is, NOT a probability of profit. The
 * two are reported separately on purpose: conflating them is how tools end up
 * promising win rates the data does not support.
 */
export function computeConfluence(signals: IndicatorSignal[]): ConfluenceResult {
  const active = signals.filter((s) => s.weight > 0);
  const totalWeight = active.reduce((a, s) => a + s.weight, 0);

  if (totalWeight === 0) {
    return { score: 0, bias: "NEUTRAL", agreement: 0, confidence: 0, signals };
  }

  const weighted = active.reduce((a, s) => a + s.strength * s.weight, 0) / totalWeight;
  const score = round(clamp(weighted, -1, 1) * 100, 1);
  const bias = biasFromStrength(weighted);

  let agreement: number;
  if (bias === "NEUTRAL") {
    // With no resolved direction, agreement measures how much of the evidence
    // is actually committed rather than sitting in the dead zone.
    const committed = active.filter((s) => Math.abs(s.strength) > 0.12);
    agreement = round(
      (committed.reduce((a, s) => a + s.weight, 0) / totalWeight) * 100,
      0
    );
  } else {
    const direction = bias === "BULLISH" ? 1 : -1;
    agreement = round(
      (active.filter((s) => Math.sign(s.strength) === direction).reduce((a, s) => a + s.weight, 0) /
        totalWeight) *
        100,
      0
    );
  }

  // Confidence blends raw magnitude with how much of the weight agrees.
  // Squaring the agreement term stops a 55/45 split from reading as strong.
  const magnitude = Math.min(1, Math.abs(weighted) / 0.55);
  const coherence = (agreement / 100) ** 2;
  const confidence = round(clamp((magnitude * 0.6 + coherence * 0.4) * 100, 0, 100), 0);

  return { score, bias, agreement, confidence, signals };
}

/**
 * Derives a per-timeframe bias for multi-timeframe confirmation.
 */
export function summarizeTimeframe(
  timeframe: string,
  candles: Candle[],
  digits: number
): TimeframeConfluence {
  const confluence = computeConfluence(buildSignals(candles, digits));
  return {
    timeframe,
    bias: confluence.bias,
    score: confluence.score,
    candles: candles.length,
  };
}

/**
 * Combines per-timeframe biases into a single higher-timeframe bias.
 *
 * The active analysis timeframe counts double because it is the timeframe the
 * user is actually trading; longer timeframes get progressively more weight
 * since they carry more information about regime.
 */
export function aggregateTimeframes(
  frames: TimeframeConfluence[],
  primaryTimeframe: string
): { bias: Bias; score: number } {
  if (frames.length === 0) return { bias: "NEUTRAL", score: 0 };

  const horizonWeight: Record<string, number> = { "1m": 0.5, "5m": 0.6, "15m": 0.8, "1H": 1.2, "4H": 1.4, "1D": 1.6 };
  let weighted = 0;
  let totalWeight = 0;

  for (const frame of frames) {
    const w = (frame.timeframe === primaryTimeframe ? 2 : 1) * (horizonWeight[frame.timeframe] ?? 1);
    weighted += frame.score * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return { bias: "NEUTRAL", score: 0 };
  const score = round(weighted / totalWeight, 1);
  return { bias: biasFromStrength(score / 100), score };
}