import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFxRates, usdToKes } from "@/lib/fx/rates";
import { requirePermission, platformUserId } from "@/lib/auth/access";
import { ReferralStats } from "@/types";
import { buildReferralShareUrl } from "@/lib/referral/link";

export const dynamic = "force-dynamic";

function buildStats(userId: string, req?: NextRequest): ReferralStats {
  const fx = getFxRates();
  const records = db.getReferrals(userId);
  const rewardUsd = db.getReferralRewardUsd();
  const qualifiedRecords = records.filter((r) => r.status === "QUALIFIED");
  const totalEarnedUsd = Math.round(
    qualifiedRecords.reduce((a, r) => a + r.rewardUsd, 0) * 100
  ) / 100;

  const code = db.getReferralCode(userId);

  return {
    code,
    rewardPerReferralUsd: rewardUsd,
    rewardPerReferralKes: usdToKes(rewardUsd),
    totalReferrals: records.length,
    qualified: records.filter((r) => r.status === "QUALIFIED").length,
    pending: records.filter((r) => r.status === "PENDING").length,
    totalEarnedUsd,
    totalEarnedKes: usdToKes(totalEarnedUsd),
    shareUrl: buildReferralShareUrl(code, req),
    records,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "referral:manage");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = platformUserId(auth.identity);

  return NextResponse.json({
    referrals: buildStats(userId, request),
    balance: db.getBalance(userId, "REAL"),
  });
}

export async function POST(request: NextRequest) {
  // Referral rewards credit a real balance, so this needs the same permission
  // that allows touching the real book.
  const auth = await requirePermission(request, "referral:manage");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const userId = platformUserId(auth.identity);
    const result = db.registerReferral(userId, {
      code: body?.code,
      email: body?.email,
      name: body?.name,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const isQualified = result.record.status === "QUALIFIED";
    const creditedUsd = isQualified ? result.record.rewardUsd : 0;

    return NextResponse.json({
      success: true,
      credited: isQualified,
      status: result.record.status,
      pendingRewardUsd: result.record.rewardUsd,
      reward: {
        amountUsd: creditedUsd,
        amountKes: usdToKes(creditedUsd),
        accountType: "REAL" as const,
      },
      record: result.record,
      balance: result.balance,
      referrals: buildStats(userId, request),
      creditedTo: isQualified ? auth.identity.user.email : null,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid referral payload." },
      { status: 400 }
    );
  }
}