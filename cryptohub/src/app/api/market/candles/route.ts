import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/access";
import { getCandles, getTicker, tickSizeFor } from "@/lib/market/feed";
import { DEFAULT_ASSETS } from "@/lib/market/assets";

export const dynamic = "force-dynamic";

/**
 * Real historical candles for one instrument.
 *
 * Gated like every other data route: the terminal requires a session, and an
 * anonymous scraper should not be able to use this as a free price API.
 *
 * `digits` and `tickSize` are returned so the chart configures its price scale
 * from the instrument rather than from a library default. That is what makes a
 * sub-1.00 pair and a five-figure asset both render legibly.
 */
export async function GET(request: NextRequest) {
  const auth = await requireIdentity(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const timeframe = (searchParams.get("timeframe") || "1H").toUpperCase();

  const asset = DEFAULT_ASSETS.find((a) => a.symbol === symbol);
  if (!asset) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 400 });
  }

  const series = await getCandles(asset.symbol, asset.assetClass, timeframe);

  // The last bar is still forming; its close is the live price.
  const ticker = await getTicker(asset.symbol, asset.assetClass);

  return NextResponse.json({
    symbol: asset.symbol,
    timeframe,
    // The interval the provider actually returned, which can be coarser than the
    // one requested when only daily reference rates exist.
    interval: series.interval,
    timeframeHonoured: series.timeframeHonoured,
    digits: asset.digits,
    tickSize: tickSizeFor(asset.digits),
    source: series.source,
    delayed: series.delayed,
    price: ticker.price,
    change24h: ticker.change24h,
    high24h: ticker.high24h,
    low24h: ticker.low24h,
    candles: series.candles,
  });
}