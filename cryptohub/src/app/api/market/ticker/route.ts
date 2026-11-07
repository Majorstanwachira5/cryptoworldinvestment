import { NextRequest, NextResponse } from "next/server";
import { getLiveAssets } from "@/lib/market/feed";

export const dynamic = "force-dynamic";

/**
 * Live quotes for every supported instrument.
 *
 * Publicly accessible so visitors on the landing page, marquee ticker,
 * and authenticated traders see synchronized live prices without 401s.
 */
export async function GET(_request: NextRequest) {
  try {
    const { assets, sources, delayed } = await getLiveAssets();

    return NextResponse.json({
      assets,
      sources,
      delayed,
      cryptoLive: true,
      forexLive: Boolean(process.env.TWELVE_DATA_API_KEY),
    });
  } catch (error: unknown) {
    console.error("[market/ticker] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch live quotes." },
      { status: 500 }
    );
  }
}
