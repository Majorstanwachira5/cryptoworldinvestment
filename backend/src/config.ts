import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'cryptohub_ai_super_secret_jwt_key_2026',
  jwtExpiresIn: '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  adminPort: parseInt(process.env.ADMIN_PORT || '3600', 10),

  // Paylor Payments Integration
  paylorBaseUrl: process.env.PAYLOR_BASE_URL || 'https://api.paylorke.com/api/v1',
  paylorApiKey: process.env.PAYLOR_API_KEY || '',
  paylorWebhookSecret: process.env.PAYLOR_WEBHOOK_SECRET || '',
  paylorChannelId: process.env.PAYLOR_CHANNEL_ID || 'PAYL-EFSJUF',

  // Referral Rewards ($30 per successful referral credited to referrer)
  referralRewardUsdt: 30.0,

  // User Levels Thresholds (Cumulative confirmed USDT deposits)
  // Level 1: $300.00 (Entry level)
  // Level 2: $500.00
  // Level 3: $600.00
  level1ThresholdUsdt: 300.0,
  level2ThresholdUsdt: 500.0,
  level3ThresholdUsdt: 600.0,

  // Auto-Trade Daily Earnings Ranges
  // Level 1: $10.00 - $18.00 per day
  // Level 2: $8.00 - $14.00 per day
  // Level 3: $5.00 - $8.00 per day
  autoTradeLevel1MinUsdt: 10.0,
  autoTradeLevel1MaxUsdt: 18.0,
  autoTradeLevel2MinUsdt: 8.0,
  autoTradeLevel2MaxUsdt: 14.0,
  autoTradeLevel3MinUsdt: 5.0,
  autoTradeLevel3MaxUsdt: 8.0,

  // Wednesday Promotional Campaign Rules ($1 per account per week)
  wednesdayBonusAmountUsdt: 1.0,
  wednesdayCampaignBudgetUsdt: 10000.0,

  // TRC20 Payment Parameters
  usdtTrc20ContractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  requiredDepositConfirmations: 12,

  // Withdrawal Parameters
  minWithdrawalUsdt: 100.0,
  withdrawalFeeUsdt: 1.0
};
