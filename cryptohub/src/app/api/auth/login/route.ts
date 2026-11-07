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
 * Failures return one generic message for both an unknown email and a wrong
 * password, so this endpoint cannot be used to discover which accounts exist.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const result = credentials.authenticate(body.email || "", body.password || "");

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
}
