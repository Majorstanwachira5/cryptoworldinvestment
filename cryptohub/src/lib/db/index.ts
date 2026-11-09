import {
  User,
  Balance,
  Trade,
  LedgerEntry,
  LedgerEntryType,
  PredictionResult,
  AccountType,
  ReferralRecord,
  Candle,
  Ticker,
} from "@/types";
import { getFxRates } from "@/lib/fx/rates";
import { loadState, saveState, flushState, describeStorage } from "./persistence";
import { SupabaseSync } from "@/lib/supabase/sync";

/**
 * Authoritative referral reward: $30.00 per successful referral, credited once to REAL account.
 */
const REFERRAL_REWARD_USD = 30.0;
const DIRECT_REFERRAL_REWARD_USD = REFERRAL_REWARD_USD;

const STORE_FILE = "cryptohub-store";

/** Welcome registration capital bonus credited to every new account upon sign up. */
const REAL_STARTING_CAPITAL = 5.0;

const DEPOSIT_ADDRESSES = {
  btc: process.env.BTC_DEPOSIT_ADDRESS || "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  eth: process.env.ETH_DEPOSIT_ADDRESS || "0x71C8407BEA758B540306E5D73A9dFcf38914A690",
  usdt:
    process.env.NEXT_PUBLIC_TRON_VAULT_ADDRESS ||
    process.env.USDT_DEPOSIT_ADDRESS ||
    "TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd",
};

/**
 * Derives a stable, human-typeable referral code from a profile id.
 * Deterministic so the same user always shares the same code.
 */
function referralCodeFor(userId: string, email: string): string {
  const seed = `${userId}:${email}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().slice(0, 6).padStart(6, "X");
}

interface AccountState {
  balance: Balance;
  trades: Trade[];
  ledger: LedgerEntry[];
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: User["role"];
  referralCode: string;
  riskTolerancePercent: number;
  hasCompletedRiskQuiz: boolean;
  kycStatus: User["kycStatus"];
  createdAt: string;
}

interface MarketCandlesRecord {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  updatedAt: number;
  source: string;
}

interface PersistedState {
  version: number;
  users: Record<string, UserRecord>;
  accounts: Record<string, { REAL: AccountState }>;
  referrals: Record<string, ReferralRecord[]>;
  predictions: PredictionResult[];
  marketCandles: Record<string, MarketCandlesRecord>;
  tickers: Record<string, Ticker>;
  totalPlatformVolume: number;
  totalPlatformRevenue: number;
}

function emptyState(): PersistedState {
  return {
    version: 1,
    users: {},
    accounts: {},
    referrals: {},
    predictions: [],
    marketCandles: {},
    tickers: {},
    totalPlatformVolume: 0,
    totalPlatformRevenue: 0,
  };
}

function freshBalance(userId: string): Balance {
  const now = new Date().toISOString();
  return {
    userId,
    accountType: "REAL",
    currency: "USDT",
    availableBalance: REAL_STARTING_CAPITAL,
    equity: REAL_STARTING_CAPITAL,
    marginUsed: 0,
    freeMargin: REAL_STARTING_CAPITAL,
    marginLevelPct: 9999,
    totalDeposited: 0.0,
    updatedAt: now,
  };
}

function freshAccount(userId: string): AccountState {
  const now = new Date().toISOString();
  const welcomeEntry: LedgerEntry = {
    id: `led_bonus_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    accountType: "REAL",
    type: "WELCOME_BONUS",
    amount: REAL_STARTING_CAPITAL,
    currency: "USDT",
    balanceAfter: REAL_STARTING_CAPITAL,
    description: "Welcome Registration Capital Bonus ($5.00 USDT)",
    status: "CONFIRMED",
    timestamp: now,
    createdAt: now,
  };
  return {
    balance: freshBalance(userId),
    trades: [],
    ledger: [welcomeEntry],
  };
}

/**
 * Per-user platform store — strictly REAL accounts only.
 *
 * Every read and write is scoped by user id, taken from the verified access
 * token, and mirrored asynchronously to Supabase.
 */
