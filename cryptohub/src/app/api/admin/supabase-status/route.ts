import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/access";
import { checkSupabaseConnection } from "@/lib/supabase/sync";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "admin:stats");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const health = await checkSupabaseConnection();
  return NextResponse.json({
    success: true,
    supabase: health,
  });
}

