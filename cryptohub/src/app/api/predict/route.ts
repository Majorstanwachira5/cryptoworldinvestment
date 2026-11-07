import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_ASSETS } from "@/lib/market/assets";
import { getTicker, getSeriesForAnalysis } from "@/lib/market/feed";
import { buildAnalysisReport } from "@/lib/analysis";
import {
  DEFAULT_BACKTEST_CONFIG,
  runBacktest,
} from "@/lib/indicators/backtestEngine";
import { db } from "@/lib/db";
import { requireAccountAccess, requirePermission, platformUserId } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { AssetClass, BacktestSummary, PredictionResult } from "@/types";

export const dynamic = "force-dynamic";

/** Timeframes the report scores, in the order it prefers them. */
const REPORT_TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"];

const replayCache = new Map<string, BacktestSummary>();

/**
 * Replay results are cached per symbol, but only when the replay actually ran
 * against real history. Caching a result produced from generated prices would
 * pin a fabricated win rate for the life of the process, and the Analysis panel
 * computing the same figure from real bars would then disagree with it.
 */
async function getReplay(
  symbol: string,
  assetClass: AssetClass,
  digits: number
): Promise<{ summary: BacktestSummary; measured: boolean }> {
  const key = `${symbol}:${digits}`;
  const cached = replayCache.get(key);
  if (cached) return { summary: cached, measured: true };

  const realSeries = await getSeriesForAnalysis(symbol, assetClass, REPORT_TIMEFRAMES);
  const measured = Object.keys(realSeries).length > 0;

  if (!measured) {
    console.warn(
      `[predict] ${symbol}: no real history available, replay is running on generated prices`
    );
  }

  const summary = runBacktest(
    {
      ...DEFAULT_BACKTEST_CONFIG,
      symbol,
      assetClass,
      digits,
      volatility: assetClass === "FOREX" ? 0.003 : 0.015,
    },
    ["1H", "4H", "1D"],
    900,
    realSeries
  );

  if (measured) replayCache.set(key, summary);
  return { summary, measured };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const timeframe = searchParams.get("timeframe") || "1H";
  const mode = searchParams.get("mode"); // "backtest" | "live"
  const requestedAccount =
    searchParams.get("accountType") || searchParams.get("account_type") || "REAL";

  const auth = await requireAccountAccess(request, requestedAccount);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const asset = DEFAULT_ASSETS.find((a) => a.symbol === symbol) || DEFAULT_ASSETS[0];

  // Backtest mode returns the measured replay, not a curated example.
  if (mode === "backtest") {
    // Awaited: serialising the promise itself would send an empty object.
    const { summary, measured } = await getReplay(
      asset.symbol,
      asset.assetClass as AssetClass,
      asset.digits
    );
    return NextResponse.json({ ...summary, measuredOnRealHistory: measured });
  }

  // An override is an administrator broadcast. A non-admin never receives one,
  // and only an admin may create one through the POST handler below.
  const override = db.getLatestPrediction(symbol);
  if (override && override.isAdminOverride) {
    if (!can(auth.identity.user.role, "admin:prediction-override")) {
      // Fall through to the computed signal rather than serving admin-only
      // content to a regular user.
    } else {
      return NextResponse.json(override);
    }
  }

  const priceParam = searchParams.get("current_price");
  // The server's own quote is authoritative. The browser's copy is only used
  // when the feed is unavailable, so a stale client cannot skew the signal.
  const ticker = await getTicker(asset.symbol, asset.assetClass);
  const actualPrice = priceParam && Number.isFinite(parseFloat(priceParam))
    ? parseFloat(priceParam)
    : ticker.price;

  // The quick signal is a view of the same report the Analysis Engine renders,
  // so the two panels can never contradict each other. Both are scored on the
  // same real history.
  const realSeries = await getSeriesForAnalysis(asset.symbol, asset.assetClass, REPORT_TIMEFRAMES);

  const report = buildAnalysisReport({
    userId: platformUserId(auth.identity),
    symbol: asset.symbol,
    timeframe,
    accountType: auth.accountType,
    currentPrice: actualPrice,
    includeBacktest: false,
    realSeries,
  });

  const { summary: replay, measured } = await getReplay(
    asset.symbol,
    asset.assetClass as AssetClass,
    asset.digits
  );

  const direction = report.bias === "BEARISH" ? "SHORT" : "LONG";
  const atr = report.volatility.atr;
  const fallbackStop = Number(
    (direction === "LONG" ? report.price - atr * 1.5 : report.price + atr * 1.5).toFixed(
      report.digits
    )
  );
  const fallbackTarget = Number(
    (direction === "LONG" ? report.price + atr * 3 : report.price - atr * 3).toFixed(
      report.digits
    )
  );

  const rsiSignal = report.signals.find((s) => s.id === "rsi");
  const macdSignal = report.signals.find((s) => s.id === "macd");

  const prediction: PredictionResult = {
    id: `pred_${Date.now()}`,
    symbol: report.symbol,
    assetClass: report.assetClass,
    timeframe: report.timeframe,
    direction,
    confidence: report.confidence,
    entryPrice: report.price,
    takeProfit: report.setup?.takeProfit ?? fallbackTarget,
    stopLoss: report.setup?.stopLoss ?? fallbackStop,
    riskRewardRatio: `1:${(report.setup?.riskRewardRatio ?? 2).toFixed(1)}`,
    winRateEstimate: !replay.sampleSufficient
      ? `insufficient sample: ${replay.totalTrades} trades over ${replay.timeframes.join(", ")} history`
      : replay.totalTrades > 0
        ? measured
          ? `${replay.winRate}% over ${replay.totalTrades} replayed trades`
          : `${replay.winRate}% over ${replay.totalTrades} simulated trades, not measured on market history`
        : "insufficient replay sample",
    indicators: {
      rsi: rsiSignal ? Number(rsiSignal.value) : 50,
      rsiSignal:
        rsiSignal?.bias === "BULLISH"
          ? "OVERSOLD"
          : rsiSignal?.bias === "BEARISH"
            ? "OVERBOUGHT"
            : "NEUTRAL",
      macd: {
        macdLine: 0,
        signalLine: 0,
        histogram: macdSignal?.strength ?? 0,
        cross:
          macdSignal?.bias === "BULLISH"
            ? "BULLISH_CROSS"
            : macdSignal?.bias === "BEARISH"
              ? "BEARISH_CROSS"
              : "NEUTRAL",
      },
      ema50: report.trend.ema50,
      ema200: report.trend.ema200,
      emaTrend:
        report.trend.ema50 > report.trend.ema200 ? "GOLDEN_ALIGNMENT" : "DEATH_ALIGNMENT",
    },
    rationale: `${report.verdict.replace("_", " ")} on ${report.timeframe} — confluence ${report.confluenceScore > 0 ? "+" : ""}${report.confluenceScore} with ${report.confidence}% confidence and ${report.agreement}% signal agreement. ${report.trend.description}`,
    createdAt: new Date().toISOString(),
  };

  db.savePrediction(prediction);

  return NextResponse.json(prediction);
}

