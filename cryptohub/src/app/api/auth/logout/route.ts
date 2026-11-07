import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Signs the caller out.
 *
 * Access tokens are stateless, so this cannot revoke one on its own: it tells
 * the client to discard it and records the event for the audit trail. Real
 * revocation needs a deny list keyed on `jti`, which is the right change to
 * make when sessions gain a one-time identifier.
 */
export async function POST(request: NextRequest) {
  const hasToken = Boolean(
    request.headers.get("authorization") || request.cookies.get("cryptohub_session")
  );

  const response = NextResponse.json({
    success: true,
    revoked: hasToken,
    message: hasToken
      ? "Signed out. Session cookie cleared."
      : "No active session.",
  });

  response.cookies.set("cryptohub_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}