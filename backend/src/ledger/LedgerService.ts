import { db } from '../database';
import { randomUUID as uuidv4 } from 'crypto';

export interface LedgerPosting {
  walletId: string;
  type: 'DEBIT' | 'CREDIT';
  amountMicro: number; // Integer micro-units (1 USDT = 1_000_000 micro)
}

export class LedgerService {

  static getOrCreateSystemWallet(): { id: string } {
    let systemWallet = db.prepare("SELECT id FROM wallets WHERE user_id = 'SYSTEM_TREASURY'").get() as { id: string } | undefined;
    if (!systemWallet) {
      const sysWalletId = 'SYSTEM_TREASURY_WALLET';
      db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, full_name, referral_code, role) VALUES ('SYSTEM_TREASURY', 'system@cryptohub.ai', 'HASH', 'System Treasury', 'SYS123', 'ADMIN')").run();
      db.prepare("INSERT OR IGNORE INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, 'SYSTEM_TREASURY', 'USDT', 1000000000000, 0)").run(sysWalletId);
      systemWallet = { id: sysWalletId };
    }
    return systemWallet;
  }

  static postTransaction(
    reference: string,
    type: string,
    description: string,
    postings: LedgerPosting[]
  ): string {
    let totalDebit = 0;
    let totalCredit = 0;

    for (const posting of postings) {
      if (posting.amountMicro <= 0) {
        throw new Error('Ledger entry amount must be positive micro-units.');
      }
      if (posting.type === 'DEBIT') {
        totalDebit += posting.amountMicro;
      } else if (posting.type === 'CREDIT') {
        totalCredit += posting.amountMicro;
      }
    }

    if (totalDebit !== totalCredit) {
      throw new Error(`Double-entry ledger mismatch: Total Debit (${totalDebit}) != Total Credit (${totalCredit})`);
    }

    const txId = uuidv4();

    const postTxTransaction = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM ledger_transactions WHERE reference = ?').get(reference);
      if (existing) {
        return (existing as { id: string }).id;
      }

      db.prepare(`
        INSERT INTO ledger_transactions (id, reference, type, description)
        VALUES (?, ?, ?, ?)
      `).run(txId, reference, type, description);

      const insertEntryStmt = db.prepare(`
        INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount_micro)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const posting of postings) {
        const entryId = uuidv4();
        insertEntryStmt.run(entryId, txId, posting.walletId, posting.type, posting.amountMicro);

        if (posting.type === 'CREDIT') {
          db.prepare('UPDATE wallets SET total_balance_micro = total_balance_micro + ? WHERE id = ?')
            .run(posting.amountMicro, posting.walletId);
        } else {
          const wallet = db.prepare('SELECT total_balance_micro FROM wallets WHERE id = ?').get(posting.walletId) as { total_balance_micro: number } | undefined;
          if (!wallet || wallet.total_balance_micro < posting.amountMicro) {
            throw new Error(`Insufficient wallet balance for DEBIT on wallet ${posting.walletId}`);
          }
          db.prepare('UPDATE wallets SET total_balance_micro = total_balance_micro - ? WHERE id = ?')
            .run(posting.amountMicro, posting.walletId);
        }
      }

      return txId;
    });

    return postTxTransaction();
  }

  static reserveAmount(walletId: string, amountMicro: number) {
    const reserveTx = db.transaction(() => {
      const wallet = db.prepare('SELECT total_balance_micro, reserved_balance_micro FROM wallets WHERE id = ?').get(walletId) as { total_balance_micro: number; reserved_balance_micro: number } | undefined;
      if (!wallet) throw new Error('Wallet not found');

      const availableMicro = wallet.total_balance_micro - wallet.reserved_balance_micro;
      if (availableMicro < amountMicro) {
        throw new Error('Insufficient available balance to reserve.');
      }

      db.prepare('UPDATE wallets SET reserved_balance_micro = reserved_balance_micro + ? WHERE id = ?')
        .run(amountMicro, walletId);
    });
    reserveTx();
  }

  static releaseReservation(walletId: string, amountMicro: number) {
    const releaseTx = db.transaction(() => {
      db.prepare('UPDATE wallets SET reserved_balance_micro = MAX(0, reserved_balance_micro - ?) WHERE id = ?')
        .run(amountMicro, walletId);
    });
    releaseTx();
  }
}