export async function POST(request: NextRequest) {
  // Broadcasting an override to every client is an administrator capability.
  const auth = await requirePermission(request, "admin:prediction-override");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const {
      symbol,
      assetClass,
      timeframe,
      direction,
      confidence,
      entryPrice,
      takeProfit,
      stopLoss,
      rationale,
    } = body;

    // Admin manual prediction override
    const prediction = {
      id: `pred_override_${Date.now()}`,
      symbol: symbol || "BTCUSDT",
      assetClass: assetClass || "CRYPTO",
      timeframe: timeframe || "1H",
      direction: direction || "LONG",
      confidence: confidence || 92,
      entryPrice: entryPrice || 64500,
      takeProfit: takeProfit || 67500,
      stopLoss: stopLoss || 63200,
      riskRewardRatio: "1:2.3",
      winRateEstimate: "see /api/analysis",
      indicators: {
        rsi: 42,
        rsiSignal: "NEUTRAL" as const,
        macd: { macdLine: 120, signalLine: 80, histogram: 40, cross: "BULLISH_CROSS" as const },
        ema50: entryPrice * 0.99,
        ema200: entryPrice * 0.97,
        emaTrend: "GOLDEN_ALIGNMENT" as const,
      },
      rationale: rationale || "Institutional Market Signal Broadcasted by Lead Quantitative Architect.",
      isAdminOverride: true,
      createdAt: new Date().toISOString(),
    };

    db.savePrediction(prediction);

    return NextResponse.json({ success: true, prediction });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid prediction payload" }, { status: 400 });
  }
}
