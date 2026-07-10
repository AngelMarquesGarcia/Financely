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
  additionalNotes: string | null;
  active: number;
  startYear: number;
  startMonth: number;
  lastCreatedYear: number | null;
  lastCreatedMonth: number | null;
};

/** Builds a wire template with an empty allocation map; `hydrateEnvelopeMaps` fills it in. */
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
    envelopeIdMap: new Map(),
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
    category_id as categoryId, additional_notes as additionalNotes,
    active, start_year as startYear, start_month as startMonth,
    last_created_year as lastCreatedYear, last_created_month as lastCreatedMonth`;

  /** Populates each template's `envelopeIdMap` from `periodic_movement_envelopes` (batched). */
  private hydrateEnvelopeMaps(templates: PeriodicMovementT[]): PeriodicMovementT[] {
    if (templates.length === 0) return templates;
    const ids = templates.map((t) => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT periodic_movement_id as templateId, envelope_id as envelopeId, amount_cents as amountCents
         FROM ${tables.periodicMovementEnvelopes} WHERE periodic_movement_id IN (${placeholders})`,
      )
      .all(...ids) as { templateId: number; envelopeId: number; amountCents: number }[];

    const byTemplate = new Map<number, Map<number, number>>();
    for (const r of rows) {
      let map = byTemplate.get(r.templateId);
      if (map == undefined) {
        map = new Map<number, number>();
        byTemplate.set(r.templateId, map);
      }
      map.set(r.envelopeId, r.amountCents);
    }
    for (const t of templates) t.envelopeIdMap = byTemplate.get(t.id) ?? new Map();
    return templates;
  }

  insert(t: Omit<PeriodicMovementT, 'id'>): number | bigint {
    const insertTemplate = this.db.prepare(
      `INSERT INTO ${tables.periodicMovements}
         (account_id, name, concept, quantity_cents, isPositive, day_of_month, category_id,
          additional_notes, active, start_year, start_month,
          last_created_year, last_created_month)
       VALUES (:accountId, :name, :concept, :quantityCents, :isPositive, :dayOfMonth, :categoryId,
          :additionalNotes, :active, :startYear, :startMonth,
          :lastCreatedYear, :lastCreatedMonth)`,
    );
    const insertAlloc = this.db.prepare(
      `INSERT INTO ${tables.periodicMovementEnvelopes} (periodic_movement_id, envelope_id, amount_cents) VALUES (?, ?, ?)`,
    );
    return this.db.transaction((template: Omit<PeriodicMovementT, 'id'>) => {
      const id = insertTemplate.run({
        accountId: template.accountId,
        name: template.name,
        concept: template.concept ?? null,
        quantityCents: template.quantityCents,
        isPositive: template.isPositive ? 1 : 0,
        dayOfMonth: template.dayOfMonth,
        categoryId: template.categoryId,
        additionalNotes: template.additionalNotes ?? null,
        active: template.active ? 1 : 0,
        startYear: template.startYear,
        startMonth: template.startMonth,
        lastCreatedYear: template.lastCreatedYear ?? null,
        lastCreatedMonth: template.lastCreatedMonth ?? null,
      }).lastInsertRowid;
      for (const [envelopeId, amount] of template.envelopeIdMap) {
        insertAlloc.run(Number(id), envelopeId, amount);
      }
      return id;
    })(t);
  }

  getAll(): PeriodicMovementT[] {
    return this.hydrateEnvelopeMaps(
      (
        this.db
          .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} ORDER BY name`)
          .all() as RawPeriodic[]
      ).map(toPeriodic),
    );
  }

  getActive(): PeriodicMovementT[] {
    return this.hydrateEnvelopeMaps(
      (
        this.db
          .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} WHERE active = 1`)
          .all() as RawPeriodic[]
      ).map(toPeriodic),
    );
  }

  getById(id: number): PeriodicMovementT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} WHERE id = ?`)
      .get(id) as RawPeriodic | undefined;
    if (row == undefined) return undefined;
    return this.hydrateEnvelopeMaps([toPeriodic(row)])[0];
  }

  getByName(name: string): PeriodicMovementT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.periodicMovements} WHERE name = ?`)
      .get(name) as RawPeriodic | undefined;
    if (row == undefined) return undefined;
    return this.hydrateEnvelopeMaps([toPeriodic(row)])[0];
  }

  /** Updates editable fields (incl. the envelope split); the cursor and active flag come along but
   *  are normally driven by setCursor/setActive. */
  update(t: PeriodicMovementT): boolean {
    const updateTemplate = this.db.prepare(
      `UPDATE ${tables.periodicMovements} SET
         account_id = :accountId, name = :name, concept = :concept,
         quantity_cents = :quantityCents, isPositive = :isPositive, day_of_month = :dayOfMonth,
         category_id = :categoryId, additional_notes = :additionalNotes,
         active = :active, start_year = :startYear, start_month = :startMonth,
         last_created_year = :lastCreatedYear, last_created_month = :lastCreatedMonth
       WHERE id = :id`,
    );
    const delAlloc = this.db.prepare(
      `DELETE FROM ${tables.periodicMovementEnvelopes} WHERE periodic_movement_id = ?`,
    );
    const insertAlloc = this.db.prepare(
      `INSERT INTO ${tables.periodicMovementEnvelopes} (periodic_movement_id, envelope_id, amount_cents) VALUES (?, ?, ?)`,
    );
    return this.db.transaction((template: PeriodicMovementT) => {
      const changed =
        updateTemplate.run({
          id: template.id,
          accountId: template.accountId,
          name: template.name,
          concept: template.concept ?? null,
          quantityCents: template.quantityCents,
          isPositive: template.isPositive ? 1 : 0,
          dayOfMonth: template.dayOfMonth,
          categoryId: template.categoryId,
          additionalNotes: template.additionalNotes ?? null,
          active: template.active ? 1 : 0,
          startYear: template.startYear,
          startMonth: template.startMonth,
          lastCreatedYear: template.lastCreatedYear ?? null,
          lastCreatedMonth: template.lastCreatedMonth ?? null,
        }).changes > 0;
      delAlloc.run(template.id);
      for (const [envelopeId, amount] of template.envelopeIdMap) {
        insertAlloc.run(template.id, envelopeId, amount);
      }
      return changed;
    })(t);
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

  /** Removes the template and its tag + allocation links (junctions cleared explicitly — FK cascade is not relied on). */
  delete(id: number): boolean {
    const tx = this.db.transaction((templateId: number) => {
      this.db
        .prepare(`DELETE FROM ${tables.periodicMovementTags} WHERE periodic_movement_id = ?`)
        .run(templateId);
      this.db
        .prepare(`DELETE FROM ${tables.periodicMovementEnvelopes} WHERE periodic_movement_id = ?`)
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
