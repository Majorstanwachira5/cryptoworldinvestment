import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/access";
import { getLiveAssets } from "@/lib/market/feed";

export const dynamic = "force-dynamic";

/**
 * Live quotes for every supported instrument.
 *
 * The asset list, the marquee ticker, and the dashboard price grid all render
 * from this, so they stay consistent with the chart instead of showing the
 * hardcoded literals that used to sit in `assets.ts`.
 *
 * `delayed` lists the instruments that are not live. Forex pairs without a
 * configured intraday feed sit on a daily reference rate, so the client is
 * expected to label them rather than present them as a streaming market.
 */
export async function GET(request: NextRequest) {
  const auth = await requireIdentity(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { assets, sources, delayed } = await getLiveAssets();

  return NextResponse.json({
    assets,
    sources,
    delayed,
    cryptoLive: true,
    forexLive: Boolean(process.env.TWELVE_DATA_API_KEY),
  });
}