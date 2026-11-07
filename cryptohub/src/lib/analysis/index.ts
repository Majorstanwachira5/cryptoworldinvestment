import {
  AccountPerformance,
  AccountType,
  AnalysisReport,
  AssetClass,
  Bias,
  Balance,
  Candle,
  TimeframeConfluence,
  Trade,
  TradeDirection,
} from "@/types";
import { DEFAULT_ASSETS, generateCandleHistory, hashSeed } from "@/lib/market/assets";
import { db } from "@/lib/db";
import { calculateATR } from "@/lib/indicators/technical";
import {
  buildSignals,
  computeConfluence,
  aggregateTimeframes,
} from "@/lib/indicators/signals";
import {
  aggregateCandles,
  breakEvenWinRate,
  DEFAULT_BACKTEST_CONFIG,
  runBacktest,
  TIMEFRAME_SECONDS,
} from "@/lib/indicators/backtestEngine";
import {
  buildTrendProfile,
  buildVolatilityProfile,
  findSupportResistance,
} from "@/lib/indicators/analytics";
import { getPipSize } from "@/lib/trading/pips";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Base volatility per bar, matching the chart feed. */
function baseVolatility(assetClass: AssetClass): number {
  return assetClass === "FOREX" ? 0.003 : 0.015;
}

/**
 * Longest history is always generated at 1H and rolled up, so every
 * higher timeframe is a genuine aggregation of the same prices rather than an
 * independent series that could disagree with it.
 */
const BASE_BARS = 7200;

interface TimeframeSeries {
  timeframe: string;
  candles: Candle[];
}

/**
 * Real bars for the requested timeframes, when the market feed can supply them.
 *
 * Without this the report is computed from a seeded random walk, which meant the
 * Analysis panel described a series that had nothing to do with the chart the
 * user was looking at. Where real history exists it is used; where the feed has
 * nothing, the synthetic generator remains as an explicit fallback.
 */
export type RealSeries = Partial<Record<string, Candle[]>>;

function buildTimeframeSeries(
  symbol: string,
  price: number,
  volatility: number,
  timeframes: string[],
  realSeries?: RealSeries
): TimeframeSeries[] {
  const out: TimeframeSeries[] = [];

  for (const timeframe of timeframes) {
    const real = realSeries?.[timeframe];
    if (real && real.length > 0) {
      out.push({ timeframe, candles: real });
      continue;
    }

    const step = TIMEFRAME_SECONDS[timeframe] ?? 3600;

    // Higher timeframes are a genuine aggregation of the 1H base rather than an
    // independent series that could disagree with it.
    if (step > 3600 && realSeries?.["1H"] && realSeries["1H"].length > 0) {
      const factor = Math.max(1, Math.round(step / 3600));
      out.push({
        timeframe,
        candles: aggregateCandles(realSeries["1H"], factor).slice(-720),
      });
      continue;
    }

    out.push({
      timeframe,
      candles: generateBase(symbol, price, volatility, step, 720, timeframe),
    });
  }

  return out;
}

function generateBase(
  symbol: string,
  price: number,
  volatility: number,
  intervalSeconds = 3600,
  count = BASE_BARS,
  seedSuffix = "base"
): Candle[] {
  return generateCandleHistory(
    price,
    volatility,
    count,
    intervalSeconds,
    hashSeed(`${symbol}:${seedSuffix}:${price.toFixed(6)}:${count}`)
  );
}

function verdictFromScore(score: number): AnalysisReport["verdict"] {
  if (score >= 45) return "STRONG_LONG";
  if (score >= 12) return "LEAN_LONG";
  if (score > -12) return "NEUTRAL";
  if (score > -45) return "LEAN_SHORT";
  return "STRONG_SHORT";
}

function directionFromBias(bias: Bias): TradeDirection | null {
  if (bias === "BULLISH") return "LONG";
  if (bias === "BEARISH") return "SHORT";
  return null;
}

