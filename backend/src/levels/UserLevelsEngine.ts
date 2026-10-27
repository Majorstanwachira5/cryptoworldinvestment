import { db } from '../database';
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

  static evaluateUserLevel(userId: string): UserLevelInfo {
    const volRow = db.prepare(`
      SELECT SUM(amount_usdt) as total_vol
      FROM deposit_verifications
      WHERE user_id = ? AND status = 'CREDITED'
    `).get(userId) as { total_vol: number | null };

    const qualifyingVolumeUsdt = volRow.total_vol || 0.0;

    let newLevel = 0;
    if (qualifyingVolumeUsdt >= config.level1ThresholdUsdt) {
      newLevel = 1;
    } else if (qualifyingVolumeUsdt >= config.level2ThresholdUsdt) {
      newLevel = 2;
    } else if (qualifyingVolumeUsdt >= config.level3ThresholdUsdt) {
      newLevel = 3;
    }

    const existing = db.prepare('SELECT level FROM user_levels WHERE user_id = ?').get(userId) as { level: number } | undefined;
    const oldLevel = existing ? existing.level : 0;

    const nowIso = new Date().toISOString();

    const evaluateTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO user_levels (user_id, level, qualifying_volume_usdt, last_evaluated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          level = excluded.level,
          qualifying_volume_usdt = excluded.qualifying_volume_usdt,
          last_evaluated_at = excluded.last_evaluated_at
      `).run(userId, newLevel, qualifyingVolumeUsdt, nowIso);

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

        db.prepare(`
          INSERT INTO user_level_audit_logs (id, user_id, old_level, new_level, rule_version, evidence_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), userId, oldLevel, newLevel, UserLevelsEngine.RULE_VERSION, JSON.stringify(evidence));
      }
    });

    evaluateTx();

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

  static getUserLevel(userId: string): UserLevelInfo {
    const levelRecord = db.prepare('SELECT level, qualifying_volume_usdt, last_evaluated_at FROM user_levels WHERE user_id = ?').get(userId) as any;
    if (!levelRecord) {
      return this.evaluateUserLevel(userId);
    }
    return {
      userId,
      level: levelRecord.level,
      qualifyingVolumeUsdt: levelRecord.qualifying_volume_usdt,
      nextLevelThresholdUsdt: levelRecord.level === 1 ? null : (levelRecord.level === 2 ? config.level1ThresholdUsdt : config.level3ThresholdUsdt),
      lastEvaluatedAt: levelRecord.last_evaluated_at
    };
  }

  static getAuditLogs(userId?: string) {
    if (userId) {
      return db.prepare('SELECT * FROM user_level_audit_logs WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    }
    return db.prepare('SELECT * FROM user_level_audit_logs ORDER BY created_at DESC LIMIT 100').all();
  }
}
