import { Candle } from "@/types";

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const emaValues: number[] = [];

  // Seed with Simple Moving Average for the first period
  let sum = 0;
  const initialLength = Math.min(period, prices.length);
  for (let i = 0; i < initialLength; i++) {
    sum += prices[i];
  }
  let currentEma = sum / initialLength;
  emaValues.push(currentEma);

  for (let i = initialLength; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    emaValues.push(currentEma);
  }
  return emaValues;
}

/**
 * Calculates Relative Strength Index (RSI - 14)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 50.0;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      const currentLoss = Math.abs(diff);
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Math.round(rsi * 100) / 100;
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMACD(prices: number[]) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);

  const macdLine: number[] = [];
  const offset = 26 - 12;

  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }

  const signalLine = calculateEMA(macdLine, 9);
  const currentMacd = macdLine[macdLine.length - 1] || 0;
  const currentSignal = signalLine[signalLine.length - 1] || 0;
  const prevMacd = macdLine[macdLine.length - 2] || currentMacd;
  const prevSignal = signalLine[signalLine.length - 2] || currentSignal;

  const histogram = currentMacd - currentSignal;

  let cross: "BULLISH_CROSS" | "BEARISH_CROSS" | "NEUTRAL" = "NEUTRAL";
  if (prevMacd <= prevSignal && currentMacd > currentSignal) {
    cross = "BULLISH_CROSS";
  } else if (prevMacd >= prevSignal && currentMacd < currentSignal) {
    cross = "BEARISH_CROSS";
  }

  return {
    macdLine: Math.round(currentMacd * 100) / 100,
    signalLine: Math.round(currentSignal * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
    cross,
  };
}

/**
 * Calculates Average True Range (ATR - 14) for volatility & dynamic SL/TP
 */
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < 2) return candles[0]?.close * 0.015 || 10;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
    trs.push(tr);
  }

  const recent = trs.slice(-period);
  const sum = recent.reduce((a, b) => a + b, 0);
  return sum / recent.length;
}
