import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccountAccess, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Accept both camelCase "accountType" (used by frontend) and snake_case "account_type" (legacy/webhook)
  const auth = await requireAccountAccess(
    request,
    searchParams.get("accountType") ?? searchParams.get("account_type") ?? "REAL"
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Scoped to the verified token: a caller only ever sees their own book.
  const userId = platformUserId(auth.identity);
  const user = db.getUser(userId);
  const balance = db.getBalance(userId, auth.accountType);

  return NextResponse.json({
    user,
    balance,
    accountType: auth.accountType,
    session: { id: auth.identity.user.id, role: auth.identity.user.role },
  });
}