class DatabaseStore {
  private state: PersistedState;

  constructor() {
    const storage = describeStorage();
    if (!storage.writable) {
      console.error(
        `[db] DATA_DIR ${storage.dir} is not writable (${storage.error}). ` +
          "State will be held in memory only and lost on restart."
      );
    } else {
      console.log(`[db] persisting state to ${storage.dir}`);
    }

    const loaded = loadState<PersistedState>(STORE_FILE);
    this.state = loaded && loaded.version === 1 ? loaded : emptyState();

    // Strip any legacy DEMO books from persisted state and ensure REAL ledger reconciliation
    let cleaned = false;
    for (const [uid, accs] of Object.entries(this.state.accounts)) {
      const anyAccs = accs as Record<string, AccountState>;
      if ("DEMO" in anyAccs) {
        delete anyAccs.DEMO;
        cleaned = true;
      }
      if (!anyAccs.REAL) {
        anyAccs.REAL = freshAccount(uid);
        cleaned = true;
      } else {
        if (anyAccs.REAL.ledger.length === 0) {
          const now = new Date().toISOString();
          anyAccs.REAL.ledger.push({
            id: `led_bonus_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId: uid,
            accountType: "REAL",
            type: "WELCOME_BONUS",
            amount: REAL_STARTING_CAPITAL,
            currency: "USDT",
            balanceAfter: REAL_STARTING_CAPITAL,
            description: "Welcome Registration Capital Bonus ($5.00 USDT)",
            status: "CONFIRMED",
            timestamp: now,
            createdAt: now,
          });
          anyAccs.REAL.balance.availableBalance = REAL_STARTING_CAPITAL;
          anyAccs.REAL.balance.equity = REAL_STARTING_CAPITAL;
          anyAccs.REAL.balance.freeMargin = REAL_STARTING_CAPITAL;
          cleaned = true;
        }

        // Ensure availableBalance matches ledger sum
        const ledgerSum =
          Math.round(anyAccs.REAL.ledger.reduce((s, e) => s + e.amount, 0) * 100) / 100;
        if (anyAccs.REAL.balance.availableBalance !== ledgerSum) {
          anyAccs.REAL.balance.availableBalance = ledgerSum;
          cleaned = true;
        }
      }
    }
    if (cleaned) {
      flushState(STORE_FILE, this.state);
    }
  }

  /** Debounced write. Safe for high-frequency updates such as price marks. */
  private persist(): void {
    saveState(STORE_FILE, this.state);
  }

  /** Immediate write. Used after changes that must not be lost. */
  private persistNow(): void {
    flushState(STORE_FILE, this.state);
  }

  private accountsFor(userId: string): { REAL: AccountState } {
    const existing = this.state.accounts[userId];
    if (existing && existing.REAL) {
      const hasWelcome = existing.REAL.ledger.some(
        (e) => e.type === "WELCOME_BONUS" || e.description.includes("Welcome Registration Capital")
      );
      if (!hasWelcome) {
        const now = new Date().toISOString();
        existing.REAL.ledger.unshift({
          id: `led_bonus_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId,
          accountType: "REAL",
          type: "WELCOME_BONUS",
          amount: REAL_STARTING_CAPITAL,
          currency: "USDT",
          balanceAfter: REAL_STARTING_CAPITAL,
          description: "Welcome Registration Capital Bonus ($5.00 USDT)",
          status: "CONFIRMED",
          timestamp: now,
          createdAt: now,
        });
        const ledgerSum = Math.round(existing.REAL.ledger.reduce((s, e) => s + e.amount, 0) * 100) / 100;
        existing.REAL.balance.availableBalance = ledgerSum;
        existing.REAL.balance.equity = ledgerSum;
        existing.REAL.balance.freeMargin = ledgerSum;
        this.persistNow();
      }
      return existing;
    }

    const created = {
      REAL: existing?.REAL ?? freshAccount(userId),
    };
    this.state.accounts[userId] = created;
    this.persistNow();
    return created;
  }

  private account(userId: string, _accountType: AccountType = "REAL"): AccountState {
    return this.accountsFor(userId).REAL;
  }

  /**
   * Ensures a platform profile and REAL book exist for an identity.
   */
  ensureUser(input: { id: string; email: string; name?: string; role?: User["role"] }): User {
    const existing = this.state.users[input.id];

    if (!existing) {
      this.state.users[input.id] = {
        id: input.id,
        email: input.email,
        name: (input.name || input.email.split("@")[0]).slice(0, 80),
        role: input.role || "user",
        referralCode: referralCodeFor(input.id, input.email),
        riskTolerancePercent: 2.0,
        hasCompletedRiskQuiz: true,
        kycStatus: "UNVERIFIED",
        createdAt: new Date().toISOString(),
      };
      const acc = this.accountsFor(input.id);
      this.persistNow();
      const userObj = this.getUser(input.id);
      SupabaseSync.syncUser(userObj, acc.REAL.balance);
      return userObj;
    } else if (input.role && existing.role !== input.role) {
      existing.role = input.role;
      this.persistNow();
    }

    return this.getUser(input.id);
  }

  // User
  getUser(userId: string): User {
    const record = this.state.users[userId];

    if (!record) {
      throw new Error(
        `No platform profile exists for user id ${userId}. Call ensureUser first.`
      );
    }

    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      referralCode: record.referralCode,
      btcAddress: DEPOSIT_ADDRESSES.btc,
      ethAddress: DEPOSIT_ADDRESSES.eth,
      usdtAddress: DEPOSIT_ADDRESSES.usdt,
      riskTolerancePercent: record.riskTolerancePercent,
      hasCompletedRiskQuiz: record.hasCompletedRiskQuiz,
      kycStatus: record.kycStatus,
      createdAt: record.createdAt,
    };
  }

