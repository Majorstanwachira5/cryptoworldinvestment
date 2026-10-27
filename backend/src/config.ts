import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'cryptohub_ai_super_secret_jwt_key_2026',
  jwtExpiresIn: '7d',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:8nA76JiDn@bwqXR@db.lwsybancxxqwrmxneyui.supabase.co:5432/postgres',
  supabaseUrl: process.env.SUPABASE_URL || 'https://lwsybancxxqwrmxneyui.supabase.co',
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_S6vgt2hh2EkC9WeBer8jRw_5gy2Fj_R',
  adminPort: parseInt(process.env.ADMIN_PORT || '3600', 10),

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
