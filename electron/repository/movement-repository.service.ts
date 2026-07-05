import { MovementT, MovementFilter, PeriodT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';
import { dateToISO, isoToDate } from './date-utils';

type RawMovement = {
  id: number;
  accountId: number;
  name: string;
  concept: string | null;
  quantityCents: number;
  isPositive: number;
  date: string;
  categoryId: number;
  additionalNotes: string | null;
  templateId: number | null;
  isTentative: number;
  isAnomalous: number;
};

/** Builds a wire movement with an empty allocation map; `hydrateEnvelopeMaps` fills it in. */
function toMovement(r: RawMovement): MovementT {
  return {
    id: r.id,
    accountId: r.accountId,
    name: r.name,
    concept: r.concept,
    quantityCents: r.quantityCents,
    isPositive: r.isPositive === 1,
    date: isoToDate(r.date),
    categoryId: r.categoryId,
    envelopeIdMap: new Map(),
    additionalNotes: r.additionalNotes,
    templateId: r.templateId,
    isTentative: r.isTentative === 1,
    isAnomalous: r.isAnomalous === 1,
  };
}

export class MovementRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, account_id as accountId, name, concept, quantity_cents as quantityCents,
    isPositive, date, category_id as categoryId,
    additional_notes as additionalNotes, template_id as templateId, is_tentative as isTentative,
    is_anomalous as isAnomalous`;

  /**
   * Populates each movement's `envelopeIdMap` from `movement_envelopes` in a single batched query
   * (no N+1). Called by every read method so services always receive fully-attributed movements.
   */
  private hydrateEnvelopeMaps(movements: MovementT[]): MovementT[] {
    if (movements.length === 0) return movements;
    const ids = movements.map((m) => m.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT movement_id as movementId, envelope_id as envelopeId, amount_cents as amountCents
         FROM ${tables.movementEnvelopes} WHERE movement_id IN (${placeholders})`,
      )
      .all(...ids) as { movementId: number; envelopeId: number; amountCents: number }[];

    const byMovement = new Map<number, Map<number, number>>();
    for (const r of rows) {
      let map = byMovement.get(r.movementId);
      if (map == undefined) {
        map = new Map<number, number>();
        byMovement.set(r.movementId, map);
      }
      map.set(r.envelopeId, r.amountCents);
    }
    for (const m of movements) m.envelopeIdMap = byMovement.get(m.id) ?? new Map();
    return movements;
  }

  insertMovement(mov: Omit<MovementT, 'id'>): number | bigint {
    const insertMov = this.db.prepare(
      `INSERT INTO ${tables.movements}
         (account_id, name, concept, quantity_cents, isPositive, date, category_id,
          additional_notes, template_id, is_tentative, is_anomalous)
       VALUES (:accountId, :name, :concept, :quantityCents, :isPositive, :date, :categoryId,
          :additionalNotes, :templateId, :isTentative, :isAnomalous)`,
    );
    const insertAlloc = this.db.prepare(
      `INSERT INTO ${tables.movementEnvelopes} (movement_id, envelope_id, amount_cents) VALUES (?, ?, ?)`,
    );
    return this.db.transaction((m: Omit<MovementT, 'id'>) => {
      const id = insertMov.run({
        accountId: m.accountId,
        name: m.name,
        concept: m.concept ?? null,
        quantityCents: m.quantityCents,
        isPositive: m.isPositive ? 1 : 0,
        date: dateToISO(m.date),
        categoryId: m.categoryId,
        additionalNotes: m.additionalNotes ?? null,
        templateId: m.templateId ?? null,
        isTentative: m.isTentative ? 1 : 0,
        isAnomalous: m.isAnomalous ? 1 : 0,
      }).lastInsertRowid;
      for (const [envelopeId, amount] of m.envelopeIdMap) insertAlloc.run(Number(id), envelopeId, amount);
      return id;
    })(mov);
  }

  getAllMovements(filter?: MovementFilter): MovementT[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter?.date?.from) {
      conditions.push('date >= :dateFrom');
      params['dateFrom'] = filter.date.from;
    }
    if (filter?.date?.to) {
      conditions.push('date <= :dateTo');
      params['dateTo'] = filter.date.to;
    }
    if (filter?.amount?.from != null) {
      conditions.push('quantity_cents >= :amountFrom');
      params['amountFrom'] = filter.amount.from;
    }
    if (filter?.amount?.to != null) {
      conditions.push('quantity_cents <= :amountTo');
      params['amountTo'] = filter.amount.to;
    }
    if (filter?.categoryId != null) {
      conditions.push('category_id = :categoryId');
      params['categoryId'] = filter.categoryId;
    }
    if (filter?.envelopeId != null) {
      conditions.push(
        `EXISTS (SELECT 1 FROM ${tables.movementEnvelopes} me
                 WHERE me.movement_id = ${tables.movements}.id AND me.envelope_id = :envelopeId)`,
      );
      params['envelopeId'] = filter.envelopeId;
    }
    if (filter?.text) {
      const { query, condition, field } = filter.text;
      const escaped = query.replace(/[%_\\]/g, '\\$&');
      const pattern =
        condition === 'exact'
          ? query
          : condition === 'contains'
            ? `%${escaped}%`
            : condition === 'startsWith'
              ? `${escaped}%`
              : `%${escaped}`;
      params['textQuery'] = pattern;

      const cols: Record<Exclude<typeof field, 'all'>, string> = {
        name: 'name',
        concept: 'concept',
        notes: 'additional_notes',
      };
      const op = condition === 'exact' ? `= :textQuery` : `LIKE :textQuery ESCAPE '\\'`;
      if (field === 'all') {
        conditions.push(`(name ${op} OR concept ${op} OR additional_notes ${op})`);
      } else {
        conditions.push(`${cols[field]} ${op}`);
      }
    }
    if (filter?.isPositive != null) {
      conditions.push('isPositive = :isPositive');
      params['isPositive'] = filter.isPositive ? 1 : 0;
    }
    if (filter?.tags) {
      const matchingIds = this.getMovementIdsByTags(filter.tags.ids, filter.tags.matchAll);
      if (matchingIds.length === 0) return [];
      conditions.push(`id IN (${matchingIds.join(',')})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.hydrateEnvelopeMaps(
      (
        this.db
          .prepare(`SELECT ${this.selectCols} FROM ${tables.movements} ${where}`)
          .all(params) as RawMovement[]
      ).map(toMovement),
    );
  }

  getMovementsByPeriod(period: PeriodT): MovementT[] {
    return this.hydrateEnvelopeMaps(
      (
        this.db
          .prepare(
            `SELECT ${this.selectCols} FROM ${tables.movements} m
             WHERE account_id = ?
               AND CAST(strftime('%Y', date) AS INTEGER) = ?
               AND CAST(strftime('%m', date) AS INTEGER) - 1 = ?
               AND EXISTS (SELECT 1 FROM ${tables.movementEnvelopes} me
                           WHERE me.movement_id = m.id AND me.envelope_id = ?)`,
          )
          .all(period.accountId, period.year, period.month, period.envelopeId) as RawMovement[]
      ).map(toMovement),
    );
  }

  /** Clears the tentative flag (review approved). The only transition we support. */
  confirm(id: number): boolean {
    return (
      this.db.prepare(`UPDATE ${tables.movements} SET is_tentative = 0 WHERE id = ?`).run(id)
        .changes > 0
    );
  }

  /** Guard source: does any tentative movement exist in this account for the given month? */
  hasTentativeInAccountMonth(accountId: number, year: number, month: number): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM ${tables.movements}
         WHERE account_id = ? AND is_tentative = 1
           AND CAST(strftime('%Y', date) AS INTEGER) = ?
           AND CAST(strftime('%m', date) AS INTEGER) - 1 = ?
         LIMIT 1`,
      )
      .get(accountId, year, month);
    return row != undefined;
  }

  /** Drives the period summary's `tentative` flag: any tentative movement in this exact period? */
  hasTentativeInPeriod(period: PeriodT): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM ${tables.movements} m
         WHERE account_id = ? AND is_tentative = 1
           AND CAST(strftime('%Y', date) AS INTEGER) = ?
           AND CAST(strftime('%m', date) AS INTEGER) - 1 = ?
           AND EXISTS (SELECT 1 FROM ${tables.movementEnvelopes} me
                       WHERE me.movement_id = m.id AND me.envelope_id = ?)
         LIMIT 1`,
      )
      .get(period.accountId, period.year, period.month, period.envelopeId);
    return row != undefined;
  }

  getByTemplate(templateId: number): MovementT[] {
    return this.hydrateEnvelopeMaps(
      (
        this.db
          .prepare(`SELECT ${this.selectCols} FROM ${tables.movements} WHERE template_id = ?`)
          .all(templateId) as RawMovement[]
      ).map(toMovement),
    );
  }

  countByTemplate(templateId: number): number {
    return (
      this.db
        .prepare(`SELECT COUNT(*) AS n FROM ${tables.movements} WHERE template_id = ?`)
        .get(templateId) as { n: number }
    ).n;
  }

  private getMovementIdsByTags(tagIds: number[], matchAll: boolean): number[] {
    const inClause = tagIds.join(',');
    const sql = matchAll
      ? `SELECT movement_id FROM ${tables.movementTags} WHERE tag_id IN (${inClause})
         GROUP BY movement_id HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}`
      : `SELECT DISTINCT movement_id FROM ${tables.movementTags} WHERE tag_id IN (${inClause})`;
    return (this.db.prepare(sql).all() as { movement_id: number }[]).map((r) => r.movement_id);
  }

  getMovementById(id: number): MovementT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.movements} WHERE id = ?`)
      .get(id) as RawMovement | undefined;
    if (row == undefined) return undefined;
    return this.hydrateEnvelopeMaps([toMovement(row)])[0];
  }

  updateMovement(mov: MovementT): boolean {
    const updateMov = this.db.prepare(`
      UPDATE ${tables.movements}
      SET account_id = :accountId, name = :name, concept = :concept, quantity_cents = :quantityCents,
          isPositive = :isPositive, date = :date, category_id = :categoryId,
          additional_notes = :additionalNotes, is_anomalous = :isAnomalous
      WHERE id = :id
    `);
    const delAlloc = this.db.prepare(
      `DELETE FROM ${tables.movementEnvelopes} WHERE movement_id = ?`,
    );
    const insertAlloc = this.db.prepare(
      `INSERT INTO ${tables.movementEnvelopes} (movement_id, envelope_id, amount_cents) VALUES (?, ?, ?)`,
    );
    return this.db.transaction((m: MovementT) => {
      const changed =
        updateMov.run({
          id: m.id,
          accountId: m.accountId,
          name: m.name,
          concept: m.concept ?? null,
          quantityCents: m.quantityCents,
          isPositive: m.isPositive ? 1 : 0,
          date: dateToISO(m.date),
          categoryId: m.categoryId,
          additionalNotes: m.additionalNotes ?? null,
          isAnomalous: m.isAnomalous ? 1 : 0,
        }).changes > 0;
      // Re-write the allocation regardless (the split may change while the movement row does not).
      delAlloc.run(m.id);
      for (const [envelopeId, amount] of m.envelopeIdMap) insertAlloc.run(m.id, envelopeId, amount);
      return changed;
    })(mov);
  }

  deleteMovement(id: number): boolean {
    const delAlloc = this.db.prepare(
      `DELETE FROM ${tables.movementEnvelopes} WHERE movement_id = ?`,
    );
    const delMov = this.db.prepare(`DELETE FROM ${tables.movements} WHERE id = ?`);
    return this.db.transaction((rowId: number) => {
      delAlloc.run(rowId);
      return delMov.run(rowId).changes === 1;
    })(id);
  }

  deleteManyMovements(ids: number[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const delAlloc = this.db.prepare(
      `DELETE FROM ${tables.movementEnvelopes} WHERE movement_id IN (${placeholders})`,
    );
    const delMov = this.db.prepare(`DELETE FROM ${tables.movements} WHERE id IN (${placeholders})`);
    return this.db.transaction((rowIds: number[]) => {
      delAlloc.run(...rowIds);
      return delMov.run(...rowIds).changes;
    })(ids);
  }

  suggestNames(prefix: string, limit = 20): string[] {
    const trimmed = prefix.trim();
    if (!trimmed) return [];
    const escaped = trimmed.replace(/[%_\\]/g, '\\$&');
    const rows = this.db
      .prepare(
        `SELECT DISTINCT name FROM ${tables.movements}
         WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT ?`,
      )
      .all(`%${escaped}%`, limit) as { name: string }[];
    return rows.map((r) => r.name);
  }
}

export const movementRepository = new MovementRepository();
