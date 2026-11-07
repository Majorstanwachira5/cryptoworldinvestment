import { NextRequest, NextResponse } from "next/server";
import { executeOrder } from "@/lib/trading/engine";
import { db } from "@/lib/db";
import { requireAccountAccess, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      accountType = "REAL",
      symbol,
      assetClass,
      direction,
      orderType,
      size,
      leverage,
      currentPrice,
      stopLoss,
      takeProfit,
      rationale,
    } = body;

    // Gate before anything is validated or executed, so an unauthenticated
    // caller learns nothing about which parameters are acceptable.
    const auth = await requireAccountAccess(request, accountType);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    if (!symbol || !direction || !size || !leverage || !currentPrice) {
      return NextResponse.json(
        { success: false, error: "Missing required trade execution parameters." },
        { status: 400 }
      );
    }

    const result = executeOrder({
      userId: platformUserId(auth.identity),
      accountType: auth.accountType,
      symbol,
      assetClass: assetClass || "CRYPTO",
      direction,
      orderType: orderType || "MARKET",
      size: Number(size),
      leverage: Number(leverage),
      currentPrice: Number(currentPrice),
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfit ? Number(takeProfit) : undefined,
      rationale,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const updatedBalance = db.getBalance(platformUserId(auth.identity), auth.accountType);

    return NextResponse.json({
      success: true,
      trade: result.trade,
      balance: updatedBalance,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to execute order: " + (error as Error).message },
      { status: 500 }
    );
  }
}
