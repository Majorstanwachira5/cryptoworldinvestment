import { NextRequest, NextResponse } from "next/server";
import { credentials } from "@/lib/auth/credentials";
import { issueAccessToken } from "@/lib/auth/access";
import { AccessTokenResponse } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Exchanges credentials for an access token.
 *
 * The password is verified against the salted scrypt hash held by the
 * credential store and is never echoed, logged, or compared as a string.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { email?: string; password?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Please provide both email and password." },
        { status: 400 }
      );
    }

    const result = credentials.authenticate(email, password);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }

    const { token, expiresAt } = issueAccessToken(result.user);

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
    console.error("[auth/login] uncaught error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed on server.",
      },
      { status: 500 }
    );
  }
}
