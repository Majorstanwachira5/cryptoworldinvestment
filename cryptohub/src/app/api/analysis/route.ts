import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisReport } from "@/lib/analysis";
import { DEFAULT_ASSETS } from "@/lib/market/assets";
import { getSeriesForAnalysis, getTicker } from "@/lib/market/feed";
import { requireAccountAccess, platformUserId } from "@/lib/auth/access";
import { AssetClass } from "@/types";

// Indicator and replay work is heavier than a JSON lookup, so it runs per
// request rather than on a timer.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Timeframes the report scores, in the order it prefers them. */
const REPORT_TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const timeframe = searchParams.get("timeframe") || "1H";
  const priceParam = searchParams.get("current_price");
  const currentPrice = priceParam ? parseFloat(priceParam) : undefined;
  const includeBacktest = searchParams.get("backtest") !== "false";

  // Analysis reads account state (equity, realised record), so it is gated on
  // the permission for the book being inspected.
  const auth = await requireAccountAccess(
    request,
    searchParams.get("accountType") ?? searchParams.get("account_type") ?? "REAL"
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const asset =
    DEFAULT_ASSETS.find((a) => a.symbol === symbol) || DEFAULT_ASSETS[0];

  try {
    // Score the real series the chart is drawing, so the report and the chart
    // can no longer describe different markets. Anything the feed cannot supply
    // falls back inside the engine.
    const realSeries = await getSeriesForAnalysis(
      asset.symbol,
      asset.assetClass,
      REPORT_TIMEFRAMES
    );

    // Prefer the server's own quote over the browser's copy of it.
    const ticker = await getTicker(asset.symbol, asset.assetClass);

    const report = buildAnalysisReport({
      userId: platformUserId(auth.identity),
      symbol: asset.symbol,
      timeframe,
      accountType: auth.accountType,
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : ticker.price,
      includeBacktest,
      realSeries,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      {
        error: "Analysis engine failed to produce a report for this symbol.",
        assetClass: asset.assetClass as AssetClass,
      },
      { status: 500 }
    );
  }
}