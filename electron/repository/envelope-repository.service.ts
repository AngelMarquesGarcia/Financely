import { Envelope } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

export class EnvelopeRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, name, account_id as accountId, is_default as isDefault, starting_balance as startingBalance`;

  insertEnvelope(envelope: Omit<Envelope, 'id' | 'isDefault'>): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.envelopes} (name, account_id, starting_balance)
         VALUES (:name, :accountId, :startingBalance)`,
      )
      .run(envelope).lastInsertRowid;
  }

  getAllEnvelopes(): Envelope[] {
    return (
      this.db.prepare(`SELECT ${this.selectCols} FROM ${tables.envelopes}`).all() as RawEnvelope[]
    ).map(toEnvelope);
  }

  getEnvelopeById(id: number): Envelope | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.envelopes} WHERE id = ?`)
      .get(id) as RawEnvelope | undefined;
    return row ? toEnvelope(row) : undefined;
  }

  updateEnvelope(envelope: Envelope): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${tables.envelopes}
           SET name = :name, account_id = :accountId, starting_balance = :startingBalance
           WHERE id = :id`,
        )
        .run(envelope).changes > 0
    );
  }

  deleteEnvelope(id: number): boolean {
    return this.db.prepare(`DELETE FROM ${tables.envelopes} WHERE id = ?`).run(id).changes === 1;
  }

  isDefault(id: number): boolean {
    const row = this.db
      .prepare(`SELECT is_default as isDefault FROM ${tables.envelopes} WHERE id = ?`)
      .get(id) as { isDefault: number } | undefined;
    return row?.isDefault === 1;
  }

  /** Returns the default envelope id for an account, or undefined if none is set. */
  getDefaultForAccount(accountId: number): number | undefined {
    const row = this.db
      .prepare(`SELECT id FROM ${tables.envelopes} WHERE account_id = ? AND is_default = 1 LIMIT 1`)
      .get(accountId) as { id: number } | undefined;
    return row?.id;
  }

  /** Sets the given envelope as the only default within its account. Transactional. */
  setDefault(id: number): void {
    const env = this.getEnvelopeById(id);
    if (!env) throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
    if (env.accountId == null) throw new AppError(AppErrorCode.ENVELOPE_ORPHAN_DEFAULT);
    const accountId = env.accountId;
    const tx = this.db.transaction((targetId: number, accId: number) => {
      this.db
        .prepare(`UPDATE ${tables.envelopes} SET is_default = 0 WHERE account_id = ? AND is_default = 1`)
        .run(accId);
      this.db.prepare(`UPDATE ${tables.envelopes} SET is_default = 1 WHERE id = ?`).run(targetId);
    });
    tx(id, accountId);
  }

  /** Reassigns all movements from one envelope to another. */
  reassignMovements(fromId: number, toId: number): void {
    this.db
      .prepare(`UPDATE ${tables.movements} SET envelope_id = ? WHERE envelope_id = ?`)
      .run(toId, fromId);
  }

  getAccountId(id: number): number | null {
    const row = this.db
      .prepare(`SELECT account_id as accountId FROM ${tables.envelopes} WHERE id = ?`)
      .get(id) as { accountId: number | null } | undefined;
    return row?.accountId ?? null;
  }
}

type RawEnvelope = { id: number; name: string; accountId: number | null; isDefault: number; startingBalance: number };
function toEnvelope(r: RawEnvelope): Envelope {
  return { id: r.id, name: r.name, accountId: r.accountId, isDefault: r.isDefault === 1, startingBalance: r.startingBalance };
}

export const envelopeRepository = new EnvelopeRepository();
