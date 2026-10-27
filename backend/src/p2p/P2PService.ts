import { db } from '../database';
import { randomUUID as uuidv4 } from 'crypto';

export class P2PService {

  static getAds() {
    const ads = db.prepare('SELECT * FROM p2p_ads ORDER BY created_at DESC').all() as any[];
    if (ads.length === 0) {
      const sampleAds = [
        {
          id: uuidv4(),
          user_id: 'SYSTEM_P2P_MERCHANT_1',
          merchant_name: 'CryptoExpress_P2P',
          type: 'SELL',
          price: 1.00,
          fiat_currency: 'USD',
          available_amount: 50000.0,
          min_limit: 50.0,
          max_limit: 5000.0,
          payment_methods: JSON.stringify(['Bank Transfer', 'Zelle', 'Revolut'])
        },
        {
          id: uuidv4(),
          user_id: 'SYSTEM_P2P_MERCHANT_2',
          merchant_name: 'GlobalTrader_Pro',
          type: 'BUY',
          price: 0.99,
          fiat_currency: 'USD',
          available_amount: 25000.0,
          min_limit: 100.0,
          max_limit: 2500.0,
          payment_methods: JSON.stringify(['Bank Transfer', 'Wise'])
        }
      ];

      for (const ad of sampleAds) {
        db.prepare(`
          INSERT INTO p2p_ads (id, user_id, merchant_name, type, price, fiat_currency, available_amount, min_limit, max_limit, payment_methods)
          VALUES (@id, @user_id, @merchant_name, @type, @price, @fiat_currency, @available_amount, @min_limit, @max_limit, @payment_methods)
        `).run(ad);
      }

      return sampleAds.map(a => ({
        adId: a.id,
        merchantName: a.merchant_name,
        type: a.type,
        price: a.price,
        fiatCurrency: a.fiat_currency,
        availableAmount: a.available_amount,
        minLimit: a.min_limit,
        maxLimit: a.max_limit,
        paymentMethods: JSON.parse(a.payment_methods)
      }));
    }

    return ads.map(a => ({
      adId: a.id,
      merchantName: a.merchant_name,
      type: a.type,
      price: a.price,
      fiatCurrency: a.fiat_currency,
      availableAmount: a.available_amount,
      minLimit: a.min_limit,
      maxLimit: a.max_limit,
      paymentMethods: JSON.parse(a.payment_methods || '[]')
    }));
  }

  static createOrder(buyerId: string, adId: string, amountUsdt: number) {
    const ad = db.prepare('SELECT * FROM p2p_ads WHERE id = ?').get(adId) as any;
    if (!ad) throw new Error('P2P Advertisement not found.');

    if (amountUsdt < ad.min_limit || amountUsdt > ad.max_limit) {
      throw new Error(`Amount must be between $${ad.min_limit} and $${ad.max_limit}`);
    }

    const orderId = uuidv4();
    const fiatAmount = amountUsdt * ad.price;

    db.prepare(`
      INSERT INTO p2p_orders (id, ad_id, buyer_id, seller_id, amount_usdt, fiat_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(orderId, adId, buyerId, ad.user_id, amountUsdt, fiatAmount);

    return {
      orderId,
      adId,
      buyerName: 'User_' + buyerId.substring(0, 6),
      sellerName: ad.merchant_name,
      amountUsdt,
      fiatAmount,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
  }
}
