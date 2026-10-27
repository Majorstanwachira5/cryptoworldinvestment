import { db } from '../database';
import { randomUUID as uuidv4 } from 'crypto';

export class PaperTradingEngine {

  static createOrder(userId: string, symbol: string, type: 'MARKET' | 'LIMIT', side: 'BUY' | 'SELL', amount: number, limitPrice?: number) {
    if (amount <= 0) {
      throw new Error('Order amount must be greater than zero.');
    }

    const pair = db.prepare('SELECT last_price FROM market_pairs WHERE symbol = ?').get(symbol) as { last_price: number } | undefined;
    if (!pair) {
      throw new Error(`Market pair ${symbol} not found.`);
    }

    const executionPrice = type === 'MARKET' ? pair.last_price : (limitPrice || pair.last_price);
    const orderId = uuidv4();
    const status = type === 'MARKET' ? 'FILLED' : 'OPEN';
    const filledAmount = type === 'MARKET' ? amount : 0;

    db.prepare(`
      INSERT INTO orders (id, user_id, symbol, type, side, price, amount, filled_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, userId, symbol, type, side, executionPrice, amount, filledAmount, status);

    return {
      orderId,
      userId,
      symbol,
      type,
      side,
      price: executionPrice,
      amount,
      filledAmount,
      status,
      createdAt: new Date().toISOString()
    };
  }

  static getOrders(userId: string, symbol?: string) {
    let query = 'SELECT * FROM orders WHERE user_id = ?';
    const params: any[] = [userId];

    if (symbol) {
      query += ' AND symbol = ?';
      params.push(symbol);
    }

    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      orderId: r.id,
      userId: r.user_id,
      symbol: r.symbol,
      type: r.type,
      side: r.side,
      price: r.price,
      amount: r.amount,
      filledAmount: r.filled_amount,
      status: r.status,
      createdAt: r.created_at
    }));
  }
}
