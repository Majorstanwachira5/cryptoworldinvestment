import { NextRequest, NextResponse } from "next/server";
import { BlockchainLedgerService } from "@/lib/ledger/trc20";
import { requireAccountAccess, platformUserId } from "@/lib/auth/access";
import { RewardEngine } from "@/lib/rewards/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/ledger/withdraw
 * Initiates an atomic balance reservation and records a withdrawal request.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAccountAccess(request, "REAL");
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const userId = platformUserId(auth.identity);
    const body = await request.json();
    const { destinationAddress, amount, idempotencyKey } = body;

    if (!destinationAddress || typeof destinationAddress !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid destination TRC20 address is required." },
        { status: 400 }
      );
    }

    // Basic TRON address format validation (starts with 'T', length 34)
    if (!destinationAddress.startsWith("T") || destinationAddress.length !== 34) {
      return NextResponse.json(
        { success: false, error: "Invalid TRON (TRC20) address format. Must begin with 'T' and be 34 characters." },
        { status: 400 }
      );
    }

    const withdrawAmount = Number(amount);
    if (!Number.isFinite(withdrawAmount) || withdrawAmount < RewardEngine.WITHDRAWAL_MINIMUM_USD) {
      return NextResponse.json(
        {
          success: false,
          error: `Withdrawal minimum is $${RewardEngine.WITHDRAWAL_MINIMUM_USD.toFixed(2)} USDT, server-enforced. Requests below $${RewardEngine.WITHDRAWAL_MINIMUM_USD.toFixed(2)} are rejected.`,
        },
        { status: 400 }
      );
    }

    const result = BlockchainLedgerService.requestWithdrawal({
      userId,
      destinationAddress,
      amount: withdrawAmount,
      idempotencyKey,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      withdrawal: result.withdrawal,
      message: "Withdrawal request submitted. Funds have been atomically reserved pending security review.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Withdrawal request failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ledger/withdraw
 * Returns the authenticated user's withdrawal requests and statuses.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAccountAccess(request, "REAL");
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const userId = platformUserId(auth.identity);
    const withdrawals = BlockchainLedgerService.getWithdrawalsForUser(userId);

    return NextResponse.json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch withdrawals: " + (error as Error).message },
      { status: 500 }
    );
  }
}
