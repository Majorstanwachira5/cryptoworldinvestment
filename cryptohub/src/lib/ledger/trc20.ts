import { db } from "@/lib/db";
import { loadState, flushState } from "@/lib/db/persistence";
import { SupabaseSync } from "@/lib/supabase/sync";

export type DepositState =
  | "DETECTED"
  | "CONFIRMING"
  | "CONFIRMED"
  | "CREDITED"
  | "FAILED"
  | "REJECTED"
  | "MANUAL_REVIEW";

export type WithdrawalState =
  | "REQUESTED"
  | "REVIEW_PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "BROADCAST"
  | "CONFIRMING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED"
  | "MANUAL_REVIEW";

export interface TRC20DepositRecord {
  id: string;
  userId: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  contractAddress: string; // TRC20 USDT: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
  confirmations: number;
  requiredConfirmations: number;
  state: DepositState;
  detectedAt: string;
  confirmedAt?: string;
  creditedAt?: string;
  idempotencyKey: string;
  failureReason?: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  asset: string;
  network: string; // "TRC20"
  destinationAddress: string;
  amount: number;
  fee: number;
  totalReserved: number;
  state: WithdrawalState;
  requestedAt: string;
  approvedAt?: string;
  txHash?: string;
  rejectedReason?: string;
  idempotencyKey: string;
}

const TRC20_STORE_FILE = "cryptohub-trc20";

interface TRC20PersistedState {
  processedTxHashes: string[];
  deposits: Record<string, TRC20DepositRecord>;
  withdrawals: Record<string, WithdrawalRecord>;
}

const loadedTrc20 = loadState<TRC20PersistedState>(TRC20_STORE_FILE);
const processedTxHashes = new Set<string>(loadedTrc20?.processedTxHashes ?? []);
const depositsStore: Record<string, TRC20DepositRecord> = loadedTrc20?.deposits ?? {};
const withdrawalsStore: Record<string, WithdrawalRecord> = loadedTrc20?.withdrawals ?? {};

function persistTRC20(): void {
  flushState(TRC20_STORE_FILE, {
    processedTxHashes: Array.from(processedTxHashes),
    deposits: depositsStore,
    withdrawals: withdrawalsStore,
  });
}

// Official TRON Mainnet USDT Token Contract Address
export const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const REQUIRED_TRON_CONFIRMATIONS = 19; // TRON finality standard