/**
 * Tallies this account's own closed trades.
 *
 * These are the only win-rate numbers in the report that describe money that
 * was actually at risk, so they are kept strictly separate from the backtest.
 */
export function computeAccountPerformance(
  trades: Trade[],
  accountType: AccountType
): AccountPerformance | null {
  const closed = trades.filter(
    (t) => t.status === "CLOSED" && (t.accountType || "REAL") === accountType
  );

  if (closed.length === 0) return null;

  // Oldest first so the drawdown walk follows the real order of events.
  const ordered = [...closed].sort(
    (a, b) => new Date(a.closedAt ?? a.openedAt).getTime() - new Date(b.closedAt ?? b.openedAt).getTime()
  );

  const winsArr = ordered.filter((t) => t.pnl > 0);
  const lossesArr = ordered.filter((t) => t.pnl < 0);
  const grossProfit = round2(winsArr.reduce((a, t) => a + t.pnl, 0));
  const grossLoss = round2(Math.abs(lossesArr.reduce((a, t) => a + t.pnl, 0)));
  const netPnl = round2(ordered.reduce((a, t) => a + t.pnl, 0));

  let peak = 0;
  let running = 0;
  let maxDrawdown = 0;
  for (const t of ordered) {
    running = round2(running + t.pnl);
    if (running > peak) peak = running;
    const dd = round2(peak - running);
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    accountType,
    closedTrades: ordered.length,
    wins: winsArr.length,
    losses: lossesArr.length,
    winRate: round2((winsArr.length / ordered.length) * 100),
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : null,
    averageWin: winsArr.length > 0 ? round2(grossProfit / winsArr.length) : 0,
    averageLoss: lossesArr.length > 0 ? round2(grossLoss / lossesArr.length) : 0,
    largestWin: winsArr.length > 0 ? round2(Math.max(...winsArr.map((t) => t.pnl))) : 0,
    largestLoss: lossesArr.length > 0 ? round2(Math.min(...lossesArr.map((t) => t.pnl))) : 0,
    maxDrawdown,
  };
}

interface SetupInput {
  symbol: string;
  assetClass: AssetClass;
  digits: number;
  direction: TradeDirection;
  candles: Candle[];
  price: number;
  balance: Balance;
  riskPercent: number;
  leverage: number;
}

interface SetupResult {
  setup: AnalysisReport["setup"];
  notes: string[];
}

/**
 * Sizes a position so the stop costs exactly the account's risk budget.
 *
 * Size is derived, never guessed: it is the largest position whose stop
 * distance equals the permitted risk. If even the smallest permissible
 * position breaches the budget, no setup is offered rather than returning a
 * size that violates the risk policy.
 */
