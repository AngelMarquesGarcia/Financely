import { Account, AccountStats } from '@shared/types';
import { DatabaseService } from './database.service';

export class AccountRepository {
  private readonly table = 'accounts';
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, name, description, is_default as isDefault`;

  insertAccount(account: Omit<Account, 'id' | 'isDefault'>): number | bigint {
    return this.db
      .prepare(`INSERT INTO ${this.table} (name, description) VALUES (:name, :description)`)
      .run({ ...account, description: account.description ?? null }).lastInsertRowid;
  }

  getAllAccounts(): Account[] {
    return (
      this.db.prepare(`SELECT ${this.selectCols} FROM ${this.table}`).all() as RawAccount[]
    ).map(toAccount);
  }

  getAccountById(id: number): Account | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${this.table} WHERE id = ?`)
      .get(id) as RawAccount | undefined;
    return row ? toAccount(row) : undefined;
  }

  updateAccount(account: Account): boolean {
    return (
      this.db
        .prepare(`UPDATE ${this.table} SET name = :name, description = :description WHERE id = :id`)
        .run({ ...account, description: account.description ?? null }).changes > 0
    );
  }

  deleteAccount(id: number): boolean {
    return (
      this.db
        .prepare(`DELETE FROM ${this.table} WHERE id = ? AND is_default = 0`)
        .run(id).changes === 1
    );
  }

  isDefault(id: number): boolean {
    const row = this.db
      .prepare(`SELECT is_default as isDefault FROM ${this.table} WHERE id = ?`)
      .get(id) as { isDefault: number } | undefined;
    return row?.isDefault === 1;
  }

  /** Sets the given account as the only default. Transactional. */
  setDefault(id: number): void {
    const tx = this.db.transaction((targetId: number) => {
      this.db.prepare(`UPDATE ${this.table} SET is_default = 0 WHERE is_default = 1`).run();
      this.db.prepare(`UPDATE ${this.table} SET is_default = 1 WHERE id = ?`).run(targetId);
    });
    tx(id);
  }

  getStats(): AccountStats {
    const m = this.db
      .prepare(
        `SELECT
            COALESCE(SUM(CASE WHEN isPositive = 1 THEN quantity_cents ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN isPositive = 0 THEN quantity_cents ELSE 0 END), 0) AS expense
         FROM movements`,
      )
      .get() as { income: number; expense: number };
    const e = this.db.prepare(`SELECT COUNT(*) AS n FROM envelopes`).get() as { n: number };
    return {
      totalIncomeCents: m.income,
      totalExpenseCents: m.expense,
      balanceCents: m.income - m.expense,
      envelopeCount: e.n,
    };
  }
}

type RawAccount = { id: number; name: string; description: string | null; isDefault: number };
function toAccount(r: RawAccount): Account {
  return { id: r.id, name: r.name, description: r.description ?? undefined, isDefault: r.isDefault === 1 };
}

export const accountRepository = new AccountRepository();
