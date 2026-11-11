import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:8nA76JiDn%40bwqXR@db.lwsybancxxqwrmxneyui.supabase.co:5432/postgres";

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 6000,
      keepAlive: true,
    });
    pool.on("error", (err) => {
      console.warn("[postgres] pool idle client warning:", err.message);
    });
  }
  return pool;
}

let initialized = false;

export async function ensureDatabaseSchema(): Promise<boolean> {
  if (initialized) return true;
  try {
    const client = await getPostgresPool().connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          kyc_status TEXT NOT NULL DEFAULT 'VERIFIED',
          referral_code TEXT UNIQUE NOT NULL,
          mfa_enabled INTEGER NOT NULL DEFAULT 0,
          role TEXT NOT NULL DEFAULT 'USER',
          is_suspended INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS wallets (
          id TEXT PRIMARY KEY,
          user_id TEXT UNIQUE NOT NULL,
          asset TEXT NOT NULL DEFAULT 'USDT',
          total_balance_micro BIGINT NOT NULL DEFAULT 5000000,
          reserved_balance_micro BIGINT NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ledger_transactions (
          id TEXT PRIMARY KEY,
          reference TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ledger_entries (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          wallet_id TEXT NOT NULL,
          entry_type TEXT NOT NULL,
          amount_micro BIGINT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(transaction_id) REFERENCES ledger_transactions(id) ON DELETE CASCADE,
          FOREIGN KEY(wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
        );

        DO $$
        BEGIN
          BEGIN
            ALTER TABLE users DISABLE ROW LEVEL SECURITY;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE ledger_transactions DISABLE ROW LEVEL SECURITY;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END $$;

        GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
      `);
      initialized = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[postgres] schema initialization skipped (running on REST/WAL):", (err as Error).message);
    return false;
  }
}

export interface PgUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  kyc_status: string;
  referral_code: string;
  role: string;
  created_at: string;
}

export async function pgFindUserByEmail(email: string): Promise<PgUser | null> {
  const norm = (email || "").trim().toLowerCase();
  if (!norm) return null;
  try {
    const client = await getPostgresPool().connect();
    try {
      const res = await client.query(
        "SELECT id, email, password_hash, full_name, kyc_status, referral_code, role, created_at FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [norm]
      );
      return res.rows[0] || null;
    } finally {
      client.release();
    }
  } catch {
    return null;
  }
}

export async function pgInsertUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role?: string;
  referralCode?: string;
}): Promise<boolean> {
  const norm = user.email.trim().toLowerCase();
  const refCode = user.referralCode || user.id.slice(0, 8);
  const role = user.role || "user";

  try {
    await ensureDatabaseSchema();
    const client = await getPostgresPool().connect();
    try {
      await client.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, referral_code, kyc_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'VERIFIED')
         ON CONFLICT (email) DO UPDATE 
         SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name`,
        [user.id, norm, user.passwordHash, user.fullName, role, refCode]
      );

      // Ensure wallet with $5.00 Welcome Registration Bonus (5,000,000 micro USDT)
      const walletId = `wal_${user.id.replace(/^usr_/, "")}`;
      await client.query(
        `INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro)
         VALUES ($1, $2, 'USDT', 5000000, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [walletId, user.id]
      );
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[postgres] pgInsertUser failed:", (err as Error).message);
    return false;
  }
}

export async function pgDeleteUser(idOrEmail: string): Promise<boolean> {
  const norm = idOrEmail.trim().toLowerCase();
  try {
    const client = await getPostgresPool().connect();
    try {
      await client.query(
        "DELETE FROM users WHERE id = $1 OR LOWER(email) = $2",
        [idOrEmail, norm]
      );
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}
