import crypto from 'crypto';
import { db } from '../database';
import { config } from '../config';
import { LedgerService } from '../ledger/LedgerService';
import { UserLevelsEngine } from '../levels/UserLevelsEngine';
import { randomUUID as uuidv4 } from 'crypto';

export class PaylorService {

  static async initiateCollection(userId: string, rail: string, msisdn: string, amount: number, currency: string = 'KES') {
    const reference = `PAYLOR_COL_${uuidv4().substring(0, 10)}`;

    // Call Paylor API
    const response = await fetch(`${config.paylorBaseUrl}/global/collections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.paylorApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rail: rail || 'SASAPAY_KE',
        msisdn,
        amount,
        currency,
        reference,
        channel_id: config.paylorChannelId
      })
    });

    const data = await response.json() as any;

    // Persist payment attempt to database
    await db.run(`
      INSERT INTO paylor_payments (id, user_id, reference, rail, amount, currency, status, provider_response)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `, [uuidv4(), userId, reference, rail, amount, currency, JSON.stringify(data)]);

    return {
      reference,
      status: 'PENDING',
      providerResponse: data
    };
  }

  static async verifyWebhookSignature(rawBody: string, signatureHeader: string): Promise<boolean> {
    if (!signatureHeader || !config.paylorWebhookSecret) return false;
    const computedSignature = crypto
      .createHmac('sha256', config.paylorWebhookSecret)
      .update(rawBody)
      .digest('hex');
    const sigBuf = Buffer.from(signatureHeader);
    const compBuf = Buffer.from(computedSignature);
    if (sigBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, compBuf);
  }

  static async handleWebhookEvent(event: any, rawBody: string, signatureHeader: string) {
    const isValid = await this.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      throw new Error('Invalid Paylor webhook signature.');
    }

    const eventId = event.event_id || event.id || uuidv4();
    const reference = event.reference || event.data?.reference;
    const status = event.status || event.data?.status;
    const amount = event.amount || event.data?.amount || 0;
    const currency = event.currency || event.data?.currency || 'KES';

    // Storage-level idempotency via unique event constraint
    try {
      await db.run(`
        INSERT INTO paylor_webhook_events (event_id, reference, status, raw_payload)
        VALUES (?, ?, ?, ?)
      `, [eventId, reference, status, JSON.stringify(event)]);
    } catch (err: any) {
      if (err.code === '23505') { // Postgres unique violation
        return { success: true, message: 'Duplicate webhook event ignored idempotently.', duplicate: true };
      }
      throw err;
    }

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const payment = await db.get('SELECT * FROM paylor_payments WHERE reference = ?', [reference]) as any;
      if (payment && payment.status !== 'CREDITED') {
        await db.transaction(async (client) => {
          await db.run("UPDATE paylor_payments SET status = 'CREDITED', updated_at = CURRENT_TIMESTAMP WHERE reference = ?", [reference], client);

          const userWallet = await db.get("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'", [payment.user_id], client) as { id: string } | undefined;
          if (userWallet) {
            const systemWallet = await LedgerService.getOrCreateSystemWallet();
            // Convert amount to micro units (or FX converted to USDT if currency is KES; here 1 KES = approx 0.0077 USDT or direct amount in micro)
            const amountUsdtEquivalent = currency === 'KES' ? amount * 0.0077 : amount;
            const amountMicro = Math.round(amountUsdtEquivalent * 1_000_000);
            const ledgerRef = `PAYLOR_DEP_${reference}`;

            await LedgerService.postTransaction(
              ledgerRef,
              'DEPOSIT',
              `Paylor Collection Verified (${reference})`,
              [
                { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
                { walletId: userWallet.id, type: 'CREDIT', amountMicro }
              ]
            );

            await UserLevelsEngine.evaluateUserLevel(payment.user_id, client);
          }
        });
      }
    }

    return { success: true, eventId, reference, status };
  }
}
