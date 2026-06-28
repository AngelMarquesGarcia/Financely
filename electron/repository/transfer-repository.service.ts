import { TransferT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';
import { dateToISO, isoToDate } from './date-utils';

type RawTransfer = {
  id: number;
  fromEnvelopeId: number;
  toEnvelopeId: number;
  accountId: number;
  quantityCents: number;
  date: string;
  isAuto: number;
  notes: string | null;
};

function toTransfer(r: RawTransfer): TransferT {
  return {
    id: r.id,
    fromEnvelopeId: r.fromEnvelopeId,
    toEnvelopeId: r.toEnvelopeId,
    accountId: r.accountId,
    quantityCents: r.quantityCents,
    date: isoToDate(r.date),
    isAuto: r.isAuto === 1,
    notes: r.notes,
  };
}

export class TransferRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `id, from_envelope_id as fromEnvelopeId, to_envelope_id as toEnvelopeId,
    account_id as accountId, quantity_cents as quantityCents, date, is_auto as isAuto, notes`;

  insert(t: Omit<TransferT, 'id'>): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.transfers}
           (from_envelope_id, to_envelope_id, account_id, quantity_cents, date, is_auto, notes)
         VALUES (:fromEnvelopeId, :toEnvelopeId, :accountId, :quantityCents, :date, :isAuto, :notes)`,
      )
      .run({
        fromEnvelopeId: t.fromEnvelopeId,
        toEnvelopeId: t.toEnvelopeId,
        accountId: t.accountId,
        quantityCents: t.quantityCents,
        date: dateToISO(t.date),
        isAuto: t.isAuto ? 1 : 0,
        notes: t.notes ?? null,
      }).lastInsertRowid;
  }

  getAll(): TransferT[] {
    return (
      this.db.prepare(`SELECT ${this.selectCols} FROM ${tables.transfers}`).all() as RawTransfer[]
    ).map(toTransfer);
  }

  getById(id: number): TransferT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.transfers} WHERE id = ?`)
      .get(id) as RawTransfer | undefined;
    return row ? toTransfer(row) : undefined;
  }

  /** All transfers touching the given envelope, as source or destination. */
  getForEnvelope(envelopeId: number): TransferT[] {
    return (
      this.db
        .prepare(
          `SELECT ${this.selectCols} FROM ${tables.transfers}
           WHERE from_envelope_id = ? OR to_envelope_id = ?`,
        )
        .all(envelopeId, envelopeId) as RawTransfer[]
    ).map(toTransfer);
  }

  delete(id: number): boolean {
    return this.db.prepare(`DELETE FROM ${tables.transfers} WHERE id = ?`).run(id).changes === 1;
  }

  /**
   * Sums the transfers in/out of an envelope for a given (year, month). `net = inCents − outCents`;
   * presence (`inCents + outCents > 0`) tells callers whether any transfer exists for the period.
   * Uses the same strftime month filter as movement queries (month is 0-indexed).
   */
  netForEnvelopePeriod(
    envelopeId: number,
    year: number,
    month: number,
  ): { inCents: number; outCents: number } {
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN to_envelope_id = :env THEN quantity_cents ELSE 0 END), 0) AS inCents,
           COALESCE(SUM(CASE WHEN from_envelope_id = :env THEN quantity_cents ELSE 0 END), 0) AS outCents
         FROM ${tables.transfers}
         WHERE (from_envelope_id = :env OR to_envelope_id = :env)
           AND CAST(strftime('%Y', date) AS INTEGER) = :year
           AND CAST(strftime('%m', date) AS INTEGER) - 1 = :month`,
      )
      .get({ env: envelopeId, year, month }) as { inCents: number; outCents: number };
    return { inCents: row.inCents, outCents: row.outCents };
  }
}

export const transferRepository = new TransferRepository();
