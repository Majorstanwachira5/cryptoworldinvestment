import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { initDatabase, db } from './database';
import { AuthService } from './auth/AuthService';
import { PaperTradingEngine } from './trading/PaperTradingEngine';
import { BacktestingEngine } from './trading/BacktestingEngine';
import { WalletService } from './wallet/WalletService';
import { ReferralRewardsEngine } from './rewards/ReferralRewardsEngine';
import { P2PService } from './p2p/P2PService';
import { AdminService } from './admin/AdminService';
import { UserLevelsEngine } from './levels/UserLevelsEngine';
import { PaymentVerificationEngine } from './payments/PaymentVerificationEngine';
import { WednesdayBonusEngine } from './promotions/WednesdayBonusEngine';

initDatabase();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  jwt.verify(token, config.jwtSecret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.userId = user.userId;
    req.role = user.role;
    next();
  });
};

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Administrator privileges required' });
  }
  next();
};

// Healthcheck
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'CryptoHub AI Shared Backend', timestamp: new Date().toISOString() });
});

// --- AUTH ROUTES ---
app.post('/api/v1/auth/register', (req: Request, res: Response) => {
  try {
    const { email, password, fullName, referralCode } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const result = AuthService.register(email, password, fullName, referralCode);

    if (referralCode) {
      ReferralRewardsEngine.processReferralReward(result.userId);
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    const result = AuthService.login(email, password);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/users/me', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = db.prepare('SELECT id, email, full_name, kyc_status, referral_code, mfa_enabled, created_at FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const levelInfo = UserLevelsEngine.getUserLevel(req.userId!);

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        kycStatus: user.kyc_status,
        referralCode: user.referral_code,
        mfaEnabled: Boolean(user.mfa_enabled),
        userLevel: levelInfo.level,
        qualifyingVolumeUsdt: levelInfo.qualifyingVolumeUsdt,
        createdAt: user.created_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- USER LEVELS ROUTES ---
app.get('/api/v1/users/level', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const levelInfo = UserLevelsEngine.getUserLevel(req.userId!);
    res.json({ success: true, data: levelInfo });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- MARKETS ROUTES ---
app.get('/api/v1/markets/pairs', (req: Request, res: Response) => {
  try {
    const pairs = db.prepare('SELECT * FROM market_pairs').all() as any[];
    const data = pairs.map(p => ({
      symbol: p.symbol,
      baseAsset: p.base_asset,
      quoteAsset: p.quote_asset,
      lastPrice: p.last_price,
      change24h: p.change_24h,
      high24h: p.high_24h,
      low24h: p.low_24h,
      volume24h: p.volume_24h
    }));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/markets/candles', (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'BTC/USDT';
    const timeframe = (req.query.timeframe as string) || '1h';
    const candles = db.prepare('SELECT * FROM candlesticks WHERE symbol = ? AND timeframe = ? ORDER BY timestamp ASC LIMIT 100').all(symbol, timeframe) as any[];

    const data = candles.map(c => ({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- PAPER TRADING & BACKTESTING ROUTES ---
app.post('/api/v1/paper-trading/orders', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { symbol, type, side, amount, price } = req.body;
    const order = PaperTradingEngine.createOrder(req.userId!, symbol, type, side, amount, price);
    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/paper-trading/orders', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const symbol = req.query.symbol as string | undefined;
    const orders = PaperTradingEngine.getOrders(req.userId!, symbol);
    res.json({ success: true, data: orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/backtesting/run', (req: Request, res: Response) => {
  try {
    const { strategy, symbol, initialCapital, timeframe, days } = req.body;
    const result = BacktestingEngine.runBacktest({
      strategy: strategy || 'SMA_CROSS',
      symbol: symbol || 'BTC/USDT',
      initialCapital: initialCapital || 10000,
      timeframe: timeframe || '1h',
      days: days || 30
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- WALLET & LEDGER ROUTES ---
app.get('/api/v1/wallet/summary', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const summary = WalletService.getWalletSummary(req.userId!);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/wallet/transactions', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const txs = WalletService.getTransactions(req.userId!);
    res.json({ success: true, data: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- PAYMENTS & DEPOSITS ROUTES ---
app.get('/api/v1/deposits/address', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const addr = WalletService.getDepositAddress(req.userId!);
    res.json({ success: true, data: addr });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/deposits/request', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { amountUsdt } = req.body;
    const result = PaymentVerificationEngine.createPaymentRequest(req.userId!, amountUsdt || 100.0);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/deposits/webhook', (req: Request, res: Response) => {
  try {
    const { txHash, network, tokenContract, destinationAddress, amountUsdt, confirmations } = req.body;
    const result = PaymentVerificationEngine.processDepositNotification({
      txHash,
      network: network || 'TRC20',
      tokenContract: tokenContract || config.usdtTrc20ContractAddress,
      destinationAddress,
      amountUsdt: parseFloat(amountUsdt),
      confirmations: parseInt(confirmations, 10) || 12
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/deposits/history', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const history = PaymentVerificationEngine.getUserDeposits(req.userId!);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- WITHDRAWALS ROUTES ---
app.post('/api/v1/withdrawals/request', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { address, amount } = req.body;
    const tx = WalletService.requestWithdrawal(req.userId!, address, amount);
    res.json({ success: true, data: tx });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/withdrawals/history', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const history = WalletService.getWithdrawalRequests(req.userId!);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- WEDNESDAY PROMOTIONAL BONUS ROUTES ---
app.post('/api/v1/promotions/wednesday/claim', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const result = WednesdayBonusEngine.processWednesdayBonus(req.userId!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/promotions/wednesday/history', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const history = WednesdayBonusEngine.getUserBonuses(req.userId!);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- REWARDS ROUTES ---
app.get('/api/v1/rewards/summary', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const summary = ReferralRewardsEngine.getRewardsSummary(req.userId!);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- P2P ROUTES ---
app.get('/api/v1/p2p/ads', (req: Request, res: Response) => {
  try {
    const ads = P2PService.getAds();
    res.json({ success: true, data: ads });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/p2p/orders', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { adId, amount } = req.body;
    const order = P2PService.createOrder(req.userId!, adId, amount);
    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- ADMIN ROUTES ---
app.get('/api/v1/admin/overview', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const metrics = AdminService.getOverviewMetrics();
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/admin/users', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const users = AdminService.getUsers();
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/admin/users/status', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, suspend } = req.body;
    const result = AdminService.toggleUserStatus(req.userId!, targetUserId, suspend);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/admin/levels/audit', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const logs = UserLevelsEngine.getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/admin/withdrawals', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const requests = WalletService.getWithdrawalRequests();
    res.json({ success: true, data: requests });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/admin/withdrawals/approve', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const { withdrawalId, txHash } = req.body;
    const result = WalletService.approveAndExecuteWithdrawal(withdrawalId, req.userId!, txHash);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/admin/ledger', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const audit = AdminService.getLedgerAudit();
    res.json({ success: true, data: audit });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/admin/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    let admin = db.prepare('SELECT * FROM users WHERE email = ? AND role = "ADMIN"').get(email) as any;
    if (!admin && email === 'admin@cryptohub.ai' && password === 'AdminPass123!') {
      const adminId = 'ADMIN_PRIMARY';
      const userReferralCode = 'ADM001';
      db.prepare(`
        INSERT OR REPLACE INTO users (id, email, password_hash, full_name, referral_code, role)
        VALUES (?, ?, 'ADMIN_HASH', 'System Administrator', ?, 'ADMIN')
      `).run(adminId, email, userReferralCode);
      admin = { id: adminId, email, role: 'ADMIN' };
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const accessToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'ADMIN' }, config.jwtSecret, { expiresIn: '1d' });
    res.json({
      success: true,
      data: {
        userId: admin.id,
        email: admin.email,
        accessToken
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = config.port;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[CryptoHub AI Backend] Running on http://localhost:${PORT}`);
  });
}

export { app };
