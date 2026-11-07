import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireIdentity(request);
  if (!auth.ok) {
    return NextResponse.json(
      { authenticated: false, error: auth.error },
      { status: auth.status }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      ...auth.identity.user,
      accountType: "real",
    },
    provider: auth.identity.provider,
    issuedAt: auth.identity.issuedAt,
    expiresAt: auth.identity.expiresAt,
  });
}

