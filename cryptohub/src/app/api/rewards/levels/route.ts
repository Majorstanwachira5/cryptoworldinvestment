import { NextRequest, NextResponse } from "next/server";
import { RewardEngine } from "@/lib/rewards/engine";
import { requirePermission, platformUserId } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "ledger:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId =
    auth.identity.user.role === "admin" && searchParams.get("userId")
      ? searchParams.get("userId")!
      : platformUserId(auth.identity);

  const derivation = RewardEngine.deriveUserLevel(targetUserId);

  return NextResponse.json({
    success: true,
    level: derivation,
  });
}
