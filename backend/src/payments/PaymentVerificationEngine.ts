import { db } from '../database';
import { config } from '../config';
import { LedgerService } from '../ledger/LedgerService';
import { UserLevelsEngine } from '../levels/UserLevelsEngine';
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

  static createPaymentRequest(userId: string, requestedAmountUsdt: number): PaymentRequestResult {
    const paymentRequestId = `PR_${uuidv4().substring(0, 8)}`;
    const destinationAddress = 'T' + Buffer.from(userId.replace(/-/g, '')).toString('hex').substring(0, 33).toUpperCase();

    db.prepare(`
      INSERT INTO deposit_verifications (id, user_id, payment_request_id, network, token_contract, destination_address, amount_usdt, status, required_confirmations)
      VALUES (?, ?, ?, 'TRC20', ?, ?, ?, 'PAYMENT_REQUESTED', ?)
    `).run(uuidv4(), userId, paymentRequestId, config.usdtTrc20ContractAddress, destinationAddress, requestedAmountUsdt, config.requiredDepositConfirmations);

    return {
      paymentRequestId,
      userId,
      network: 'TRC20',
      destinationAddress,
      requiredConfirmations: config.requiredDepositConfirmations,
      status: 'PAYMENT_REQUESTED'
    };
  }

  static processDepositNotification(notification: WebhookNotification) {
    if (notification.network !== 'TRC20') {
      throw new Error(`Unsupported network '${notification.network}'. Only TRC20 is supported.`);
    }

    if (notification.tokenContract !== config.usdtTrc20ContractAddress) {
      throw new Error(`Invalid token contract '${notification.tokenContract}'. Only TRC20 USDT is accepted.`);
    }

    const existingCredited = db.prepare("SELECT id, status FROM deposit_verifications WHERE tx_hash = ? AND status = 'CREDITED'").get(notification.txHash);
    if (existingCredited) {
      return { success: true, message: 'Deposit already processed and credited.', status: 'CREDITED', duplicate: true };
    }

    let record = db.prepare('SELECT * FROM deposit_verifications WHERE tx_hash = ?').get(notification.txHash) as any;

    if (!record) {
      record = db.prepare("SELECT * FROM deposit_verifications WHERE destination_address = ? AND status = 'PAYMENT_REQUESTED' ORDER BY created_at DESC").get(notification.destinationAddress) as any;
    }

    if (!record) {
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(notification.destinationAddress) as any;
      const targetUserId = user ? user.id : 'UNKNOWN_USER';

      const depositId = uuidv4();
      const prId = `PR_WEBHOOK_${uuidv4().substring(0, 8)}`;
      db.prepare(`
        INSERT INTO deposit_verifications (id, user_id, payment_request_id, network, token_contract, destination_address, amount_usdt, tx_hash, confirmations, required_confirmations, status)
        VALUES (?, ?, ?, 'TRC20', ?, ?, ?, ?, ?, ?, 'TRANSACTION_DETECTED')
      `).run(depositId, targetUserId, prId, config.usdtTrc20ContractAddress, notification.destinationAddress, notification.amountUsdt, notification.txHash, notification.confirmations, config.requiredDepositConfirmations);

      record = db.prepare('SELECT * FROM deposit_verifications WHERE id = ?').get(depositId) as any;
    }

    let nextStatus = 'CONFIRMATION_PENDING';
    if (notification.confirmations >= config.requiredDepositConfirmations) {
      nextStatus = 'VERIFIED';
    }

    const nowIso = new Date().toISOString();

    const processTx = db.transaction(() => {
      db.prepare(`
        UPDATE deposit_verifications
        SET tx_hash = ?, confirmations = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(notification.txHash, notification.confirmations, nextStatus, nowIso, record.id);

      if (nextStatus === 'VERIFIED') {
        const userWallet = db.prepare("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'").get(record.user_id) as { id: string } | undefined;
        if (userWallet) {
          const systemWallet = LedgerService.getOrCreateSystemWallet();
          const amountMicro = Math.round(notification.amountUsdt * 1_000_000);
          const ledgerRef = `DEPOSIT_${notification.txHash}`;

          LedgerService.postTransaction(
            ledgerRef,
            'DEPOSIT',
            `TRC20 USDT Verified Deposit (Tx: ${notification.txHash.substring(0, 8)}...)`,
            [
              { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
              { walletId: userWallet.id, type: 'CREDIT', amountMicro }
            ]
          );

          db.prepare("UPDATE deposit_verifications SET status = 'CREDITED', updated_at = ? WHERE id = ?")
            .run(nowIso, record.id);

          UserLevelsEngine.evaluateUserLevel(record.user_id);
        }
      }
    });

    processTx();

    const updated = db.prepare('SELECT * FROM deposit_verifications WHERE id = ?').get(record.id) as any;

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

  static getUserDeposits(userId: string) {
    return db.prepare('SELECT * FROM deposit_verifications WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  }
}
