-- =====================================================================
-- CRYPTOHUB AI - SUPABASE POSTGRESQL PRODUCTION SCHEMA (REAL-ONLY)
-- Strictly Live Real Capital, TRC20 USDT Vault, Double-Entry Ledger
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'viewer', 'support', 'admin', 'super_admin')),
    referral_code TEXT UNIQUE NOT NULL,
    btc_address TEXT,
    eth_address TEXT,
    usdt_address TEXT DEFAULT 'TEbs6th1rgsrZNiYqdZEHGoJ3FJFA1zGYd',
    risk_tolerance_percent NUMERIC(5,2) DEFAULT 2.00,
    has_completed_risk_quiz BOOLEAN DEFAULT TRUE,
    kyc_status TEXT DEFAULT 'UNVERIFIED' CHECK (kyc_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. BALANCES TABLE (Strictly REAL Accounts Only)
CREATE TABLE IF NOT EXISTS public.balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_type TEXT NOT NULL DEFAULT 'REAL' CHECK (account_type IN ('REAL')),
    currency TEXT DEFAULT 'USDT',
    available_balance NUMERIC(18,2) DEFAULT 0.00,
    equity NUMERIC(18,2) DEFAULT 0.00,
    margin_used NUMERIC(18,2) DEFAULT 0.00,
    free_margin NUMERIC(18,2) DEFAULT 0.00,
    margin_level_pct NUMERIC(10,2) DEFAULT 9999.00,
    total_deposited NUMERIC(18,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, account_type)
);

-- 3. TRADES & POSITIONS TABLE (Strictly REAL Execution)
CREATE TABLE IF NOT EXISTS public.trades (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_type TEXT NOT NULL DEFAULT 'REAL' CHECK (account_type IN ('REAL')),
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('CRYPTO', 'FOREX')),
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    order_type TEXT DEFAULT 'MARKET' CHECK (order_type IN ('MARKET', 'LIMIT')),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    entry_price NUMERIC(18,6) NOT NULL,
    exit_price NUMERIC(18,6),
    current_price NUMERIC(18,6) NOT NULL,
    size NUMERIC(18,6) NOT NULL,
    leverage INTEGER DEFAULT 1,
    margin NUMERIC(18,2) NOT NULL,
    stop_loss NUMERIC(18,6),
    take_profit NUMERIC(18,6),
    liquidation_price NUMERIC(18,6),
    pnl NUMERIC(18,2) DEFAULT 0.00,
    pips NUMERIC(12,2) DEFAULT 0.00,
    rationale TEXT,
    is_backtest BOOLEAN DEFAULT FALSE,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 4. DOUBLE-ENTRY LEDGER TRANSACTIONS TABLE (Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_type TEXT NOT NULL DEFAULT 'REAL' CHECK (account_type IN ('REAL')),
    type TEXT NOT NULL CHECK (
        type IN (
            'DEPOSIT',
            'WITHDRAWAL',
            'TRADE_PROFIT',
            'TRADE_LOSS',
            'COMMISSION_FEE',
            'REFERRAL_BONUS',
            'AUTO_TRADE_EARNING',
            'WEDNESDAY_BONUS',
            'ADJUSTMENT'
        )
    ),
    amount NUMERIC(18,2) NOT NULL,
    currency TEXT DEFAULT 'USDT',
    balance_after NUMERIC(18,2) NOT NULL,
    tx_hash TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TRC20 DEPOSITS TABLE
CREATE TABLE IF NOT EXISTS public.trc20_deposits (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    tx_hash TEXT UNIQUE NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    contract_address TEXT NOT NULL DEFAULT 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    confirmations INTEGER NOT NULL DEFAULT 0,
    required_confirmations INTEGER NOT NULL DEFAULT 19,
    state TEXT NOT NULL CHECK (
        state IN ('DETECTED', 'CONFIRMING', 'CONFIRMED', 'CREDITED', 'FAILED', 'REJECTED', 'MANUAL_REVIEW')
    ),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    credited_at TIMESTAMP WITH TIME ZONE,
    idempotency_key TEXT UNIQUE NOT NULL,
    failure_reason TEXT
);

-- 6. WITHDRAWALS TABLE ($100.00 Minimum Server-Enforced)
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    asset TEXT NOT NULL DEFAULT 'USDT',
    network TEXT NOT NULL DEFAULT 'TRC20',
    destination_address TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount >= 100.00),
    fee NUMERIC(18,2) NOT NULL DEFAULT 1.00,
    total_reserved NUMERIC(18,2) NOT NULL,
    state TEXT NOT NULL CHECK (
        state IN (
            'REQUESTED',
            'REVIEW_PENDING',
            'APPROVED',
            'PROCESSING',
            'BROADCAST',
            'CONFIRMING',
            'COMPLETED',
            'REJECTED',
            'CANCELLED',
            'FAILED',
            'MANUAL_REVIEW'
        )
    ),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    tx_hash TEXT,
    rejected_reason TEXT,
    idempotency_key TEXT UNIQUE NOT NULL
);

-- 7. AI PREDICTIONS & SIGNALS TABLE
CREATE TABLE IF NOT EXISTS public.predictions (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('CRYPTO', 'FOREX')),
    timeframe TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    entry_price NUMERIC(18,6) NOT NULL,
    take_profit NUMERIC(18,6) NOT NULL,
    stop_loss NUMERIC(18,6) NOT NULL,
    risk_reward_ratio TEXT NOT NULL,
    win_rate_estimate TEXT NOT NULL,
    indicators JSONB NOT NULL,
    rationale TEXT NOT NULL,
    is_backtest BOOLEAN DEFAULT FALSE,
    historical_date TEXT,
    backtest_outcome TEXT CHECK (backtest_outcome IN ('WIN', 'LOSS')),
    is_admin_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. REFERRALS TABLE ($30.00 Direct Reward to REAL Account)
CREATE TABLE IF NOT EXISTS public.referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    referrer_email TEXT NOT NULL,
    code TEXT NOT NULL,
    referred_email TEXT NOT NULL,
    referred_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUALIFIED' CHECK (status IN ('PENDING', 'QUALIFIED')),
    reward_usd NUMERIC(18,2) NOT NULL DEFAULT 30.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (referrer_id, referred_email)
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILED', 'REJECTED')),
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_trades_user_account ON public.trades(user_id, account_type, status);
CREATE INDEX IF NOT EXISTS idx_ledger_user_account ON public.ledger_entries(user_id, account_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON public.trc20_deposits(user_id, state);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id, state);
CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON public.predictions(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON public.audit_logs(timestamp DESC);
