import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculatePnL, calculatePips } from "@/lib/trading/pips";
import { requireAccountAccess, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const auth = await requireAccountAccess(
    request,
    searchParams.get("accountType") ?? searchParams.get("account_type") ?? "REAL"
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = platformUserId(auth.identity);
  const trades = db.getTrades(userId, auth.accountType);
  const balance = db.getBalance(userId, auth.accountType);
  return NextResponse.json({ trades, balance, accountType: auth.accountType });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body as { updates?: Array<{ id: string; currentPrice: number }> };

    const auth = await requireAccountAccess(request, body?.accountType ?? "REAL");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const userId = platformUserId(auth.identity);

    if (Array.isArray(updates)) {
      for (const item of updates) {
        const trade = db.getTrades(userId, auth.accountType).find((t) => t.id === item.id);
        if (trade && trade.status === "OPEN") {
          const pnl = calculatePnL(
            trade.entryPrice,
            item.currentPrice,
            trade.size,
            trade.direction,
            trade.assetClass,
            trade.symbol
          );
          const pips = calculatePips(
            trade.entryPrice,
            item.currentPrice,
            trade.direction,
            trade.symbol,
            trade.assetClass
          );
          db.updatePositionPrice(userId, item.id, item.currentPrice, pnl, pips, auth.accountType);
        }
      }
    }

    const updatedTrades = db.getTrades(userId, auth.accountType);
    const updatedBalance = db.getBalance(userId, auth.accountType);

    return NextResponse.json({ trades: updatedTrades, balance: updatedBalance });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to update prices" }, { status: 400 });
  }
}