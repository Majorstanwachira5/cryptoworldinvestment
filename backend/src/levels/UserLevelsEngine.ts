import { db, pool } from '../database';
import { PoolClient, Pool } from 'pg';
import { config } from '../config';
import { randomUUID as uuidv4 } from 'crypto';

export interface UserLevelInfo {
  userId: string;
  level: number;
  qualifyingVolumeUsdt: number;
  nextLevelThresholdUsdt: number | null;
  lastEvaluatedAt: string;
}

export class UserLevelsEngine {

  public static readonly RULE_VERSION = 'v1.0.0_cumulative_verified_deposits';

  static async evaluateUserLevel(userId: string, client: PoolClient | Pool = pool): Promise<UserLevelInfo> {
    const volRow = await db.get(`
      SELECT SUM(amount_usdt) as total_vol
      FROM deposit_verifications
      WHERE user_id = ? AND status = 'CREDITED'
    `, [userId], client) as { total_vol: string | number | null };

    const qualifyingVolumeUsdt = Number(volRow?.total_vol) || 0.0;

    let newLevel = 0;
    if (qualifyingVolumeUsdt >= config.level1ThresholdUsdt) {
      newLevel = 1;
    } else if (qualifyingVolumeUsdt >= config.level2ThresholdUsdt) {
      newLevel = 2;
    } else if (qualifyingVolumeUsdt >= config.level3ThresholdUsdt) {
      newLevel = 3;
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
      `, [userId, newLevel, qualifyingVolumeUsdt, nowIso], c);

      if (oldLevel !== newLevel || !existing) {
        const evidence = {
          userId,
          qualifyingVolumeUsdt,
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
        `, [uuidv4(), userId, oldLevel, newLevel, UserLevelsEngine.RULE_VERSION, JSON.stringify(evidence)], c);
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
    if (newLevel === 0) nextThreshold = config.level3ThresholdUsdt;
    else if (newLevel === 3) nextThreshold = config.level2ThresholdUsdt;
    else if (newLevel === 2) nextThreshold = config.level1ThresholdUsdt;

    return {
      userId,
      level: newLevel,
      qualifyingVolumeUsdt,
      nextLevelThresholdUsdt: nextThreshold,
      lastEvaluatedAt: nowIso
    };
  }

  static async getUserLevel(userId: string): Promise<UserLevelInfo> {
    const levelRecord = await db.get('SELECT level, qualifying_volume_usdt, last_evaluated_at FROM user_levels WHERE user_id = ?', [userId]) as any;
    if (!levelRecord) {
      return await this.evaluateUserLevel(userId);
    }
    return {
      userId,
      level: levelRecord.level,
      qualifyingVolumeUsdt: Number(levelRecord.qualifying_volume_usdt),
      nextLevelThresholdUsdt: levelRecord.level === 1 ? null : (levelRecord.level === 2 ? config.level1ThresholdUsdt : config.level3ThresholdUsdt),
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
