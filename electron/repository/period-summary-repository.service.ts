import { DirtyState, PeriodT, PeriodSummaryT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

export class PeriodSummaryRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `
    account_id        AS accountId,
    account_name      AS accountName,
    envelope_id       AS envelopeId,
    envelope_name     AS envelopeName,
    year,
    month,
    cash_flow_cents           AS cashFlowCents,
    total_income_cents        AS totalIncomeCents,
    total_expense_cents       AS totalExpenseCents,
    avg_expense_cents         AS avgExpenseCents,
    avg_income_cents          AS avgIncomeCents,
    avg_movement_amount_cents AS avgMovementAmountCents,
    movement_count            AS movementCount,
    ending_balance_cents      AS endingBalanceCents,
    net_transfers_cents       AS netTransfersCents,
    budget_cents              AS budgetCents,
    max_savings_cents         AS maxSavingsCents,
    notes,
    dirty_state               AS dirtyState,
    tentative,
    without_anom_cash_flow_cents           AS woCashFlowCents,
    without_anom_total_income_cents        AS woTotalIncomeCents,
    without_anom_total_expense_cents       AS woTotalExpenseCents,
    without_anom_avg_expense_cents         AS woAvgExpenseCents,
    without_anom_avg_income_cents          AS woAvgIncomeCents,
    without_anom_avg_movement_amount_cents AS woAvgMovementAmountCents,
    without_anom_movement_count            AS woMovementCount
  `;

  insert(s: PeriodSummaryT): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.periodSummaries} (
          account_id, account_name, envelope_id, envelope_name, year, month,
          cash_flow_cents, total_income_cents, total_expense_cents,
          avg_expense_cents, avg_income_cents, avg_movement_amount_cents,
          movement_count, ending_balance_cents, net_transfers_cents,
          budget_cents, max_savings_cents, notes, dirty_state, tentative,
          without_anom_cash_flow_cents, without_anom_total_income_cents,
          without_anom_total_expense_cents, without_anom_avg_expense_cents,
          without_anom_avg_income_cents, without_anom_avg_movement_amount_cents,
          without_anom_movement_count
        ) VALUES (
          :accountId, :accountName, :envelopeId, :envelopeName, :year, :month,
          :cashFlowCents, :totalIncomeCents, :totalExpenseCents,
          :avgExpenseCents, :avgIncomeCents, :avgMovementAmountCents,
          :movementCount, :endingBalanceCents, :netTransfersCents,
          :budgetCents, :maxSavingsCents, :notes, :dirtyState, :tentative,
          :woCashFlowCents, :woTotalIncomeCents,
          :woTotalExpenseCents, :woAvgExpenseCents,
          :woAvgIncomeCents, :woAvgMovementAmountCents,
          :woMovementCount
        )`,
      )
      .run(toRow(s)).lastInsertRowid;
  }

  getAll(): PeriodSummaryT[] {
    return (
      this.db.prepare(`SELECT ${this.selectCols} FROM ${tables.periodSummaries}`).all() as RawRow[]
    ).map(toSummary);
  }

  getByPeriod(period: PeriodT): PeriodSummaryT | undefined {
    const row = this.db
      .prepare(
        `SELECT ${this.selectCols} FROM ${tables.periodSummaries}
         WHERE account_id = ? AND year = ? AND month = ?
           AND (envelope_id IS ?)`,
      )
      .get(period.accountId, period.year, period.month, period.envelopeId) as RawRow | undefined;
    return row ? toSummary(row) : undefined;
  }

  /** Most recent summary for an envelope (chronologically last by year, then month). */
  getLatest(envelopeId: number): PeriodSummaryT | undefined {
    const row = this.db
      .prepare(
        `SELECT ${this.selectCols} FROM ${tables.periodSummaries}
         WHERE envelope_id = ?
         ORDER BY year DESC, month DESC
         LIMIT 1`,
      )
      .get(envelopeId) as RawRow | undefined;
    return row ? toSummary(row) : undefined;
  }

  /**
   * Most recent summary strictly before (year, month) for the same account+envelope — the correct
   * anchor for the ending-balance chain, which must skip months with no activity (gaps) rather than
   * only looking at the immediately-preceding month.
   */
  getLatestBefore(period: PeriodT): PeriodSummaryT | undefined {
    const row = this.db
      .prepare(
        `SELECT ${this.selectCols} FROM ${tables.periodSummaries}
         WHERE account_id = ? AND (envelope_id IS ?)
           AND (year < ? OR (year = ? AND month < ?))
         ORDER BY year DESC, month DESC
         LIMIT 1`,
      )
      .get(
        period.accountId,
        period.envelopeId,
        period.year,
        period.year,
        period.month,
      ) as RawRow | undefined;
    return row ? toSummary(row) : undefined;
  }

  /**
   * Marks every later CLEAN summary of the same account+envelope DIRTY so its ending balance is
   * re-chained on next read. Gap-safe (updates all later months in one statement, not just the
   * contiguous run). MODIFIED summaries are left as-is — they already force a full recompute.
   */
  markLaterDirty(period: PeriodT): void {
    this.db
      .prepare(
        `UPDATE ${tables.periodSummaries} SET dirty_state = 'DIRTY'
         WHERE account_id = :accountId AND (envelope_id IS :envelopeId)
           AND (year > :year OR (year = :year AND month > :month))
           AND dirty_state = 'CLEAN'`,
      )
      .run({
        accountId: period.accountId,
        envelopeId: period.envelopeId,
        year: period.year,
        month: period.month,
      });
  }

  /** Removes every summary for an envelope — used when the envelope itself is deleted. */
  deleteAllForEnvelope(envelopeId: number): void {
    this.db
      .prepare(`DELETE FROM ${tables.periodSummaries} WHERE envelope_id = ?`)
      .run(envelopeId);
  }

  update(s: PeriodSummaryT): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ${tables.periodSummaries} SET
            account_id = :accountId, account_name = :accountName,
            envelope_id = :envelopeId, envelope_name = :envelopeName,
            year = :year, month = :month,
            cash_flow_cents = :cashFlowCents,
            total_income_cents = :totalIncomeCents,
            total_expense_cents = :totalExpenseCents,
            avg_expense_cents = :avgExpenseCents,
            avg_income_cents = :avgIncomeCents,
            avg_movement_amount_cents = :avgMovementAmountCents,
            movement_count = :movementCount,
            ending_balance_cents = :endingBalanceCents,
            net_transfers_cents = :netTransfersCents,
            budget_cents = :budgetCents,
            max_savings_cents = :maxSavingsCents,
            notes = :notes,
            dirty_state = :dirtyState,
            tentative = :tentative,
            without_anom_cash_flow_cents = :woCashFlowCents,
            without_anom_total_income_cents = :woTotalIncomeCents,
            without_anom_total_expense_cents = :woTotalExpenseCents,
            without_anom_avg_expense_cents = :woAvgExpenseCents,
            without_anom_avg_income_cents = :woAvgIncomeCents,
            without_anom_avg_movement_amount_cents = :woAvgMovementAmountCents,
            without_anom_movement_count = :woMovementCount
           WHERE account_id = :accountId
             AND year = :year
             AND month = :month
             AND (envelope_id IS :envelopeId)`,
        )
        .run(toRow(s)).changes > 0
    );
  }

  /**
   * Stamps the budget + savings-cap snapshot onto the exact (year, month) period for an envelope.
   * Only the targeted month is updated — past and future existing summaries are untouched.
   * New summaries created in the future pick up the envelope's current values at creation.
   * Returns the number of rows updated (0 if no summary exists for that period yet).
   */
  stampEnvelopeSnapshot(
    envelopeId: number,
    budgetCents: number | null,
    maxSavingsCents: number | null,
    year: number,
    month: number,
  ): number {
    return Number(
      this.db
        .prepare(
          `UPDATE ${tables.periodSummaries}
             SET budget_cents = :budgetCents, max_savings_cents = :maxSavingsCents
           WHERE envelope_id = :envelopeId
             AND year = :year
             AND month = :month`,
        )
        .run({ budgetCents, maxSavingsCents, envelopeId, year, month }).changes,
    );
  }

  delete(period: PeriodT): boolean {
    return (
      this.db
        .prepare(
          `DELETE FROM ${tables.periodSummaries}
           WHERE account_id = ?
             AND envelope_id IS ?
             AND year = ?
             AND month = ?`,
        )
        .run(period.accountId, period.envelopeId, period.year, period.month).changes === 1
    );
  }
}

