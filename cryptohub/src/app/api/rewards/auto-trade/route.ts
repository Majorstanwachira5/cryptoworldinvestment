import { NextRequest, NextResponse } from "next/server";
import { RewardEngine } from "@/lib/rewards/engine";
import { requireAccountAccess, requirePermission, platformUserId } from "@/lib/auth/access";
import { AuditService } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/rewards/auto-trade
 * Returns auto-trade eligibility, current tier, daily earning range, and historical yields for authenticated user.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAccountAccess(request, "REAL");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const userId = platformUserId(auth.identity);
  const derivation = RewardEngine.deriveUserLevel(userId);
  const microTradeStatus = RewardEngine.getMicroTradeStatus(userId);
  const ledger = db.getLedger(userId, "REAL");
  const autoTradeHistory = ledger
    .filter((e) => e.type === "AUTO_TRADE_EARNING")
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      currency: e.currency,
      description: e.description,
      createdAt: e.createdAt,
    }));

  return NextResponse.json({
    success: true,
    derivation,
    microTradeStatus,
    history: autoTradeHistory,
  });
}

/**
 * POST /api/rewards/auto-trade
 * Executes daily quantitative auto-trade yield credit.
 * - If body.batch is true: Admin batch credit across all platform accounts.
 * - Otherwise: Single-user execution for the authenticated user session.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const dateOverride = body?.date;

  // Batch execution (Admin only)
  if (body?.batch) {
    const adminAuth = await requirePermission(request, "admin:reward:trigger");
    if (!adminAuth.ok) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    const result = RewardEngine.runDailyAutoTrade(dateOverride);

    AuditService.log({
      actor: adminAuth.identity.user.email,
      action: "TRIGGER_AUTO_TRADE_BATCH",
      target: "PLATFORM_USERS",
      outcome: "SUCCESS",
      details: {
        date: result.date,
        processed: result.processed,
        credited: result.credited,
      },
    });

    return NextResponse.json({
      success: true,
      batch: true,
      ...result,
    });
  }

  // Single-user execution (User session or Admin)
  const auth = await requireAccountAccess(request, "REAL");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const userId = platformUserId(auth.identity);

  // Micro-Trade execution ($0.20 x 5 sequential base bot trades for all registered users)
  if (body?.action === "MICRO" || body?.micro) {
    const microResult = RewardEngine.executeNextMicroTrade(userId, dateOverride);
    const updatedBalance = db.getBalance(userId, "REAL");
    const microStatus = RewardEngine.getMicroTradeStatus(userId, dateOverride);

    if (microResult.credited) {
      AuditService.log({
        actor: auth.identity.user.email,
        action: "AUTO_TRADE_MICRO_CREDIT",
        target: userId,
        outcome: "SUCCESS",
        details: {
          step: microResult.step,
          amount: microResult.amount,
          ledgerId: microResult.ledgerId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      micro: true,
      result: microResult,
      status: microStatus,
      balance: updatedBalance,
    });
  }

  const result = RewardEngine.runDailyAutoTradeForUser(userId, dateOverride);
  const updatedBalance = db.getBalance(userId, "REAL");

  if (result.credited) {
    AuditService.log({
      actor: auth.identity.user.email,
      action: "AUTO_TRADE_CREDIT",
      target: userId,
      outcome: "SUCCESS",
      details: {
        amount: result.amount,
        level: result.level,
        ledgerId: result.ledgerId,
      },
    });
  }

  return NextResponse.json({
    success: true,
    batch: false,
    result,
    balance: updatedBalance,
  });
}
