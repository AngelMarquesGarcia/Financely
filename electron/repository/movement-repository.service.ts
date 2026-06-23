import { Movement, MovementFilter, Period } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

/** Converts a Date (or ISO string) to a local YYYY-MM-DD string (timezone-stable). */
function dateToISO(d: Date | unknown): string {
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // IPC structured-clone may strip the Date prototype — fall back to string slice
  return String(d).substring(0, 10);
}

/** Parses a YYYY-MM-DD string as a local-midnight Date (timezone-stable). */
function isoToDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

type RawMovement = {
  id: number;
  accountId: number;
  name: string;
  concept: string | null;
  quantityCents: number;
  isPositive: number;
  date: string;
  categoryId: number;
  envelopeId: number;
  additionalNotes: string | null;
};

function toMovement(r: RawMovement): Movement {
  return {
    id: r.id,
    accountId: r.accountId,
    name: r.name,
    concept: r.concept,
    quantityCents: r.quantityCents,
    isPositive: r.isPositive === 1,
    date: isoToDate(r.date),
    categoryId: r.categoryId,
    envelopeId: r.envelopeId,
    additionalNotes: r.additionalNotes,
  };
}

export class MovementRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, account_id as accountId, name, concept, quantity_cents as quantityCents,
    isPositive, date, category_id as categoryId, envelope_id as envelopeId,
    additional_notes as additionalNotes`;

  insertMovement(mov: Omit<Movement, 'id'>): number | bigint {
    const stmt = this.db.prepare(
      `INSERT INTO ${tables.movements}
         (account_id, name, concept, quantity_cents, isPositive, date, category_id, envelope_id, additional_notes)
       VALUES (:accountId, :name, :concept, :quantityCents, :isPositive, :date, :categoryId, :envelopeId, :additionalNotes)`,
    );
    return stmt.run({
      accountId: mov.accountId,
      name: mov.name,
      concept: mov.concept ?? null,
      quantityCents: mov.quantityCents,
      isPositive: mov.isPositive ? 1 : 0,
      date: dateToISO(mov.date),
      categoryId: mov.categoryId,
      envelopeId: mov.envelopeId,
      additionalNotes: mov.additionalNotes ?? null,
    }).lastInsertRowid;
  }

  getAllMovements(filter?: MovementFilter): Movement[] {
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
      conditions.push('envelope_id = :envelopeId');
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
    return (
      this.db
        .prepare(`SELECT ${this.selectCols} FROM ${tables.movements} ${where}`)
        .all(params) as RawMovement[]
    ).map(toMovement);
  }

  getMovementsByPeriod(period: Period): Movement[] {
    return (
      this.db
        .prepare(
          `SELECT ${this.selectCols} FROM ${tables.movements}
           WHERE account_id = ?
             AND envelope_id IS ?
             AND CAST(strftime('%Y', date) AS INTEGER) = ?
             AND CAST(strftime('%m', date) AS INTEGER) - 1 = ?`,
        )
        .all(period.accountId, period.envelopeId, period.year, period.month) as RawMovement[]
    ).map(toMovement);
  }

  private getMovementIdsByTags(tagIds: number[], matchAll: boolean): number[] {
    const inClause = tagIds.join(',');
    const sql = matchAll
      ? `SELECT movement_id FROM ${tables.movementTags} WHERE tag_id IN (${inClause})
         GROUP BY movement_id HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}`
      : `SELECT DISTINCT movement_id FROM ${tables.movementTags} WHERE tag_id IN (${inClause})`;
    return (this.db.prepare(sql).all() as { movement_id: number }[]).map((r) => r.movement_id);
  }

  getMovementById(id: number): Movement | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.movements} WHERE id = ?`)
      .get(id) as RawMovement | undefined;
    return row ? toMovement(row) : undefined;
  }

  updateMovement(mov: Movement): boolean {
    const stmt = this.db.prepare(`
      UPDATE ${tables.movements}
      SET account_id = :accountId, name = :name, concept = :concept, quantity_cents = :quantityCents,
          isPositive = :isPositive, date = :date,
          category_id = :categoryId, envelope_id = :envelopeId,
          additional_notes = :additionalNotes
      WHERE id = :id
    `);
    return (
      stmt.run({
        id: mov.id,
        accountId: mov.accountId,
        name: mov.name,
        concept: mov.concept ?? null,
        quantityCents: mov.quantityCents,
        isPositive: mov.isPositive ? 1 : 0,
        date: dateToISO(mov.date),
        categoryId: mov.categoryId,
        envelopeId: mov.envelopeId,
        additionalNotes: mov.additionalNotes ?? null,
      }).changes > 0
    );
  }

  deleteMovement(id: number): boolean {
    return this.db.prepare(`DELETE FROM ${tables.movements} WHERE id = ?`).run(id).changes === 1;
  }

  deleteManyMovements(ids: number[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM ${tables.movements} WHERE id IN (${placeholders})`);
    return this.db.transaction((rowIds: number[]) => stmt.run(...rowIds).changes)(ids);
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