  /**
   * Marks the caller's profile as risk-certified.
   */
  completeRiskQuiz(userId: string): User {
    const record = this.state.users[userId];
    if (record) {
      record.hasCompletedRiskQuiz = true;
      this.persistNow();
    }
    return this.getUser(userId);
  }

  // Balance & Margin Calculations (Strictly REAL Account)
  getBalance(userId: string, _accountType: AccountType = "REAL"): Balance {
    const account = this.account(userId, "REAL");
    this.recalculateEquity(account);
    return { ...account.balance };
  }

  private recalculateEquity(account: AccountState): void {
    const targetBalance = account.balance;

    const openTrades = account.trades.filter((t) => t.status === "OPEN");
    const totalUnrealizedPnl = openTrades.reduce((acc, t) => acc + t.pnl, 0);
    const totalMarginUsed = openTrades.reduce((acc, t) => acc + t.margin, 0);

    targetBalance.marginUsed = Math.round(totalMarginUsed * 100) / 100;
    targetBalance.equity =
      Math.round((targetBalance.availableBalance + totalUnrealizedPnl) * 100) / 100;
    targetBalance.freeMargin =
      Math.round((targetBalance.equity - targetBalance.marginUsed) * 100) / 100;
    targetBalance.marginLevelPct =
      targetBalance.marginUsed > 0
        ? Math.round((targetBalance.equity / targetBalance.marginUsed) * 100 * 100) / 100
        : 9999;
    targetBalance.updatedAt = new Date().toISOString();
  }

  // Trades
  getTrades(userId: string, _accountType: AccountType = "REAL"): Trade[] {
    return [...this.account(userId, "REAL").trades];
  }

