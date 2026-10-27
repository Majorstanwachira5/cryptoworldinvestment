import { db } from '../database';
import { randomUUID as uuidv4 } from 'crypto';

export class AdminService {

  static getOverviewMetrics() {
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "USER"').get() as { count: number }).count;
    const activeUsers = (db.prepare('SELECT COUNT(*) as count FROM users WHERE is_suspended = 0 AND role = "USER"').get() as { count: number }).count;

    const liabilitiesRow = db.prepare('SELECT SUM(total_balance_micro) as sum FROM wallets WHERE user_id != "SYSTEM_TREASURY"').get() as { sum: number | null };
    const walletLiabilitiesUsdt = (liabilitiesRow.sum || 0) / 1_000_000;

    const totalOrders = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number }).count;
    const totalRewardsPaid = (db.prepare('SELECT SUM(amount_usdt) as sum FROM reward_events WHERE status = "CREDITED"').get() as { sum: number | null }).sum || 0;

    return {
      totalUsers,
      activeUsers,
      walletLiabilitiesUsdt: parseFloat(walletLiabilitiesUsdt.toFixed(2)),
      totalOrders,
      totalRewardsPaid: parseFloat(totalRewardsPaid.toFixed(2)),
      systemHealth: 'HEALTHY'
    };
  }

  static getUsers() {
    const users = db.prepare('SELECT id, email, full_name, kyc_status, referral_code, is_suspended, created_at FROM users ORDER BY created_at DESC').all() as any[];
    return users.map(u => ({
      userId: u.id,
      email: u.email,
      fullName: u.full_name,
      kycStatus: u.kyc_status,
      referralCode: u.referral_code,
      isSuspended: Boolean(u.is_suspended),
      createdAt: u.created_at
    }));
  }

  static toggleUserStatus(adminId: string, targetUserId: string, suspend: boolean) {
    db.prepare('UPDATE users SET is_suspended = ? WHERE id = ?').run(suspend ? 1 : 0, targetUserId);

    db.prepare(`
      INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details)
      VALUES (?, ?, ?, 'USER', ?, ?)
    `).run(uuidv4(), adminId, suspend ? 'SUSPEND_USER' : 'REINSTATE_USER', targetUserId, `User ${targetUserId} status changed to ${suspend ? 'suspended' : 'active'}`);

    return { success: true, targetUserId, isSuspended: suspend };
  }

  static getLedgerAudit() {
    const transactions = db.prepare(`
      SELECT id, reference, type, description, created_at
      FROM ledger_transactions
      ORDER BY created_at DESC
      LIMIT 100
    `).all() as any[];

    const entriesStmt = db.prepare(`
      SELECT le.id, le.wallet_id, le.entry_type, le.amount_micro, u.email
      FROM ledger_entries le
      LEFT JOIN wallets w ON le.wallet_id = w.id
      LEFT JOIN users u ON w.user_id = u.id
      WHERE le.transaction_id = ?
    `);

    return transactions.map(tx => {
      const entries = entriesStmt.all(tx.id) as any[];
      return {
        transactionId: tx.id,
        reference: tx.reference,
        type: tx.type,
        description: tx.description,
        timestamp: tx.created_at,
        entries: entries.map(e => ({
          entryId: e.id,
          walletId: e.wallet_id,
          userEmail: e.email || 'SYSTEM',
          type: e.entry_type,
          amountUsdt: e.amount_micro / 1_000_000
        }))
      };
    });
  }
}
