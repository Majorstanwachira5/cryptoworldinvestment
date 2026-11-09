import { db } from "@/lib/db";
import { UserLevel, LedgerEntry } from "@/types";

export interface LevelDerivation {
  userId: string;
  cumulativeDeposits: number;
  successfulReferralsCount: number;
  depositBaseLevel: UserLevel;
  referralPromotedLevel: UserLevel;
  effectiveLevel: UserLevel;
  levelName: string;
  dailyEarningRange: [number, number] | null;
  eligibleForAutoTrade: boolean;
  withdrawableEarnings: number;
  totalEarnings: number;
  totalWithdrawn: number;
  hasRunToday: boolean;
}

export interface AutoTradeResult {
  userId: string;
  level: UserLevel;
  amount: number;
  credited: boolean;
  ledgerId?: string;
  reason?: string;
}

export interface WednesdayBonusResult {
  userId: string;
  credited: boolean;
  amount: number;
  ledgerId?: string;
  reason?: string;
}

export class RewardEngine {
  // Authoritative constants
  public static readonly LEVEL_3_THRESHOLD = 300.0;
  public static readonly LEVEL_2_THRESHOLD = 500.0;
  public static readonly LEVEL_1_THRESHOLD = 600.0;

  public static readonly AUTO_TRADE_RANGES = {
    3: { min: 5.0, max: 8.0 },
    2: { min: 8.0, max: 14.0 },
    1: { min: 10.0, max: 18.0 },
  };

  public static readonly REFERRAL_REWARD_USD = 30.0;
  public static readonly WEDNESDAY_BONUS_USD = 1.0;
  public static readonly WITHDRAWAL_MINIMUM_USD = 10.0;

  /**
   * Derive user level strictly server-side based on cumulative confirmed deposits
   * and successful referral counts, plus calculate withdrawable earnings vs locked working capital.
   */
  public static deriveUserLevel(userId: string): LevelDerivation {
    const userLedger = db.getLedger(userId, "REAL");
    
    // Cumulative confirmed USDT deposits (Locked Working Capital)
    const cumulativeDeposits = userLedger
      .filter((entry) => entry.type === "DEPOSIT" && entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);

    // Count successful/qualified referrals
    const referrals = db.getReferrals(userId) || [];
    const successfulReferralsCount = referrals.filter(
      (r) => r.status === "QUALIFIED"
    ).length;

    // 1. Determine base level by confirmed cumulative deposits
    let depositBaseLevel: UserLevel = 0;
    if (cumulativeDeposits >= this.LEVEL_1_THRESHOLD) {
      depositBaseLevel = 1;
    } else if (cumulativeDeposits >= this.LEVEL_2_THRESHOLD) {
      depositBaseLevel = 2;
    } else if (cumulativeDeposits >= this.LEVEL_3_THRESHOLD) {
      depositBaseLevel = 3;
    }

    // 2. Determine referral promotion level
    // Rule: Level 3 with >10 successful referrals -> Level 2.
    //       Level 3 with >20 successful referrals -> Level 1.
    let referralPromotedLevel: UserLevel = depositBaseLevel;
    if (depositBaseLevel > 0) {
      if (successfulReferralsCount > 20) {
        referralPromotedLevel = 1;
      } else if (successfulReferralsCount > 10) {
        referralPromotedLevel = depositBaseLevel === 1 ? 1 : 2;
      }
    }

    // Precedence rule: highest level wins (1 is top, 2 is mid, 3 is entry, 0 is unranked)
    let effectiveLevel: UserLevel = depositBaseLevel;
    if (depositBaseLevel > 0) {
      effectiveLevel = Math.min(depositBaseLevel, referralPromotedLevel) as UserLevel;
    }

    const levelNames: Record<UserLevel, string> = {
      0: "Unranked / Below Entry",
      3: "Level 3 (Entry - $300)",
      2: "Level 2 (Mid - $500)",
      1: "Level 1 (Top Tier - $600+)",
    };

    const dailyRanges: Record<UserLevel, [number, number] | null> = {
      0: null,
      3: [this.AUTO_TRADE_RANGES[3].min, this.AUTO_TRADE_RANGES[3].max],
      2: [this.AUTO_TRADE_RANGES[2].min, this.AUTO_TRADE_RANGES[2].max],
      1: [this.AUTO_TRADE_RANGES[1].min, this.AUTO_TRADE_RANGES[1].max],
    };

    // Calculate Withdrawable Earnings vs Principal Deposit
    // Earnings types: AUTO_TRADE_EARNING, REFERRAL_BONUS, WELCOME_BONUS, WEDNESDAY_BONUS, TRADE_PROFIT
    const totalEarnings = userLedger
      .filter((e) =>
        [
          "AUTO_TRADE_EARNING",
          "REFERRAL_BONUS",
          "WELCOME_BONUS",
          "WEDNESDAY_BONUS",
          "TRADE_PROFIT",
        ].includes(e.type)
      )
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const totalLosses = userLedger
      .filter((e) => e.type === "TRADE_LOSS")
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const totalWithdrawn = userLedger
      .filter((e) => e.type === "WITHDRAWAL")
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const netEarnings = Math.max(0, totalEarnings - totalLosses);
    const withdrawableEarnings = Math.max(
      0,
      Math.round((netEarnings - totalWithdrawn) * 100) / 100
    );

    const today = new Date().toISOString().split("T")[0];
    const hasRunToday = userLedger.some(
      (e) =>
        e.type === "AUTO_TRADE_EARNING" &&
        (e.txHash === `auto_trade_${today}_${userId}` ||
          e.description.includes(`Auto-Trade Daily Credit (${today})`))
    );

    return {
      userId,
      cumulativeDeposits,
      successfulReferralsCount,
      depositBaseLevel,
      referralPromotedLevel,
      effectiveLevel,
      levelName: levelNames[effectiveLevel],
      dailyEarningRange: dailyRanges[effectiveLevel],
      eligibleForAutoTrade: effectiveLevel > 0,
      withdrawableEarnings,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
      hasRunToday,
    };
  }

