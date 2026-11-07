import { NextRequest, NextResponse } from "next/server";
import { BlockchainLedgerService, TRON_USDT_CONTRACT } from "@/lib/ledger/trc20";
import { requireAccountAccess, platformUserId } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * POST /api/ledger/deposit/trc20
 * Handles TRC20 USDT deposit reporting and confirmation tracking.
 *
 * SECURITY: Unprivileged users reporting a transaction hash always start at
 * 0 confirmations (DETECTED state) and cannot self-credit by forging
 * `confirmations: 19`. Only verified Paylor webhooks or authorized admins
 * can credit confirmations >= 19.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAccountAccess(request, "REAL");
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const callerId = platformUserId(auth.identity);
    const isAdminCaller =
      can(auth.identity.user.role, "admin:payments:manage") ||
      can(auth.identity.user.role, "admin:users:write");

    const body = await request.json();
    const {
      txHash,
      fromAddress,
      toAddress,
      amount,
      contractAddress,
      confirmations = 0,
      userId: bodyUserId,
    } = body;

    if (!txHash || typeof txHash !== "string" || txHash.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: "A valid TRON transaction hash is required." },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "A positive deposit amount is required." },
        { status: 400 }
      );
    }

    // Security enforcement: Regular users cannot supply confirmations > 0 or target another userId
    const effectiveConfirmations = isAdminCaller ? Math.max(0, Number(confirmations) || 0) : 0;
    const targetUserId = isAdminCaller && bodyUserId ? String(bodyUserId) : callerId;

    const result = BlockchainLedgerService.processTRC20Deposit({
      userId: targetUserId,
      txHash: txHash.trim(),
      fromAddress: fromAddress || "T_EXTERNAL_SENDER",
      toAddress:
        toAddress ||
        process.env.PAYLOR_TRON_WALLET ||
        "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd",
      amount: numAmount,
      contractAddress: contractAddress || TRON_USDT_CONTRACT,
      confirmations: effectiveConfirmations,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, deposit: result.deposit },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      deposit: result.deposit,
      message:
        result.deposit.state === "CREDITED"
          ? "Deposit confirmed and credited to REAL ledger."
          : `TRC20 transaction hash registered (${result.deposit.state}). Confirmations: ${result.deposit.confirmations}/${result.deposit.requiredConfirmations}. Balance credits automatically once 19 TRON block confirmations settle.`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to process TRC20 deposit: " + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ledger/deposit/trc20
 * Lists TRC20 deposits for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAccountAccess(request, "REAL");
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const userId = platformUserId(auth.identity);
    const deposits = BlockchainLedgerService.getDepositsForUser(userId);

    return NextResponse.json({
      success: true,
      deposits,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch deposits: " + (error as Error).message },
      { status: 500 }
    );
  }
}
