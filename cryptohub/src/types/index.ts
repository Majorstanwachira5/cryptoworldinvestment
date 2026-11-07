export type AccountType = "REAL";
export type AssetClass = "CRYPTO" | "FOREX";
export type TradeDirection = "LONG" | "SHORT";
export type OrderType = "MARKET" | "LIMIT";
export type PositionStatus = "OPEN" | "CLOSED" | "CANCELLED";

export type Role = "user" | "viewer" | "support" | "admin" | "super_admin";

export type Permission =
  | "trade:real"
  | "ledger:read"
  | "analysis:read"
  | "referral:manage"
  | "admin:stats"
  | "admin:users:read"
  | "admin:users:write"
  | "admin:withdrawal:approve"
  | "admin:reward:trigger"
  | "admin:payments:manage"
  | "admin:prediction-override";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED";
    createdAt: string;
    /** Which identity provider vouched for this session. */
    provider: "LOCAL" | "SUPABASE";
    /** Set once the real-account risk certification has been passed server-side. */
    riskCertifiedAt: string | null;
    accountType?: "real";
  }

export interface AccessTokenResponse {
  token: string;
  expiresAt: number;
  tokenType: "Bearer";
  user: AuthenticatedUser;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  btcAddress: string;
  ethAddress: string;
  usdtAddress: string;
  riskTolerancePercent: number;
  hasCompletedRiskQuiz: boolean;
  kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED";
  /** Code this user shares. Signing up with it credits the referrer. */
  referralCode: string;
  createdAt: string;
}

export type ReferralStatus = "PENDING" | "QUALIFIED";

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerEmail: string;
  /** Stable code that was used, so the audit trail survives an email change. */
  code: string;
  referredEmail: string;
  referredName: string;
  status: ReferralStatus;
  /** Always paid in USD/USDT, and always into the REAL account. */
  rewardUsd: number;
  tier?: 1 | 2; // 1 = Direct ($100), 2 = Second Level ($10)
  createdAt: string;
}

/** Payload returned by GET /api/profile. Always authenticated, never public. */
export interface ProfileResponse extends ProfileSummary {
  authenticated: boolean;
  /** Which authority issued the access token that authorized this request. */
  provider: "local" | "supabase";
  /** Permissions granted to the signed-in user, derived from their role. */
  permissions: Permission[];
}

export interface ReferralStats {
  code: string;
  rewardPerReferralUsd: number;
  rewardPerReferralKes: number;
  totalReferrals: number;
  qualified: number;
  pending: number;
  totalEarnedUsd: number;
  totalEarnedKes: number;
  shareUrl: string;
  records: ReferralRecord[];
}

export interface ProfileSummary {
  user: AuthenticatedUser;
  /** Platform deposit addresses, shown on the profile for funding the real account. */
  depositAddresses: {
    usdt: string;
    btc: string;
    eth: string;
  };
  session: {
    /**
     * Lifetime of the access token currently in use. The raw token is never
     * echoed back: the client already holds it, and reflecting a bearer
     * credential into a response body only widens exposure.
     */
    issuedAt: number;
    expiresAt: number;
  };
  real: Balance;
  fx: {
    usdKes: number;
    displayCurrency: "USD" | "KES";
  };
  performance: {
    REAL: AccountPerformance | null;
  };
  referrals: ReferralStats;
  openPositions: number;
}

export interface Balance {
  userId: string;
  accountType: AccountType;
  currency: string;
  availableBalance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevelPct: number;
  totalDeposited: number;
  updatedAt: string;
}

export interface Trade {
  id: string;
  userId: string;
  accountType: AccountType;
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  orderType: OrderType;
  status: PositionStatus;
  entryPrice: number;
  exitPrice?: number;
  currentPrice: number;
  size: number; // Units for Crypto, Lots for Forex
  leverage: number;
  margin: number;
  stopLoss?: number;
  takeProfit?: number;
  liquidationPrice?: number;
  pnl: number;
  pips: number;
  rationale?: string;
  isBacktest?: boolean;
  openedAt: string;
  closedAt?: string;
}

export type UserLevel = 0 | 1 | 2 | 3; // 0 = Unranked / Below Entry, 3 = Entry ($300), 2 = Mid ($500), 1 = Top ($600)
export type AdminRole = "super_admin" | "admin" | "support" | "viewer";

export type LedgerEntryType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRADE_PROFIT"
  | "TRADE_LOSS"
  | "COMMISSION_FEE"
  | "REFERRAL_BONUS"
  | "AUTO_TRADE_EARNING"
  | "WEDNESDAY_BONUS"
  | "ADJUSTMENT";

export interface LedgerEntry {
  id: string;
  userId: string;
  accountType: AccountType;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  balanceAfter: number;
  txHash?: string;
  description: string;
  createdAt: string;
}

export interface IndicatorMetrics {
  rsi: number;
  rsiSignal: "OVERSOLD" | "OVERBOUGHT" | "NEUTRAL";
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    cross: "BULLISH_CROSS" | "BEARISH_CROSS" | "NEUTRAL";
  };
  ema50: number;
  ema200: number;
  emaTrend: "GOLDEN_ALIGNMENT" | "DEATH_ALIGNMENT" | "NEUTRAL";
}

