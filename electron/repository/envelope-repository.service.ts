import { Envelope } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { DatabaseService } from './database.service';

export class EnvelopeRepository {
  private readonly table = 'envelopes';
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, name, account_id as accountId, is_default as isDefault`;

  insertEnvelope(envelope: Omit<Envelope, 'id' | 'isDefault'>): number | bigint {
    return this.db
      .prepare(`INSERT INTO ${this.table} (name, account_id) VALUES (:name, :accountId)`)
      .run(envelope).lastInsertRowid;
  }

  getAllEnvelopes(): Envelope[] {
    return (
      this.db.prepare(`SELECT ${this.selectCols} FROM ${this.table}`).all() as RawEnvelope[]
    ).map(toEnvelope);
  }

  getEnvelopeById(id: number): Envelope | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${this.table} WHERE id = ?`)
      .get(id) as RawEnvelope | undefined;
    return row ? toEnvelope(row) : undefined;
  }

  updateEnvelope(envelope: Envelope): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${this.table} SET name = :name, account_id = :accountId WHERE id = :id`,
        )
        .run(envelope).changes > 0
    );
  }

  deleteEnvelope(id: number): boolean {
    return this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id).changes === 1;
  }

  isDefault(id: number): boolean {
    const row = this.db
      .prepare(`SELECT is_default as isDefault FROM ${this.table} WHERE id = ?`)
      .get(id) as { isDefault: number } | undefined;
    return row?.isDefault === 1;
  }

  /** Returns the default envelope id for an account, or undefined if none is set. */
  getDefaultForAccount(accountId: number): number | undefined {
    const row = this.db
      .prepare(`SELECT id FROM ${this.table} WHERE account_id = ? AND is_default = 1 LIMIT 1`)
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
        .prepare(`UPDATE ${this.table} SET is_default = 0 WHERE account_id = ? AND is_default = 1`)
        .run(accId);
      this.db.prepare(`UPDATE ${this.table} SET is_default = 1 WHERE id = ?`).run(targetId);
    });
    tx(id, accountId);
  }

  /** Reassigns all movements from one envelope to another. */
  reassignMovements(fromId: number, toId: number): void {
    this.db
      .prepare(`UPDATE movements SET envelope_id = ? WHERE envelope_id = ?`)
      .run(toId, fromId);
  }

  getAccountId(id: number): number | null {
    const row = this.db
      .prepare(`SELECT account_id as accountId FROM ${this.table} WHERE id = ?`)
      .get(id) as { accountId: number | null } | undefined;
    return row?.accountId ?? null;
  }
}

type RawEnvelope = { id: number; name: string; accountId: number | null; isDefault: number };
function toEnvelope(r: RawEnvelope): Envelope {
  return { id: r.id, name: r.name, accountId: r.accountId, isDefault: r.isDefault === 1 };
}

export const envelopeRepository = new EnvelopeRepository();
