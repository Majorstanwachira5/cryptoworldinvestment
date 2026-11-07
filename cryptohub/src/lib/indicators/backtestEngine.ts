import {
  AssetClass,
  BacktestStatus,
  BacktestSummary,
  BacktestTrade,
  Candle,
  TradeDirection,
} from "@/types";
import { calculateATR } from "./technical";
import { buildSignals, computeConfluence } from "./signals";

/** Timeframe label to bar duration in seconds. */
export const TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
};

/**
 * Rolls a fine series up into a coarser timeframe by grouping bars and
 * rebuilding OHLC from the constituents. Used so multi-timeframe confirmation
 * and the replay share one price source.
 */
export function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1) return candles;
  const out: Candle[] = [];

  for (let i = 0; i < candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    if (group.length === 0) continue;
    out.push({
      time: group[group.length - 1].time,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((a, c) => a + c.volume, 0),
    });
  }

  return out;
}

export interface BacktestConfig {
  symbol: string;
  assetClass: AssetClass;
  digits: number;
  /** Base per-bar volatility used for risk estimation. */
  volatility: number;
  /** Minimum absolute confluence score to open a position. */
  signalThreshold: number;
  /** Stop distance as a multiple of ATR. */
  atrStopMultiple: number;
  /** Reward distance as a multiple of ATR. */
  atrTargetMultiple: number;
  /** Bars a position may be held before a time exit. */
  maxBarsInTrade: number;
  /** Bars required before the first trade is eligible. */
  warmupBars: number;
  /** Candles fed to the indicator stack at each evaluation. */
  lookbackBars: number;
  /** Round-turn cost in basis points of notional (spread + commission). */
  costBps: number;
}

export const DEFAULT_BACKTEST_CONFIG: Omit<
  BacktestConfig,
  "symbol" | "assetClass" | "digits" | "volatility"