  addTrade(
    userId: string,
    trade: Omit<Trade, "id" | "userId" | "openedAt" | "pnl" | "pips" | "status">,
    _accountType: AccountType = "REAL"
  ): Trade {
    const account = this.account(userId, "REAL");

    const newTrade: Trade = {
      ...trade,
      id: `trd_real_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      accountType: "REAL",
      status: "OPEN",
      pnl: 0,
      pips: 0,
      openedAt: new Date().toISOString(),
    };

    account.trades.unshift(newTrade);

    this.state.totalPlatformVolume += newTrade.size * newTrade.entryPrice;
    this.state.totalPlatformRevenue += newTrade.size * newTrade.entryPrice * 0.0004;
    this.recalculateEquity(account);
    this.persistNow();
    SupabaseSync.syncTrade(newTrade);
    return newTrade;
  }

  updatePositionPrice(
    userId: string,
    id: string,
    currentPrice: number,
    pnl: number,
    pips: number,
    _accountType: AccountType = "REAL"
  ) {
    const account = this.account(userId, "REAL");
    const trade = account.trades.find((t) => t.id === id);
    if (trade && trade.status === "OPEN") {
      trade.currentPrice = currentPrice;
      trade.pnl = pnl;
      trade.pips = pips;
      this.recalculateEquity(account);
      this.persist();
    }
  }

  closeTrade(
    userId: string,
    id: string,
    exitPrice: number,
    _accountType: AccountType = "REAL"
  ): Trade | null {
    const account = this.account(userId, "REAL");

    const trade = account.trades.find((t) => t.id === id);
    if (!trade || trade.status !== "OPEN") return null;

    trade.status = "CLOSED";
    trade.exitPrice = exitPrice;
    trade.closedAt = new Date().toISOString();

    // Calculate final realized PnL based on exitPrice
    const diff =
      trade.direction === "LONG" ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
    let realizedPnl = 0;
    if (trade.assetClass === "FOREX") {
      const pipSize = trade.symbol.includes("JPY") ? 0.01 : 0.0001;
      const pips = diff / pipSize;
      const pipVal = trade.symbol.includes("JPY") ? 1000 / exitPrice : 10.0;
      realizedPnl = Math.round(pips * pipVal * trade.size * 100) / 100;
      trade.pips = Math.round(pips * 10) / 10;
    } else {
      realizedPnl = Math.round(diff * trade.size * 100) / 100;
    }
    trade.pnl = realizedPnl;

    // Create double-entry ledger transaction (updates availableBalance atomically via ledger sum)
    const ledgerType = trade.pnl >= 0 ? "TRADE_PROFIT" : "TRADE_LOSS";
    this.addLedgerEntry(
      userId,
      {
        type: ledgerType,
        amount: trade.pnl,
        currency: "USDT",
        description: `[REAL] Closed ${trade.direction} ${trade.symbol} at ${exitPrice} (PnL: $${trade.pnl.toFixed(2)})`,
      },
      "REAL"
    );

    this.recalculateEquity(account);
    this.persistNow();
    SupabaseSync.syncTrade(trade);
    return trade;
  }

  // Ledger & Deposits
  getLedger(userId: string, _accountType: AccountType = "REAL"): LedgerEntry[] {
    return [...this.account(userId, "REAL").ledger];
  }

  calculateLedgerSum(userId: string, _accountType: AccountType = "REAL"): number {
    const ledger = this.account(userId, "REAL").ledger;
    const sum = ledger.reduce((acc, entry) => acc + entry.amount, 0);
    return Math.round(sum * 100) / 100;
  }

  addLedgerEntry(
    userId: string,
    entry: Omit<LedgerEntry, "id" | "userId" | "accountType" | "createdAt" | "balanceAfter">,
    _accountType: AccountType = "REAL"
  ): LedgerEntry {
    const account = this.account(userId, "REAL");

    // Enforce correct sign for ledger double-entry reconciliation
    let signedAmount = entry.amount;
    const debitTypes: LedgerEntryType[] = ["WITHDRAWAL", "TRADE_LOSS", "COMMISSION_FEE"];
    const creditTypes: LedgerEntryType[] = [
      "DEPOSIT",
      "TRADE_PROFIT",
      "REFERRAL_BONUS",
      "AUTO_TRADE_EARNING",
      "WEDNESDAY_BONUS",
    ];

    if (debitTypes.includes(entry.type)) {
      signedAmount = -Math.abs(entry.amount);
    } else if (creditTypes.includes(entry.type)) {
      signedAmount = Math.abs(entry.amount);
    }

    signedAmount = Math.round(signedAmount * 100) / 100;

    // Compute balance after this entry
    const previousSum = account.ledger.reduce((acc, e) => acc + e.amount, 0);
    const balanceAfter = Math.round((previousSum + signedAmount) * 100) / 100;

    const newEntry: LedgerEntry = {
      ...entry,
      amount: signedAmount,
      id: `led_real_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      accountType: "REAL",
      balanceAfter,
      createdAt: new Date().toISOString(),
    };

    account.ledger.unshift(newEntry);

    // Balance is always equal to SUM(ledger_entries.amount)
    account.balance.availableBalance = balanceAfter;
    if (signedAmount > 0 && entry.type === "DEPOSIT") {
      account.balance.totalDeposited =
        Math.round((account.balance.totalDeposited + signedAmount) * 100) / 100;
    }

    this.recalculateEquity(account);
    this.persistNow();
    SupabaseSync.syncLedgerEntry(newEntry);
    return newEntry;
  }

