import assert from 'assert';
import crypto from 'crypto';
import { db, initDatabase } from '../database';
import { AuthService } from '../auth/AuthService';
import { PaymentVerificationEngine } from '../payments/PaymentVerificationEngine';
import { UserLevelsEngine } from '../levels/UserLevelsEngine';
import { ReferralRewardsEngine } from '../rewards/ReferralRewardsEngine';
import { AutoTradeEngine } from '../rewards/AutoTradeEngine';
import { WednesdayBonusEngine } from '../promotions/WednesdayBonusEngine';
import { WalletService } from '../wallet/WalletService';
import { LedgerService } from '../ledger/LedgerService';
import { PaylorService } from '../payments/PaylorService';
import { config } from '../config';

async function runAuditVerification() {
  console.log('================================================================================');
  console.log('🛡️ CRYPTOHUB AI END-TO-END REAL-MONEY ENGINE AUDIT VERIFICATION SUITE');
  console.log('================================================================================\n');

  await initDatabase();

  // ---------------------------------------------------------------------------
  // PHASE 0 — PRECONDITIONS VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 0: PRECONDITIONS ---');
  console.log('P0.1 Provider: Paylor Crypto TRC20 Address Binding & Webhook HMAC Verification');
  console.log('  Doc URL: https://api.paylorke.com/api/v1 / https://docs.paylorke.com');
  console.log('  Event Schema: { event_id, reference, status, amount, currency, txHash, network, tokenContract, destinationAddress, confirmations }');

  // Test P0.3 Network and Asset Allowlist
  console.log('P0.3 Testing Network and Asset Allowlist...');
  let wrongNetCaught = false;
  try {
    await PaymentVerificationEngine.processDepositNotification({
      txHash: `0xERR_NET_${Date.now()}`,
      network: 'ERC20',
      tokenContract: config.usdtTrc20ContractAddress,
      destinationAddress: 'T123456789012345678901234567890123',
      amountUsdt: 100,
      confirmations: 12
    });
  } catch (err: any) {
    wrongNetCaught = err.message.includes('Unsupported network');
    console.log(`  [REJECTED RESPONSE] Non-TRC20 Network: "${err.message}"`);
  }
  assert.ok(wrongNetCaught, 'Non-TRC20 network must be rejected');

  let wrongTokenCaught = false;
  try {
    await PaymentVerificationEngine.processDepositNotification({
      txHash: `0xERR_TOKEN_${Date.now()}`,
      network: 'TRC20',
      tokenContract: 'TR_INVALID_TOKEN_CONTRACT',
      destinationAddress: 'T123456789012345678901234567890123',
      amountUsdt: 100,
      confirmations: 12
    });
  } catch (err: any) {
    wrongTokenCaught = err.message.includes('Invalid token contract');
    console.log(`  [REJECTED RESPONSE] Invalid Token Contract: "${err.message}"`);
  }
  assert.ok(wrongTokenCaught, 'Non-USDT token contract must be rejected');
  console.log('✔ Phase 0 Preconditions Verified!\n');

  // ---------------------------------------------------------------------------
  // PHASE 1 — LEDGER INTEGRITY BASELINE
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 1: LEDGER INTEGRITY BASELINE ---');
  // Check SUM(debits) = SUM(credits) across all ledger entries
  const debitsRes = await db.get("SELECT SUM(amount_micro) as total FROM ledger_entries WHERE entry_type = 'DEBIT'") as any;
  const creditsRes = await db.get("SELECT SUM(amount_micro) as total FROM ledger_entries WHERE entry_type = 'CREDIT'") as any;
  const totalDebits = Number(debitsRes?.total || 0);
  const totalCredits = Number(creditsRes?.total || 0);
  const diff = totalDebits - totalCredits;
  console.log(`  Total Debits: ${totalDebits} micro-USDT | Total Credits: ${totalCredits} micro-USDT | Difference: ${diff}`);
  assert.strictEqual(diff, 0, 'SUM(debits) must equal SUM(credits) exactly across settled ledger entries');

  // Check ledger entries with null/empty references in ledger_transactions
  const nullRefRes = await db.get("SELECT COUNT(*) as count FROM ledger_transactions WHERE reference IS NULL OR reference = ''") as any;
  const nullRefCount = Number(nullRefRes?.count || 0);
  console.log(`  Transactions with NULL or empty reference: ${nullRefCount}`);
  assert.strictEqual(nullRefCount, 0, 'No ledger transactions can have NULL or empty reference');

  // Reconciliation query: balance_shown_by_api vs SUM(ledger_entries)
  const usersWithWallets = await db.all("SELECT u.id, u.email, w.id as wallet_id, w.total_balance_micro FROM users u JOIN wallets w ON u.id = w.user_id") as any[];
  let mismatchCount = 0;
  for (const u of usersWithWallets) {
    const ledgerSumRes = await db.get(`
      SELECT SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_micro ELSE -amount_micro END) as sum
      FROM ledger_entries
      WHERE wallet_id = ?
    `, [u.wallet_id]) as any;
    const ledgerSum = Number(ledgerSumRes?.sum || 0);
    const walletBalance = Number(u.total_balance_micro);
    if (ledgerSum !== walletBalance) {
      mismatchCount++;
      console.error(`  MISMATCH detected for user ${u.email}: Wallet Balance = ${walletBalance}, Ledger SUM = ${ledgerSum}`);
    }
  }
  console.log(`  Row count of wallet vs ledger mismatches: ${mismatchCount}`);
  assert.strictEqual(mismatchCount, 0, 'Wallet balance vs SUM(ledger_entries) mismatch count must be 0');
  console.log('✔ Phase 1 Ledger Integrity Baseline Verified!\n');

  // ---------------------------------------------------------------------------
  // PHASE 2 — DEPOSIT DETECTION AND LEVEL ASSIGNMENT
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 2: DEPOSIT DETECTION & LEVEL ASSIGNMENT ---');
  const userP2Email = `p2_user_${Date.now()}@cryptohub.ai`;
  const userP2 = await AuthService.register(userP2Email, 'Password123!', 'Deposit Test User');
  const prP2 = await PaymentVerificationEngine.createPaymentRequest(userP2.userId, 100);

  // 2.1 Deposit below $300 ($200 deposit)
  console.log('2.1 Valid TRC20 deposit below $300 ($200.00)...');
  const txP2_1 = `0xTX_P2_200_${Date.now()}`;
  const depRes1 = await PaymentVerificationEngine.processDepositNotification({
    txHash: txP2_1,
    network: 'TRC20',
    tokenContract: config.usdtTrc20ContractAddress,
    destinationAddress: prP2.destinationAddress,
    amountUsdt: 200,
    confirmations: 12
  });
  let levelInfoP2 = await UserLevelsEngine.getUserLevel(userP2.userId);
  console.log(`  Status: ${depRes1.status} | Level before/after: Level 0 -> Level ${levelInfoP2.level} | Balance: $${(await WalletService.getWalletSummary(userP2.userId)).totalBalance}`);
  assert.strictEqual(levelInfoP2.level, 0, 'Cumulative deposit of $200 must remain Level 0');

  // 2.2 Deposit crossing $300 ($150 additional, cumulative $350)
  console.log('2.2 Deposit crossing $300 threshold ($150 additional, cumulative $350)...');
  const txP2_2 = `0xTX_P2_150_${Date.now()}`;
  await PaymentVerificationEngine.processDepositNotification({
    txHash: txP2_2,
    network: 'TRC20',
    tokenContract: config.usdtTrc20ContractAddress,
    destinationAddress: prP2.destinationAddress,
    amountUsdt: 150,
    confirmations: 12
  });
  levelInfoP2 = await UserLevelsEngine.getUserLevel(userP2.userId);
  console.log(`  Cumulative Volume: $${levelInfoP2.qualifyingVolumeUsdt} | Level: Level ${levelInfoP2.level}`);
  assert.strictEqual(levelInfoP2.level, 1, 'Cumulative deposit of $350 must be Level 1');

  // 2.3 Deposit crossing $500 threshold ($170 additional, cumulative $520)
  console.log('2.3 Deposit crossing $500 threshold ($170 additional, cumulative $520)...');
  const txP2_3 = `0xTX_P2_170_${Date.now()}`;
  await PaymentVerificationEngine.processDepositNotification({
    txHash: txP2_3,
    network: 'TRC20',
    tokenContract: config.usdtTrc20ContractAddress,
    destinationAddress: prP2.destinationAddress,
    amountUsdt: 170,
    confirmations: 12
  });
  levelInfoP2 = await UserLevelsEngine.getUserLevel(userP2.userId);
  console.log(`  Cumulative Volume: $${levelInfoP2.qualifyingVolumeUsdt} | Level: Level ${levelInfoP2.level}`);
  assert.strictEqual(levelInfoP2.level, 2, 'Cumulative deposit of $520 must be Level 2');

  // 2.4 Deposit crossing $600 threshold ($100 additional, cumulative $620)
  console.log('2.4 Deposit crossing $600 threshold ($100 additional, cumulative $620)...');
  const txP2_4 = `0xTX_P2_100_${Date.now()}`;
  await PaymentVerificationEngine.processDepositNotification({
    txHash: txP2_4,
    network: 'TRC20',
    tokenContract: config.usdtTrc20ContractAddress,
    destinationAddress: prP2.destinationAddress,
    amountUsdt: 100,
    confirmations: 12
  });
  levelInfoP2 = await UserLevelsEngine.getUserLevel(userP2.userId);
  console.log(`  Cumulative Volume: $${levelInfoP2.qualifyingVolumeUsdt} | Level: Level ${levelInfoP2.level}`);
  assert.strictEqual(levelInfoP2.level, 3, 'Cumulative deposit of $620 must be Level 3');

  // 2.5 Duplicate Webhook for same txHash
  console.log('2.5 Duplicate webhook for same txHash...');
  const ledgerCountBeforeDup = Number((await db.get("SELECT COUNT(*) as count FROM ledger_entries WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE reference = ?)", [`DEPOSIT_${txP2_4}`]) as any).count);
  const dupRes = await PaymentVerificationEngine.processDepositNotification({
    txHash: txP2_4,
    network: 'TRC20',
    tokenContract: config.usdtTrc20ContractAddress,
    destinationAddress: prP2.destinationAddress,
    amountUsdt: 100,
    confirmations: 12
  });
  const ledgerCountAfterDup = Number((await db.get("SELECT COUNT(*) as count FROM ledger_entries WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE reference = ?)", [`DEPOSIT_${txP2_4}`]) as any).count);
  console.log(`  Duplicate Response: ${JSON.stringify(dupRes)} | Ledger Count Before: ${ledgerCountBeforeDup}, After: ${ledgerCountAfterDup}`);
  assert.strictEqual(dupRes.duplicate, true, 'Duplicate webhook must return duplicate: true');
  assert.strictEqual(ledgerCountBeforeDup, ledgerCountAfterDup, 'Ledger entry count must remain unchanged on duplicate webhook');
  console.log('✔ Phase 2 Deposit Detection & Level Assignment Verified!\n');

  // ---------------------------------------------------------------------------
  // PHASE 3 — AUTO-TRADE DAILY EARNINGS
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 3: AUTO-TRADE DAILY EARNINGS ---');
  // Create test users for Level 1, Level 2, Level 3, and Level 0
  const uL1 = await AuthService.register(`autotrade_l1_${Date.now()}@cryptohub.ai`, 'Pass123!', 'AutoTrade L1');
  const prL1 = await PaymentVerificationEngine.createPaymentRequest(uL1.userId, 350);
  await PaymentVerificationEngine.processDepositNotification({ txHash: `0xAT_L1_${Date.now()}`, network: 'TRC20', tokenContract: config.usdtTrc20ContractAddress, destinationAddress: prL1.destinationAddress, amountUsdt: 350, confirmations: 12 });

  const uL2 = await AuthService.register(`autotrade_l2_${Date.now()}@cryptohub.ai`, 'Pass123!', 'AutoTrade L2');
  const prL2 = await PaymentVerificationEngine.createPaymentRequest(uL2.userId, 520);
  await PaymentVerificationEngine.processDepositNotification({ txHash: `0xAT_L2_${Date.now()}`, network: 'TRC20', tokenContract: config.usdtTrc20ContractAddress, destinationAddress: prL2.destinationAddress, amountUsdt: 520, confirmations: 12 });

  const uL3 = await AuthService.register(`autotrade_l3_${Date.now()}@cryptohub.ai`, 'Pass123!', 'AutoTrade L3');
  const prL3 = await PaymentVerificationEngine.createPaymentRequest(uL3.userId, 650);
  await PaymentVerificationEngine.processDepositNotification({ txHash: `0xAT_L3_${Date.now()}`, network: 'TRC20', tokenContract: config.usdtTrc20ContractAddress, destinationAddress: prL3.destinationAddress, amountUsdt: 650, confirmations: 12 });

  const uL0 = await AuthService.register(`autotrade_l0_${Date.now()}@cryptohub.ai`, 'Pass123!', 'AutoTrade L0');

  const testRunDate = '2026-10-28';

  // Run auto-trade for Level 3
  const resL3 = await AutoTradeEngine.processUserAutoTrade(uL3.userId, testRunDate);
  console.log(`  Level 3 Auto-Trade Earning: $${resL3.amountUsdt} | Range: [$5.00 - $8.00]`);
  assert.ok(resL3.amountUsdt >= 5.0 && resL3.amountUsdt <= 8.0, 'Level 3 earning must be between $5.00 and $8.00');

  // Run auto-trade for Level 2
  const resL2 = await AutoTradeEngine.processUserAutoTrade(uL2.userId, testRunDate);
  console.log(`  Level 2 Auto-Trade Earning: $${resL2.amountUsdt} | Range: [$8.00 - $14.00]`);
  assert.ok(resL2.amountUsdt >= 8.0 && resL2.amountUsdt <= 14.0, 'Level 2 earning must be between $8.00 and $14.00');

  // Run auto-trade for Level 1
  const resL1 = await AutoTradeEngine.processUserAutoTrade(uL1.userId, testRunDate);
  console.log(`  Level 1 Auto-Trade Earning: $${resL1.amountUsdt} | Range: [$10.00 - $18.00]`);
  assert.ok(resL1.amountUsdt >= 10.0 && resL1.amountUsdt <= 18.0, 'Level 1 earning must be between $10.00 and $18.00');

  // Run auto-trade for Level 0 (below Level 1)
  const resL0 = await AutoTradeEngine.processUserAutoTrade(uL0.userId, testRunDate);
  console.log(`  Level 0 Auto-Trade Earning: $${resL0.amountUsdt} | Status: ${resL0.status}`);
  assert.strictEqual(resL0.amountUsdt, 0.0, 'Level 0 user must receive $0.00 auto-trade earnings');

  // Duplicate job run (invoke again on same date)
  const dupL3 = await AutoTradeEngine.processUserAutoTrade(uL3.userId, testRunDate);
  console.log(`  Duplicate Job Run Response: ${JSON.stringify(dupL3)}`);
  assert.strictEqual(dupL3.alreadyProcessed, true, 'Duplicate auto-trade run on same date must return alreadyProcessed: true');

  const runsCount = Number((await db.get('SELECT COUNT(*) as count FROM auto_trade_runs WHERE run_date = ? AND user_id = ?', [testRunDate, uL3.userId]) as any).count);
  assert.strictEqual(runsCount, 1, 'auto_trade_runs row count for user on runDate must be exactly 1');
  console.log('✔ Phase 3 Auto-Trade Daily Earnings Verified!\n');

  // ---------------------------------------------------------------------------
  // PHASE 4 — REFERRALS, PROMOTION, AND $30 REWARD
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 4: REFERRALS, PROMOTION, AND $30 REWARD ---');
  const referrerUser = await AuthService.register(`referrer_${Date.now()}@cryptohub.ai`, 'Pass123!', 'Referrer Main');

  // 4.1 Referral link -> registration -> confirmed deposit -> $30 reward
  const referee1 = await AuthService.register(`referee1_${Date.now()}@cryptohub.ai`, 'Pass123!', 'Referee 1', referrerUser.referralCode);
  const walletBeforeRef = await WalletService.getWalletSummary(referrerUser.userId);
  const prRef1 = await PaymentVerificationEngine.createPaymentRequest(referee1.userId, 300);
  await PaymentVerificationEngine.processDepositNotification({
    txHash: `0xREF1_DEP_${Date.now()}`,
    network: 'TRC20',
    tokenContract: config.usdtTrc20ContractAddress,
    destinationAddress: prRef1.destinationAddress,
    amountUsdt: 300,
    confirmations: 12
  });

  const walletAfterRef = await WalletService.getWalletSummary(referrerUser.userId);
  const rewardEarned = walletAfterRef.totalBalance - walletBeforeRef.totalBalance;
  console.log(`  Referral Reward Credited: $${rewardEarned} USDT to Referrer`);
  assert.strictEqual(rewardEarned, 30.0, 'Referral reward must be exactly $30.00 USDT');

  // 4.2 Self-referral attempt
  console.log('4.2 Self-referral attempt...');
  let selfRefBlocked = false;
  try {
    await ReferralRewardsEngine.registerReferral(referrerUser.userId, referrerUser.referralCode);
  } catch (err: any) {
    selfRefBlocked = err.message.includes('Self-referral');
    console.log(`  [BLOCKED RESPONSE] Self-Referral: "${err.message}"`);
  }
  assert.ok(selfRefBlocked, 'Self-referral must be strictly blocked');

  // 4.3 Circular referral attempt (referee1 tries to refer referrerUser)
  console.log('4.3 Circular referral attempt...');
  let circularBlocked = false;
  try {
    await ReferralRewardsEngine.registerReferral(referrerUser.userId, referee1.referralCode);
  } catch (err: any) {
    circularBlocked = err.message.includes('Circular referral');
    console.log(`  [BLOCKED RESPONSE] Circular Referral: "${err.message}"`);
  }
  assert.ok(circularBlocked, 'Circular referral must be strictly blocked');

  // 4.4 Referral Promotion Rule (>10 referrals promotes Level 3 -> Level 2; >20 referrals promotes -> Level 1)
  console.log('4.4 Referral Promotion Rule verification...');
  // Set up a Level 3 user ($600 deposits)
  const promoUser = await AuthService.register(`promouser_${Date.now()}@cryptohub.ai`, 'Pass123!', 'Promotion Test User');
  const prPromo = await PaymentVerificationEngine.createPaymentRequest(promoUser.userId, 600);
  await PaymentVerificationEngine.processDepositNotification({ txHash: `0xPROMO_DEP_${Date.now()}`, network: 'TRC20', tokenContract: config.usdtTrc20ContractAddress, destinationAddress: prPromo.destinationAddress, amountUsdt: 600, confirmations: 12 });

  let promoLevelInfo = await UserLevelsEngine.getUserLevel(promoUser.userId);
  console.log(`  Initial Level (0 referrals): Level ${promoLevelInfo.level}`);
  assert.strictEqual(promoLevelInfo.level, 3, 'Base deposit $600 with 0 referrals must be Level 3');

  // Fast creation for 21 referees in loop 4.4
  const preHashedPassword = '$2a$10$wT2eXg2eW6iA1q/92q1Z0eO1mG3r4t5y6u7i8o9p0';
  for (let i = 1; i <= 11; i++) {
    const refereeId = `subref_${i}_${Date.now()}`;
    const userReferralCode = `SR${i}_${Date.now()}`;
    await db.run("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES (?, ?, ?, 'SubRef', ?, 'USER')", [refereeId, `${refereeId}@cryptohub.ai`, preHashedPassword, userReferralCode]);
    await db.run("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, ?, 'USDT', 0, 0)", [`w_${refereeId}`, refereeId]);
    await db.run("INSERT INTO referral_relationships (id, referrer_id, referee_id, level) VALUES (?, ?, ?, 1)", [`rr_${refereeId}`, promoUser.userId, refereeId]);
    await db.run("INSERT INTO deposit_verifications (id, user_id, payment_request_id, network, token_contract, destination_address, amount_usdt, tx_hash, confirmations, status) VALUES (?, ?, ?, 'TRC20', ?, 'T_DEST', 300, ?, 12, 'CREDITED')", [`dv_${refereeId}`, refereeId, `pr_${refereeId}`, config.usdtTrc20ContractAddress, `tx_${refereeId}`]);
  }

  promoLevelInfo = await UserLevelsEngine.evaluateUserLevel(promoUser.userId);
  console.log(`  Level after 11 successful referrals: Level ${promoLevelInfo.level} (Successful Referrals: ${promoLevelInfo.successfulReferralsCount})`);
  assert.strictEqual(promoLevelInfo.level, 2, 'Level 3 user with 11 successful referrals must promote to Level 2');

  for (let i = 12; i <= 21; i++) {
    const refereeId = `subref_${i}_${Date.now()}`;
    const userReferralCode = `SR${i}_${Date.now()}`;
    await db.run("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES (?, ?, ?, 'SubRef', ?, 'USER')", [refereeId, `${refereeId}@cryptohub.ai`, preHashedPassword, userReferralCode]);
    await db.run("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, ?, 'USDT', 0, 0)", [`w_${refereeId}`, refereeId]);
    await db.run("INSERT INTO referral_relationships (id, referrer_id, referee_id, level) VALUES (?, ?, ?, 1)", [`rr_${refereeId}`, promoUser.userId, refereeId]);
    await db.run("INSERT INTO deposit_verifications (id, user_id, payment_request_id, network, token_contract, destination_address, amount_usdt, tx_hash, confirmations, status) VALUES (?, ?, ?, 'TRC20', ?, 'T_DEST', 300, ?, 12, 'CREDITED')", [`dv_${refereeId}`, refereeId, `pr_${refereeId}`, config.usdtTrc20ContractAddress, `tx_${refereeId}`]);
  }

  promoLevelInfo = await UserLevelsEngine.evaluateUserLevel(promoUser.userId);
  console.log(`  Level after 21 successful referrals: Level ${promoLevelInfo.level} (Successful Referrals: ${promoLevelInfo.successfulReferralsCount})`);
  assert.strictEqual(promoLevelInfo.level, 1, 'Level 3/2 user with 21 successful referrals must promote to Level 1');
  console.log('✔ Phase 4 Referrals, Promotion & $30 Reward Verified!\n');

  // ---------------------------------------------------------------------------
  // PHASE 5 — WEDNESDAY $1 BONUS
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 5: WEDNESDAY $1 BONUS ---');
  const uWed = await AuthService.register(`wed_user_${Date.now()}@cryptohub.ai`, 'Pass123!', 'Wednesday Test User');

  // Force Wednesday claim in test mode
  const wedBonusRes1 = await WednesdayBonusEngine.processWednesdayBonus(uWed.userId, '2026-W43', false);
  console.log(`  Wednesday Bonus Response: ${JSON.stringify(wedBonusRes1)}`);
  assert.strictEqual(wedBonusRes1.amountUsdt, 1.0, 'Wednesday bonus must be exactly $1.00 USDT');
  assert.strictEqual(wedBonusRes1.status, 'CREDITED', 'Status must be CREDITED');

  // Duplicate claim in same week
  const wedBonusRes2 = await WednesdayBonusEngine.processWednesdayBonus(uWed.userId, '2026-W43', false);
  console.log(`  Duplicate Claim Response: ${JSON.stringify(wedBonusRes2)}`);
  assert.strictEqual(wedBonusRes2.alreadyClaimed, true, 'Duplicate Wednesday claim must return alreadyClaimed: true');

  const wedLedgerCount = Number((await db.get("SELECT COUNT(*) as count FROM ledger_entries WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE reference = ?)", [`WED_BONUS_2026-W43_${uWed.userId}`]) as any).count);
  assert.strictEqual(wedLedgerCount, 2, 'Ledger entries for Wednesday bonus must remain exactly 2 (1 DEBIT + 1 CREDIT)');

  // Attempt non-Wednesday claim without weekCode / with forceDayCheck = true
  let nonWedBlocked = false;
  try {
    const isWedNow = new Date().getUTCDay() === 3;
    if (!isWedNow) {
      await WednesdayBonusEngine.processWednesdayBonus(uWed.userId, undefined, true);
    } else {
      nonWedBlocked = true; // Skipped if today is actually Wednesday
    }
  } catch (err: any) {
    nonWedBlocked = err.message.includes('only available on Wednesdays');
    console.log(`  [BLOCKED RESPONSE] Non-Wednesday Claim: "${err.message}"`);
  }
  assert.ok(nonWedBlocked, 'Claiming Wednesday bonus on non-Wednesday must be rejected');
  console.log('✔ Phase 5 Wednesday $1 Bonus Verified!\n');

  // ---------------------------------------------------------------------------
  // PHASE 6 — WITHDRAWALS AT $100 MINIMUM
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 6: WITHDRAWALS AT $100 MINIMUM ---');
  const uWith = await AuthService.register(`withdrawal_user_${Date.now()}@cryptohub.ai`, 'Pass123!', 'Withdrawal Test User');
  const prWith = await PaymentVerificationEngine.createPaymentRequest(uWith.userId, 200);
  await PaymentVerificationEngine.processDepositNotification({
    txHash: `0xWITH_DEP_${Date.now()}`,
    network: 'TRC20',
    tokenContract: config.usdtTrc20ContractAddress,
    destinationAddress: prWith.destinationAddress,
    amountUsdt: 200,
    confirmations: 12
  });

  // 6.1 Attempt $99.99 withdrawal (below $100 minimum)
  console.log('6.1 Attempting $99.99 withdrawal...');
  let underMinCaught = false;
  try {
    await WalletService.requestWithdrawal(uWith.userId, 'T9xWithdrawalDestAddress12345678', 99.99);
  } catch (err: any) {
    underMinCaught = err.message.includes('Minimum withdrawal amount is 100.00 USDT');
    console.log(`  [REJECTED RESPONSE] $99.99 Withdrawal: "${err.message}"`);
  }
  assert.ok(underMinCaught, '$99.99 withdrawal must be rejected');

  // 6.2 Attempt $100 withdrawal with balance below $100
  console.log('6.2 Attempting $100 withdrawal with insufficient balance...');
  const uLowBal = await AuthService.register(`lowbal_user_${Date.now()}@cryptohub.ai`, 'Pass123!', 'Low Balance User');
  let insufficientCaught = false;
  try {
    await WalletService.requestWithdrawal(uLowBal.userId, 'T9xWithdrawalDestAddress12345678', 100.0);
  } catch (err: any) {
    insufficientCaught = err.message.includes('Insufficient available balance');
    console.log(`  [REJECTED RESPONSE] Insufficient Balance Withdrawal: "${err.message}"`);
  }
  assert.ok(insufficientCaught, 'Withdrawal with insufficient balance must be rejected');

  // 6.3 Attempt $100 withdrawal with $200 balance (Valid)
  console.log('6.3 Attempting valid $100 withdrawal from $200 balance...');
  const walletBeforeWith = await WalletService.getWalletSummary(uWith.userId);
  const withReq = await WalletService.requestWithdrawal(uWith.userId, 'T9xWithdrawalDestAddress12345678', 100.0);
  const walletAfterWith = await WalletService.getWalletSummary(uWith.userId);
  console.log(`  Withdrawal Request ID: ${withReq.withdrawalId} | Status: ${withReq.status}`);
  console.log(`  Wallet Balance Before: $${walletBeforeWith.totalBalance} | After: $${walletAfterWith.totalBalance}`);
  assert.strictEqual(withReq.status, 'PENDING_REVIEW', 'Withdrawal request status must be PENDING_REVIEW');
  assert.strictEqual(walletAfterWith.totalBalance, 100.0, 'Wallet balance must immediately reflect $100 debit');

  // Check resulting ledger entry
  const withLedgerEntries = await db.all("SELECT le.* FROM ledger_entries le JOIN ledger_transactions lt ON le.transaction_id = lt.id WHERE lt.reference = ?", [`WITHDRAWAL_REQ_${withReq.withdrawalId}`]) as any[];
  console.log(`  Ledger Entries Created: ${withLedgerEntries.length} (Balanced DEBIT + CREDIT)`);
  assert.strictEqual(withLedgerEntries.length, 2, 'Exactly 2 ledger entries (DEBIT + CREDIT) must be created');
  console.log('✔ Phase 6 Withdrawals at $100 Minimum Verified!\n');

  // ---------------------------------------------------------------------------
  // PHASE 7 — CROSS-USER ISOLATION
  // ---------------------------------------------------------------------------
  console.log('--- PHASE 7: CROSS-USER ISOLATION ---');
  const userA = await AuthService.register(`usera_${Date.now()}@cryptohub.ai`, 'Pass123!', 'User A');
  const userB = await AuthService.register(`userb_${Date.now()}@cryptohub.ai`, 'Pass123!', 'User B');

  // Deposit for User B
  const prB = await PaymentVerificationEngine.createPaymentRequest(userB.userId, 300);
  await PaymentVerificationEngine.processDepositNotification({ txHash: `0xUSERB_DEP_${Date.now()}`, network: 'TRC20', tokenContract: config.usdtTrc20ContractAddress, destinationAddress: prB.destinationAddress, amountUsdt: 300, confirmations: 12 });

  // Query User A's deposits, transactions, auto-trade history, and withdrawals
  const userADeposits = await PaymentVerificationEngine.getUserDeposits(userA.userId);
  const userATransactions = await WalletService.getTransactions(userA.userId);
  const userAAutoTrade = await AutoTradeEngine.getUserAutoTradeHistory(userA.userId);
  const userAWithdrawals = await WalletService.getWithdrawalRequests(userA.userId);

  console.log(`  User A Deposits Count: ${userADeposits.length} (User B has deposits, User A has 0)`);
  console.log(`  User A Transactions Count: ${userATransactions.length}`);
  console.log(`  User A Auto-Trade History Count: ${userAAutoTrade.length}`);
  console.log(`  User A Withdrawals Count: ${userAWithdrawals.length}`);

  assert.strictEqual(userADeposits.length, 0, "User A must not see User B's deposits");
  assert.strictEqual(userATransactions.length, 0, "User A must not see User B's transactions");
  assert.strictEqual(userAAutoTrade.length, 0, "User A must not see User B's auto-trade history");
  assert.strictEqual(userAWithdrawals.length, 0, "User A must not see User B's withdrawals");
  console.log('✔ Phase 7 Cross-User Isolation Verified!\n');

  console.log('================================================================================');
  console.log('🎉 ALL AUDIT PHASES (0 THROUGH 7) FULLY PASSED WITH VERIFIED PROOF!');
  console.log('================================================================================\n');
}

runAuditVerification().catch(err => {
  console.error('❌ Audit verification suite failed:', err);
  process.exit(1);
});
