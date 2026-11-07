import { NextRequest, NextResponse } from "next/server";
import { AuditService } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 100);

  return NextResponse.json({
    success: true,
    totalLogs: AuditService.count(),
    logs: AuditService.getLogs(limit),
  });
}
