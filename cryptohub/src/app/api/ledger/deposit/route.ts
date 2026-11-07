import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, platformUserId } from "@/lib/auth/access";
import { AuditService } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Administrative ledger deposit credit endpoint.
 *
 * SECURITY: Regular users cannot self-credit funds here. Only verified
 * TRC20 blockchain webhooks (/api/payments/paylor/webhook) or authorized
 * administrators with `admin:users:write` may credit the REAL ledger.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, method, txHash, userId: targetUserId, action } = body;

    if (action === "reset_demo") {
      return NextResponse.json(
        {
          success: false,
          error: "Paper/Demo trading has been permanently removed. Only REAL live accounts are supported.",
        },
        { status: 403 }
      );
    }

    const auth = await requirePermission(request, "admin:users:write");
    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Direct deposit credits require administrator authorization or verified TRC20 blockchain settlement.",
        },
        { status: auth.status }
      );
    }

    const userId = targetUserId || platformUserId(auth.identity);

    const depositAmount = Number(amount);
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid positive deposit amount is required." },
        { status: 400 }
      );
    }

    if (depositAmount > 10_000_000) {
      return NextResponse.json(
        { success: false, error: "Deposit amount exceeds the permitted maximum." },
        { status: 400 }
      );
    }

    const updatedBalance = db.depositFunds(
      userId,
      depositAmount,
      method || "Verified TRC20 USDT Settlement",
      txHash,
      "REAL"
    );

    const latestLedger = db.getLedger(userId, "REAL");

    AuditService.log({
      actor: auth.identity.user.email,
      action: "ADMIN_DEPOSIT_CREDIT",
      target: userId,
      outcome: "SUCCESS",
      details: { amount: depositAmount, method, txHash },
    });

    return NextResponse.json({
      success: true,
      balance: updatedBalance,
      latestTransaction: latestLedger[0],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Deposit processing failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}
