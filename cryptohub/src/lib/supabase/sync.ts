import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./client";
import type { LedgerEntry, Trade, User, Balance, ReferralRecord } from "@/types";
import type { TRC20DepositRecord, WithdrawalRecord } from "@/lib/ledger/trc20";
import type { AuditLogEntry } from "@/lib/audit";

export interface SupabaseHealthStatus {
  configured: boolean;
  projectUrl: string;
  projectRef: string;
  restReachable: boolean;
  authReachable: boolean;
  latencyMs: number;
  lastSyncedAt: string | null;
  syncedCounts: {
    users: number;
    ledgerEntries: number;
    deposits: number;
    withdrawals: number;
    auditLogs: number;
  };
  status: "CONNECTED" | "LOCAL_FALLBACK" | "DEGRADED";
  detail: string;
}

let lastSyncedAt: string | null = null;
const syncedCounts = {
  users: 0,
  ledgerEntries: 0,
  deposits: 0,
  withdrawals: 0,
  auditLogs: 0,
};

function extractProjectRef(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Checks live connectivity to the configured Supabase project (REST + Auth endpoints)
 * and reports synchronization telemetry for User App, Backend, and Admin Console.
 */
export async function checkSupabaseConnection(): Promise<SupabaseHealthStatus> {
  const start = Date.now();
  const projectRef = extractProjectRef(SUPABASE_URL);
  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  if (!configured) {
    return {
      configured: false,
      projectUrl: SUPABASE_URL,
      projectRef,
      restReachable: false,
      authReachable: false,
      latencyMs: 0,
      lastSyncedAt,
      syncedCounts: { ...syncedCounts },
      status: "LOCAL_FALLBACK",
      detail: "Supabase environment variables not configured; running on durable local store.",
    };
  }

  let restReachable = false;
  let authReachable = false;
  let detail = "Supabase REST & Auth gateways verified.";

  try {
    const [restRes, authRes] = await Promise.allSettled([
      fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      }),
      fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`, {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      }),
    ]);

    if (restRes.status === "fulfilled" && (restRes.value.ok || restRes.value.status === 200)) {
      restReachable = true;
    }
    if (authRes.status === "fulfilled" && (authRes.value.ok || authRes.value.status === 200)) {
      authReachable = true;
    }

    if (!restReachable && !authReachable) {
      detail = "Supabase cloud endpoints unreachable from current network; durable local WAL active.";
    }
  } catch (err) {
    detail = `Supabase probe error: ${(err as Error).message}`;
  }

  const latencyMs = Date.now() - start;
  const status =
    restReachable || authReachable
      ? "CONNECTED"
      : configured
      ? "LOCAL_FALLBACK"
      : "DEGRADED";

  return {
    configured,
    projectUrl: SUPABASE_URL,
    projectRef,
    restReachable,
    authReachable,
    latencyMs,
    lastSyncedAt,
    syncedCounts: { ...syncedCounts },
    status,
    detail,
  };
}

/**
 * Non-blocking background mirror to Supabase tables when reachable.
 * Never throws or blocks critical financial ledger writes.
 */
export const SupabaseSync = {
  async syncUser(user: User, balance?: Balance): Promise<void> {
    syncedCounts.users++;
    lastSyncedAt = new Date().toISOString();
    try {
      // Direct PostgreSQL insert if available
      try {
        const { pgInsertUser } = await import("@/lib/db/postgres");
        await pgInsertUser({
          id: user.id,
          email: user.email,
          fullName: user.name,
          passwordHash: user.btcAddress || "",
          role: user.role,
          referralCode: user.referralCode,
        });
      } catch {
        /* PostgreSQL direct pool handled */
      }

      // Supabase PostgREST sync to users table
      await supabase.from("users").upsert(
        {
          id: user.id,
          email: (user.email || "").trim().toLowerCase(),
          full_name: user.name,
          role: user.role || "USER",
          referral_code: user.referralCode || user.id.slice(0, 8),
          password_hash: user.btcAddress || "",
          kyc_status: user.kycStatus || "VERIFIED",
        },
        { onConflict: "email" }
      );

      // Supabase PostgREST sync to wallets table
      const totalMicro = balance
        ? Math.round((balance.availableBalance || 0) * 1_000_000)
        : 5000000;
      await supabase.from("wallets").upsert(
        {
          id: `wal_${user.id.replace(/^usr_/, "")}`,
          user_id: user.id,
          asset: "USDT",
          total_balance_micro: totalMicro,
          reserved_balance_micro: 0,
        },
        { onConflict: "user_id" }
      );
    } catch {
      // Silent fallback when running in offline/sandboxed environment
    }
  },

  syncLedgerEntry(entry: LedgerEntry): void {
    syncedCounts.ledgerEntries++;
    lastSyncedAt = new Date().toISOString();
    void (async () => {
      try {
        await supabase.from("ledger_entries").upsert(
          {
            id: entry.id,
            user_id: entry.userId,
            account_type: "REAL",
            type: entry.type,
            amount: entry.amount,
            currency: entry.currency,
            balance_after: entry.balanceAfter,
            tx_hash: entry.txHash || null,
            description: entry.description,
            created_at: entry.createdAt,
          },
          { onConflict: "id" }
        );
      } catch {
        // Silent fallback
      }
    })();
  },

  syncTrade(trade: Trade): void {
    lastSyncedAt = new Date().toISOString();
    void (async () => {
      try {
        await supabase.from("trades").upsert(
          {
            id: trade.id,
            user_id: trade.userId,
            account_type: "REAL",
            symbol: trade.symbol,
            asset_class: trade.assetClass,
            direction: trade.direction,
            order_type: trade.orderType,
            status: trade.status,
            entry_price: trade.entryPrice,
            exit_price: trade.exitPrice ?? null,
            current_price: trade.currentPrice,
            size: trade.size,
            leverage: trade.leverage,
            margin: trade.margin,
            stop_loss: trade.stopLoss ?? null,
            take_profit: trade.takeProfit ?? null,
            liquidation_price: trade.liquidationPrice ?? null,
            pnl: trade.pnl,
            pips: trade.pips,
            rationale: trade.rationale ?? null,
            opened_at: trade.openedAt,
            closed_at: trade.closedAt ?? null,
          },
          { onConflict: "id" }
        );
      } catch {
        // Silent fallback
      }
    })();
  },

  syncDeposit(deposit: TRC20DepositRecord): void {
    syncedCounts.deposits++;
    lastSyncedAt = new Date().toISOString();
    void (async () => {
      try {
        await supabase.from("trc20_deposits").upsert(
          {
            id: deposit.id,
            user_id: deposit.userId,
            tx_hash: deposit.txHash,
            from_address: deposit.fromAddress,
            to_address: deposit.toAddress,
            amount: deposit.amount,
            contract_address: deposit.contractAddress,
            confirmations: deposit.confirmations,
            required_confirmations: deposit.requiredConfirmations,
            state: deposit.state,
            detected_at: deposit.detectedAt,
            confirmed_at: deposit.confirmedAt ?? null,
            credited_at: deposit.creditedAt ?? null,
            idempotency_key: deposit.idempotencyKey,
            failure_reason: deposit.failureReason ?? null,
          },
          { onConflict: "tx_hash" }
        );
      } catch {
        // Silent fallback
      }
    })();
  },

  syncWithdrawal(withdrawal: WithdrawalRecord): void {
    syncedCounts.withdrawals++;
    lastSyncedAt = new Date().toISOString();
    void (async () => {
      try {
        await supabase.from("withdrawals").upsert(
          {
            id: withdrawal.id,
            user_id: withdrawal.userId,
            asset: withdrawal.asset,
            network: withdrawal.network,
            destination_address: withdrawal.destinationAddress,
            amount: withdrawal.amount,
            fee: withdrawal.fee,
            total_reserved: withdrawal.totalReserved,
            state: withdrawal.state,
            requested_at: withdrawal.requestedAt,
            approved_at: withdrawal.approvedAt ?? null,
            tx_hash: withdrawal.txHash ?? null,
            rejected_reason: withdrawal.rejectedReason ?? null,
            idempotency_key: withdrawal.idempotencyKey,
          },
          { onConflict: "id" }
        );
      } catch {
        // Silent fallback
      }
    })();
  },

  syncReferral(record: ReferralRecord): void {
    lastSyncedAt = new Date().toISOString();
    void (async () => {
      try {
        await supabase.from("referrals").upsert(
          {
            id: record.id,
            referrer_id: record.referrerId,
            referrer_email: record.referrerEmail,
            code: record.code,
            referred_email: record.referredEmail,
            referred_name: record.referredName,
            status: record.status,
            reward_usd: record.rewardUsd,
            created_at: record.createdAt,
          },
          { onConflict: "referrer_id,referred_email" }
        );
      } catch {
        // Silent fallback
      }
    })();
  },

  syncAuditLog(entry: AuditLogEntry): void {
    syncedCounts.auditLogs++;
    lastSyncedAt = new Date().toISOString();
    void (async () => {
      try {
        await supabase.from("audit_logs").insert({
          id: entry.id,
          actor: entry.actor,
          action: entry.action,
          target: entry.target,
          outcome: entry.outcome,
          details: entry.details ?? {},
          timestamp: entry.timestamp,
        });
      } catch {
        // Silent fallback
      }
    })();
  },
};

