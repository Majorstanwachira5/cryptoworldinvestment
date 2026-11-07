import { NextRequest, NextResponse } from "next/server";
import { BlockchainLedgerService } from "@/lib/ledger/trc20";
import { requirePermission } from "@/lib/auth/access";
import { AuditService } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/withdrawals
 * Returns all withdrawal requests across the platform. Requires admin:users:read permission.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "admin:users:read");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const withdrawals = BlockchainLedgerService.getAllWithdrawals();
  return NextResponse.json({ success: true, withdrawals });
}

/**
 * POST /api/admin/withdrawals
 * Actions: "approve" or "reject". Strictly requires admin:withdrawal:approve permission.
 * A support or viewer user will be rejected with 403 Forbidden.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, "admin:withdrawal:approve");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { withdrawalId, action, reason, txHash } = body;

    if (!withdrawalId || !action) {
      return NextResponse.json(
        { success: false, error: "withdrawalId and action ('approve' | 'reject') are required." },
        { status: 400 }
      );
    }

    if (action === "approve") {
      const ok = BlockchainLedgerService.approveWithdrawal(withdrawalId, txHash);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: "Withdrawal not found or not in REVIEW_PENDING state." },
          { status: 400 }
        );
      }

      AuditService.log({
        actor: auth.identity.user.email,
        action: "APPROVE_WITHDRAWAL",
        target: withdrawalId,
        outcome: "SUCCESS",
        details: { txHash },
      });

      return NextResponse.json({
        success: true,
        message: `Withdrawal ${withdrawalId} approved and marked COMPLETED.`,
      });
    }

    if (action === "reject") {
      const rejectReason = reason || "Administrative review rejected.";
      const ok = BlockchainLedgerService.rejectWithdrawal(withdrawalId, rejectReason);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: "Withdrawal not found or not in REVIEW_PENDING state." },
          { status: 400 }
        );
      }

      AuditService.log({
        actor: auth.identity.user.email,
        action: "REJECT_WITHDRAWAL",
        target: withdrawalId,
        outcome: "SUCCESS",
        details: { reason: rejectReason },
      });

      return NextResponse.json({
        success: true,
        message: `Withdrawal ${withdrawalId} rejected. Reserved funds refunded to user.`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Supported: 'approve', 'reject'" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to process withdrawal action: " + (error as Error).message },
      { status: 500 }
    );
  }
}
