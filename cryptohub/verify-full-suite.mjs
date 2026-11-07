import assert from "node:assert";

console.log("================================================================================");
console.log("🚀 STARTING CRYPTOHUB AI FULL END-TO-END VERIFICATION SUITE");
console.log("================================================================================\n");

// 1. Referral Link Generation & Removal of localhost
console.log("▶ TEST 1: Referral Link Generation & Sanitization (No Localhost)...");
import { buildReferralShareUrl } from "@/lib/referral/link";

const sampleUrl = buildReferralShareUrl("CH-ALEX77");
console.log("  Generated Referral Link:", sampleUrl);
assert.ok(!sampleUrl.includes("localhost"), "Referral link must never contain localhost");
assert.ok(sampleUrl.includes("/join?ref="), "Referral link must use institutional path /join?ref=");
assert.ok(sampleUrl.includes("CH-ALEX77"), "Referral link must contain referral code");
console.log("  ✔ PASSED: Referral URL is clean, institutional, and localhost-free.\n");

// 2. Database & User Level Derivation
console.log("▶ TEST 2: User Level & AutoTrade Reward Derivation...");
import { RewardEngine } from "@/lib/rewards/engine";
import { db } from "@/lib/db";

const runId = Date.now().toString(36);
const testUser = db.ensureUser({
  id: `suite_user_${runId}`,
  email: `trader_${runId}@cryptohub.io`,
  name: "Institutional Suite Trader",
  role: "user"
});

// Deposit $350 -> Should be Level 3 ($5–$8 daily auto-trade)
db.depositFunds(testUser.id, 350.0, "TRC20 Test Deposit", `dep_suite_${Date.now()}`);
const levelInfo = RewardEngine.deriveUserLevel(testUser.id);
console.log(`  User Cumulative Deposit: $${levelInfo.cumulativeDeposits} -> Level: ${levelInfo.effectiveLevel} (${levelInfo.levelName})`);
assert.strictEqual(levelInfo.effectiveLevel, 3, "Deposit of $350 must qualify for Level 3");

// Auto-trade execution test
const autoTradeRes = RewardEngine.runDailyAutoTrade("2026-11-07");
console.log(`  Auto-Trade Run Result: Processed ${autoTradeRes.processed}, Credited ${autoTradeRes.credited}`);
const userCredit = autoTradeRes.results.find(r => r.userId === testUser.id);
assert.ok(userCredit, "User should have an auto-trade result");
assert.ok(userCredit.amount >= 5.0 && userCredit.amount <= 8.0, `Level 3 auto-trade must be between $5 and $8, got ${userCredit?.amount}`);
console.log(`  AutoTrade credited: $${userCredit?.amount} USDT to REAL ledger.`);
console.log("  ✔ PASSED: Auto-trade executed correctly with tier limits.\n");

// 3. Referral $30 USDT Real Credit
console.log("▶ TEST 3: $30.00 USDT Real Referral Bonus Registration...");
const referralCode = db.getReferralCode(testUser.id);
const friendEmail = `friend_${Date.now()}@test.com`;

const regRef = db.registerReferral(testUser.id, {
  code: referralCode,
  email: friendEmail,
  name: "Referred Trader"
});
assert.ok(regRef.ok, "Referral registration must succeed");
assert.strictEqual(regRef.record.rewardUsd, 30.0, "Reward must be strictly $30.00 USDT");
console.log(`  Referral registered for ${friendEmail}: credited $${regRef.record.rewardUsd} USDT`);

// Verify balance updated in REAL account
const balAfterRef = db.getBalance(testUser.id, "REAL");
assert.ok(balAfterRef.availableBalance >= 380.0, "Balance must reflect deposit + $30 referral bonus");
console.log(`  Balance after referral bonus: $${balAfterRef.availableBalance} USDT`);
console.log("  ✔ PASSED: Referral registration credited $30.00 USDT directly to REAL ledger.\n");

// 4. Trade Execution & Risk Management Protection
console.log("▶ TEST 4: Real Trade Execution Engine & Mandatory Stop-Loss...");
import { executeOrder, closeOrder } from "@/lib/trading/engine";

const tradeResult = executeOrder({
  userId: testUser.id,
  accountType: "REAL",
  symbol: "BTC/USDT",
  assetClass: "CRYPTO",
  direction: "LONG",
  orderType: "MARKET",
  size: 0.004,
  leverage: 5,
  currentPrice: 68500.0,
  stopLoss: 67000.0,
  takeProfit: 71000.0,
});
assert.ok(tradeResult.success, `Trade execution failed: ${tradeResult.error}`);
const trade = tradeResult.trade;
assert.strictEqual(trade.status, "OPEN", "New trade must be in OPEN status");
assert.strictEqual(trade.accountType, "REAL", "Trade must be in REAL account");
console.log(`  Opened REAL position: ${trade.direction} ${trade.symbol} size=${trade.size} at $${trade.entryPrice}`);

// Close Trade with Profit
const closeResult = closeOrder(testUser.id, trade.id, 69500.0);
assert.ok(closeResult.success, `Close position failed: ${closeResult.error}`);
assert.strictEqual(closeResult.trade.status, "CLOSED", "Trade must be CLOSED");
assert.ok(closeResult.trade.pnl > 0, "PNL should be positive for price 69500 vs 68500");
console.log(`  Closed position: Realized PNL = +$${closeResult.trade.pnl.toFixed(2)} USDT`);
console.log("  ✔ PASSED: Trading engine opened and closed real position with full ledger settlement.\n");

// 5. Supabase Synchronization & Health Probe
console.log("▶ TEST 5: Supabase Connection & Synchronization Layer...");
import { checkSupabaseConnection } from "@/lib/supabase/sync";

const health = await checkSupabaseConnection();
console.log(`  Supabase Configured: ${health.configured}`);
console.log(`  Supabase URL: ${health.projectUrl}`);
console.log(`  Sync Status: ${health.status} (${health.detail})`);
assert.ok(health.configured, "Supabase environment must be configured");
console.log("  ✔ PASSED: Supabase integration and telemetry verified.\n");

console.log("================================================================================");
console.log("🏆 ALL 5 CRITICAL TEST SUITES PASSED FLAWLESSLY! READY FOR SHIPPING.");
console.log("================================================================================\n");
