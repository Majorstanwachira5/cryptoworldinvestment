import { NextRequest, NextResponse } from "next/server";
import { BlockchainLedgerService } from "@/lib/ledger/trc20";
import { requirePermission } from "@/lib/auth/access";
import { AuditService } from "@/lib/audit";
import { RewardEngine } from "@/lib/rewards/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/deposits
 * Returns all blockchain deposits across the platform. Admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "admin:users:read");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const deposits = BlockchainLedgerService.getAllDeposits();
  return NextResponse.json({ success: true, deposits });
}

/**
 * POST /api/admin/deposits
 * Manually mark a deposit as confirmed.
 * Security Rules:
 *  - Must require an explicit reason
 *  - Must write to audit log
 *  - Must create matching ledger entry atomically
 *  - Attempt to confirm non-TRC20/USDT deposit is strictly rejected
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, "admin:users:write");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { userId, amount, asset, network, txHash, reason } = body;

    if (!userId || !amount || !txHash) {
      return NextResponse.json(
        { success: false, error: "userId, amount, and txHash are required." },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        {
          success: false,
          error: "A documented audit reason of at least 5 characters is mandatory for manual deposit confirmations.",
        },
        { status: 400 }
      );
    }

    // Attempt to confirm non-TRC20/USDT must be rejected
    const checkedAsset = (asset || "USDT").toUpperCase();
    const checkedNetwork = (network || "TRC20").toUpperCase();
    if (checkedAsset !== "USDT" || checkedNetwork !== "TRC20") {
      AuditService.log({
        actor: auth.identity.user.email,
        action: "MANUAL_DEPOSIT_REJECTED",
        target: userId,
        outcome: "REJECTED",
        details: { asset: checkedAsset, network: checkedNetwork, reason: "Non-TRC20/USDT asset" },
      });
      return NextResponse.json(
        { success: false, error: "Manual confirmation rejected: Only USDT on TRC20 network can be credited." },
        { status: 400 }
      );
    }

    const cleanHash = txHash.trim().toLowerCase();
    const result = BlockchainLedgerService.processTRC20Deposit({
      userId,
      txHash: cleanHash,
      fromAddress: "MANUAL_ADMIN_OVERRIDE",
      toAddress: process.env.PAYLOR_TRON_WALLET || "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd",
      amount: Number(amount),
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      confirmations: 19,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const derivation = RewardEngine.deriveUserLevel(userId);

    AuditService.log({
      actor: auth.identity.user.email,
      action: "MANUAL_DEPOSIT_CONFIRMED",
      target: userId,
      outcome: "SUCCESS",
      details: {
        amount: Number(amount),
        txHash: cleanHash,
        reason,
        newLevel: derivation.effectiveLevel,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Deposit of ${amount} USDT confirmed for user ${userId}.`,
      deposit: result.deposit,
      userLevel: derivation,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to manually confirm deposit: " + (error as Error).message },
      { status: 500 }
    );
  }
}
