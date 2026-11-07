import { NextRequest, NextResponse } from "next/server";
import { RewardEngine } from "@/lib/rewards/engine";
import { requirePermission } from "@/lib/auth/access";
import { AuditService } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, "admin:reward:trigger");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const dateOverride = body?.date;

  const result = RewardEngine.runWednesdayBonus(dateOverride);

  AuditService.log({
    actor: auth.identity.user.email,
    action: "TRIGGER_WEDNESDAY_BONUS",
    target: "PLATFORM_USERS",
    outcome: result.isWednesday ? "SUCCESS" : "REJECTED",
    details: {
      date: result.date,
      isWednesday: result.isWednesday,
      credited: result.credited,
    },
  });

  return NextResponse.json({
    success: true,
    ...result,
  });
}
