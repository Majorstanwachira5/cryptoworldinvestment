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
    let body: { email?: string; name?: string; password?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    const email = (body.email || "").trim();
    const name = (body.name || "").trim();
    const password = body.password || "";

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

    const result = credentials.create({ email, name, password });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Initialize user account with $5.00 Welcome Registration Bonus in double-entry store
    db.ensureUser({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    });

    const { token, expiresAt } = issueAccessToken(result.user);

    // Non-blocking background sync of the new user to Supabase
    try {
      const credUser = credentials.findByEmail(result.user.email);
      const authSignature = credUser ? `AUTH_V1:${credUser.salt}:${credUser.passwordHash}` : "";
      SupabaseSync.syncUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        kycStatus: result.user.kycStatus,
        createdAt: result.user.createdAt,
        referralCode: result.user.id.slice(0, 8),
        btcAddress: authSignature,
        ethAddress: "",
        usdtAddress: "",
        riskTolerancePercent: 5,
        hasCompletedRiskQuiz: true,
      });
    } catch {
      /* non-blocking */
    }

    const payload: AccessTokenResponse = {
      token,
      expiresAt,
      tokenType: "Bearer",
      user: { ...result.user, provider: "LOCAL", accountType: "real" },
    };

    const response = NextResponse.json({ success: true, ...payload });
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