  depositFunds(
    userId: string,
    amount: number,
    method: string,
    txHash?: string,
    _accountType: AccountType = "REAL"
  ): Balance {
    if (txHash) {
      const clean = txHash.trim().toLowerCase();
      const existing = this.account(userId, "REAL").ledger.find(
        (e) => e.txHash?.trim().toLowerCase() === clean
      );
      if (existing) {
        return this.getBalance(userId, "REAL");
      }
    }

    const positiveAmount = Math.abs(amount);
    this.addLedgerEntry(
      userId,
      {
        type: "DEPOSIT",
        amount: positiveAmount,
        currency: "USDT",
        txHash: txHash || `TRON_${Date.now().toString(16).toUpperCase()}`,
        description: `Deposit via ${method} confirmed`,
      },
      "REAL"
    );

    // Unlock pending referral rewards for the referrer if this user's cumulative deposits reach Level 3 threshold ($300.00)
    const depositor = this.state.users[userId];
    if (depositor && depositor.email) {
      const depEmail = depositor.email.toLowerCase();
      const updatedAccount = this.account(userId, "REAL");
      const cumulativeDeposits = updatedAccount.ledger
        .filter((e) => e.type === "DEPOSIT" && e.amount > 0)
        .reduce((sum, e) => sum + e.amount, 0);

      if (cumulativeDeposits >= 300) {
        for (const [refId, records] of Object.entries(this.state.referrals)) {
          for (const r of records) {
            if (r.referredEmail.toLowerCase() === depEmail && r.status === "PENDING") {
              r.status = "QUALIFIED";
              this.addLedgerEntry(
                refId,
                {
                  type: "REFERRAL_BONUS",
                  amount: r.rewardUsd,
                  currency: "USDT",
                  description: `Qualified referral reward for ${depEmail} ($${r.rewardUsd.toFixed(2)} USDT)`,
                },
                "REAL"
              );
              SupabaseSync.syncReferral(r);
            }
          }
        }
      }
    }

    return this.getBalance(userId, "REAL");
  }

  /**
   * Atomically locks and reserves balance (e.g. for pending withdrawals).
   */
  reserveBalance(
    userId: string,
    amount: number,
    _accountType: AccountType = "REAL"
  ): { ok: boolean; balance?: Balance; error?: string } {
    const account = this.account(userId, "REAL");
    const targetBalance = account.balance;

    if (targetBalance.availableBalance < amount) {
      return {
        ok: false,
        error: `Insufficient available funds. Required: ${amount} USDT, Available: ${targetBalance.availableBalance} USDT`,
      };
    }

    targetBalance.availableBalance =
      Math.round((targetBalance.availableBalance - amount) * 100) / 100;

    this.recalculateEquity(account);
    this.persistNow();
    return { ok: true, balance: { ...targetBalance } };
  }

  /**
   * Atomically refunds reserved balance upon rejection or cancellation.
   */
  refundBalance(
    userId: string,
    amount: number,
    _accountType: AccountType = "REAL"
  ): Balance {
    const account = this.account(userId, "REAL");
    const targetBalance = account.balance;

    targetBalance.availableBalance =
      Math.round((targetBalance.availableBalance + amount) * 100) / 100;

    this.recalculateEquity(account);
    this.persistNow();
    return { ...targetBalance };
  }

