import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID as uuidv4 } from 'crypto';
import { db } from '../database';
import { config } from '../config';

export class AuthService {

  static async register(email: string, passwordPlain: string, fullName: string, referralCodeInput?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existingUser) {
      throw new Error('An account with this email already exists.');
    }

    const userId = uuidv4();
    const walletId = uuidv4();
    const passwordHash = bcrypt.hashSync(passwordPlain, 10);
    const userReferralCode = 'CH' + Math.random().toString(36).substring(2, 8).toUpperCase();

    await db.transaction(async (client) => {
      await db.run(`
        INSERT INTO users (id, email, password_hash, full_name, referral_code, role)
        VALUES (?, ?, ?, ?, ?, 'USER')
      `, [userId, normalizedEmail, passwordHash, fullName, userReferralCode], client);

      await db.run(`
        INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro)
        VALUES (?, ?, 'USDT', 0, 0)
      `, [walletId, userId], client);

      if (referralCodeInput) {
        const referrer = await db.get('SELECT id FROM users WHERE referral_code = ?', [referralCodeInput.trim().toUpperCase()], client) as { id: string } | undefined;
        if (referrer && referrer.id !== userId) {
          await db.run(`
            INSERT INTO referral_relationships (id, referrer_id, referee_id, level)
            VALUES (?, ?, ?, 1)
          `, [uuidv4(), referrer.id, userId], client);

          const level1Referrer = await db.get('SELECT referrer_id FROM referral_relationships WHERE referee_id = ? AND level = 1', [referrer.id], client) as { referrer_id: string } | undefined;
          if (level1Referrer && level1Referrer.referrer_id !== userId) {
            await db.run(`
              INSERT INTO referral_relationships (id, referrer_id, referee_id, level)
              VALUES (?, ?, ?, 2)
            `, [uuidv4(), level1Referrer.referrer_id, userId], client);
          }
        }
      }
    });

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

  static async login(email: string, passwordPlain: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.get('SELECT id, password_hash, full_name, referral_code, role, is_suspended FROM users WHERE email = ?', [normalizedEmail]) as any;

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