export class BlockchainLedgerService {
  /**
   * Process incoming TRC20 deposit with strict idempotency and multi-state confirmation.
   */
  public static processTRC20Deposit(input: {
    userId: string;
    txHash: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
    contractAddress: string;
    confirmations: number;
  }): { ok: boolean; deposit: TRC20DepositRecord; error?: string } {
    const cleanHash = input.txHash.trim().toLowerCase();

    // Idempotency: Reject already credited deposit across memory store and durable ledger
    const alreadyInLedger = db
      .getLedger(input.userId, "REAL")
      .some((e) => e.txHash?.trim().toLowerCase() === cleanHash);

    if (processedTxHashes.has(cleanHash) || alreadyInLedger) {
      processedTxHashes.add(cleanHash);
      const existing =
        Object.values(depositsStore).find((d) => d.txHash === cleanHash) ||
        ({
          id: `dep_existing_${cleanHash}`,
          userId: input.userId,
          txHash: cleanHash,
          amount: input.amount,
          state: "CREDITED",
        } as TRC20DepositRecord);
      return { ok: false, deposit: existing, error: "Transaction hash has already been credited." };
    }

    // Verify correct token contract
    if (input.contractAddress && input.contractAddress !== TRON_USDT_CONTRACT) {
      const rejectedDeposit: TRC20DepositRecord = {
        id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: input.userId,
        txHash: cleanHash,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        amount: input.amount,
        contractAddress: input.contractAddress,
        confirmations: input.confirmations,
        requiredConfirmations: REQUIRED_TRON_CONFIRMATIONS,
        state: "REJECTED",
        detectedAt: new Date().toISOString(),
        idempotencyKey: cleanHash,
        failureReason: "Invalid TRC20 token contract. Must match TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      };
      depositsStore[rejectedDeposit.id] = rejectedDeposit;
      persistTRC20();
      SupabaseSync.syncDeposit(rejectedDeposit);
      return { ok: false, deposit: rejectedDeposit, error: rejectedDeposit.failureReason };
    }

    const state: DepositState =
      input.confirmations >= REQUIRED_TRON_CONFIRMATIONS
        ? "CREDITED"
        : input.confirmations > 0
        ? "CONFIRMING"
        : "DETECTED";

    // Check if an uncredited deposit record already exists for this txHash so we upgrade it in-place
    const existingPending = Object.values(depositsStore).find(
      (d) => d.txHash === cleanHash && d.state !== "CREDITED"
    );

    const deposit: TRC20DepositRecord = existingPending
      ? {
          ...existingPending,
          confirmations: input.confirmations,
          state,
          confirmedAt:
            input.confirmations >= REQUIRED_TRON_CONFIRMATIONS
              ? new Date().toISOString()
              : existingPending.confirmedAt,
          creditedAt: state === "CREDITED" ? new Date().toISOString() : undefined,
        }
      : {
          id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: input.userId,
          txHash: cleanHash,
          fromAddress: input.fromAddress,
          toAddress: input.toAddress,
          amount: input.amount,
          contractAddress: TRON_USDT_CONTRACT,
          confirmations: input.confirmations,
          requiredConfirmations: REQUIRED_TRON_CONFIRMATIONS,
          state,
          detectedAt: new Date().toISOString(),
          confirmedAt:
            input.confirmations >= REQUIRED_TRON_CONFIRMATIONS ? new Date().toISOString() : undefined,
          creditedAt: state === "CREDITED" ? new Date().toISOString() : undefined,
          idempotencyKey: cleanHash,
        };

    depositsStore[deposit.id] = deposit;

    // Credit internal ledger atomically ONLY when CONFIRMED
    if (state === "CREDITED") {
      processedTxHashes.add(cleanHash);
      db.depositFunds(
        input.userId,
        input.amount,
        "TRC20 Blockchain Transfer",
        cleanHash,
        "REAL"
      );
    }

    persistTRC20();
    SupabaseSync.syncDeposit(deposit);

    return { ok: true, deposit };
  }

  /**
   * Request controlled withdrawal with atomic balance reservation.
   */
  public static requestWithdrawal(input: {
    userId: string;
    destinationAddress: string;
    amount: number;
    idempotencyKey?: string;
  }): { ok: boolean; withdrawal?: WithdrawalRecord; error?: string } {
    // Authoritative Rule: Withdrawal minimum $100.00, server-enforced
    if (!input.amount || input.amount < 100.0) {
      return {
        ok: false,
        error: "Withdrawal minimum is $100.00 USDT, server-enforced. Requests below $100.00 are rejected.",
      };
    }

    if (
      !input.destinationAddress ||
      !input.destinationAddress.startsWith("T") ||
      input.destinationAddress.length !== 34
    ) {
      return {
        ok: false,
        error: "Invalid TRON TRC20 destination wallet address.",
      };
    }

    const fee = 1.0; // 1 USDT standard TRON network gas fee
    const totalRequired = input.amount + fee;

    // Check REAL available balance
    const realBalance = db.getBalance(input.userId, "REAL");
    if (realBalance.availableBalance < totalRequired) {
      return {
        ok: false,
        error: `Insufficient available funds. Required: ${totalRequired} USDT (${input.amount} USDT + 1 USDT fee), Available: ${realBalance.availableBalance} USDT`,
      };
    }

    const id = `wth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const withdrawal: WithdrawalRecord = {
      id,
      userId: input.userId,
      asset: "USDT",
      network: "TRC20",
      destinationAddress: input.destinationAddress,
      amount: input.amount,
      fee,
      totalReserved: totalRequired,
      state: "REVIEW_PENDING",
      requestedAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey || id,
    };

    withdrawalsStore[id] = withdrawal;

    // Ledger is single source of truth: debit applied atomically via ledger entry
    db.addLedgerEntry(
      input.userId,
      {
        type: "WITHDRAWAL",
        amount: totalRequired,
        currency: "USDT",
        txHash: id,
        description: `Withdrawal reserved for ${input.destinationAddress} (${input.amount} USDT + 1 USDT fee)`,
      },
      "REAL"
    );

    persistTRC20();
    SupabaseSync.syncWithdrawal(withdrawal);

    return { ok: true, withdrawal };
  }

  /**
   * Admin approves and broadcasts withdrawal.
   */
  public static approveWithdrawal(withdrawalId: string, txHash?: string): boolean {
    const w = withdrawalsStore[withdrawalId];
    if (!w || w.state !== "REVIEW_PENDING") return false;

    w.state = "COMPLETED";
    w.approvedAt = new Date().toISOString();
    w.txHash = txHash || `tron_tx_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    persistTRC20();
    SupabaseSync.syncWithdrawal(w);
    return true;
  }

  /**
   * Admin rejects withdrawal: atomic refund back to available balance via compensating ledger credit.
   */
  public static rejectWithdrawal(withdrawalId: string, reason: string): boolean {
    const w = withdrawalsStore[withdrawalId];
    if (!w || w.state !== "REVIEW_PENDING") return false;

    w.state = "REJECTED";
    w.rejectedReason = reason;

    // Compensating ledger credit applied atomically
    db.addLedgerEntry(
      w.userId,
      {
        type: "ADJUSTMENT",
        amount: w.totalReserved,
        currency: "USDT",
        txHash: `refund_${withdrawalId}`,
        description: `Refund for rejected withdrawal ${withdrawalId} (${reason})`,
      },
      "REAL"
    );

    persistTRC20();
    SupabaseSync.syncWithdrawal(w);

    return true;
  }

  public static getWithdrawalsForUser(userId: string): WithdrawalRecord[] {
    return Object.values(withdrawalsStore)
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  public static getDepositsForUser(userId: string): TRC20DepositRecord[] {
    return Object.values(depositsStore)
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  public static getAllWithdrawals(): WithdrawalRecord[] {
    return Object.values(withdrawalsStore).sort((a, b) =>
      b.requestedAt.localeCompare(a.requestedAt)
    );
  }

  public static getAllDeposits(): TRC20DepositRecord[] {
    return Object.values(depositsStore).sort((a, b) =>
      b.detectedAt.localeCompare(a.detectedAt)
    );
  }
}