  // Referrals
  getReferralCode(userId: string): string {
    return this.getUser(userId).referralCode;
  }

  getReferrals(userId: string): ReferralRecord[] {
    return [...(this.state.referrals[userId] ?? [])];
  }

  getReferralRewardUsd(): number {
    return REFERRAL_REWARD_USD;
  }

  /**
   * Registers a referral and pays the $30.00 USDT reward to the REAL account.
   */
  registerReferral(
    userId: string,
    input: { code: string; email: string; name?: string }
  ): { ok: true; record: ReferralRecord; balance: Balance } | { ok: false; error: string } {
    const code = (input.code || "").trim().toUpperCase();
    const email = (input.email || "").trim().toLowerCase();

    if (!code) return { ok: false, error: "A referral code is required." };
    if (!email || !email.includes("@")) {
      return { ok: false, error: "A valid email address is required." };
    }

    const referrer = this.state.users[userId];
    if (!referrer) {
      return { ok: false, error: "Your account could not be found." };
    }

    if (code !== referrer.referralCode) {
      return { ok: false, error: "That referral code is not recognised." };
    }
    if (email === referrer.email.toLowerCase()) {
      return { ok: false, error: "You cannot refer your own account." };
    }

    const mine = this.state.referrals[userId] ?? [];
    if (mine.some((r) => r.referredEmail === email)) {
      return {
        ok: false,
        error: `${email} has already been referred. Each referral is paid once.`,
      };
    }

    // Check if the referred user has signed up and reached the deposit tier ($300.00 Level 3 threshold)
    const referredUser = Object.values(this.state.users).find(
      (u) => u.email.toLowerCase() === email
    );

    let refereeCumulativeDeposits = 0;
    if (referredUser && this.state.accounts[referredUser.id]?.REAL) {
      refereeCumulativeDeposits = this.state.accounts[referredUser.id].REAL.ledger
        .filter((e) => e.type === "DEPOSIT" && e.amount > 0)
        .reduce((sum, e) => sum + e.amount, 0);
    }

    const hasReachedDepositTier = refereeCumulativeDeposits >= 300;

    const record: ReferralRecord = {
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      referrerId: userId,
      referrerEmail: referrer.email,
      code,
      referredEmail: email,
      referredName: (input.name || "").trim() || email.split("@")[0],
      status: hasReachedDepositTier ? "QUALIFIED" : "PENDING",
      rewardUsd: DIRECT_REFERRAL_REWARD_USD,
      tier: 1,
      createdAt: new Date().toISOString(),
    };

    this.state.referrals[userId] = [record, ...mine];

    // Authoritative rule: reward is credited to REAL ledger only once the referee deposits according to levels ($300 min)
    if (hasReachedDepositTier) {
      this.addLedgerEntry(
        userId,
        {
          type: "REFERRAL_BONUS",
          amount: record.rewardUsd,
          currency: "USDT",
          description: `Direct referral reward for ${record.referredEmail} ($${record.rewardUsd.toFixed(2)} USDT)`,
        },
        "REAL"
      );
    }

    const account = this.account(userId, "REAL");
    this.recalculateEquity(account);
    this.persistNow();
    SupabaseSync.syncReferral(record);

    return { record, balance: { ...account.balance }, ok: true };
  }

  recordReferral(
    referrerId: string,
    referrerEmail: string,
    code: string,
    referredEmail: string,
    referredName?: string,
    rewardUsd: number = REFERRAL_REWARD_USD,
    status: ReferralRecord["status"] = "QUALIFIED"
  ): ReferralRecord {
    const mine = this.state.referrals[referrerId] ?? [];
    const record: ReferralRecord = {
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      referrerId,
      referrerEmail,
      code,
      referredEmail,
      referredName: referredName || referredEmail.split("@")[0],
      status,
      rewardUsd,
      tier: 1,
      createdAt: new Date().toISOString(),
    };
    this.state.referrals[referrerId] = [record, ...mine];
    this.persistNow();
    SupabaseSync.syncReferral(record);
    return record;
  }

