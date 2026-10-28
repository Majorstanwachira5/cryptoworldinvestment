import { db, pool } from '../database';
import { LedgerService } from '../ledger/LedgerService';
import { UserLevelsEngine } from '../levels/UserLevelsEngine';
import { config } from '../config';
import { randomUUID as uuidv4 } from 'crypto';

export interface AutoTradeEarningResult {
  runId: string;
  runDate: string;
  userId: string;
  level: number;
  amountUsdt: number;
  status: string;
  alreadyProcessed?: boolean;
}

export class AutoTradeEngine {

  /**
   * Returns current date in YYYY-MM-DD format for a given Date object (default: current UTC date).
   */
  public static getFormattedDate(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculates the auto-trade daily earnings for a given user level.
   * Business Rules:
   *  - Level 1: Min $10.00, Max $18.00 per day
   *  - Level 2: Min $8.00, Max $14.00 per day
   *  - Level 3: Min $5.00, Max $8.00 per day
   *  - Level 0 (or invalid): $0.00
   * Uses a deterministic seed derived from userId + runDate so results are reproducible and auditable.
   */
  public static calculateDailyEarning(userId: string, level: number, runDate: string): number {
    let min = 0;
    let max = 0;

    if (level === 1) {
      min = config.autoTradeLevel1MinUsdt;
      max = config.autoTradeLevel1MaxUsdt;
    } else if (level === 2) {
      min = config.autoTradeLevel2MinUsdt;
      max = config.autoTradeLevel2MaxUsdt;
    } else if (level === 3) {
      min = config.autoTradeLevel3MinUsdt;
      max = config.autoTradeLevel3MaxUsdt;
    } else {
      return 0.0;
    }

    // Pseudo-random pseudo-deterministic hash for reproducibility based on userId + runDate
    let hash = 0;
    const str = `${userId}_${runDate}_autotrade_seed`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const normalized = Math.abs(hash % 10000) / 10000.0; // 0.0000 to 0.9999
    const amount = min + normalized * (max - min);
    return parseFloat(amount.toFixed(2));
  }

  /**
   * Processes daily auto-trade earnings for a single user for a specific run date.
   * Idempotent: duplicate calls for same runDate + userId will return the existing record without extra ledger entries.
   */
  static async processUserAutoTrade(userId: string, dateOverride?: string): Promise<AutoTradeEarningResult> {
    const runDate = dateOverride || this.getFormattedDate();
    const eventKey = `AUTOTRADE_${runDate}_${userId}`;

    // Idempotency check in auto_trade_runs table
    const existing = await db.get('SELECT * FROM auto_trade_runs WHERE run_date = ? AND user_id = ?', [runDate, userId]) as any;
    if (existing) {
      return {
        runId: existing.id,
        runDate: existing.run_date,
        userId: existing.user_id,
        level: existing.level,
        amountUsdt: Number(existing.amount_usdt),
        status: existing.status,
        alreadyProcessed: true
      };
    }

    // Evaluate latest user level
    const levelInfo = await UserLevelsEngine.getUserLevel(userId);
    const userLevel = levelInfo.level;

    if (userLevel < 1) {
      return {
        runId: '',
        runDate,
        userId,
        level: userLevel,
        amountUsdt: 0.0,
        status: 'SKIPPED_LEVEL_0',
        alreadyProcessed: false
      };
    }

    const dailyAmountUsdt = this.calculateDailyEarning(userId, userLevel, runDate);
    if (dailyAmountUsdt <= 0) {
      return {
        runId: '',
        runDate,
        userId,
        level: userLevel,
        amountUsdt: 0.0,
        status: 'SKIPPED_ZERO_AMOUNT',
        alreadyProcessed: false
      };
    }

    const userWallet = await db.get("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'", [userId]) as { id: string } | undefined;
    if (!userWallet) {
      throw new Error(`USDT wallet not found for user ${userId}`);
    }

    const systemWallet = await LedgerService.getOrCreateSystemWallet();
    const amountMicro = Math.round(dailyAmountUsdt * 1_000_000);
    const runId = uuidv4();

    const txId = await db.transaction(async (client) => {
      // Post balanced ledger transaction
      const ledgerTxId = await LedgerService.postTransaction(
        eventKey,
        'AUTO_TRADE_EARNING',
        `Daily Auto-Trade Earning (Level ${userLevel}, Date: ${runDate})`,
        [
          { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
          { walletId: userWallet.id, type: 'CREDIT', amountMicro }
        ]
      );

      // Record run in auto_trade_runs
      await db.run(`
        INSERT INTO auto_trade_runs (id, run_date, user_id, level, amount_usdt, status, transaction_id)
        VALUES (?, ?, ?, ?, ?, 'CREDITED', ?)
      `, [runId, runDate, userId, userLevel, dailyAmountUsdt, ledgerTxId], client);

      return ledgerTxId;
    });

    return {
      runId,
      runDate,
      userId,
      level: userLevel,
      amountUsdt: dailyAmountUsdt,
      status: 'CREDITED',
      alreadyProcessed: false
    };
  }

  /**
   * Runs the auto-trade earnings job across all eligible users (Level 1, 2, 3) for the given run date.
   */
  static async runDailyBatch(dateOverride?: string): Promise<{ runDate: string; processedCount: number; results: AutoTradeEarningResult[] }> {
    const runDate = dateOverride || this.getFormattedDate();

    // Fetch all users with user_levels record or active status
    const users = await db.all('SELECT DISTINCT u.id FROM users u WHERE u.is_suspended = 0 AND u.role = $1', ['USER']) as { id: string }[];

    const results: AutoTradeEarningResult[] = [];
    let processedCount = 0;

    for (const user of users) {
      try {
        const result = await this.processUserAutoTrade(user.id, runDate);
        if (result.status === 'CREDITED') {
          processedCount++;
        }
        results.push(result);
      } catch (err: any) {
        console.error(`Error processing auto-trade for user ${user.id}:`, err.message);
      }
    }

    return {
      runDate,
      processedCount,
      results
    };
  }

  /**
   * Retrieves auto-trade earnings history for a specific user.
   */
  static async getUserAutoTradeHistory(userId: string) {
    return await db.all('SELECT * FROM auto_trade_runs WHERE user_id = ? ORDER BY run_date DESC, created_at DESC', [userId]);
  }
}