function buildTradeSetup(input: SetupInput): SetupResult {
  const notes: string[] = [];
  const { candles, price, direction, symbol, assetClass, digits, balance } = input;

  const atr = calculateATR(candles, 14);
  if (!atr || atr <= 0) {
    return { setup: null, notes: ["ATR unavailable on this series; no position sizing."] };
  }

  let stopDistance = atr * 1.5;

  // Respect structure: if a swing level sits just inside the ATR stop, push
  // the stop beyond it so the stop is not sitting in obvious noise.
  const levels = findSupportResistance(candles, 5);
  const buffer = atr * 0.25;
  if (direction === "LONG") {
    const supports = levels
      .filter((l) => l.kind === "SUPPORT" && l.price < price && price - l.price < stopDistance)
      .sort((a, b) => b.price - a.price);
    if (supports[0]) {
      const extended = price - supports[0].price + buffer;
      if (extended > stopDistance) {
        stopDistance = extended;
        notes.push("Stop widened to sit below the nearest swing support rather than inside it.");
      }
    }
  } else {
    const resistances = levels
      .filter((l) => l.kind === "RESISTANCE" && l.price > price && l.price - price < stopDistance)
      .sort((a, b) => a.price - b.price);
    if (resistances[0]) {
      const extended = resistances[0].price - price + buffer;
      if (extended > stopDistance) {
        stopDistance = extended;
        notes.push("Stop widened to sit above the nearest swing resistance rather than inside it.");
      }
    }
  }

  const targetMultiple = 2;
  const targetDistance = stopDistance * targetMultiple;

  const stopLoss =
    direction === "LONG" ? price - stopDistance : price + stopDistance;
  const takeProfit =
    direction === "LONG" ? price + targetDistance : price - targetDistance;

  if (stopLoss <= 0 || takeProfit <= 0) {
    return { setup: null, notes: ["Computed stop or target is not a tradable price."] };
  }

  const riskBudget = round2((balance.equity * input.riskPercent) / 100);
  if (riskBudget <= 0) {
    return {
      setup: null,
      notes: [
        input.balance.equity <= 0
          ? "Account equity is $0.00, so there is nothing to risk. Fund the account to size a position."
          : "Risk budget rounds to $0.00 at this equity; no position offered.",
      ],
    };
  }

  const isForex = assetClass === "FOREX";
  const pipSize = getPipSize(symbol, assetClass);

  let size: number;
  let riskAmount: number;
  let rewardAmount: number;

  if (isForex) {
    const pipsRisked = stopDistance / pipSize;
    const pipValuePerLot = symbol.includes("JPY") ? 1000 / price : 10;
    const minLots = 0.01;
    size = riskBudget / (pipsRisked * pipValuePerLot);
    riskAmount = pipsRisked * pipValuePerLot * size;
    rewardAmount = riskAmount * targetMultiple;
    // Enforce the broker minimum, then re-check that the minimum still fits.
    if (size < minLots) {
      notes.push(
        `Risk budget of $${riskBudget.toFixed(2)} is below the 0.01 lot minimum; no position offered.`
      );
      return { setup: null, notes };
    }
    size = Math.floor(size * 100) / 100;
    riskAmount = round2(pipsRisked * pipValuePerLot * size);
    rewardAmount = round2(riskAmount * targetMultiple);
  } else {
    const minUnits = symbol.includes("BTC") ? 0.001 : symbol.includes("ETH") ? 0.01 : 1;
    size = riskBudget / stopDistance;
    if (size < minUnits) {
      notes.push(
        `Risk budget of $${riskBudget.toFixed(2)} is below the ${minUnits} unit minimum; no position offered.`
      );
      return { setup: null, notes };
    }
    const decimals = minUnits >= 1 ? 3 : 4;
    size = Math.floor(size * Math.pow(10, decimals)) / Math.pow(10, decimals);
    riskAmount = round2(stopDistance * size);
    rewardAmount = round2(targetDistance * size);
  }

  if (riskAmount > riskBudget) {
    notes.push("Rounded-down size still exceeded the risk budget; no position offered.");
    return { setup: null, notes };
  }

  const notional = isForex ? size * 100000 * price : size * price;
  const marginRequired = round2(notional / input.leverage);

  if (marginRequired > balance.freeMargin) {
    notes.push(
      `Margin required ($${marginRequired.toFixed(2)}) exceeds free margin ($${balance.freeMargin.toFixed(2)}).`
    );
    return { setup: null, notes };
  }

  const warnings: string[] = [];
  if (riskAmount > round2(balance.equity * 0.02)) {
    warnings.push("Risk exceeds the 2% per-trade guideline.");
  }
  if (balance.marginLevelPct < 200 && balance.marginLevelPct !== 9999) {
    warnings.push(
      `Margin level is ${balance.marginLevelPct.toFixed(0)}%; adding size raises liquidation risk.`
    );
  }

  return {
    setup: {
      direction,
      entry: Number(price.toFixed(digits)),
      stopLoss: Number(stopLoss.toFixed(digits)),
      takeProfit: Number(takeProfit.toFixed(digits)),
      riskRewardRatio: targetMultiple,
      riskAmount,
      rewardAmount,
      size: Number(size.toFixed(size < 1 ? 4 : 3)),
      sizeUnit: isForex ? "LOTS" : "UNITS",
      riskPercent: round2((riskAmount / balance.equity) * 100),
      marginRequired,
      leverage: input.leverage,
      warnings,
    },
    notes,
  };
}

