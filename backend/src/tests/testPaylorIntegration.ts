import assert from 'assert';
import crypto from 'crypto';
import { db, initDatabase } from '../database';
import { AuthService } from '../auth/AuthService';
import { PaylorService } from '../payments/PaylorService';
import { WalletService } from '../wallet/WalletService';
import { config } from '../config';

async function runPaylorTests() {
  console.log('====================================================');
  console.log('⚡ STARTING PAYLOR PAYMENT INTEGRATION VERIFICATION SUITE');
  console.log('====================================================\n');

  await initDatabase();

  // Test 1: User Registration for Payment Flow
  console.log('▶ Test 1: User Registration for Paylor Payments...');
  const userEmail = `paylor_user_${Date.now()}@cryptohub.ai`;
  const user = await AuthService.register(userEmail, 'Pass123!', 'Paylor Test User');
  console.log(`  ✔ PASSED: Created user ${user.userId}\n`);

  // Test 2: Signature Verification Test (Valid vs Forged)
  console.log('▶ Test 2: HMAC SHA256 Webhook Signature Verification...');
  const samplePayload = JSON.stringify({
    event_id: `EVT_${Date.now()}`,
    reference: `PAYLOR_REF_TEST_${Date.now()}`,
    status: 'SUCCESS',
    amount: 1500,
    currency: 'KES'
  });

  const testSecret = config.paylorWebhookSecret || '331a3e3b36adac37d43d3042716f350cb9d8c2cf3542777ffa4dd3c1c599d71c';
  config.paylorWebhookSecret = testSecret;

  const validSignature = crypto
    .createHmac('sha256', testSecret)
    .update(samplePayload)
    .digest('hex');

  const isValid = await PaylorService.verifyWebhookSignature(samplePayload, validSignature);
  assert.strictEqual(isValid, true, 'Valid signature must pass verification');

  const isForgedValid = await PaylorService.verifyWebhookSignature(samplePayload, 'forged_signature_header_123');
  assert.strictEqual(isForgedValid, false, 'Forged signature must be rejected');
  console.log('  ✔ PASSED: Signature verification strictly blocks forged signatures\n');

  // Test 3: End-to-End Collection & Webhook Credit
  console.log('▶ Test 3: End-to-End Paylor Collection & Ledger Credit...');
  const collectionRef = `PAYLOR_COL_TEST_${Date.now()}`;
  const paymentId = `PAY_${Date.now()}`;

  // Insert payment record
  await db.run(`
    INSERT INTO paylor_payments (id, user_id, reference, rail, amount, currency, status)
    VALUES (?, ?, ?, 'SASAPAY_KE', 1500, 'KES', 'PENDING')
  `, [paymentId, user.userId, collectionRef]);

  const walletBefore = await WalletService.getWalletSummary(user.userId);
  const ledgerCountBefore = (await db.get('SELECT COUNT(*) as cnt FROM ledger_entries') as any).cnt;

  const webhookPayload = {
    event_id: `EVT_PAYLOR_${Date.now()}`,
    reference: collectionRef,
    status: 'SUCCESS',
    amount: 1500,
    currency: 'KES'
  };

  const payloadString = JSON.stringify(webhookPayload);
  const sig = crypto.createHmac('sha256', testSecret).update(payloadString).digest('hex');

  const result1 = await PaylorService.handleWebhookEvent(webhookPayload, payloadString, sig);
  assert.strictEqual(result1.status, 'SUCCESS', 'Webhook processing must return SUCCESS status');

  const walletAfter = await WalletService.getWalletSummary(user.userId);
  const ledgerCountAfter = (await db.get('SELECT COUNT(*) as cnt FROM ledger_entries') as any).cnt;

  assert.ok(walletAfter.availableBalance > walletBefore.availableBalance, 'Wallet balance must increase after credited deposit');
  assert.strictEqual(Number(ledgerCountAfter), Number(ledgerCountBefore) + 2, 'Ledger entries must increase by exactly 2 (DEBIT + CREDIT)');
  console.log(`  ✔ PASSED: Deposit credited atomically. Ledger entries: ${ledgerCountBefore} → ${ledgerCountAfter}\n`);

  // Test 4: Idempotent Webhook Duplicate Handling
  console.log('▶ Test 4: Webhook Storage-Level Idempotency...');
  const result2 = await PaylorService.handleWebhookEvent(webhookPayload, payloadString, sig);
  assert.strictEqual(result2.duplicate, true, 'Duplicate webhook must return duplicate: true');

  const ledgerCountDuplicate = (await db.get('SELECT COUNT(*) as cnt FROM ledger_entries') as any).cnt;
  assert.strictEqual(Number(ledgerCountDuplicate), Number(ledgerCountAfter), 'Ledger count must NOT increase on duplicate webhook');
  console.log('  ✔ PASSED: Duplicate webhook handled idempotently with 0 balance changes\n');

  console.log('====================================================');
  console.log('🎉 PAYLOR PAYMENT INTEGRATION FULLY VERIFIED & PASSED!');
  console.log('====================================================');
}

runPaylorTests().catch(err => {
  console.error('❌ Paylor test suite failed:', err);
  process.exit(1);
});