type RawRow = {
  accountId: number;
  accountName: string;
  envelopeId: number | null;
  envelopeName: string | null;
  year: number;
  month: number;
  cashFlowCents: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  avgExpenseCents: number;
  avgIncomeCents: number;
  avgMovementAmountCents: number;
  movementCount: number;
  endingBalanceCents: number;
  netTransfersCents: number;
  budgetCents: number | null;
  maxSavingsCents: number | null;
  notes: string | null;
  dirtyState: string;
  tentative: number;
  woCashFlowCents: number | null;
  woTotalIncomeCents: number | null;
  woTotalExpenseCents: number | null;
  woAvgExpenseCents: number | null;
  woAvgIncomeCents: number | null;
  woAvgMovementAmountCents: number | null;
  woMovementCount: number | null;
};

function toSummary(r: RawRow): PeriodSummaryT {
  return {
    accountId: r.accountId,
    accountName: r.accountName,
    envelopeId: r.envelopeId,
    envelopeName: r.envelopeName,
    year: r.year,
    month: r.month,
    cashFlowCents: r.cashFlowCents,
    totalIncomeCents: r.totalIncomeCents,
    totalExpenseCents: r.totalExpenseCents,
    avgExpenseCents: r.avgExpenseCents,
    avgIncomeCents: r.avgIncomeCents,
    avgMovementAmountCents: r.avgMovementAmountCents,
    movementCount: r.movementCount,
    endingBalanceCents: r.endingBalanceCents,
    netTransfersCents: r.netTransfersCents,
    budgetCents: r.budgetCents ?? undefined,
    maxSavingsCents: r.maxSavingsCents ?? undefined,
    notes: r.notes ?? undefined,
    dirtyState: r.dirtyState as DirtyState,
    tentative: r.tentative === 1,
    // All seven mirror columns are written together, so a null count means "no mirror stored".
    summaryWithoutAnomalies:
      r.woMovementCount === null
        ? null
        : {
            cashFlowCents: r.woCashFlowCents!,
            totalIncomeCents: r.woTotalIncomeCents!,
            totalExpenseCents: r.woTotalExpenseCents!,
            avgExpenseCents: r.woAvgExpenseCents!,
            avgIncomeCents: r.woAvgIncomeCents!,
            avgMovementAmountCents: r.woAvgMovementAmountCents!,
            movementCount: r.woMovementCount,
          },
  };
}