export interface BuildReportOptions {
  /** Owner of the data this report is built for. */
  userId: string;
  symbol: string;
  timeframe: string;
  accountType: AccountType;
  currentPrice?: number;
  includeBacktest?: boolean;
  /**
   * Real historical bars keyed by timeframe. Supplied by the caller from the
   * market feed so the report scores the same series the chart is drawing.
   */
  realSeries?: RealSeries;
}

const REPORT_TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"];

/**
 * Assembles the full analysis report: indicators, multi-timeframe confluence,
 * a risk-sized setup, this account's realised record, and a replay of the
 * strategy over generated history.
 *
 * DEMO and REAL run the SAME analysis. The difference is what the account can
 * act on: an unfunded REAL account gets no position sizing, and no account ever
 * gets a win rate that was not measured from data.
 */
export function buildAnalysisReport(options: BuildReportOptions): AnalysisReport {
  const {
    userId,
    symbol,
    timeframe,
    accountType,
    includeBacktest = true,
  } = options;

  const asset =
    DEFAULT_ASSETS.find((a) => a.symbol === symbol) || DEFAULT_ASSETS[0];
  const digits = asset.digits;
  const price = options.currentPrice ?? asset.currentPrice;
  const volatility = baseVolatility(asset.assetClass);

  const requested = REPORT_TIMEFRAMES.includes(timeframe) ? timeframe : "1H";
  const orderedTimeframes = [requested, ...REPORT_TIMEFRAMES.filter((tf) => tf !== requested)];

  const series = buildTimeframeSeries(symbol, price, volatility, orderedTimeframes, options.realSeries);
  const primary = series.find((s) => s.timeframe === requested) || series[0];
  const candles = primary.candles;

  const signals = buildSignals(candles, digits);
  const confluence = computeConfluence(signals);

  const multiTimeframe: TimeframeConfluence[] = series.map((s) => {
    const tfSignals = buildSignals(s.candles, digits);
    const tf = computeConfluence(tfSignals);
    return { timeframe: s.timeframe, bias: tf.bias, score: tf.score, candles: s.candles.length };
  });

  const higherTimeframes = multiTimeframe.filter((t) => t.timeframe !== requested);
  const higherAgreement = aggregateTimeframes(higherTimeframes, requested);

  // The verdict blends the active timeframe with the higher timeframes. When
  // they disagree the score is pulled back toward neutral rather than
  // resolved in favour of the chart the user is looking at.
  const combinedScore = round2(confluence.score * 0.65 + higherAgreement.score * 0.35);
  const bias: Bias =
    Math.sign(combinedScore) !== Math.sign(confluence.score) &&
    Math.abs(combinedScore) < 20 &&
    Math.abs(confluence.score) > 12
      ? "NEUTRAL"
      : combinedScore >= 12
        ? "BULLISH"
        : combinedScore <= -12
          ? "BEARISH"
          : "NEUTRAL";

  // Higher-timeframe disagreement damps confidence rather than flipping it.
  const alignment = bias === "NEUTRAL" ? 0.6 : Math.sign(combinedScore) === Math.sign(confluence.score) ? 1 : 0.65;
  const confidence = Math.round(confluence.confidence * alignment);

  const balance = db.getBalance(userId, accountType);
  const user = db.getUser(userId);

  const direction = directionFromBias(bias);
  let setup: AnalysisReport["setup"] = null;
  const notes: string[] = [];

  if (direction && confidence >= 30 && balance.equity > 0) {
    const result = buildTradeSetup({
      symbol: asset.symbol,
      assetClass: asset.assetClass,
      digits,
      direction,
      candles,
      price,
      balance,
      riskPercent: Math.min(user.riskTolerancePercent || 2, accountType === "REAL" ? 2 : 5),
      leverage: 20,
    });
    setup = result.setup;
    notes.push(...result.notes);
  } else if (!direction) {
    notes.push("Signals conflict across timeframes. No directional edge, so no position is offered.");
  } else if (balance.equity <= 0) {
    notes.push(
      accountType === "REAL"
        ? "The REAL account holds $0.00. Analysis runs normally, but there is no capital to risk until a deposit is confirmed."
        : "Account equity is $0.00; no position can be sized."
    );
  } else {
    notes.push(
      `Confidence is ${confidence}%, below the 30% floor required to size a position.`
    );
  }

  const performance = computeAccountPerformance(db.getTrades(userId, accountType), accountType);

  const backtest = includeBacktest
    ? runBacktest(
        {
          ...DEFAULT_BACKTEST_CONFIG,
          symbol: asset.symbol,
          assetClass: asset.assetClass,
          digits,
          volatility,
        },
        // Replay the same real history the signals were computed from. Running
        // the win rate against generated prices while the signals came from the
        // market would report a measured figure for a series nobody traded.
        ["1H", "4H", "1D"],
        900,
        options.realSeries
      )
    : null;

  const trend = buildTrendProfile(candles, digits);
  const volatilityProfile = buildVolatilityProfile(candles, digits);
  const levels = findSupportResistance(candles, 5);

  if (backtest && !backtest.sampleSufficient) {
    notes.push(
      `Replay produced only ${backtest.totalTrades} trade${backtest.totalTrades === 1 ? "" : "s"} ` +
        `over ${backtest.timeframes.join(", ")} history, which is too few to quote a win rate. ` +
        (backtest.measuredOnRealHistory
          ? "A longer history is needed before this strategy can be judged."
          : "No market history was available, so no measured rate is shown.")
    );
  } else if (backtest && backtest.totalTrades > 0) {
    const rr = DEFAULT_BACKTEST_CONFIG.atrTargetMultiple / DEFAULT_BACKTEST_CONFIG.atrStopMultiple;
    const hurdle = breakEvenWinRate(rr);
    notes.push(
      `Measured strategy win rate over ${backtest.totalTrades} replayed trades is ${backtest.winRate ?? "n/a"}%. ` +
        `A 1:${rr.toFixed(1)} payoff needs ${hurdle}% to break even, so the sample is ${
          (backtest.winRate ?? 0) >= hurdle ? "above" : "below"
        } its own hurdle.`
    );
    if (backtest.maxDrawdownPercent > 0) {
      notes.push(`Worst peak-to-trough drawdown across the sample was ${backtest.maxDrawdownPercent}%.`);
    }
  }

  if (performance) {
    notes.push(
      `${performance.closedTrades} closed ${accountType} trade${performance.closedTrades === 1 ? "" : "s"} on record: ` +
        `${performance.wins}W / ${performance.losses}L, ${performance.winRate ?? "n/a"}% win rate, net ${
          performance.netPnl >= 0 ? "+" : ""
        }$${performance.netPnl.toFixed(2)}.`
    );
  } else {
    notes.push(
      `No closed ${accountType} trades yet, so there is no realised win rate for this account. The figures above are a historical replay only.`
    );
  }

  notes.push(
    "Confidence measures how coherent the indicators are. It is not a probability of profit."
  );

  return {
    symbol: asset.symbol,
    assetClass: asset.assetClass,
    timeframe: requested,
    accountType,
    generatedAt: new Date().toISOString(),
    price: Number(price.toFixed(digits)),
    digits,
    confluenceScore: combinedScore,
    bias,
    agreement: confluence.agreement,
    confidence,
    verdict: verdictFromScore(combinedScore),
    signals,
    trend,
    volatility: volatilityProfile,
    levels,
    multiTimeframe,
    setup,
    performance,
    backtest,
    notes,
  };
}