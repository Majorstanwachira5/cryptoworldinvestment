import { db } from '../database';
import { LedgerService } from '../ledger/LedgerService';
import { randomUUID as uuidv4 } from 'crypto';

export interface BonusResult {
  eventId: string;
  eventKey: string;
  userId: string;
  amountUsdt: number;
  status: string;
  alreadyClaimed?: boolean;
}

export class WednesdayBonusEngine {

  public static getIsoWeekCode(date: Date = new Date()): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }

  static processWednesdayBonus(userId: string, weekCodeInput?: string): BonusResult {
    const weekCode = weekCodeInput || this.getIsoWeekCode();
    const eventKey = `WED_BONUS_${weekCode}_${userId}`;

    const existing = db.prepare('SELECT id, status, amount_usdt FROM wednesday_bonus_events WHERE event_key = ?').get(eventKey) as any;
    if (existing) {
      return {
        eventId: existing.id,
        eventKey,
        userId,
        amountUsdt: existing.amount_usdt,
        status: existing.status,
        alreadyClaimed: true
      };
    }

    const campaign = db.prepare('SELECT id, reward_amount_usdt, max_budget_usdt, spent_budget_usdt, is_active FROM wednesday_campaigns WHERE is_active = 1 LIMIT 1').get() as any;
    if (!campaign) {
      throw new Error('Wednesday promotional campaign is currently not active.');
    }

    const rewardAmount = campaign.reward_amount_usdt;
    if (campaign.spent_budget_usdt + rewardAmount > campaign.max_budget_usdt) {
      throw new Error('Wednesday promotional campaign budget limit reached.');
    }

    const userWallet = db.prepare('SELECT id FROM wallets WHERE user_id = ? AND asset = "USDT"').get(userId) as { id: string } | undefined;
    if (!userWallet) {
      throw new Error('User USDT wallet not found.');
    }

    const systemWallet = LedgerService.getOrCreateSystemWallet();

    const amountMicro = Math.round(rewardAmount * 1_000_000);
    const eventId = uuidv4();

    const bonusTx = db.transaction(() => {
      const txId = LedgerService.postTransaction(
        eventKey,
        'PROMOTIONAL_BONUS',
        `Wednesday Promotional Bonus (${weekCode})`,
        [
          { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
          { walletId: userWallet.id, type: 'CREDIT', amountMicro }
        ]
      );

      db.prepare(`
        INSERT INTO wednesday_bonus_events (id, event_key, user_id, campaign_id, amount_usdt, status, transaction_id)
        VALUES (?, ?, ?, ?, ?, 'CREDITED', ?)
      `).run(eventId, eventKey, userId, campaign.id, rewardAmount, txId);

      db.prepare('UPDATE wednesday_campaigns SET spent_budget_usdt = spent_budget_usdt + ? WHERE id = ?')
        .run(rewardAmount, campaign.id);

      return txId;
    });

    bonusTx();

    return {
      eventId,
      eventKey,
      userId,
      amountUsdt: rewardAmount,
      status: 'CREDITED',
      alreadyClaimed: false
    };
  }

  static getUserBonuses(userId: string) {
    return db.prepare('SELECT * FROM wednesday_bonus_events WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  }
}
