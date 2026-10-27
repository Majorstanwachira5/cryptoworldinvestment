import { db } from '../database';
import { LedgerService } from '../ledger/LedgerService';
import { config } from '../config';
import { randomUUID as uuidv4 } from 'crypto';

export class WalletService {

  static getWalletSummary(userId: string) {
    let wallet = db.prepare("SELECT id, total_balance_micro, reserved_balance_micro FROM wallets WHERE user_id = ? AND asset = 'USDT'").get(userId) as any;

    if (!wallet) {
      const walletId = uuidv4();
      db.prepare("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, ?, 'USDT', 0, 0)").run(walletId, userId);
      wallet = { id: walletId, total_balance_micro: 0, reserved_balance_micro: 0 };
    }

    const totalBalance = wallet.total_balance_micro / 1_000_000;
    const reservedBalance = wallet.reserved_balance_micro / 1_000_000;
    const availableBalance = Math.max(0, totalBalance - reservedBalance);

    return {
      totalBalance: parseFloat(totalBalance.toFixed(6)),
      availableBalance: parseFloat(availableBalance.toFixed(6)),
      reservedBalance: parseFloat(reservedBalance.toFixed(6)),
      asset: 'USDT'
    };
  }

  static getTransactions(userId: string) {
    const wallet = db.prepare("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'").get(userId) as { id: string } | undefined;
    if (!wallet) return [];

    const entries = db.prepare(`
      SELECT le.entry_type, le.amount_micro, le.created_at, lt.type, lt.reference, lt.description
      FROM ledger_entries le
      JOIN ledger_transactions lt ON le.transaction_id = lt.id
      WHERE le.wallet_id = ?
      ORDER BY le.created_at DESC
    `).all(wallet.id) as any[];

    return entries.map((e, idx) => ({
      transactionId: `TX_${idx}_${e.reference.substring(0, 8)}`,
      type: e.type,
      amount: (e.entry_type === 'CREDIT' ? 1 : -1) * (e.amount_micro / 1_000_000),
      status: 'CREDITED',
      reference: e.description || e.reference,
      timestamp: e.created_at
    }));
  }

  static getDepositAddress(userId: string) {
    const address = 'T' + Buffer.from(userId.replace(/-/g, '')).toString('hex').substring(0, 33).toUpperCase();
    const qrCodeUri = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${address}`;

    return {
      network: 'TRC20',
      address,
      qrCodeUri
    };
  }

  static requestWithdrawal(userId: string, address: string, amountUsdt: number) {
    if (amountUsdt < config.minWithdrawalUsdt) {
      throw new Error(`Minimum withdrawal amount is ${config.minWithdrawalUsdt} USDT.`);
    }

    const wallet = db.prepare("SELECT id, total_balance_micro, reserved_balance_micro FROM wallets WHERE user_id = ? AND asset = 'USDT'").get(userId) as any;
    if (!wallet) throw new Error('Wallet not found.');

    const availableMicro = wallet.total_balance_micro - wallet.reserved_balance_micro;
    const amountMicro = Math.round(amountUsdt * 1_000_000);

    if (availableMicro < amountMicro) {
      throw new Error('Insufficient available balance for withdrawal.');
    }

    const withdrawalId = uuidv4();
    const feeUsdt = config.withdrawalFeeUsdt;
    const netReceiveUsdt = Math.max(0, amountUsdt - feeUsdt);

    const withdrawalTx = db.transaction(() => {
      LedgerService.reserveAmount(wallet.id, amountMicro);

      db.prepare(`
        INSERT INTO withdrawal_requests (id, user_id, destination_address, network, amount_usdt, fee_usdt, net_receive_usdt, status, risk_score)
        VALUES (?, ?, ?, 'TRC20', ?, ?, ?, 'PENDING_REVIEW', 0.0)
      `).run(withdrawalId, userId, address, amountUsdt, feeUsdt, netReceiveUsdt);
    });

    withdrawalTx();

    return {
      withdrawalId,
      userId,
      destinationAddress: address,
      network: 'TRC20',
      amountUsdt,
      feeUsdt,
      netReceiveUsdt,
      status: 'PENDING_REVIEW'
    };
  }

  static approveAndExecuteWithdrawal(withdrawalId: string, adminId: string, txHash?: string) {
    const req = db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(withdrawalId) as any;
    if (!req) throw new Error('Withdrawal request not found.');

    if (req.status === 'CONFIRMED') {
      return { success: true, message: 'Withdrawal already executed.', status: 'CONFIRMED' };
    }

    const wallet = db.prepare("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'").get(req.user_id) as any;
    if (!wallet) throw new Error('User wallet not found.');

    const amountMicro = Math.round(req.amount_usdt * 1_000_000);
    const withdrawalRef = `WITHDRAWAL_${req.id}`;
    const hash = txHash || `0x${uuidv4().replace(/-/g, '')}`;

    const systemWallet = LedgerService.getOrCreateSystemWallet();

    const approveTx = db.transaction(() => {
      LedgerService.postTransaction(
        withdrawalRef,
        'WITHDRAWAL',
        `TRC20 USDT Withdrawal to ${req.destination_address} (Tx: ${hash.substring(0, 8)}...)`,
        [
          { walletId: wallet.id, type: 'DEBIT', amountMicro },
          { walletId: systemWallet.id, type: 'CREDIT', amountMicro }
        ]
      );

      LedgerService.releaseReservation(wallet.id, amountMicro);

      db.prepare(`
        UPDATE withdrawal_requests
        SET status = 'CONFIRMED', tx_hash = ?, updated_at = ?
        WHERE id = ?
      `).run(hash, new Date().toISOString(), withdrawalId);

      db.prepare(`
        INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details)
        VALUES (?, ?, 'APPROVE_WITHDRAWAL', 'WITHDRAWAL', ?, ?)
      `).run(uuidv4(), adminId, withdrawalId, `Approved withdrawal ${withdrawalId} for $${req.amount_usdt} USDT to ${req.destination_address}`);
    });

    approveTx();

    return {
      withdrawalId,
      status: 'CONFIRMED',
      txHash: hash
    };
  }

  static getWithdrawalRequests(userId?: string) {
    if (userId) {
      return db.prepare('SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    }
    return db.prepare('SELECT w.*, u.email FROM withdrawal_requests w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC').all();
  }
}
