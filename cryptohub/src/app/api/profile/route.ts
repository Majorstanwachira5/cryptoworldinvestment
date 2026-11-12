import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFxRates, usdToKes, DisplayCurrency } from "@/lib/fx/rates";
import { requireIdentity, platformUserId } from "@/lib/auth/access";
import { permissionsFor } from "@/lib/auth/rbac";
import { computeAccountPerformance } from "@/lib/analysis";
import { RewardEngine } from "@/lib/rewards/engine";
import { AuthenticatedUser, ProfileSummary, ReferralStats } from "@/types";
import { buildReferralShareUrl } from "@/lib/referral/link";

export const dynamic = "force-dynamic";

function referralStats(userId: string, req?: NextRequest): ReferralStats {
  const rewardUsd = db.getReferralRewardUsd();
  const records = db.getReferrals(userId);
  const qualifiedRecords = records.filter((r) => r.status === "QUALIFIED");
  const totalEarnedUsd =
    Math.round(qualifiedRecords.reduce((a, r) => a + r.rewardUsd, 0) * 100) / 100;
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
  // The profile is private: there is no unauthenticated fallback. If a token
  // is missing or stale the client is expected to register or sign in again.
  const auth = await requireIdentity(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Every figure below is read with this id, so the response can only ever
  // describe the account that owns the token.
  const userId = platformUserId(auth.identity);
  const fx = getFxRates();
  const identity: AuthenticatedUser = auth.identity.user;
  const profile = db.getUser(userId);

  const summary: ProfileSummary = {
    user: identity,
    depositAddresses: {
      usdt: profile.usdtAddress,
      btc: profile.btcAddress,
      eth: profile.ethAddress,
    },
    session: {
      issuedAt: auth.identity.issuedAt ?? Math.floor(Date.now() / 1000),
      expiresAt: auth.identity.expiresAt ?? 0,
    },
    real: db.getBalance(userId, "REAL"),
    fx: { usdKes: fx.usdKes, displayCurrency: fx.displayCurrency as DisplayCurrency },
    performance: {
      REAL: computeAccountPerformance(db.getTrades(userId, "REAL"), "REAL"),
    },
    referrals: referralStats(userId, request),
    openPositions: db
      .getTrades(userId, "REAL")
      .filter((t) => t.status === "OPEN").length,
  };

  const levelInfo = RewardEngine.deriveUserLevel(userId);

  return NextResponse.json({
    ...summary,
    levelInfo,
    authenticated: true,
    provider: auth.identity.provider,
    permissions: permissionsFor(identity.role),
  });
}