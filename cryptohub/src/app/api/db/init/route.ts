import { NextResponse } from "next/server";
import { ensureDatabaseSchema, getPostgresPool } from "@/lib/db/postgres";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let pgStatus = "UNREACHABLE";
  let errorMsg = null;
  let tableCount = 0;

  try {
    const success = await ensureDatabaseSchema();
    if (success) {
      const client = await getPostgresPool().connect();
      try {
        const res = await client.query(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
        );
        tableCount = parseInt(res.rows[0]?.count || "0", 10);
        pgStatus = "CONNECTED";
      } finally {
        client.release();
      }
    }
  } catch (err) {
    errorMsg = (err as Error).message;
  }

  // Also test REST API
  const restCheck = await supabase.from("users").select("count");
  const restStatus = restCheck.error ? `ERROR (${restCheck.error.status})` : "CONNECTED";

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
    postgres: {
      status: pgStatus,
      publicTables: tableCount,
      error: errorMsg,
    },
    restApi: {
      status: restStatus,
    },
  });
}

export async function POST() {
  return GET();
}

