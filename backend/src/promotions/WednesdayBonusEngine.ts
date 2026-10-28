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

  static async processWednesdayBonus(userId: string, weekCodeInput?: string, forceDayCheck: boolean = true): Promise<BonusResult> {
    const currentDate = new Date();
    const dayOfWeek = currentDate.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

    // Rule: Must be Wednesday (day 3) unless explicitly in test mode with weekCodeInput supplied
    if (forceDayCheck && !weekCodeInput && dayOfWeek !== 3) {
      throw new Error('Wednesday promotional bonus is only available on Wednesdays (UTC).');
    }

    const weekCode = weekCodeInput || this.getIsoWeekCode(currentDate);
    const eventKey = `WED_BONUS_${weekCode}_${userId}`;

    const existing = await db.get('SELECT id, status, amount_usdt FROM wednesday_bonus_events WHERE event_key = ?', [eventKey]) as any;
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

    const campaign = await db.get('SELECT id, reward_amount_usdt, max_budget_usdt, spent_budget_usdt, is_active FROM wednesday_campaigns WHERE is_active = 1 LIMIT 1') as any;
    if (!campaign) {
      throw new Error('Wednesday promotional campaign is currently not active.');
    }

    const rewardAmount = campaign.reward_amount_usdt;
    if (Number(campaign.spent_budget_usdt) + rewardAmount > Number(campaign.max_budget_usdt)) {
      throw new Error('Wednesday promotional campaign budget limit reached.');
    }

    const userWallet = await db.get("SELECT id FROM wallets WHERE user_id = ? AND asset = 'USDT'", [userId]) as { id: string } | undefined;
    if (!userWallet) {
      throw new Error('User USDT wallet not found.');
    }

    const systemWallet = await LedgerService.getOrCreateSystemWallet();

    const amountMicro = Math.round(rewardAmount * 1_000_000);
    const eventId = uuidv4();

    const txId = await db.transaction(async (client) => {
      const ledgerTxId = await LedgerService.postTransaction(
        eventKey,
        'PROMOTIONAL_BONUS',
        `Wednesday Promotional Bonus (${weekCode})`,
        [
          { walletId: systemWallet.id, type: 'DEBIT', amountMicro },
          { walletId: userWallet.id, type: 'CREDIT', amountMicro }
        ]
      );

      await db.run(`
        INSERT INTO wednesday_bonus_events (id, event_key, user_id, campaign_id, amount_usdt, status, transaction_id)
        VALUES (?, ?, ?, ?, ?, 'CREDITED', ?)
      `, [eventId, eventKey, userId, campaign.id, rewardAmount, ledgerTxId], client);

      await db.run('UPDATE wednesday_campaigns SET spent_budget_usdt = spent_budget_usdt + ? WHERE id = ?',
        [rewardAmount, campaign.id], client);

      return ledgerTxId;
    });

    return {
      eventId,
      eventKey,
      userId,
      amountUsdt: rewardAmount,
      status: 'CREDITED',
      alreadyClaimed: false
    };
  }

  static async getUserBonuses(userId: string) {
    return await db.all('SELECT * FROM wednesday_bonus_events WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }
}
