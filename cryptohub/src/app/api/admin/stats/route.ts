import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Platform-wide figures. Available to administrators only.
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const stats = db.getAdminStats();
  // Aggregates across every account. This is the one response that is not
  // scoped to the caller, and it is reachable only through requireAdmin.
  const trades = db.getAllTrades();
  const users = db.getAllUsers();

  // The requesting administrator's own books, so the admin screen still has a
  // concrete balance to display alongside the platform totals.
  const userId = platformUserId(auth.identity);

  return NextResponse.json({
    stats,
    trades,
    users,
    user: db.getUser(userId),
    balance: db.getBalance(userId, "REAL"),
    requestedBy: auth.identity.user.email,
  });
}