import Database from 'better-sqlite3';
import { config } from './config';

export const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      asset TEXT NOT NULL DEFAULT 'USDT',
      total_balance_micro INTEGER NOT NULL DEFAULT 0,
      reserved_balance_micro INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      wallet_id TEXT NOT NULL,
      entry_type TEXT NOT NULL, -- 'DEBIT' or 'CREDIT'
      amount_micro INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(transaction_id) REFERENCES ledger_transactions(id),
      FOREIGN KEY(wallet_id) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS market_pairs (
      symbol TEXT PRIMARY KEY,
      base_asset TEXT NOT NULL,
      quote_asset TEXT NOT NULL,
      last_price REAL NOT NULL,
      change_24h REAL NOT NULL,
      high_24h REAL NOT NULL,
      low_24h REAL NOT NULL,
      volume_24h REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS candlesticks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      UNIQUE(symbol, timeframe, timestamp)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL, -- 'MARKET' or 'LIMIT'
      side TEXT NOT NULL, -- 'BUY' or 'SELL'
      price REAL NOT NULL,
      amount REAL NOT NULL,
      filled_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'FILLED', 'CANCELLED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS referral_relationships (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referee_id TEXT UNIQUE NOT NULL,
      level INTEGER NOT NULL, -- 1 for direct, 2 for second-level
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(referrer_id) REFERENCES users(id),
      FOREIGN KEY(referee_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reward_events (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referee_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      amount_usdt REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'CREDITED',
      transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(referrer_id) REFERENCES users(id),
      FOREIGN KEY(referee_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS p2p_ads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'BUY' or 'SELL'
      price REAL NOT NULL,
      fiat_currency TEXT NOT NULL,
      available_amount REAL NOT NULL,
      min_limit REAL NOT NULL,
      max_limit REAL NOT NULL,
      payment_methods TEXT NOT NULL, -- JSON array
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS p2p_orders (
      id TEXT PRIMARY KEY,
      ad_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      amount_usdt REAL NOT NULL,
      fiat_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'COMPLETED', 'DISPUTED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- USER LEVELS SCHEMAS
    CREATE TABLE IF NOT EXISTS user_levels (
      user_id TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 0,
      qualifying_volume_usdt REAL NOT NULL DEFAULT 0.0,
      last_evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_level_audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      old_level INTEGER NOT NULL,
      new_level INTEGER NOT NULL,
      rule_version TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- DEPOSIT VERIFICATIONS LIFECYCLE
    CREATE TABLE IF NOT EXISTS deposit_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payment_request_id TEXT UNIQUE NOT NULL,
      network TEXT NOT NULL DEFAULT 'TRC20',
      token_contract TEXT NOT NULL DEFAULT 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      destination_address TEXT NOT NULL,
      amount_usdt REAL NOT NULL,
      tx_hash TEXT UNIQUE,
      confirmations INTEGER NOT NULL DEFAULT 0,
      required_confirmations INTEGER NOT NULL DEFAULT 12,
      status TEXT NOT NULL DEFAULT 'PAYMENT_REQUESTED',
      reconciliation_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- WEDNESDAY PROMOTIONAL CAMPAIGN
    CREATE TABLE IF NOT EXISTS wednesday_campaigns (
      id TEXT PRIMARY KEY,
      campaign_code TEXT UNIQUE NOT NULL,
      reward_amount_usdt REAL NOT NULL DEFAULT 1.0,
      max_budget_usdt REAL NOT NULL DEFAULT 10000.0,
      spent_budget_usdt REAL NOT NULL DEFAULT 0.0,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wednesday_bonus_events (
      id TEXT PRIMARY KEY,
      event_key TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      amount_usdt REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'CREDITED',
      transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(campaign_id) REFERENCES wednesday_campaigns(id)
    );

    -- WITHDRAWALS WORKFLOW
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      destination_address TEXT NOT NULL,
      network TEXT NOT NULL DEFAULT 'TRC20',
      amount_usdt REAL NOT NULL,
      fee_usdt REAL NOT NULL DEFAULT 1.0,
      net_receive_usdt REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      risk_score REAL NOT NULL DEFAULT 0.0,
      tx_hash TEXT,
      reconciliation_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  seedInitialMarketData();
  seedInitialWednesdayCampaign();
}

function seedInitialMarketData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM market_pairs').get() as { count: number };
  if (count.count === 0) {
    const pairs = [
      { symbol: 'BTC/USDT', base_asset: 'BTC', quote_asset: 'USDT', last_price: 67420.50, change_24h: 3.45, high_24h: 68100.00, low_24h: 65200.00, volume_24h: 1245000000.0 },
      { symbol: 'ETH/USDT', base_asset: 'ETH', quote_asset: 'USDT', last_price: 3512.80, change_24h: -1.20, high_24h: 3600.00, low_24h: 3450.00, volume_24h: 780000000.0 },
      { symbol: 'SOL/USDT', base_asset: 'SOL', quote_asset: 'USDT', last_price: 178.40, change_24h: 8.95, high_24h: 182.00, low_24h: 162.50, volume_24h: 420000000.0 },
      { symbol: 'BNB/USDT', base_asset: 'BNB', quote_asset: 'USDT', last_price: 592.10, change_24h: 0.85, high_24h: 601.00, low_24h: 585.00, volume_24h: 190000000.0 },
      { symbol: 'XRP/USDT', base_asset: 'XRP', quote_asset: 'USDT', last_price: 0.548, change_24h: 2.10, high_24h: 0.565, low_24h: 0.532, volume_24h: 110000000.0 }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO market_pairs (symbol, base_asset, quote_asset, last_price, change_24h, high_24h, low_24h, volume_24h)
      VALUES (@symbol, @base_asset, @quote_asset, @last_price, @change_24h, @high_24h, @low_24h, @volume_24h)
    `);

    for (const p of pairs) {
      insertStmt.run(p);
    }

    const candleStmt = db.prepare(`
      INSERT OR IGNORE INTO candlesticks (symbol, timeframe, timestamp, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    let basePrice = 67000.0;
    for (let i = 48; i >= 0; i--) {
      const ts = now - i * 3600 * 1000;
      const variation = (Math.sin(i) * 300) + ((Math.random() - 0.48) * 200);
      const open = basePrice;
      const close = basePrice + variation;
      const high = Math.max(open, close) + Math.random() * 150;
      const low = Math.min(open, close) - Math.random() * 150;
      const vol = 1000 + Math.random() * 5000;
      candleStmt.run('BTC/USDT', '1h', ts, open, high, low, close, vol);
      basePrice = close;
    }
  }
}

function seedInitialWednesdayCampaign() {
  const count = db.prepare('SELECT COUNT(*) as count FROM wednesday_campaigns').get() as { count: number };
  if (count.count === 0) {
    db.prepare(`
      INSERT INTO wednesday_campaigns (id, campaign_code, reward_amount_usdt, max_budget_usdt, spent_budget_usdt, start_date, end_date, is_active)
      VALUES ('WED_CAMPAIGN_PRIMARY', 'WED_PROMO_2026', 1.0, 10000.0, 0.0, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1)
    `).run();
  }
}
