import { db } from '../database';
import { config } from '../config';
import { LedgerService } from '../ledger/LedgerService';
import { UserLevelsEngine } from '../levels/UserLevelsEngine';
import { ReferralRewardsEngine } from '../rewards/ReferralRewardsEngine';
import { randomUUID as uuidv4 } from 'crypto';

export interface PaymentRequestResult {
  paymentRequestId: string;
  userId: string;
  network: string;
  destinationAddress: string;
  requiredConfirmations: number;
  status: string;
}

export interface WebhookNotification {
  txHash: string;
  network: string;
  tokenContract: string;
  destinationAddress: string;
  amountUsdt: number;
  confirmations: number;
}

export class PaymentVerificationEngine {

  static async createPaymentRequest(userId: string, requestedAmountUsdt: number): Promise<PaymentRequestResult> {
    const paymentRequestId = `PR_${uuidv4().substring(0, 8)}`;
    const destinationAddress = 'T' + Buffer.from(userId.replace(/-/g, '')).toString('hex').substring(0, 33).toUpperCase();

    await db.run(`
      INSERT INTO deposit_verifications (id, user_id, payment_request_id, network, token_contract, destination_address, amount_usdt, status, required_confirmations)
      VALUES (?, ?, ?, 'TRC20', ?, ?, ?, 'PAYMENT_REQUESTED', ?)
    `, [uuidv4(), userId, paymentRequestId, config.usdtTrc20ContractAddress, destinationAddress, requestedAmountUsdt, config.requiredDepositConfirmations]);

    return {
      paymentRequestId,
      userId,
      network: 'TRC20',
      destinationAddress,
      requiredConfirmations: config.requiredDepositConfirmations,
      status: 'PAYMENT_REQUESTED'
    };
  }

  static async processDepositNotification(notification: WebhookNotification) {
    if (notification.network !== 'TRC20') {
      throw new Error(`Unsupported network '${notification.network}'. Only TRC20 is supported.`);
    }

    if (notification.tokenContract !== config.usdtTrc20ContractAddress) {
      throw new Error(`Invalid token contract '${notification.tokenContract}'. Only TRC20 USDT is accepted.`);
    }

    const existingCredited = await db.get("SELECT id, status FROM deposit_verifications WHERE tx_hash = ? AND status = 'CREDITED'", [notification.txHash]);
    if (existingCredited) {
      return { success: true, message: 'Deposit already processed and credited.', status: 'CREDITED', duplicate: true };
    }

    let record = await db.get('SELECT * FROM deposit_verifications WHERE tx_hash = ?', [notification.txHash]) as any;

    if (!record) {
      record = await db.get("SELECT * FROM deposit_verifications WHERE destination_address = ? AND status IN ('PAYMENT_REQUESTED', 'CONFIRMATION_PENDING') ORDER BY created_at DESC", [notification.destinationAddress]) as any;
    }

    if (!record) {
      // Find user_id from any existing deposit_verifications with this destinationAddress
      const userRecord = await db.get("SELECT user_id FROM deposit_verifications WHERE destination_address = ? LIMIT 1", [notification.destinationAddress]) as any;
      if (userRecord) {
        const id = uuidv4();
        const prId = `PR_AUTO_${uuidv4().substring(0, 8)}`;
        await db.run(`
          INSERT INTO deposit_verifications (id, user_id, payment_request_id, network, token_contract, destination_address, amount_usdt, tx_hash, confirmations, status, required_confirmations)
          VALUES (?, ?, ?, 'TRC20', ?, ?, ?, ?, ?, 'CONFIRMATION_PENDING', ?)
        `, [id, userRecord.user_id, prId, notification.tokenContract, notification.destinationAddress, notification.amountUsdt, notification.txHash, notification.confirmations, config.requiredDepositConfirmations]);

        record = await db.get('SELECT * FROM deposit_verifications WHERE id = ?', [id]);
      }
    }

    if (!record) {
      throw new Error(`Deposit notification for unknown destination address: ${notification.destinationAddress}`);
    }

    let nextStatus = 'CONFIRMATION_PENDING';
    if (notification.confirmations >= config.requiredDepositConfirmations) {
      nextStatus = 'VERIFIED';
    }

    const nowIso = new Date().toISOString();

    await db.transaction(async (client) => {
      await db.run(`
        UPDATE deposit_verifications
        SET tx_hash = ?, amount_usdt = ?, confirmations = ?, status = ?, updated_at = ?
        WHERE id = ?
      `, [notification.txHash, notification.amountUsdt, notification.confirmations, nextStatus, nowIso, record.id], client);

      if (nextStatus === 'VERIFIED') {
        const userWallet = await db.get("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'", [record.user_id], client) as { id: string } | undefined;
        if (userWallet) {
          const systemWallet = await LedgerService.getOrCreateSystemWallet();
          const amountMicro = Math.round(notification.amountUsdt * 1_000_000);
          const ledgerRef = `DEPOSIT_${notification.txHash}`;

          await LedgerService.postTransaction(
            ledgerRef,
            'DEPOSIT',
            `TRC20 USDT Verified Deposit (Tx: ${notification.txHash.substring(0, 8)}...)`,
            [
              { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
              { walletId: userWallet.id, type: 'CREDIT', amountMicro }
            ]
          );

          await db.run("UPDATE deposit_verifications SET status = 'CREDITED', updated_at = ? WHERE id = ?",
            [nowIso, record.id], client);

          await UserLevelsEngine.evaluateUserLevel(record.user_id, client);
        }
      }
    });

    if (nextStatus === 'VERIFIED') {
      // Process referral reward for the referrer if this referee was referred
      await ReferralRewardsEngine.processReferralReward(record.user_id);
    }

    const updated = await db.get('SELECT * FROM deposit_verifications WHERE id = ?', [record.id]) as any;

    return {
      success: true,
      paymentRequestId: updated.payment_request_id,
      userId: updated.user_id,
      txHash: notification.txHash,
      amountUsdt: updated.amount_usdt,
      status: updated.status,
      confirmations: notification.confirmations
    };
  }

  static async getUserDeposits(userId: string) {
    return await db.all('SELECT * FROM deposit_verifications WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }
}
