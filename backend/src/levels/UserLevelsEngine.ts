import { db, pool } from '../database';
import { PoolClient, Pool } from 'pg';
import { config } from '../config';
import { randomUUID as uuidv4 } from 'crypto';

export interface UserLevelInfo {
  userId: string;
  level: number;
  qualifyingVolumeUsdt: number;
  successfulReferralsCount: number;
  nextLevelThresholdUsdt: number | null;
  lastEvaluatedAt: string;
}

export class UserLevelsEngine {

  public static readonly RULE_VERSION = 'v2.0.0_cumulative_deposits_and_referral_promotions';

  static async evaluateUserLevel(userId: string, client: PoolClient | Pool = pool): Promise<UserLevelInfo> {
    // 1. Calculate cumulative confirmed deposit volume
    const volRow = await db.get(`
      SELECT SUM(amount_usdt) as total_vol
      FROM deposit_verifications
      WHERE user_id = ? AND status = 'CREDITED'
    `, [userId], client) as { total_vol: string | number | null };

    const qualifyingVolumeUsdt = Number(volRow?.total_vol) || 0.0;

    // 2. Count successful referrals (referees with at least one confirmed deposit)
    const refRow = await db.get(`
      SELECT COUNT(DISTINCT rr.referee_id) as cnt
      FROM referral_relationships rr
      JOIN deposit_verifications dv ON rr.referee_id = dv.user_id
      WHERE rr.referrer_id = ? AND dv.status = 'CREDITED'
    `, [userId], client) as { cnt: string | number | null };

    const successfulReferralsCount = Number(refRow?.cnt) || 0;

    // 3. Determine base level from deposit volume:
    // Level 3 threshold: ≥ $600
    // Level 2 threshold: ≥ $500
    // Level 1 threshold: ≥ $300 (entry level)
    let depositLevel = 0;
    if (qualifyingVolumeUsdt >= config.level3ThresholdUsdt) {
      depositLevel = 3;
    } else if (qualifyingVolumeUsdt >= config.level2ThresholdUsdt) {
      depositLevel = 2;
    } else if (qualifyingVolumeUsdt >= config.level1ThresholdUsdt) {
      depositLevel = 1;
    }

    // 4. Apply referral promotion rules:
    // Level 3 user (or Level 0) with > 10 successful referrals promotes to Level 2.
    // Level 3/2 user with > 20 successful referrals promotes to Level 1.
    let effectiveLevel = depositLevel;

    if (successfulReferralsCount > 20) {
      // >20 referrals promotes user to Level 1 regardless of deposit level
      effectiveLevel = 1;
    } else if (successfulReferralsCount > 10) {
      // >10 referrals promotes to Level 2 if base level is 3 or 0
      if (depositLevel === 3 || depositLevel === 0) {
        effectiveLevel = 2;
      }
    }

    const existing = await db.get('SELECT level FROM user_levels WHERE user_id = ?', [userId], client) as { level: number } | undefined;
    const oldLevel = existing ? existing.level : 0;

    const nowIso = new Date().toISOString();

    const runEval = async (c: PoolClient | Pool) => {
      await db.run(`
        INSERT INTO user_levels (user_id, level, qualifying_volume_usdt, last_evaluated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          level = excluded.level,
          qualifying_volume_usdt = excluded.qualifying_volume_usdt,
          last_evaluated_at = excluded.last_evaluated_at
      `, [userId, effectiveLevel, qualifyingVolumeUsdt, nowIso], c);

      if (oldLevel !== effectiveLevel || !existing) {
        const evidence = {
          userId,
          qualifyingVolumeUsdt,
          successfulReferralsCount,
          depositLevel,
          effectiveLevel,
          thresholds: {
            level1: config.level1ThresholdUsdt,
            level2: config.level2ThresholdUsdt,
            level3: config.level3ThresholdUsdt
          },
          timestamp: nowIso
        };

        await db.run(`
          INSERT INTO user_level_audit_logs (id, user_id, old_level, new_level, rule_version, evidence_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [uuidv4(), userId, oldLevel, effectiveLevel, UserLevelsEngine.RULE_VERSION, JSON.stringify(evidence)], c);
      }
    };

    if (client === pool) {
      await db.transaction(async (txClient) => {
        await runEval(txClient);
      });
    } else {
      await runEval(client);
    }

    let nextThreshold: number | null = null;
    if (effectiveLevel === 0) nextThreshold = config.level1ThresholdUsdt;
    else if (effectiveLevel === 1) nextThreshold = config.level2ThresholdUsdt;
    else if (effectiveLevel === 2) nextThreshold = config.level3ThresholdUsdt;

    return {
      userId,
      level: effectiveLevel,
      qualifyingVolumeUsdt,
      successfulReferralsCount,
      nextLevelThresholdUsdt: nextThreshold,
      lastEvaluatedAt: nowIso
    };
  }

  static async getUserLevel(userId: string): Promise<UserLevelInfo> {
    const levelRecord = await db.get('SELECT level, qualifying_volume_usdt, last_evaluated_at FROM user_levels WHERE user_id = ?', [userId]) as any;
    if (!levelRecord) {
      return await this.evaluateUserLevel(userId);
    }

    const refRow = await db.get(`
      SELECT COUNT(DISTINCT rr.referee_id) as cnt
      FROM referral_relationships rr
      JOIN deposit_verifications dv ON rr.referee_id = dv.user_id
      WHERE rr.referrer_id = ? AND dv.status = 'CREDITED'
    `, [userId]) as { cnt: string | number | null };

    const successfulReferralsCount = Number(refRow?.cnt) || 0;

    return {
      userId,
      level: levelRecord.level,
      qualifyingVolumeUsdt: Number(levelRecord.qualifying_volume_usdt),
      successfulReferralsCount,
      nextLevelThresholdUsdt: levelRecord.level === 0 ? config.level1ThresholdUsdt : (levelRecord.level === 1 ? config.level2ThresholdUsdt : (levelRecord.level === 2 ? config.level3ThresholdUsdt : null)),
      lastEvaluatedAt: levelRecord.last_evaluated_at
    };
  }

  static async getAuditLogs(userId?: string) {
    if (userId) {
      return await db.all('SELECT * FROM user_level_audit_logs WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }
    return await db.all('SELECT * FROM user_level_audit_logs ORDER BY created_at DESC LIMIT 100');
  }
}
