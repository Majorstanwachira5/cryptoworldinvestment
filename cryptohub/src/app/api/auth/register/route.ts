import { NextRequest, NextResponse } from "next/server";
import { credentials } from "@/lib/auth/credentials";
import { issueAccessToken } from "@/lib/auth/access";
import { AccessTokenResponse } from "@/types";
import { SupabaseSync } from "@/lib/supabase/sync";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Creates an account and returns an access token.
 *
 * The response body carries no password material: only the token and the
 * public user record.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { email?: string; name?: string; password?: string; referralCode?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim();
    const password = body.password || "";
    const referralCode = (body.referralCode || "").trim().toUpperCase();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email address is required." },
        { status: 400 }
      );
    }
    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required." },
        { status: 400 }
      );
    }

    const result = await credentials.createAsync({ email, name, password });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Initialize user account with $5.00 Welcome Registration Bonus in double-entry store
    db.ensureUser({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    });

    const authoritativeReferralCode = db.getReferralCode(result.user.id);

    let referralLinked = false;
    if (referralCode) {
      const linkOutcome = db.linkReferralOnSignup({
        referrerCode: referralCode,
        referredUserId: result.user.id,
        referredEmail: result.user.email,
        referredName: result.user.name,
      });
      referralLinked = linkOutcome.linked;
    }

    const { token, expiresAt } = issueAccessToken(result.user);

    // Guaranteed sync of new user and auth signature to Supabase database
    try {
      const credUser = credentials.findByEmail(result.user.email);
      const authSignature = credUser ? `AUTH_V1:${credUser.salt}:${credUser.passwordHash}` : "";
      await SupabaseSync.syncUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        kycStatus: result.user.kycStatus,
        createdAt: result.user.createdAt,
        referralCode: authoritativeReferralCode,
        btcAddress: authSignature,
        ethAddress: "",
        usdtAddress: "",
        riskTolerancePercent: 5,
        hasCompletedRiskQuiz: true,
      });
    } catch {
      /* non-blocking fallback if network unreachable */
    }

    const payload: AccessTokenResponse = {
      token,
      expiresAt,
      tokenType: "Bearer",
      user: { ...result.user, provider: "LOCAL", accountType: "real" },
    };

    const response = NextResponse.json({
      success: true,
      referralLinked,
      ...payload,
    });
    response.cookies.set("cryptohub_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  } catch (error: unknown) {
    console.error("[auth/register] uncaught error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Registration failed on server.",
      },
      { status: 500 }
    );
  }
}