export type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface IndicatorSignal {
  id: string;
  label: string;
  bias: Bias;
  /** Signed strength in the range -1..1. Negative is bearish. */
  strength: number;
  /** Weight of this signal in the confluence score. */
  weight: number;
  value: string;
  detail: string;
}

export interface VolatilityProfile {
  atr: number;
  atrPercent: number;
  /** ATR expressed as a percentage of price. */
  regime: "COMPRESSED" | "NORMAL" | "ELEVATED" | "EXTREME";
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    /** Where price sits within the bands: 0 = lower, 1 = upper. */
    percentB: number;
  };
  description: string;
}

export interface PriceLevel {
  price: number;
  kind: "SUPPORT" | "RESISTANCE";
  /** How many swing pivots clustered at this level. */
  touches: number;
  strength: "WEAK" | "MODERATE" | "STRONG";
}

export interface TrendProfile {
  adx: number;
  plusDI: number;
  minusDI: number;
  /** ADX above 25 is conventionally a trending market. */
  regime: "TRENDING" | "RANGING" | "EMERGING";
  ema50: number;
  ema200: number;
  emaSpreadPercent: number;
  description: string;
}

export interface TimeframeConfluence {
  timeframe: string;
  bias: Bias;
  score: number;
  candles: number;
}

export interface AnalysisReport {
  symbol: string;
  assetClass: AssetClass;
  timeframe: string;
  accountType: AccountType;
  generatedAt: string;
  price: number;
  digits: number;

  /** Aggregate confluence in the range -100..100. */
  confluenceScore: number;
  bias: Bias;
  /** 0..100. Share of weighted signals agreeing with the resolved bias. */
  agreement: number;
  /** 0..100, honest measure of signal strength. Not a win-rate promise. */
  confidence: number;
  verdict: "STRONG_LONG" | "LEAN_LONG" | "NEUTRAL" | "LEAN_SHORT" | "STRONG_SHORT";

  signals: IndicatorSignal[];
  trend: TrendProfile;
  volatility: VolatilityProfile;
  levels: PriceLevel[];
  multiTimeframe: TimeframeConfluence[];

  /** Derived only when the account has capital and a directional bias exists. */
  setup: TradeSetup | null;

  /** Live tally of this account's own closed trades. Null when none. */
  performance: AccountPerformance | null;

  /** Aggregate of every completed walk-forward backtest run for this symbol. */
  backtest: BacktestSummary | null;

  notes: string[];
}

export interface TradeSetup {
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  riskAmount: number;
  rewardAmount: number;
  size: number;
  sizeUnit: "LOTS" | "UNITS";
  /** Percent of account equity at risk if the stop is hit. */
  riskPercent: number;
  marginRequired: number;
  leverage: number;
  warnings: string[];
}

export interface AccountPerformance {
  accountType: AccountType;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  winRateStatus?: "calculated" | "insufficient_sample";
  sampleSufficient?: boolean;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
}

export interface BacktestTrade {
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  pnlPercent: number;
  barsHeld: number;
  exitReason: "TARGET" | "STOP" | "TIME";
}

export type BacktestStatus = "measured" | "insufficient_data" | "unavailable";

export interface BacktestSummary {
  symbol: string;
  strategy: string;
  timeframes: string[];
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  winRateStatus?: "calculated" | "insufficient_sample" | "unavailable";
  netPnlPercent: number;
  averageWinPercent: number;
  averageLossPercent: number;
  profitFactor: number | null;
  expectancyPercent: number;
  maxDrawdownPercent: number;
  /** Fraction of long trades that won, for directional bias detection. */
  longWinRate: number | null;
  shortWinRate: number | null;
  perTimeframe: Record<string, { trades: number; winRate: number | null; winRateStatus?: string; netPnlPercent: number }>;
  /** True when the replay ran against real prices rather than generated ones. */
  measuredOnRealHistory: boolean;
  /** False when too few trades occurred for the win rate to mean anything (min 30). */
  sampleSufficient: boolean;
  status: BacktestStatus;
  methodology: string;
  disclaimer: string;
  dataSource?: string;
  barsEvaluated?: number;
}

export interface PredictionResult {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  timeframe: string;
  direction: TradeDirection;
  confidence: number; // 0 to 100
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  riskRewardRatio: string;
  winRateEstimate: string;
  indicators: IndicatorMetrics;
  rationale: string;
  isBacktest?: boolean;
  historicalDate?: string;
  backtestOutcome?: "WIN" | "LOSS";
  isAdminOverride?: boolean;
  createdAt: string;
}

export interface Candle {
  time: number; // UNIX timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type FeedSource = "binance" | "twelvedata" | "ecb" | "database" | "unavailable" | "fallback";
export type FreshnessState = "live" | "stale" | "delayed" | "unavailable";

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  source: FeedSource;
  delayed: boolean;
  timestamp: number;
  freshness: FreshnessState;
}

export interface MarketAsset {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currentPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  digits: number;
  spread: number;
  source?: FeedSource;
  freshness?: FreshnessState;
  timestamp?: number;
}
