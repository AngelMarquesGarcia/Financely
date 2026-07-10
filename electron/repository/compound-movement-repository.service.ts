import { CompoundMovementT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

type RawCompound = {
  id: number;
  accountId: number;
  name: string;
  isCancelable: number;
  ownerYear: number | null;
  ownerMonth: number | null;
  isAnomalous: number;
  notes: string | null;
};

function toCompound(r: RawCompound): CompoundMovementT {
  return {
    id: r.id,
    accountId: r.accountId,
    name: r.name,
    isCancelable: r.isCancelable === 1,
    ownerYear: r.ownerYear,
    ownerMonth: r.ownerMonth,
    isAnomalous: r.isAnomalous === 1,
    notes: r.notes,
  };
}

/**
 * Persistence for the `compound_movements` table only. Membership lives on the movement side (a
 * child's `parent_id`); see `movementRepository.getByParent` / `setParent` / `countByParent`.
 */
export class CompoundMovementRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, account_id as accountId, name,
    is_cancelable as isCancelable, owner_year as ownerYear, owner_month as ownerMonth,
    is_anomalous as isAnomalous, notes`;

  insert(c: Omit<CompoundMovementT, 'id'>): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.compoundMovements}
           (account_id, name, is_cancelable, owner_year, owner_month, is_anomalous, notes)
         VALUES (:accountId, :name, :isCancelable, :ownerYear, :ownerMonth, :isAnomalous, :notes)`,
      )
      .run({
        accountId: c.accountId,
        name: c.name,
        isCancelable: c.isCancelable ? 1 : 0,
        ownerYear: c.ownerYear,
        ownerMonth: c.ownerMonth,
        isAnomalous: c.isAnomalous ? 1 : 0,
        notes: c.notes ?? null,
      }).lastInsertRowid;
  }

  getAll(): CompoundMovementT[] {
    return (
      this.db
        .prepare(`SELECT ${this.selectCols} FROM ${tables.compoundMovements} ORDER BY name`)
        .all() as RawCompound[]
    ).map(toCompound);
  }

  getById(id: number): CompoundMovementT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.compoundMovements} WHERE id = ?`)
      .get(id) as RawCompound | undefined;
    return row == undefined ? undefined : toCompound(row);
  }

  getByAccount(accountId: number): CompoundMovementT[] {
    return (
      this.db
        .prepare(`SELECT ${this.selectCols} FROM ${tables.compoundMovements} WHERE account_id = ?`)
        .all(accountId) as RawCompound[]
    ).map(toCompound);
  }

  /** Compounds that anchor their statistics to this exact (account, year, month) — the owner month. */
  getOwnedInPeriod(accountId: number, year: number, month: number): CompoundMovementT[] {
    return (
      this.db
        .prepare(
          `SELECT ${this.selectCols} FROM ${tables.compoundMovements}
           WHERE account_id = ? AND owner_year = ? AND owner_month = ?`,
        )
        .all(accountId, year, month) as RawCompound[]
    ).map(toCompound);
  }

  /** Updates the editable fields; `account_id` is immutable (fixed by the children). */
  update(c: CompoundMovementT): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${tables.compoundMovements} SET
             name = :name, is_cancelable = :isCancelable,
             owner_year = :ownerYear, owner_month = :ownerMonth,
             is_anomalous = :isAnomalous, notes = :notes
           WHERE id = :id`,
        )
        .run({
          id: c.id,
          name: c.name,
          isCancelable: c.isCancelable ? 1 : 0,
          ownerYear: c.ownerYear,
          ownerMonth: c.ownerMonth,
          isAnomalous: c.isAnomalous ? 1 : 0,
          notes: c.notes ?? null,
        }).changes > 0
    );
  }

  /** Deletes the compound row. Any surviving children are un-parented by the `parent_id` FK
   *  (`ON DELETE SET NULL`); the service decides whether children are deleted first. */
  delete(id: number): boolean {
    return (
      this.db.prepare(`DELETE FROM ${tables.compoundMovements} WHERE id = ?`).run(id).changes > 0
    );
  }
}

export const compoundMovementRepository = new CompoundMovementRepository();