  /**
   * Run or claim daily auto-trade for a single user.
   * Strictly idempotent per date.
   */
  public static runDailyAutoTradeForUser(userId: string, dateOverride?: string): AutoTradeResult {
    const today = dateOverride || new Date().toISOString().split("T")[0];
    const derivation = this.deriveUserLevel(userId);
    const level = derivation.effectiveLevel;

    if (level === 0) {
      return {
        userId,
        level: 0,
        amount: 0,
        credited: false,
        reason: "Account is below Level 3. Deposit at least $300.00 USDT to activate Quantitative Auto-Trade.",
      };
    }

    const userLedger = db.getLedger(userId, "REAL");
    const existingToday = userLedger.find(
      (e) =>
        e.type === "AUTO_TRADE_EARNING" &&
        (e.txHash === `auto_trade_${today}_${userId}` ||
          e.description.includes(`Auto-Trade Daily Credit (${today})`))
    );

    if (existingToday) {
      return {
        userId,
        level,
        amount: existingToday.amount,
        credited: false,
        ledgerId: existingToday.id,
        reason: `Today's Auto-Trade yield of $${existingToday.amount.toFixed(2)} USDT has already been credited (${today}). Next yield unlocks at 00:00 UTC.`,
      };
    }

    const range = this.AUTO_TRADE_RANGES[level as 1 | 2 | 3];
    const seedString = `${today}:${userId}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = (hash << 5) - hash + seedString.charCodeAt(i);
      hash |= 0;
    }
    const normalized = Math.abs(hash % 1000) / 1000.0;
    const rawAmount = range.min + normalized * (range.max - range.min);
    const amount = Math.round(rawAmount * 100) / 100;

    const txHash = `auto_trade_${today}_${userId}`;
    const entry = db.addLedgerEntry(
      userId,
      {
        type: "AUTO_TRADE_EARNING",
        amount,
        currency: "USDT",
        txHash,
        description: `Auto-Trade Daily Credit (${today}) for Level ${level} ($${amount.toFixed(2)} USDT)`,
      },
      "REAL"
    );

    return {
      userId,
      level,
      amount,
      credited: true,
      ledgerId: entry.id,
    };
  }

  /**
   * Run the daily auto-trade earnings credit for all eligible users.
   * Strictly idempotent per date.
   */
  public static runDailyAutoTrade(dateOverride?: string): {
    date: string;
    processed: number;
    credited: number;
    results: AutoTradeResult[];
  } {
    const today = dateOverride || new Date().toISOString().split("T")[0];
    const allUsers = db.getAllUsers();
    const results: AutoTradeResult[] = [];
    let creditedCount = 0;

    for (const user of allUsers) {
      const derivation = this.deriveUserLevel(user.id);
      const level = derivation.effectiveLevel;

      // Users below Level 3 receive zero earnings and NO ledger entry
      if (level === 0) {
        results.push({
          userId: user.id,
          level: 0,
          amount: 0,
          credited: false,
          reason: "Below Level 3 entry threshold ($300 cumulative deposit required)",
        });
        continue;
      }

      // Check idempotency: one auto-trade entry per user per day
      const userLedger = db.getLedger(user.id, "REAL");
      const existingToday = userLedger.find(
        (e) =>
          e.type === "AUTO_TRADE_EARNING" &&
          (e.txHash === `auto_trade_${today}_${user.id}` ||
            e.description.includes(`Auto-Trade Daily Credit (${today})`))
      );

      if (existingToday) {
        results.push({
          userId: user.id,
          level,
          amount: existingToday.amount,
          credited: false,
          ledgerId: existingToday.id,
          reason: `Already credited for date ${today}`,
        });
        continue;
      }

      // Calculate pseudo-random earning within authoritative range for the level
      const range = this.AUTO_TRADE_RANGES[level as 1 | 2 | 3];
      // Seeded deterministically by date + userId so repeated calls yield the same amount
      const seedString = `${today}:${user.id}`;
      let hash = 0;
      for (let i = 0; i < seedString.length; i++) {
        hash = (hash << 5) - hash + seedString.charCodeAt(i);
        hash |= 0;
      }
      const normalized = Math.abs(hash % 1000) / 1000.0;
      const rawAmount = range.min + normalized * (range.max - range.min);
      const amount = Math.round(rawAmount * 100) / 100;

      // Single atomic credit to ledger
      const txHash = `auto_trade_${today}_${user.id}`;
      const entry = db.addLedgerEntry(
        user.id,
        {
          type: "AUTO_TRADE_EARNING",
          amount,
          currency: "USDT",
          txHash,
          description: `Auto-Trade Daily Credit (${today}) for Level ${level} ($${amount.toFixed(2)} USDT)`,
        },
        "REAL"
      );

      creditedCount++;
      results.push({
        userId: user.id,
        level,
        amount,
        credited: true,
        ledgerId: entry.id,
      });
    }

    return {
      date: today,
      processed: allUsers.length,
      credited: creditedCount,
      results,
    };
  }

  /**
   * Run the Wednesday bonus credit.
   * Only executes if today is Wednesday in the configured timezone.
   * Idempotent per week.
   */
  public static runWednesdayBonus(dateOverride?: string): {
    isWednesday: boolean;
    date: string;
    credited: number;
    results: WednesdayBonusResult[];
  } {
    const targetDate = dateOverride ? new Date(dateOverride) : new Date();
    const dayOfWeek = targetDate.getUTCDay(); // 3 = Wednesday
    const dateStr = targetDate.toISOString().split("T")[0];

    // Compute ISO week string: YYYY-Www
    const startOfYear = new Date(Date.UTC(targetDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(
      (((targetDate.getTime() - startOfYear.getTime()) / 86400000) +
        startOfYear.getUTCDay() + 1) /
        7
    );
    const weekKey = `${targetDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;

    if (dayOfWeek !== 3) {
      return {
        isWednesday: false,
        date: dateStr,
        credited: 0,
        results: [
          {
            userId: "N/A",
            credited: false,
            amount: 0,
            reason: `Today is not Wednesday (day ${dayOfWeek} != 3). Bonus only runs on Wednesdays.`,
          },
        ],
      };
    }

    const allUsers = db.getAllUsers();
    const results: WednesdayBonusResult[] = [];
    let creditedCount = 0;

    for (const user of allUsers) {
      const derivation = this.deriveUserLevel(user.id);
      // Eligible account: Level >= 3 (cumulative deposit >= $300)
      if (derivation.effectiveLevel === 0) {
        results.push({
          userId: user.id,
          credited: false,
          amount: 0,
          reason: "Account ineligible: Requires Level 3 or confirmed deposit threshold.",
        });
        continue;
      }

      // Check idempotency for this Wednesday
      const userLedger = db.getLedger(user.id, "REAL");
      const txHash = `wednesday_bonus_${weekKey}_${user.id}`;
      const existing = userLedger.find(
        (e) =>
          e.type === "WEDNESDAY_BONUS" &&
          (e.txHash === txHash || e.description.includes(`Wednesday Loyalty Bonus (${weekKey})`))
      );

      if (existing) {
        results.push({
          userId: user.id,
          credited: false,
          amount: existing.amount,
          ledgerId: existing.id,
          reason: `Already credited for Wednesday week ${weekKey}`,
        });
        continue;
      }

      const entry = db.addLedgerEntry(
        user.id,
        {
          type: "WEDNESDAY_BONUS",
          amount: this.WEDNESDAY_BONUS_USD,
          currency: "USDT",
          txHash,
          description: `Wednesday Loyalty Bonus (${weekKey}) ($${this.WEDNESDAY_BONUS_USD.toFixed(2)} USDT)`,
        },
        "REAL"
      );

      creditedCount++;
      results.push({
        userId: user.id,
        credited: true,
        amount: this.WEDNESDAY_BONUS_USD,
        ledgerId: entry.id,
      });
    }

    return {
      isWednesday: true,
      date: dateStr,
      credited: creditedCount,
      results,
    };
  }

  /**
   * Process a successful referral reward with strict anti-collision and single-credit constraint.
   */
  public static creditReferralReward(input: {
    referrerId: string;
    referredEmail: string;
    referredName?: string;
  }): { success: boolean; rewardAmount?: number; error?: string; ledgerId?: string } {
    const referrer = db.getUser(input.referrerId);
    if (!referrer) {
      return { success: false, error: "Referrer user not found" };
    }

    const cleanEmail = input.referredEmail.trim().toLowerCase();

    // Prevent self-referral
    if (referrer.email.toLowerCase() === cleanEmail) {
      return { success: false, error: "Self-referral is strictly prohibited." };
    }

    // Check unique constraint: Referred email has already rewarded this referrer
    const existingReferrals = db.getReferrals(input.referrerId) || [];
    const alreadyRewarded = existingReferrals.find(
      (r) => r.referredEmail.toLowerCase() === cleanEmail
    );

    if (alreadyRewarded) {
      return {
        success: false,
        error: `Referral reward for ${cleanEmail} has already been credited once.`,
      };
    }

    // Record referral and credit $30.00
    const rewardUsd = this.REFERRAL_REWARD_USD;
    const referralId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const txHash = `ref_reward_${referralId}`;

    // Verify that the referee has deposited according to platform level tiers (minimum Level 3 = $300.00)
    const referredUser = db.getAllUsers().find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    let refereeCumulativeDeposits = 0;
    if (referredUser) {
      const refereeLedger = db.getLedger(referredUser.id, "REAL");
      refereeCumulativeDeposits = refereeLedger
        .filter((e) => e.type === "DEPOSIT" && e.amount > 0)
        .reduce((sum, e) => sum + e.amount, 0);
    }

    const hasReachedDepositTier = refereeCumulativeDeposits >= 300;

    db.recordReferral(
      input.referrerId,
      referrer.email,
      referrer.referralCode,
      cleanEmail,
      input.referredName || cleanEmail.split("@")[0],
      rewardUsd,
      hasReachedDepositTier ? "QUALIFIED" : "PENDING"
    );

    if (!hasReachedDepositTier) {
      return {
        success: true,
        rewardAmount: 0,
        error: "Referral recorded as PENDING. Reward ($30.00 USDT) unlocks once referee deposits according to platform levels (min $300.00).",
      };
    }

    const entry = db.addLedgerEntry(
      input.referrerId,
      {
        type: "REFERRAL_BONUS",
        amount: rewardUsd,
        currency: "USDT",
        txHash,
        description: `Referral Reward for inviting ${cleanEmail} ($${rewardUsd.toFixed(2)} USDT)`,
      },
      "REAL"
    );

    return {
      success: true,
      rewardAmount: rewardUsd,
      ledgerId: entry.id,
    };
  }
}
