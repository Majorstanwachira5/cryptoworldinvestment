import { Pool, PoolClient } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 30000,
  keepAlive: true
});

function convertSql(sql: string): string {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 0 && (
      err.code === 'ECONNRESET' ||
      err.code === 'ENOTFOUND' ||
      err.code === 'EAI_AGAIN' ||
      err.code === '57P01' ||
      err.message?.includes('Connection terminated') ||
      err.message?.includes('timeout') ||
      err.message?.includes('closed') ||
      err.message?.includes('getaddrinfo')
    )) {
      await new Promise(r => setTimeout(r, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

export const db = {
  async query(text: string, params?: any[], client: PoolClient | Pool = pool) {
    return withRetry(() => client.query(text, params));
  },
  async get(sql: string, params: any[] = [], client: PoolClient | Pool = pool) {
    const pgSql = convertSql(sql);
    return withRetry(async () => {
      const res = await client.query(pgSql, params);
      return res.rows[0];
    });
  },
  async all(sql: string, params: any[] = [], client: PoolClient | Pool = pool) {
    const pgSql = convertSql(sql);
    return withRetry(async () => {
      const res = await client.query(pgSql, params);
      return res.rows;
    });
  },
  async run(sql: string, params: any[] = [], client: PoolClient | Pool = pool) {
    const pgSql = convertSql(sql);
    return withRetry(async () => {
      const res = await client.query(pgSql, params);
      return { rowCount: res.rowCount, rows: res.rows };
    });
  },
  async transaction<T>(callback: (client: PoolClient) => Promise<T>, retries = 3): Promise<T> {
    let client: PoolClient | null = null;
    try {
      client = await withRetry(() => pool.connect());
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err: any) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        client.release(true); // Destroy broken connection
        client = null;
      }
      if (retries > 0 && (
        err.code === 'ECONNRESET' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'EAI_AGAIN' ||
        err.code === '57P01' ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('timeout') ||
        err.message?.includes('closed') ||
        err.message?.includes('read')
      )) {
        await new Promise(r => setTimeout(r, 500));
        return this.transaction(callback, retries - 1);
      }
      throw err;
    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

export async function initDatabase() {
  const client = await withRetry(() => pool.connect());
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
        total_balance_micro BIGINT NOT NULL DEFAULT 0,
        reserved_balance_micro BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
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
        FOREIGN KEY(transaction_id) REFERENCES ledger_transactions(id),
        FOREIGN KEY(wallet_id) REFERENCES wallets(id)
      );

      CREATE TABLE IF NOT EXISTS market_pairs (
        symbol TEXT PRIMARY KEY,
        base_asset TEXT NOT NULL,
        quote_asset TEXT NOT NULL,
        last_price DOUBLE PRECISION NOT NULL,
        change_24h DOUBLE PRECISION NOT NULL,
        high_24h DOUBLE PRECISION NOT NULL,
        low_24h DOUBLE PRECISION NOT NULL,
        volume_24h DOUBLE PRECISION NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS candlesticks (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        open DOUBLE PRECISION NOT NULL,
        high DOUBLE PRECISION NOT NULL,
        low DOUBLE PRECISION NOT NULL,
        close DOUBLE PRECISION NOT NULL,
        volume DOUBLE PRECISION NOT NULL,
        UNIQUE(symbol, timeframe, timestamp)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        side TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        filled_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS referral_relationships (
        id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        referee_id TEXT UNIQUE NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(referrer_id) REFERENCES users(id),
        FOREIGN KEY(referee_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reward_events (
        id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        referee_id TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        amount_usdt DOUBLE PRECISION NOT NULL DEFAULT 30.0,
        status TEXT NOT NULL DEFAULT 'CREDITED',
        transaction_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(referrer_id, referee_id),
        FOREIGN KEY(referrer_id) REFERENCES users(id),
        FOREIGN KEY(referee_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS auto_trade_runs (
        id TEXT PRIMARY KEY,
        run_date TEXT NOT NULL,
        user_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        amount_usdt DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'CREDITED',
        transaction_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(run_date, user_id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS p2p_ads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        merchant_name TEXT NOT NULL,
        type TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        fiat_currency TEXT NOT NULL,
        available_amount DOUBLE PRECISION NOT NULL,
        min_limit DOUBLE PRECISION NOT NULL,
        max_limit DOUBLE PRECISION NOT NULL,
        payment_methods TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS p2p_orders (
        id TEXT PRIMARY KEY,
        ad_id TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        amount_usdt DOUBLE PRECISION NOT NULL,
        fiat_amount DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_levels (
        user_id TEXT PRIMARY KEY,
        level INTEGER NOT NULL DEFAULT 0,
        qualifying_volume_usdt DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        last_evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_level_audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        old_level INTEGER NOT NULL,
        new_level INTEGER NOT NULL,
        rule_version TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS deposit_verifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        payment_request_id TEXT UNIQUE NOT NULL,
        network TEXT NOT NULL DEFAULT 'TRC20',
        token_contract TEXT NOT NULL DEFAULT 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        destination_address TEXT NOT NULL,
        amount_usdt DOUBLE PRECISION NOT NULL,
        tx_hash TEXT UNIQUE,
        confirmations INTEGER NOT NULL DEFAULT 0,
        required_confirmations INTEGER NOT NULL DEFAULT 12,
        status TEXT NOT NULL DEFAULT 'PAYMENT_REQUESTED',
        reconciliation_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS wednesday_campaigns (
        id TEXT PRIMARY KEY,
        campaign_code TEXT UNIQUE NOT NULL,
        reward_amount_usdt DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        max_budget_usdt DOUBLE PRECISION NOT NULL DEFAULT 10000.0,
        spent_budget_usdt DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO wednesday_campaigns (id, campaign_code, reward_amount_usdt, max_budget_usdt, spent_budget_usdt, start_date, end_date, is_active)
      VALUES ('CAMPAIGN_DEFAULT', '2026-W43', 1.0, 10000.0, 0.0, '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', 1)
      ON CONFLICT (campaign_code) DO NOTHING;

      CREATE TABLE IF NOT EXISTS wednesday_bonus_events (
        id TEXT PRIMARY KEY,
        event_key TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        amount_usdt DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'CREDITED',
        transaction_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(campaign_id) REFERENCES wednesday_campaigns(id)
      );

      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        destination_address TEXT NOT NULL,
        network TEXT NOT NULL DEFAULT 'TRC20',
        amount_usdt DOUBLE PRECISION NOT NULL,
        fee_usdt DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        net_receive_usdt DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
        risk_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        tx_hash TEXT,
        reconciliation_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS paylor_payments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        reference TEXT UNIQUE NOT NULL,
        rail TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KES',
        status TEXT NOT NULL DEFAULT 'PENDING',
        provider_response TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS paylor_webhook_events (
        event_id TEXT PRIMARY KEY,
        reference TEXT NOT NULL,
        status TEXT NOT NULL,
        raw_payload TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure System Treasury & Genesis Reserve users and wallets exist
    await client.query("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES ('SYSTEM_TREASURY', 'system@cryptohub.ai', 'HASH', 'System Treasury', 'SYS123', 'ADMIN') ON CONFLICT (id) DO NOTHING");
    await client.query("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES ('GENESIS_RESERVE', 'genesis@cryptohub.ai', 'HASH', 'Genesis Reserve', 'GEN123', 'ADMIN') ON CONFLICT (id) DO NOTHING");

    await client.query("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES ('SYSTEM_TREASURY_WALLET', 'SYSTEM_TREASURY', 'USDT', 0, 0) ON CONFLICT (id) DO NOTHING");
    await client.query("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES ('GENESIS_RESERVE_WALLET', 'GENESIS_RESERVE', 'USDT', 0, 0) ON CONFLICT (id) DO NOTHING");

    // Ensure genesis capital allocation transaction exists in ledger_transactions
    const genesisTxRes = await client.query("SELECT id FROM ledger_transactions WHERE reference = 'GENESIS_CAPITAL_ALLOCATION'");
    if (genesisTxRes.rowCount === 0) {
      const initialMicro = '1000000000000'; // 1,000,000 USDT capital reserve
      const txId = 'GENESIS_TX_001';
      await client.query("INSERT INTO ledger_transactions (id, reference, type, description) VALUES ($1, 'GENESIS_CAPITAL_ALLOCATION', 'GENESIS', 'Genesis Capital Reserve Allocation')", [txId]);
      await client.query("INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount_micro) VALUES ('GEN_ENTRY_1', $1, 'GENESIS_RESERVE_WALLET', 'DEBIT', $2)", [txId, initialMicro]);
      await client.query("INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount_micro) VALUES ('GEN_ENTRY_2', $1, 'SYSTEM_TREASURY_WALLET', 'CREDIT', $2)", [txId, initialMicro]);
    }

    // Reconcile wallet balances with SUM(ledger_entries) for system wallets
    await client.query(`
      UPDATE wallets w
      SET total_balance_micro = COALESCE((
        SELECT SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_micro ELSE -le.amount_micro END)
        FROM ledger_entries le
        WHERE le.wallet_id = w.id
      ), 0)
      WHERE w.id IN ('SYSTEM_TREASURY_WALLET', 'GENESIS_RESERVE_WALLET')
    `);

  } finally {
    client.release();
  }
}
