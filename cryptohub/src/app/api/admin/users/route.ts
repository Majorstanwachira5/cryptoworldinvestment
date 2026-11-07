import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RewardEngine } from "@/lib/rewards/engine";
import { requirePermission } from "@/lib/auth/access";
import { AuditService } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "admin:users:read");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const allUsers = db.getAllUsers();

  const enrichedUsers = allUsers.map((user) => {
    const balance = db.getBalance(user.id, "REAL");
    const derivation = RewardEngine.deriveUserLevel(user.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      kycStatus: user.kycStatus,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      balance: balance.availableBalance,
      level: derivation.effectiveLevel,
      levelName: derivation.levelName,
      cumulativeDeposits: derivation.cumulativeDeposits,
      successfulReferralsCount: derivation.successfulReferralsCount,
    };
  });

  const filtered = search
    ? enrichedUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(search) ||
          u.name.toLowerCase().includes(search) ||
          u.id.toLowerCase().includes(search)
      )
    : enrichedUsers;

  return NextResponse.json({
    success: true,
    total: filtered.length,
    users: filtered,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePermission(request, "admin:users:write");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { userId, name, email, kycStatus, balance, availableBalance } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required." },
        { status: 400 }
      );
    }

    // Critical Security Rule: Attempt to edit a user's balance directly must be blocked.
    // Balance changes only via double-entry ledger entries.
    if (balance !== undefined || availableBalance !== undefined) {
      AuditService.log({
        actor: auth.identity.user.email,
        action: "DIRECT_BALANCE_EDIT_ATTEMPT",
        target: userId,
        outcome: "REJECTED",
        details: { attemptedBalance: balance ?? availableBalance },
      });
      return NextResponse.json(
        {
          success: false,
          error:
            "Direct balance edits are strictly prohibited. Balance modifications are only permissible through immutable double-entry ledger transactions.",
        },
        { status: 400 }
      );
    }

    const user = db.getUser(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (kycStatus) user.kycStatus = kycStatus;

    AuditService.log({
      actor: auth.identity.user.email,
      action: "UPDATE_USER_PROFILE",
      target: userId,
      outcome: "SUCCESS",
      details: { updatedFields: { name, email, kycStatus } },
    });

    return NextResponse.json({
      success: true,
      message: "User profile updated successfully.",
      user: db.getUser(userId),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
