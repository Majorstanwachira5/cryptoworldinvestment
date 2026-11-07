import { NextRequest, NextResponse } from "next/server";
import { getCandles, getTicker, tickSizeFor } from "@/lib/market/feed";
import { DEFAULT_ASSETS } from "@/lib/market/assets";

export const dynamic = "force-dynamic";

/**
 * Real historical candles for one instrument.
 *
 * Provides open/high/low/close data for the TradingView chart across
 * crypto and forex pairs.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const timeframe = (searchParams.get("timeframe") || "1H").toUpperCase();

    const asset = DEFAULT_ASSETS.find((a) => a.symbol === symbol);
    if (!asset) {
      return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 400 });
    }

    const series = await getCandles(asset.symbol, asset.assetClass, timeframe);
    const ticker = await getTicker(asset.symbol, asset.assetClass);

    return NextResponse.json({
      symbol: asset.symbol,
      timeframe,
      interval: series.interval,
      timeframeHonoured: series.timeframeHonoured,
      digits: asset.digits,
      tickSize: tickSizeFor(asset.digits),
      source: series.source,
      delayed: series.delayed,
      price: ticker.price,
      change24h: ticker.change24h,
      candles: series.candles,
    });
  } catch (error: unknown) {
    console.error("[market/candles] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load candles." },
      { status: 500 }
    );
  }
}