> = {
  signalThreshold: 25,
  atrStopMultiple: 1.5,
  atrTargetMultiple: 3,
  maxBarsInTrade: 24,
  warmupBars: 120,
  lookbackBars: 260,
  costBps: 8,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

interface ReplayResult {
  trades: BacktestTrade[];
  equityCurve: number[];
}

function replayTimeframe(config: BacktestConfig, candles: Candle[]): ReplayResult {
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [0];
  const bars = candles.length;
  const costPercent = config.costBps / 100;
  const riskDistance = config.atrTargetMultiple / config.atrStopMultiple;

  let i = config.warmupBars;

  while (i < bars - 2) {
    const window = candles.slice(
      Math.max(0, i - config.lookbackBars),
      i + 1
    );

    if (window.length < 60) break;

    const { score } = computeConfluence(buildSignals(window, config.digits));

    if (Math.abs(score) < config.signalThreshold) {
      i += 1;
      continue;
    }

    const direction: TradeDirection = score > 0 ? "LONG" : "SHORT";
    const atr = calculateATR(window, 14);
    if (!atr || atr <= 0) {
      i += 1;
      continue;
    }

    // Enter on the NEXT bar's open. Using the signal bar's own close would let
    // the backtest trade on information it could not have had.
    const entryBar = candles[i + 1];
    const entryPrice = entryBar.open;
    const stopDistance = atr * config.atrStopMultiple;
    const targetDistance = atr * config.atrTargetMultiple;

    const stopLoss =
      direction === "LONG" ? entryPrice - stopDistance : entryPrice + stopDistance;
    const takeProfit =
      direction === "LONG" ? entryPrice + targetDistance : entryPrice - targetDistance;

    let exitPrice = entryPrice;
    let exitReason: BacktestTrade["exitReason"] = "TIME";
    let barsHeld = 0;

    for (let j = i + 2; j < bars && barsHeld < config.maxBarsInTrade; j++, barsHeld++) {
      const bar = candles[j];

      if (direction === "LONG") {
        if (bar.low <= stopLoss) {
          exitPrice = stopLoss;
          exitReason = "STOP";
          break;
        }
        if (bar.high >= takeProfit) {
          exitPrice = takeProfit;
          exitReason = "TARGET";
          break;
        }
      } else {
        if (bar.high >= stopLoss) {
          exitPrice = stopLoss;
          exitReason = "STOP";
          break;
        }
        if (bar.low <= takeProfit) {
          exitPrice = takeProfit;
          exitReason = "TARGET";
          break;
        }
      }

      exitPrice = bar.close;
    }

    const grossMove =
      ((exitPrice - entryPrice) / entryPrice) * (direction === "LONG" ? 1 : -1) * 100;
    const pnlPercent = round2(grossMove - costPercent);

    trades.push({
      direction,
      entryPrice,
      exitPrice,
      entryTime: entryBar.time,
      exitTime: candles[Math.min(bars - 1, i + 2 + barsHeld)].time,
      outcome: Math.abs(pnlPercent) < 0.01 ? "BREAKEVEN" : pnlPercent > 0 ? "WIN" : "LOSS",
      pnlPercent,
      barsHeld,
      exitReason,
    });

    equityCurve.push(round2(equityCurve[equityCurve.length - 1] + pnlPercent));

    // Flat until the position is resolved: no overlapping exposure, which keeps
    // the equity curve additive and the statistics interpretable.
    i = i + 2 + barsHeld;
  }

  return { trades, equityCurve };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export const MIN_REPORTABLE_TRADES = 30;

function summarizeTrades(trades: BacktestTrade[]) {
  const wins = trades.filter((t) => t.outcome === "WIN");
  const losses = trades.filter((t) => t.outcome === "LOSS");
  const breakevens = trades.length - wins.length - losses.length;

  const grossProfit = round2(wins.reduce((a, t) => a + t.pnlPercent, 0));
  const grossLoss = round2(Math.abs(losses.reduce((a, t) => a + t.pnlPercent, 0)));
  const netPnlPercent = round2(trades.reduce((a, t) => a + t.pnlPercent, 0));

  const winRate =
    trades.length >= MIN_REPORTABLE_TRADES
      ? round2((wins.length / trades.length) * 100)
      : null;
  const winRateStatus: "calculated" | "insufficient_sample" =
    trades.length >= MIN_REPORTABLE_TRADES ? "calculated" : "insufficient_sample";

  return {
    wins,
    losses,
    breakevens,
    grossProfit,
    grossLoss,
    netPnlPercent,
    winRate,
    winRateStatus,
    averageWinPercent: wins.length > 0 ? round2(grossProfit / wins.length) : 0,
    averageLossPercent: losses.length > 0 ? round2(grossLoss / losses.length) : 0,
    profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : null,
  };
}

function maxDrawdown(curve: number[]): number {
  let peak = 0;
  let worst = 0;
  for (const point of curve) {
    if (point > peak) peak = point;
    const dd = peak - point;
    if (dd > worst) worst = dd;
  }
  return round2(worst);
}

/**
 * Runs the signal strategy over verified historical bars and aggregates results.
 *
 * Requirements:
 * 1. REAL BARS ONLY: Does not generate synthetic bars or fallback to seeded random walks.
 * 2. 30-TRADE MINIMUM: If fewer than 30 trades occurred, winRate is strictly null.
 * 3. TRANSPARENCY: Accurately reflects data source, total bars evaluated, and measurement status.
 */
export function runBacktest(
  config: BacktestConfig,
  timeframes: string[] = ["1H", "4H", "1D"],
  _barsPerTimeframe = 900,
  realSeries?: Partial<Record<string, Candle[]>>
): BacktestSummary {
  const perTimeframe: BacktestSummary["perTimeframe"] = {};
  const allTrades: BacktestTrade[] = [];

  // Filter to timeframes that actually have real bars supplied
  const supplied = timeframes.filter((tf) => (realSeries?.[tf]?.length ?? 0) > 0);

  if (supplied.length === 0) {
    return {
      symbol: config.symbol,
      strategy: `Confluence ${config.signalThreshold}+ with ${config.atrStopMultiple} ATR stop / ${config.atrTargetMultiple} ATR target`,
      timeframes: [],
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: null,
      winRateStatus: "unavailable",
      netPnlPercent: 0,
      averageWinPercent: 0,
      averageLossPercent: 0,
      profitFactor: null,
      expectancyPercent: 0,
      maxDrawdownPercent: 0,
      longWinRate: null,
      shortWinRate: null,
      perTimeframe: {},
      measuredOnRealHistory: false,
      sampleSufficient: false,
      status: "unavailable",
      methodology:
        "Historical backtest unavailable: no verified historical market data is currently present in database or provider feeds.",
      disclaimer:
        "No verified market history available. The platform never synthesizes or fabricates performance numbers.",
      barsEvaluated: 0,
    };
  }

  let totalBarsEvaluated = 0;

  for (const timeframe of supplied) {
    const series = realSeries?.[timeframe];
    // Need at least warmupBars + lookback to yield even a single trade
    if (!series || series.length < config.warmupBars + 10) {
      perTimeframe[timeframe] = {
        trades: 0,
        winRate: null,
        winRateStatus: "insufficient_data",
        netPnlPercent: 0,
      };
      continue;
    }

    totalBarsEvaluated += series.length;
    const result = replayTimeframe(config, series);
    const stats = summarizeTrades(result.trades);

    perTimeframe[timeframe] = {
      trades: result.trades.length,
      winRate: stats.winRate,
      winRateStatus: stats.winRateStatus,
      netPnlPercent: stats.netPnlPercent,
    };

    allTrades.push(...result.trades);
  }

  const stats = summarizeTrades(allTrades);
  const longTrades = allTrades.filter((t) => t.direction === "LONG");
  const shortTrades = allTrades.filter((t) => t.direction === "SHORT");
  const longWins = longTrades.filter((t) => t.outcome === "WIN").length;
  const shortWins = shortTrades.filter((t) => t.outcome === "WIN").length;

  const pooledCurve = [0];
  for (const trade of allTrades) {
    pooledCurve.push(round2(pooledCurve[pooledCurve.length - 1] + trade.pnlPercent));
  }

  const expectancyPercent =
    allTrades.length > 0 ? round2(stats.netPnlPercent / allTrades.length) : 0;

  const sampleSufficient = allTrades.length >= MIN_REPORTABLE_TRADES;
  const status: BacktestStatus = sampleSufficient ? "measured" : "insufficient_data";

  return {
    symbol: config.symbol,
    strategy: `Confluence ${config.signalThreshold}+ with ${config.atrStopMultiple} ATR stop / ${config.atrTargetMultiple} ATR target`,
    timeframes: supplied,
    totalTrades: allTrades.length,
    wins: stats.wins.length,
    losses: stats.losses.length,
    breakevens: stats.breakevens,
    winRate: stats.winRate,
    winRateStatus: stats.winRateStatus,
    netPnlPercent: stats.netPnlPercent,
    averageWinPercent: stats.averageWinPercent,
    averageLossPercent: stats.averageLossPercent,
    profitFactor: stats.profitFactor,
    expectancyPercent,
    maxDrawdownPercent: maxDrawdown(pooledCurve),
    longWinRate:
      longTrades.length >= MIN_REPORTABLE_TRADES
        ? round2((longWins / longTrades.length) * 100)
        : null,
    shortWinRate:
      shortTrades.length >= MIN_REPORTABLE_TRADES
        ? round2((shortWins / shortTrades.length) * 100)
        : null,
    perTimeframe,
    measuredOnRealHistory: true,
    sampleSufficient,
    status,
    methodology: sampleSufficient
      ? `Segmented walk-forward replay over verified market history for ${supplied.join(", ")} (${totalBarsEvaluated} total bars evaluated). ` +
        `A position opens when confluence score exceeds +/-${config.signalThreshold} and fills at next bar open. ` +
        `Exit is ${config.atrStopMultiple} ATR stop, ${config.atrTargetMultiple} ATR target, or ${config.maxBarsInTrade} bars. ` +
        `Every trade incurs ${config.costBps} bps round-turn cost.`
      : `Evaluated ${totalBarsEvaluated} verified bars across ${supplied.join(", ")}. Generated ${allTrades.length} trade(s). ` +
        `Win rate withheld: sample contains fewer than ${MIN_REPORTABLE_TRADES} trades required for statistically sound measurement.`,
    disclaimer: sampleSufficient
      ? `Historical simulation only over ${allTrades.length} actual replayed trades on verified market data. Not a guarantee of future performance.`
      : `Insufficient historical trade sample (${allTrades.length}/${MIN_REPORTABLE_TRADES} trades). Win rate is withheld rather than quoted prematurely.`,
    barsEvaluated: totalBarsEvaluated,
  };
}

/**
 * Converts a measured win rate into the break-even rate implied by the reward
 * ratio, so the readout can state plainly whether the sample beat its own hurdle.
 */
export function breakEvenWinRate(riskReward: number): number {
  if (!Number.isFinite(riskReward) || riskReward <= 0) return 0;
  return round2(clamp((1 / (1 + riskReward)) * 100, 0, 100));
}