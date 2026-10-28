import { db } from '../database';
import { LedgerService } from '../ledger/LedgerService';
import { UserLevelsEngine } from '../levels/UserLevelsEngine';
import { config } from '../config';
import { randomUUID as uuidv4 } from 'crypto';

export class ReferralRewardsEngine {

  /**
   * Registers a referral relationship between a referrer and a referee.
   * Blocks self-referral and circular referral.
   */
  static async registerReferral(refereeId: string, referralCode: string) {
    if (!referralCode) return null;

    const referrer = await db.get('SELECT id FROM users WHERE referral_code = ?', [referralCode]) as { id: string } | undefined;
    if (!referrer) return null;

    if (referrer.id === refereeId) {
      throw new Error('Self-referral is strictly forbidden.');
    }

    // Check for circular referral: ensure referee has not already referred the referrer
    const circularCheck = await db.get('SELECT id FROM referral_relationships WHERE referrer_id = ? AND referee_id = ?', [refereeId, referrer.id]);
    if (circularCheck) {
      throw new Error('Circular referral is strictly forbidden.');
    }

    const relId = uuidv4();
    try {
      await db.run(`
        INSERT INTO referral_relationships (id, referrer_id, referee_id, level)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(referee_id) DO NOTHING
      `, [relId, referrer.id, refereeId]);
      return { id: relId, referrerId: referrer.id, refereeId };
    } catch (err: any) {
      if (err.code === '23505') { // Postgres unique violation on referee_id
        return null;
      }
      throw err;
    }
  }

  /**
   * Processes the $30 referral reward for the referrer when the referee makes a confirmed deposit.
   * Ensures idempotency via unique reward_events constraint and reference `REF_REWARD_<referrerId>_<refereeId>`.
   */
  static async processReferralReward(refereeId: string) {
    const relationship = await db.get(`
      SELECT * FROM referral_relationships WHERE referee_id = ?
    `, [refereeId]) as any;

    if (!relationship) return [];

    const referrerId = relationship.referrer_id;
    const rewardAmountUsdt = config.referralRewardUsdt; // $30.00
    const rewardReference = `REF_REWARD_${referrerId}_${refereeId}`;

    const existingEvent = await db.get('SELECT id FROM reward_events WHERE referrer_id = ? AND referee_id = ?', [referrerId, refereeId]);
    if (existingEvent) {
      return [];
    }

    const rewardId = uuidv4();
    const amountMicro = Math.round(rewardAmountUsdt * 1_000_000);

    const referrerWallet = await db.get("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'", [referrerId]) as { id: string } | undefined;
    if (!referrerWallet) return [];

    const systemWallet = await LedgerService.getOrCreateSystemWallet();

    const txId = await db.transaction(async (client) => {
      const ledgerTxId = await LedgerService.postTransaction(
        rewardReference,
        'REFERRAL_REWARD',
        `Referral Reward ($${rewardAmountUsdt} USDT for referee ${refereeId.substring(0, 8)}...)`,
        [
          { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
          { walletId: referrerWallet.id, type: 'CREDIT', amountMicro }
        ]
      );

      await db.run(`
        INSERT INTO reward_events (id, referrer_id, referee_id, level, amount_usdt, status, transaction_id)
        VALUES (?, ?, ?, 1, ?, 'CREDITED', ?)
      `, [rewardId, referrerId, refereeId, rewardAmountUsdt, ledgerTxId], client);

      return ledgerTxId;
    });

    // Re-evaluate referrer's level as successful referral count increased
    await UserLevelsEngine.evaluateUserLevel(referrerId);

    return [{
      rewardId,
      referrerId,
      refereeId,
      amountUsdt: rewardAmountUsdt,
      transactionId: txId
    }];
  }

  static async getRewardsSummary(userId: string) {
    const user = await db.get('SELECT referral_code FROM users WHERE id = ?', [userId]) as { referral_code: string } | undefined;

    const countRow = await db.get('SELECT COUNT(*) as cnt FROM referral_relationships WHERE referrer_id = ?', [userId]) as { cnt: string | number };
    const referralsCount = Number(countRow?.cnt || 0);

    const totalEarnedRow = await db.get("SELECT SUM(amount_usdt) as sum FROM reward_events WHERE referrer_id = ? AND status = 'CREDITED'", [userId]) as { sum: string | number | null };
    const totalEarned = Number(totalEarnedRow?.sum) || 0;

    const historyRows = await db.all('SELECT id, amount_usdt, created_at FROM reward_events WHERE referrer_id = ? ORDER BY created_at DESC', [userId]) as any[];

    const history = historyRows.map(r => ({
      transactionId: r.id,
      type: 'REFERRAL_REWARD',
      amount: r.amount_usdt,
      status: 'CREDITED',
      reference: 'Referral Reward ($30 USDT)',
      timestamp: r.created_at
    }));

    return {
      referralCode: user?.referral_code || '',
      totalEarned,
      referralsCount,
      pendingRewards: 0,
      rewardHistory: history
    };
  }
}