  /** KES value of the referral reward, for display alongside the USD figure. */
  referralRewardKes(): number {
    return Math.round(REFERRAL_REWARD_USD * getFxRates().usdKes * 100) / 100;
  }

  // Predictions
  savePrediction(prediction: PredictionResult) {
    this.state.predictions.unshift(prediction);
    if (this.state.predictions.length > 50) this.state.predictions.pop();
    this.persist();
  }

  getLatestPrediction(symbol?: string): PredictionResult | null {
    if (symbol) {
      return this.state.predictions.find((p) => p.symbol === symbol) || null;
    }
    return this.state.predictions[0] || null;
  }

  // Administration
  getAdminStats() {
    let openRealPositions = 0;
    let activeUsers24h = 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    for (const accounts of Object.values(this.state.accounts)) {
      let userActive = false;
      for (const trade of accounts.REAL.trades) {
        if (trade.status === "OPEN") {
          openRealPositions++;
          userActive = true;
        } else if (new Date(trade.closedAt || trade.openedAt).getTime() > cutoff) {
          userActive = true;
        }
      }
      if (userActive) activeUsers24h++;
    }

    const allTrades = Object.values(this.state.accounts).flatMap((accounts) => accounts.REAL.trades);

    const wins = allTrades.filter((t) => t.status === "CLOSED" && t.pnl > 0).length;
    const losses = allTrades.filter((t) => t.status === "CLOSED" && t.pnl < 0).length;
    const decided = wins + losses;

    return {
      totalUsers: Object.keys(this.state.users).length,
      activeUsers24h,
      totalVolume: Math.round(this.state.totalPlatformVolume * 100) / 100,
      totalRevenue: Math.round(this.state.totalPlatformRevenue * 100) / 100,
      openRealPositions,
      averageWinRate:
        decided >= 30 ? `${Math.round((wins / decided) * 1000) / 10}%` : "Insufficient trades (<30)",
      openPositions: openRealPositions,
      totalTrades: allTrades.length,
    };
  }

  /** Gets cached validated candles for a symbol and timeframe from durable store. */
  getCandles(
    symbol: string,
    timeframe: string
  ): { candles: Candle[]; updatedAt: number; source: string } | null {
    if (!this.state.marketCandles) this.state.marketCandles = {};
    const key = `${symbol.toUpperCase()}:${timeframe}`;
    const record = this.state.marketCandles[key];
    if (!record || !record.candles || record.candles.length === 0) return null;
    return record;
  }

  /** Saves validated candles to durable store. */
  saveCandles(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    source: string
  ): void {
    if (!this.state.marketCandles) this.state.marketCandles = {};
    const key = `${symbol.toUpperCase()}:${timeframe}`;
    this.state.marketCandles[key] = {
      symbol: symbol.toUpperCase(),
      timeframe,
      candles,
      updatedAt: Date.now(),
      source,
    };
    saveState(STORE_FILE, this.state);
  }

  /** Gets latest ticker from store. */
  getLatestTicker(symbol: string): Ticker | null {
    if (!this.state.tickers) this.state.tickers = {};
    return this.state.tickers[symbol.toUpperCase()] || null;
  }

  /** Saves latest ticker to store. */
  saveTicker(ticker: Ticker): void {
    if (!this.state.tickers) this.state.tickers = {};
    this.state.tickers[ticker.symbol.toUpperCase()] = ticker;
    saveState(STORE_FILE, this.state);
  }

  /** All REAL trades across all accounts, newest first. Admin surfaces only. */
  getAllTrades(): Trade[] {
    return Object.values(this.state.accounts)
      .flatMap((accounts) => accounts.REAL.trades)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }

  getAllUsers(): User[] {
    return Object.keys(this.state.users)
      .map((id) => this.getUser(id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

// Global Singleton Store (Shared across all Next.js App Router chunks)
const globalStore = globalThis as unknown as { __tradingStore?: DatabaseStore };
if (!globalStore.__tradingStore) {
  globalStore.__tradingStore = new DatabaseStore();
}
export const db = globalStore.__tradingStore;
