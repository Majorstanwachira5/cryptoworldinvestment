import { db } from '../database';
import { randomUUID as uuidv4 } from 'crypto';

export class AdminService {

  static async getOverviewMetrics() {
    const totalUsersRow = await db.get('SELECT COUNT(*) as count FROM users WHERE role = $1', ['USER']) as { count: string | number };
    const totalUsers = Number(totalUsersRow?.count || 0);

    const activeUsersRow = await db.get('SELECT COUNT(*) as count FROM users WHERE is_suspended = 0 AND role = $1', ['USER']) as { count: string | number };
    const activeUsers = Number(activeUsersRow?.count || 0);

    const liabilitiesRow = await db.get('SELECT SUM(total_balance_micro) as sum FROM wallets WHERE user_id != $1', ['SYSTEM_TREASURY']) as { sum: string | number | null };
    const walletLiabilitiesUsdt = (Number(liabilitiesRow?.sum) || 0) / 1_000_000;

    const totalOrdersRow = await db.get('SELECT COUNT(*) as count FROM orders') as { count: string | number };
    const totalOrders = Number(totalOrdersRow?.count || 0);

    const totalRewardsRow = await db.get('SELECT SUM(amount_usdt) as sum FROM reward_events WHERE status = $1', ['CREDITED']) as { sum: string | number | null };
    const totalRewardsPaid = Number(totalRewardsRow?.sum) || 0;

    return {
      totalUsers,
      activeUsers,
      walletLiabilitiesUsdt: parseFloat(walletLiabilitiesUsdt.toFixed(2)),
      totalOrders,
      totalRewardsPaid: parseFloat(totalRewardsPaid.toFixed(2)),
      systemHealth: 'HEALTHY'
    };
  }

  static async getUsers() {
    const users = await db.all('SELECT id, email, full_name, kyc_status, referral_code, is_suspended, created_at FROM users ORDER BY created_at DESC') as any[];
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

  static async toggleUserStatus(adminId: string, targetUserId: string, suspend: boolean) {
    await db.run('UPDATE users SET is_suspended = ? WHERE id = ?', [suspend ? 1 : 0, targetUserId]);

    await db.run(`
      INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details)
      VALUES (?, ?, ?, 'USER', ?, ?)
    `, [uuidv4(), adminId, suspend ? 'SUSPEND_USER' : 'REINSTATE_USER', targetUserId, `User ${targetUserId} status changed to ${suspend ? 'suspended' : 'active'}`]);

    return { success: true, targetUserId, isSuspended: suspend };
  }

  static async getLedgerAudit() {
    const transactions = await db.all(`
      SELECT id, reference, type, description, created_at
      FROM ledger_transactions
      ORDER BY created_at DESC
      LIMIT 100
    `) as any[];

    const result = [];
    for (const tx of transactions) {
      const entries = await db.all(`
        SELECT le.id, le.wallet_id, le.entry_type, le.amount_micro, u.email
        FROM ledger_entries le
        LEFT JOIN wallets w ON le.wallet_id = w.id
        LEFT JOIN users u ON w.user_id = u.id
        WHERE le.transaction_id = ?
      `, [tx.id]) as any[];

      result.push({
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
          amountUsdt: Number(e.amount_micro) / 1_000_000
        }))
      });
    }

    return result;
  }
}
