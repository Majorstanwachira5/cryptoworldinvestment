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

  // Referral Rewards
  referralLevel1RewardUsdt: 100, // $100 for Level 1 qualifying referral
  referralLevel2RewardUsdt: 10,  // $10 for Level 2 qualifying referral

  // User Levels Thresholds (USD-equivalent cumulative verified volume)
  level1ThresholdUsdt: 600.0,
  level2ThresholdUsdt: 500.0,
  level3ThresholdUsdt: 300.0,

  // Wednesday Promotional Campaign Rules
  wednesdayBonusAmountUsdt: 1.0,
  wednesdayCampaignBudgetUsdt: 10000.0,

  // TRC20 Payment Parameters
  usdtTrc20ContractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  requiredDepositConfirmations: 12,

  // Withdrawal Parameters
  minWithdrawalUsdt: 10.0,
  withdrawalFeeUsdt: 1.0
};
