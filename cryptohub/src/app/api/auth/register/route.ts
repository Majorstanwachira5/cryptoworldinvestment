import { NextRequest, NextResponse } from "next/server";
import { credentials } from "@/lib/auth/credentials";
import { issueAccessToken } from "@/lib/auth/access";
import { AccessTokenResponse } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Creates an account and returns an access token.
 *
 * The response body carries no password material: only the token and the
 * public user record.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; name?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const result = credentials.create({
    email: body.email || "",
    name: body.name || "",
    password: body.password || "",
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
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