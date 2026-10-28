import { db } from '../database';
import { randomUUID as uuidv4 } from 'crypto';

export interface LedgerPosting {
  walletId: string;
  type: 'DEBIT' | 'CREDIT';
  amountMicro: number; // Integer micro-units (1 USDT = 1_000_000 micro)
}

export class LedgerService {

  static async getOrCreateSystemWallet(): Promise<{ id: string }> {
    const sysWalletId = 'SYSTEM_TREASURY_WALLET';
    const genesisWalletId = 'GENESIS_RESERVE_WALLET';

    let systemWallet = await db.get("SELECT id FROM wallets WHERE user_id = 'SYSTEM_TREASURY'") as { id: string } | undefined;
    if (!systemWallet) {
      await db.run("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES ('SYSTEM_TREASURY', 'system@cryptohub.ai', 'HASH', 'System Treasury', 'SYS123', 'ADMIN') ON CONFLICT (id) DO NOTHING");
      await db.run("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES ('GENESIS_RESERVE', 'genesis@cryptohub.ai', 'HASH', 'Genesis Reserve', 'GEN123', 'ADMIN') ON CONFLICT (id) DO NOTHING");

      await db.run("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, 'SYSTEM_TREASURY', 'USDT', 0, 0) ON CONFLICT (id) DO NOTHING", [sysWalletId]);
      await db.run("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, 'GENESIS_RESERVE', 'USDT', 0, 0) ON CONFLICT (id) DO NOTHING", [genesisWalletId]);

      systemWallet = { id: sysWalletId };
    }

    // Ensure Genesis ledger transaction exists so SUM(ledger_entries) equals total_balance_micro
    const genesisTx = await db.get("SELECT id FROM ledger_transactions WHERE reference = 'GENESIS_CAPITAL_ALLOCATION'");
    if (!genesisTx) {
      const initialMicro = 1_000_000_000_000; // 1,000,000 USDT capital reserve
      const txId = uuidv4();
      await db.transaction(async (client) => {
        await db.run("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES ('SYSTEM_TREASURY', 'system@cryptohub.ai', 'HASH', 'System Treasury', 'SYS123', 'ADMIN') ON CONFLICT (id) DO NOTHING", [], client);
        await db.run("INSERT INTO users (id, email, password_hash, full_name, referral_code, role) VALUES ('GENESIS_RESERVE', 'genesis@cryptohub.ai', 'HASH', 'Genesis Reserve', 'GEN123', 'ADMIN') ON CONFLICT (id) DO NOTHING", [], client);

        await db.run("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, 'SYSTEM_TREASURY', 'USDT', 0, 0) ON CONFLICT (id) DO NOTHING", [sysWalletId], client);
        await db.run("INSERT INTO wallets (id, user_id, asset, total_balance_micro, reserved_balance_micro) VALUES (?, 'GENESIS_RESERVE', 'USDT', 0, 0) ON CONFLICT (id) DO NOTHING", [genesisWalletId], client);

        await db.run("INSERT INTO ledger_transactions (id, reference, type, description) VALUES (?, 'GENESIS_CAPITAL_ALLOCATION', 'GENESIS', 'Genesis Capital Reserve Allocation')", [txId], client);
        await db.run("INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount_micro) VALUES (?, ?, ?, 'DEBIT', ?)", [uuidv4(), txId, genesisWalletId, initialMicro], client);
        await db.run("INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount_micro) VALUES (?, ?, ?, 'CREDIT', ?)", [uuidv4(), txId, sysWalletId, initialMicro], client);

        await db.run("UPDATE wallets SET total_balance_micro = 0 - ? WHERE id = ?", [initialMicro, genesisWalletId], client);
        await db.run("UPDATE wallets SET total_balance_micro = ? WHERE id = ?", [initialMicro], client);
      });
    }

    return systemWallet;
  }

  static async postTransaction(
    reference: string,
    type: string,
    description: string,
    postings: LedgerPosting[]
  ): Promise<string> {
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

    return await db.transaction(async (client) => {
      const existing = await db.get('SELECT id FROM ledger_transactions WHERE reference = ?', [reference], client);
      if (existing) {
        return (existing as { id: string }).id;
      }

      await db.run(`
        INSERT INTO ledger_transactions (id, reference, type, description)
        VALUES (?, ?, ?, ?)
      `, [txId, reference, type, description], client);

      for (const posting of postings) {
        const entryId = uuidv4();
        await db.run(`
          INSERT INTO ledger_entries (id, transaction_id, wallet_id, entry_type, amount_micro)
          VALUES (?, ?, ?, ?, ?)
        `, [entryId, txId, posting.walletId, posting.type, posting.amountMicro], client);

        if (posting.type === 'CREDIT') {
          await db.run('UPDATE wallets SET total_balance_micro = total_balance_micro + ? WHERE id = ?',
            [posting.amountMicro, posting.walletId], client);
        } else {
          const wallet = await db.get('SELECT total_balance_micro FROM wallets WHERE id = ?', [posting.walletId], client) as { total_balance_micro: number } | undefined;
          if (!wallet || Number(wallet.total_balance_micro) < posting.amountMicro) {
            throw new Error(`Insufficient wallet balance for DEBIT on wallet ${posting.walletId}`);
          }
          await db.run('UPDATE wallets SET total_balance_micro = total_balance_micro - ? WHERE id = ?',
            [posting.amountMicro, posting.walletId], client);
        }
      }

      return txId;
    });
  }

  static async reserveAmount(walletId: string, amountMicro: number) {
    await db.transaction(async (client) => {
      const wallet = await db.get('SELECT total_balance_micro, reserved_balance_micro FROM wallets WHERE id = ?', [walletId], client) as { total_balance_micro: string | number; reserved_balance_micro: string | number } | undefined;
      if (!wallet) throw new Error('Wallet not found');

      const totalBalance = Number(wallet.total_balance_micro);
      const reservedBalance = Number(wallet.reserved_balance_micro);
      const availableMicro = totalBalance - reservedBalance;
      if (availableMicro < amountMicro) {
        throw new Error('Insufficient available balance to reserve.');
      }

      await db.run('UPDATE wallets SET reserved_balance_micro = reserved_balance_micro + ? WHERE id = ?',
        [amountMicro, walletId], client);
    });
  }

  static async releaseReservation(walletId: string, amountMicro: number) {
    await db.transaction(async (client) => {
      await db.run('UPDATE wallets SET reserved_balance_micro = GREATEST(0, reserved_balance_micro - ?) WHERE id = ?',
        [amountMicro, walletId], client);
    });
  }
}
