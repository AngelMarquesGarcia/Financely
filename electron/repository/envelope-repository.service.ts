import { EnvelopeT } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

export class EnvelopeRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, name, account_id as accountId, is_default as isDefault, starting_balance as startingBalance, budget_cents as budgetCents, max_savings_cents as maxSavingsCents, overflows_to as overflowsTo`;

  insertEnvelope(envelope: Omit<EnvelopeT, 'id' | 'isDefault'>): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.envelopes} (name, account_id, starting_balance, budget_cents, max_savings_cents, overflows_to)
         VALUES (:name, :accountId, :startingBalance, :budgetCents, :maxSavingsCents, :overflowsTo)`,
      )
      .run(envelope).lastInsertRowid;
  }

  getAllEnvelopes(): EnvelopeT[] {
    return (
      this.db.prepare(`SELECT ${this.selectCols} FROM ${tables.envelopes}`).all() as RawEnvelope[]
    ).map(toEnvelope);
  }

  getEnvelopeById(id: number): EnvelopeT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.envelopes} WHERE id = ?`)
      .get(id) as RawEnvelope | undefined;
    return row ? toEnvelope(row) : undefined;
  }

  updateEnvelope(envelope: EnvelopeT): boolean {
    // Bind a plain object: better-sqlite3 rejects class instances (e.g. Envelope) for named params.
    return (
      this.db
        .prepare(
          `UPDATE ${tables.envelopes}
           SET name = :name, account_id = :accountId, starting_balance = :startingBalance,
               budget_cents = :budgetCents, max_savings_cents = :maxSavingsCents,
               overflows_to = :overflowsTo
           WHERE id = :id`,
        )
        .run({
          id: envelope.id,
          name: envelope.name,
          accountId: envelope.accountId,
          startingBalance: envelope.startingBalance,
          budgetCents: envelope.budgetCents,
          maxSavingsCents: envelope.maxSavingsCents,
          overflowsTo: envelope.overflowsTo,
        }).changes > 0
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

  /** Reassigns all movement and periodic-template allocations from one envelope to another. */
  reassignMovements(fromId: number, toId: number): void {
    this.reassignAllocations(tables.movementEnvelopes, 'movement_id', fromId, toId);
    this.reassignAllocations(tables.periodicMovementEnvelopes, 'periodic_movement_id', fromId, toId);
  }

  /**
   * Moves `fromId` allocation rows to `toId` in an allocation table. When an owner already has a
   * `toId` row (a split touching both envelopes), the amounts are merged so the total is preserved
   * and the `(owner, envelope)` primary key stays unique.
   */
  private reassignAllocations(
    table: string,
    ownerCol: string,
    fromId: number,
    toId: number,
  ): void {
    // Owners with both rows: fold the fromId amount into the existing toId row...
    this.db
      .prepare(
        `UPDATE ${table} SET amount_cents = amount_cents + (
           SELECT src.amount_cents FROM ${table} src
           WHERE src.${ownerCol} = ${table}.${ownerCol} AND src.envelope_id = :fromId
         )
         WHERE envelope_id = :toId
           AND ${ownerCol} IN (SELECT ${ownerCol} FROM ${table} WHERE envelope_id = :fromId)`,
      )
      .run({ fromId, toId });
    // ...then drop the now-merged fromId rows.
    this.db
      .prepare(
        `DELETE FROM ${table} WHERE envelope_id = :fromId
           AND ${ownerCol} IN (SELECT ${ownerCol} FROM ${table} WHERE envelope_id = :toId)`,
      )
      .run({ fromId, toId });
    // Remaining fromId rows belong to owners with no toId allocation → straight reassign.
    this.db
      .prepare(`UPDATE ${table} SET envelope_id = :toId WHERE envelope_id = :fromId`)
      .run({ fromId, toId });
  }

  getAccountId(id: number): number | null {
    const row = this.db
      .prepare(`SELECT account_id as accountId FROM ${tables.envelopes} WHERE id = ?`)
      .get(id) as { accountId: number | null } | undefined;
    return row?.accountId ?? null;
  }
}

type RawEnvelope = {
  id: number;
  name: string;
  accountId: number | null;
  isDefault: number;
  startingBalance: number;
  budgetCents: number | null;
  maxSavingsCents: number | null;
  overflowsTo: number | null;
};
function toEnvelope(r: RawEnvelope): EnvelopeT {
  return {
    id: r.id,
    name: r.name,
    accountId: r.accountId,
    isDefault: r.isDefault === 1,
    startingBalance: r.startingBalance,
    budgetCents: r.budgetCents,
    maxSavingsCents: r.maxSavingsCents,
    overflowsTo: r.overflowsTo,
  };
}

export const envelopeRepository = new EnvelopeRepository();
