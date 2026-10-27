import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID as uuidv4 } from 'crypto';
import { db } from '../database';
import { config } from '../config';

export class AuthService {

  static register(email: string, passwordPlain: string, fullName: string, referralCodeInput?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      throw new Error('An account with this email already exists.');
    }

    const userId = uuidv4();
    const walletId = uuidv4();
    const passwordHash = bcrypt.hashSync(passwordPlain, 10);
    const userReferralCode = 'CH' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const registerTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, referral_code, role)
        VALUES (?, ?, ?, ?, ?, 'USER')
      `).run(userId, normalizedEmail, passwordHash, fullName, userReferralCode);

      db.prepare(`
        INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro)
        VALUES (?, ?, 'USDT', 0, 0)
      `).run(walletId, userId);

      if (referralCodeInput) {
        const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCodeInput.trim().toUpperCase()) as { id: string } | undefined;
        if (referrer && referrer.id !== userId) {
          db.prepare(`
            INSERT INTO referral_relationships (id, referrer_id, referee_id, level)
            VALUES (?, ?, ?, 1)
          `).run(uuidv4(), referrer.id, userId);

          const level1Referrer = db.prepare('SELECT referrer_id FROM referral_relationships WHERE referee_id = ? AND level = 1').get(referrer.id) as { referrer_id: string } | undefined;
          if (level1Referrer && level1Referrer.referrer_id !== userId) {
            db.prepare(`
              INSERT INTO referral_relationships (id, referrer_id, referee_id, level)
              VALUES (?, ?, ?, 2)
            `).run(uuidv4(), level1Referrer.referrer_id, userId);
          }
        }
      }
    });

    registerTx();

    const accessToken = jwt.sign({ userId, email: normalizedEmail, role: 'USER' }, config.jwtSecret, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ userId, type: 'refresh' }, config.jwtSecret, { expiresIn: '30d' });

    return {
      userId,
      email: normalizedEmail,
      fullName,
      referralCode: userReferralCode,
      accessToken,
      refreshToken
    };
  }

  static login(email: string, passwordPlain: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, password_hash, full_name, referral_code, role, is_suspended FROM users WHERE email = ?').get(normalizedEmail) as any;

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (user.is_suspended) {
      throw new Error('Account suspended. Please contact administrator support.');
    }

    const isValid = bcrypt.compareSync(passwordPlain, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    const accessToken = jwt.sign({ userId: user.id, email: normalizedEmail, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, config.jwtSecret, { expiresIn: '30d' });

    return {
      userId: user.id,
      email: normalizedEmail,
      fullName: user.full_name,
      referralCode: user.referral_code,
      accessToken,
      refreshToken
    };
  }
}
