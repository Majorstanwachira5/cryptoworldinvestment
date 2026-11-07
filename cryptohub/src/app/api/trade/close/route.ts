import { NextRequest, NextResponse } from "next/server";
import { closeOrder } from "@/lib/trading/engine";
import { db } from "@/lib/db";
import { requireAccountAccess, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tradeId, exitPrice, accountType = "REAL" } = body;

    const auth = await requireAccountAccess(request, accountType);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Only the owner's position can be closed: the lookup is scoped to userId.
    const userId = platformUserId(auth.identity);

    if (!tradeId || !exitPrice) {
      return NextResponse.json(
        { success: false, error: "tradeId and exitPrice are required." },
        { status: 400 }
      );
    }

    const result = closeOrder(userId, tradeId, Number(exitPrice), auth.accountType);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const updatedBalance = db.getBalance(userId, auth.accountType);

    return NextResponse.json({
      success: true,
      trade: result.trade,
      balance: updatedBalance,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to close trade: " + (error as Error).message },
      { status: 500 }
    );
  }
}
