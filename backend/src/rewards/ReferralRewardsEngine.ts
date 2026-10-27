import { db } from '../database';
import { LedgerService } from '../ledger/LedgerService';
import { config } from '../config';
import { randomUUID as uuidv4 } from 'crypto';

export class ReferralRewardsEngine {

  static processReferralReward(refereeId: string) {
    const relationships = db.prepare(`
      SELECT * FROM referral_relationships WHERE referee_id = ?
    `).all(refereeId) as any[];

    const results = [];

    for (const rel of relationships) {
      const rewardAmountUsdt = rel.level === 1
        ? config.referralLevel1RewardUsdt
        : config.referralLevel2RewardUsdt;

      const rewardReference = `REF_REWARD_L${rel.level}_${rel.referrer_id}_${refereeId}`;

      const existingEvent = db.prepare('SELECT id FROM reward_events WHERE referrer_id = ? AND referee_id = ? AND level = ?').get(rel.referrer_id, refereeId, rel.level);
      if (existingEvent) {
        continue;
      }

      const rewardId = uuidv4();
      const amountMicro = Math.round(rewardAmountUsdt * 1_000_000);

      const referrerWallet = db.prepare('SELECT id FROM wallets WHERE user_id = ? AND asset = "USDT"').get(rel.referrer_id) as { id: string } | undefined;
      if (!referrerWallet) continue;

      const systemWallet = LedgerService.getOrCreateSystemWallet();

      const txId = LedgerService.postTransaction(
        rewardReference,
        'REFERRAL_REWARD',
        `Referral Reward Level ${rel.level} ($${rewardAmountUsdt} USDT)`,
        [
          { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
          { walletId: referrerWallet.id, type: 'CREDIT', amountMicro }
        ]
      );

      db.prepare(`
        INSERT INTO reward_events (id, referrer_id, referee_id, level, amount_usdt, status, transaction_id)
        VALUES (?, ?, ?, ?, ?, 'CREDITED', ?)
      `).run(rewardId, rel.referrer_id, refereeId, rel.level, rewardAmountUsdt, txId);

      results.push({
        rewardId,
        referrerId: rel.referrer_id,
        level: rel.level,
        amountUsdt: rewardAmountUsdt,
        transactionId: txId
      });
    }

    return results;
  }

  static getRewardsSummary(userId: string) {
    const user = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId) as { referral_code: string } | undefined;

    const level1Count = (db.prepare('SELECT COUNT(*) as cnt FROM referral_relationships WHERE referrer_id = ? AND level = 1').get(userId) as { cnt: number }).cnt;
    const level2Count = (db.prepare('SELECT COUNT(*) as cnt FROM referral_relationships WHERE referrer_id = ? AND level = 2').get(userId) as { cnt: number }).cnt;

    const totalEarnedRow = db.prepare('SELECT SUM(amount_usdt) as sum FROM reward_events WHERE referrer_id = ? AND status = "CREDITED"').get(userId) as { sum: number | null };
    const totalEarned = totalEarnedRow.sum || 0;

    const historyRows = db.prepare('SELECT id, amount_usdt, level, created_at FROM reward_events WHERE referrer_id = ? ORDER BY created_at DESC').all(userId) as any[];

    const history = historyRows.map(r => ({
      transactionId: r.id,
      type: `REFERRAL_L${r.level}`,
      amount: r.amount_usdt,
      status: 'CREDITED',
      reference: `Referral Level ${r.level} Reward`,
      timestamp: r.created_at
    }));

    return {
      referralCode: user?.referral_code || '',
      totalEarned,
      level1ReferralsCount: level1Count,
      level2ReferralsCount: level2Count,
      pendingRewards: 0,
      rewardHistory: history
    };
  }
}