function toRow(s: PeriodSummaryT): Record<string, unknown> {
  return {
    accountId: s.accountId,
    accountName: s.accountName,
    envelopeId: s.envelopeId ?? null,
    envelopeName: s.envelopeName ?? null,
    year: s.year,
    month: s.month,
    cashFlowCents: s.cashFlowCents,
    totalIncomeCents: s.totalIncomeCents,
    totalExpenseCents: s.totalExpenseCents,
    avgExpenseCents: s.avgExpenseCents,
    avgIncomeCents: s.avgIncomeCents,
    avgMovementAmountCents: s.avgMovementAmountCents,
    movementCount: s.movementCount,
    endingBalanceCents: s.endingBalanceCents,
    netTransfersCents: s.netTransfersCents ?? 0,
    budgetCents: s.budgetCents ?? null,
    maxSavingsCents: s.maxSavingsCents ?? null,
    notes: s.notes ?? null,
    dirtyState: s.dirtyState,
    tentative: s.tentative ? 1 : 0,
    woCashFlowCents: s.summaryWithoutAnomalies?.cashFlowCents ?? null,
    woTotalIncomeCents: s.summaryWithoutAnomalies?.totalIncomeCents ?? null,
    woTotalExpenseCents: s.summaryWithoutAnomalies?.totalExpenseCents ?? null,
    woAvgExpenseCents: s.summaryWithoutAnomalies?.avgExpenseCents ?? null,
    woAvgIncomeCents: s.summaryWithoutAnomalies?.avgIncomeCents ?? null,
    woAvgMovementAmountCents: s.summaryWithoutAnomalies?.avgMovementAmountCents ?? null,
    woMovementCount: s.summaryWithoutAnomalies?.movementCount ?? null,
  };
}

export const periodSummaryRepository = new PeriodSummaryRepository();
