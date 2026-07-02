import { PeriodicMovementT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

type RawPeriodic = {
  id: number;
  accountId: number;
  name: string;
  concept: string | null;
  quantityCents: number;
  isPositive: number;
  dayOfMonth: number;
  categoryId: number;
  envelopeId: number;
  additionalNotes: string | null;
  active: number;
  startYear: number;
  startMonth: number;
  lastCreatedYear: number | null;
  lastCreatedMonth: number | null;
};

function toPeriodic(r: RawPeriodic): PeriodicMovementT {
  return {
    id: r.id,
    accountId: r.accountId,
    name: r.name,
    concept: r.concept,
    quantityCents: r.quantityCents,
    isPositive: r.isPositive === 1,
    dayOfMonth: r.dayOfMonth,
    categoryId: r.categoryId,
    envelopeId: r.envelopeId,
    additionalNotes: r.additionalNotes,
    active: r.active === 1,
    startYear: r.startYear,
    startMonth: r.startMonth,
    lastCreatedYear: r.lastCreatedYear,
    lastCreatedMonth: r.lastCreatedMonth,
  };
}

export class PeriodicMovementRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, account_id as accountId, name, concept,
    quantity_cents as quantityCents, isPositive, day_of_month as dayOfMonth,
    category_id as categoryId, envelope_id as envelopeId, additional_notes as additionalNotes,
    active, start_year as startYear, start_month as startMonth,
    last_created_year as lastCreatedYear, last_created_month as lastCreatedMonth`;

  insert(t: Omit<PeriodicMovementT, 'id'>): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.periodicMovements}
           (account_id, name, concept, quantity_cents, isPositive, day_of_month, category_id,
            envelope_id, additional_notes, active, start_year, start_month,
            last_created_year, last_created_month)
         VALUES (:accountId, :name, :concept, :quantityCents, :isPositive, :dayOfMonth, :categoryId,
            :envelopeId, :additionalNotes, :active, :startYear, :startMonth,
            :lastCreatedYear, :lastCreatedMonth)`,
      )
      .run({
        accountId: t.accountId,
        name: t.name,
        concept: t.concept ?? null,
        quantityCents: t.quantityCents,
        isPositive: t.isPositive ? 1 : 0,
        dayOfMonth: t.dayOfMonth,
        categoryId: t.categoryId,
        envelopeId: t.envelopeId,
        additionalNotes: t.additionalNotes ?? null,
        active: t.active ? 1 : 0,
        startYear: t.startYear,
        startMonth: t.startMonth,
        lastCreatedYear: t.lastCreatedYear ?? null,
        lastCreatedMonth: t.lastCreatedMonth ?? null,
      }).lastInsertRowid;
  }

  getAll(): PeriodicMovementT[] {
    return (
      this.db
        .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} ORDER BY name`)
        .all() as RawPeriodic[]
    ).map(toPeriodic);
  }

  getActive(): PeriodicMovementT[] {
    return (
      this.db
        .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} WHERE active = 1`)
        .all() as RawPeriodic[]
    ).map(toPeriodic);
  }

  getById(id: number): PeriodicMovementT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} WHERE id = ?`)
      .get(id) as RawPeriodic | undefined;
    return row ? toPeriodic(row) : undefined;
  }

  getByName(name: string): PeriodicMovementT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} WHERE name = ?`)
      .get(name) as RawPeriodic | undefined;
    return row ? toPeriodic(row) : undefined;
  }

  /** Updates editable fields; the cursor and active flag come along but are normally driven by
   *  setCursor/setActive. */
  update(t: PeriodicMovementT): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${tables.periodicMovements} SET
             account_id = :accountId, name = :name, concept = :concept,
             quantity_cents = :quantityCents, isPositive = :isPositive, day_of_month = :dayOfMonth,
             category_id = :categoryId, envelope_id = :envelopeId, additional_notes = :additionalNotes,
             active = :active, start_year = :startYear, start_month = :startMonth,
             last_created_year = :lastCreatedYear, last_created_month = :lastCreatedMonth
           WHERE id = :id`,
        )
        .run({
          id: t.id,
          accountId: t.accountId,
          name: t.name,
          concept: t.concept ?? null,
          quantityCents: t.quantityCents,
          isPositive: t.isPositive ? 1 : 0,
          dayOfMonth: t.dayOfMonth,
          categoryId: t.categoryId,
          envelopeId: t.envelopeId,
          additionalNotes: t.additionalNotes ?? null,
          active: t.active ? 1 : 0,
          startYear: t.startYear,
          startMonth: t.startMonth,
          lastCreatedYear: t.lastCreatedYear ?? null,
          lastCreatedMonth: t.lastCreatedMonth ?? null,
        }).changes > 0
    );
  }

  setActive(id: number, active: boolean): boolean {
    return (
      this.db
        .prepare(`UPDATE ${tables.periodicMovements} SET active = ? WHERE id = ?`)
        .run(active ? 1 : 0, id).changes > 0
    );
  }

  setCursor(id: number, year: number, month: number): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${tables.periodicMovements}
             SET last_created_year = ?, last_created_month = ? WHERE id = ?`,
        )
        .run(year, month, id).changes > 0
    );
  }

  /** Removes the template and its tag links (junction cleared explicitly — FK cascade is not relied on). */
  delete(id: number): boolean {
    const tx = this.db.transaction((templateId: number) => {
      this.db
        .prepare(`DELETE FROM ${tables.periodicMovementTags} WHERE periodic_movement_id = ?`)
        .run(templateId);
      return (
        this.db.prepare(`DELETE FROM ${tables.periodicMovements} WHERE id = ?`).run(templateId)
          .changes === 1
      );
    });
    return tx(id);
  }

  getTagIds(id: number): number[] {
    return (
      this.db
        .prepare(
          `SELECT tag_id AS tagId FROM ${tables.periodicMovementTags} WHERE periodic_movement_id = ?`,
        )
        .all(id) as { tagId: number }[]
    ).map((r) => r.tagId);
  }

  /** Replaces the template's tag set. Atomic. */
  setTags(id: number, tagIds: number[]): void {
    const tx = this.db.transaction((templateId: number, ids: number[]) => {
      this.db
        .prepare(`DELETE FROM ${tables.periodicMovementTags} WHERE periodic_movement_id = ?`)
        .run(templateId);
      const insert = this.db.prepare(
        `INSERT OR IGNORE INTO ${tables.periodicMovementTags} (periodic_movement_id, tag_id) VALUES (?, ?)`,
      );
      for (const tagId of ids) insert.run(templateId, tagId);
    });
    tx(id, tagIds);
  }
}

export const periodicMovementRepository = new PeriodicMovementRepository();
