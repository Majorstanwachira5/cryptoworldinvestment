import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const allUsers = db.getAllUsers();
  const reconciliation = [];
  let mismatchCount = 0;
  let totalCredits = 0;
  let totalDebits = 0;
  let nullReferenceCount = 0;

  for (const user of allUsers) {
    const balance = db.getBalance(user.id, "REAL");
    const ledger = db.getLedger(user.id, "REAL");
    const ledgerSum = Math.round(ledger.reduce((acc, e) => acc + e.amount, 0) * 100) / 100;

    for (const entry of ledger) {
      if (entry.amount > 0) {
        totalCredits += entry.amount;
      } else {
        totalDebits += Math.abs(entry.amount);
      }
      if (!entry.txHash && !entry.description) {
        nullReferenceCount++;
      }
    }

    const matches = Math.abs(balance.availableBalance - ledgerSum) < 0.001;
    if (!matches) {
      mismatchCount++;
    }

    reconciliation.push({
      userId: user.id,
      email: user.email,
      balanceServedByApi: balance.availableBalance,
      sumLedgerEntries: ledgerSum,
      entriesCount: ledger.length,
      matches,
    });
  }

  totalCredits = Math.round(totalCredits * 100) / 100;
  totalDebits = Math.round(totalDebits * 100) / 100;

  return NextResponse.json({
    success: true,
    totalUsersChecked: allUsers.length,
    mismatchCount,
    nullReferenceCount,
    totalCredits,
    totalDebits,
    isReconciled: mismatchCount === 0 && nullReferenceCount === 0,
    reconciliation,
  });
}
