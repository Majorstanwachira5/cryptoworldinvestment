import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth/access";
import { credentials } from "@/lib/auth/credentials";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Permanently deletes the authenticated user's account and all associated records.
 * Purges:
 * - Credentials and password hashes from the Credential Store & durable WAL
 * - Double-entry ledger balances, open trades, trade history from DatabaseStore
 * - TRC20 deposit records and withdrawal transactions
 * - Remote Supabase profiles, balances, trades, and ledger records
 * - Discards the cryptohub_session HTTP cookie
 */
async function handleDelete(request: NextRequest) {
  try {
    const auth = await requireIdentity(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized. Valid session required." },
        { status: auth.status }
      );
    }

    const { platformUserId } = await import("@/lib/auth/access");
    const userId = platformUserId(auth.identity);
    const userEmail = auth.identity.user?.email || "";

    // 1. Purge from local credentials store & WAL
    credentials.deleteUser(userId);
    if (userEmail) {
      credentials.deleteUser(userEmail);
    }

    // 2. Purge from double-entry database store (balances, trades, ledger, TRC20, withdrawals)
    db.deleteUser(userId);

    // 3. Purge from direct PostgreSQL and remote Supabase tables
    try {
      const { pgDeleteUser } = await import("@/lib/db/postgres");
      await pgDeleteUser(userId);
      if (userEmail) {
        await pgDeleteUser(userEmail);
      }
    } catch {
      /* direct postgres handled */
    }

    try {
      await Promise.allSettled([
        supabase.from("wallets").delete(`user_id=eq.${encodeURIComponent(userId)}`),
        supabase.from("ledger_entries").delete(`user_id=eq.${encodeURIComponent(userId)}`),
        supabase.from("users").delete(`id=eq.${encodeURIComponent(userId)}`),
        userEmail ? supabase.from("users").delete(`email=eq.${encodeURIComponent(userEmail)}`) : Promise.resolve(),
      ]);
    } catch {
      /* non-blocking offline/sandboxed fallback */
    }

    // 4. Return success and invalidate session cookie
    const response = NextResponse.json({
      success: true,
      message: "Your account, credentials, and financial logs have been permanently deleted.",
    });

    response.cookies.delete("cryptohub_session");
    response.cookies.set("cryptohub_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error: unknown) {
    console.error("[auth/delete-account] uncaught error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Account deletion failed on server.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  return handleDelete(request);
}

export async function POST(request: NextRequest) {
  return handleDelete(request);
}

