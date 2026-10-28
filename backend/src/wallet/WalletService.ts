import { db } from '../database';
import { LedgerService } from '../ledger/LedgerService';
import { config } from '../config';
import { randomUUID as uuidv4 } from 'crypto';

export class WalletService {

  static async getWalletSummary(userId: string) {
    let wallet = await db.get("SELECT id, total_balance_micro, reserved_balance_micro FROM wallets WHERE user_id = ? AND asset = 'USDT'", [userId]) as any;

    if (!wallet) {
      const walletId = uuidv4();
      await db.run("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, ?, 'USDT', 0, 0)", [walletId, userId]);
      wallet = { id: walletId, total_balance_micro: 0, reserved_balance_micro: 0 };
    }

    const totalBalance = Number(wallet.total_balance_micro) / 1_000_000;
    const reservedBalance = Number(wallet.reserved_balance_micro) / 1_000_000;
    const availableBalance = Math.max(0, totalBalance - reservedBalance);

    return {
      totalBalance: parseFloat(totalBalance.toFixed(6)),
      availableBalance: parseFloat(availableBalance.toFixed(6)),
      reservedBalance: parseFloat(reservedBalance.toFixed(6)),
      asset: 'USDT'
    };
  }

  static async getTransactions(userId: string) {
    const wallet = await db.get("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'", [userId]) as { id: string } | undefined;
    if (!wallet) return [];

    const entries = await db.all(`
      SELECT le.entry_type, le.amount_micro, le.created_at, lt.type, lt.reference, lt.description
      FROM ledger_entries le
      JOIN ledger_transactions lt ON le.transaction_id = lt.id
      WHERE le.wallet_id = ?
      ORDER BY le.created_at DESC
    `, [wallet.id]) as any[];

    return entries.map((e, idx) => ({
      transactionId: `TX_${idx}_${e.reference.substring(0, 8)}`,
      type: e.type,
      amount: (e.entry_type === 'CREDIT' ? 1 : -1) * (Number(e.amount_micro) / 1_000_000),
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

  static async requestWithdrawal(userId: string, address: string, amountUsdt: number) {
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      throw new Error('Destination TRC20 address is required.');
    }

    if (isNaN(amountUsdt) || amountUsdt < config.minWithdrawalUsdt) {
      throw new Error(`Minimum withdrawal amount is ${config.minWithdrawalUsdt.toFixed(2)} USDT.`);
    }

    const wallet = await db.get("SELECT id, total_balance_micro, reserved_balance_micro FROM wallets WHERE user_id = ? AND asset = 'USDT'", [userId]) as any;
    if (!wallet) throw new Error('Wallet not found.');

    const availableMicro = Number(wallet.total_balance_micro) - Number(wallet.reserved_balance_micro);
    const amountMicro = Math.round(amountUsdt * 1_000_000);

    if (availableMicro < amountMicro) {
      throw new Error('Insufficient available balance for withdrawal.');
    }

    const withdrawalId = uuidv4();
    const feeUsdt = config.withdrawalFeeUsdt;
    const netReceiveUsdt = Math.max(0, amountUsdt - feeUsdt);
    const withdrawalRef = `WITHDRAWAL_REQ_${withdrawalId}`;

    const systemWallet = await LedgerService.getOrCreateSystemWallet();

    // Atomically create withdrawal request AND post ledger debit transaction in a single DB transaction
    await db.transaction(async (client) => {
      // Post ledger transaction: DEBIT user wallet, CREDIT system treasury
      const ledgerTxId = await LedgerService.postTransaction(
        withdrawalRef,
        'WITHDRAWAL',
        `TRC20 USDT Withdrawal Request to ${address} ($${amountUsdt} USDT)`,
        [
          { walletId: wallet.id, type: 'DEBIT', amountMicro },
          { walletId: systemWallet.id, type: 'CREDIT', amountMicro }
        ]
      );

      await db.run(`
        INSERT INTO withdrawal_requests (id, user_id, destination_address, network, amount_usdt, fee_usdt, net_receive_usdt, status, risk_score)
        VALUES (?, ?, ?, 'TRC20', ?, ?, ?, 'PENDING_REVIEW', 0.0)
      `, [withdrawalId, userId, address, amountUsdt, feeUsdt, netReceiveUsdt], client);
    });

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

  static async approveAndExecuteWithdrawal(withdrawalId: string, adminId: string, txHash?: string) {
    const req = await db.get('SELECT * FROM withdrawal_requests WHERE id = ?', [withdrawalId]) as any;
    if (!req) throw new Error('Withdrawal request not found.');

    if (req.status === 'CONFIRMED') {
      return { success: true, message: 'Withdrawal already executed.', status: 'CONFIRMED', txHash: req.tx_hash };
    }

    const hash = txHash || `0x${uuidv4().replace(/-/g, '')}`;

    await db.transaction(async (client) => {
      await db.run(`
        UPDATE withdrawal_requests
        SET status = 'CONFIRMED', tx_hash = ?, updated_at = ?
        WHERE id = ?
      `, [hash, new Date().toISOString(), withdrawalId], client);

      await db.run(`
        INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details)
        VALUES (?, ?, 'APPROVE_WITHDRAWAL', 'WITHDRAWAL', ?, ?)
      `, [uuidv4(), adminId, withdrawalId, `Approved withdrawal ${withdrawalId} for $${req.amount_usdt} USDT to ${req.destination_address}`], client);
    });

    return {
      withdrawalId,
      status: 'CONFIRMED',
      txHash: hash
    };
  }

  static async getWithdrawalRequests(userId?: string) {
    if (userId) {
      return await db.all('SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }
    return await db.all('SELECT w.*, u.email FROM withdrawal_requests w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC');
  }
}
