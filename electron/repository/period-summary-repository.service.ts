import { BasicSummary, DirtyState, PeriodT, PeriodSummaryT } from '@shared/types';
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
    without_anom_movement_count            AS woMovementCount,
    compound_adj_cash_flow_cents           AS caCashFlowCents,
    compound_adj_total_income_cents        AS caTotalIncomeCents,
    compound_adj_total_expense_cents       AS caTotalExpenseCents,
    compound_adj_avg_expense_cents         AS caAvgExpenseCents,
    compound_adj_avg_income_cents          AS caAvgIncomeCents,
    compound_adj_avg_movement_amount_cents AS caAvgMovementAmountCents,
    compound_adj_movement_count            AS caMovementCount,
    compound_adj_wo_anom_cash_flow_cents           AS cawoCashFlowCents,
    compound_adj_wo_anom_total_income_cents        AS cawoTotalIncomeCents,
    compound_adj_wo_anom_total_expense_cents       AS cawoTotalExpenseCents,
    compound_adj_wo_anom_avg_expense_cents         AS cawoAvgExpenseCents,
    compound_adj_wo_anom_avg_income_cents          AS cawoAvgIncomeCents,
    compound_adj_wo_anom_avg_movement_amount_cents AS cawoAvgMovementAmountCents,
    compound_adj_wo_anom_movement_count            AS cawoMovementCount
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
          without_anom_movement_count,
          compound_adj_cash_flow_cents, compound_adj_total_income_cents,
          compound_adj_total_expense_cents, compound_adj_avg_expense_cents,
          compound_adj_avg_income_cents, compound_adj_avg_movement_amount_cents,
          compound_adj_movement_count,
          compound_adj_wo_anom_cash_flow_cents, compound_adj_wo_anom_total_income_cents,
          compound_adj_wo_anom_total_expense_cents, compound_adj_wo_anom_avg_expense_cents,
          compound_adj_wo_anom_avg_income_cents, compound_adj_wo_anom_avg_movement_amount_cents,
          compound_adj_wo_anom_movement_count
        ) VALUES (
          :accountId, :accountName, :envelopeId, :envelopeName, :year, :month,
          :cashFlowCents, :totalIncomeCents, :totalExpenseCents,
          :avgExpenseCents, :avgIncomeCents, :avgMovementAmountCents,
          :movementCount, :endingBalanceCents, :netTransfersCents,
          :budgetCents, :maxSavingsCents, :notes, :dirtyState, :tentative,
          :woCashFlowCents, :woTotalIncomeCents,
          :woTotalExpenseCents, :woAvgExpenseCents,
          :woAvgIncomeCents, :woAvgMovementAmountCents,
          :woMovementCount,
          :caCashFlowCents, :caTotalIncomeCents,
          :caTotalExpenseCents, :caAvgExpenseCents,
          :caAvgIncomeCents, :caAvgMovementAmountCents,
          :caMovementCount,
          :cawoCashFlowCents, :cawoTotalIncomeCents,
          :cawoTotalExpenseCents, :cawoAvgExpenseCents,
          :cawoAvgIncomeCents, :cawoAvgMovementAmountCents,
          :cawoMovementCount
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
      .get(period.accountId, period.envelopeId, period.year, period.year, period.month) as
      | RawRow
      | undefined;
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
    this.db.prepare(`DELETE FROM ${tables.periodSummaries} WHERE envelope_id = ?`).run(envelopeId);
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
            without_anom_movement_count = :woMovementCount,
            compound_adj_cash_flow_cents = :caCashFlowCents,
            compound_adj_total_income_cents = :caTotalIncomeCents,
            compound_adj_total_expense_cents = :caTotalExpenseCents,
            compound_adj_avg_expense_cents = :caAvgExpenseCents,
            compound_adj_avg_income_cents = :caAvgIncomeCents,
            compound_adj_avg_movement_amount_cents = :caAvgMovementAmountCents,
            compound_adj_movement_count = :caMovementCount,
            compound_adj_wo_anom_cash_flow_cents = :cawoCashFlowCents,
            compound_adj_wo_anom_total_income_cents = :cawoTotalIncomeCents,
            compound_adj_wo_anom_total_expense_cents = :cawoTotalExpenseCents,
            compound_adj_wo_anom_avg_expense_cents = :cawoAvgExpenseCents,
            compound_adj_wo_anom_avg_income_cents = :cawoAvgIncomeCents,
            compound_adj_wo_anom_avg_movement_amount_cents = :cawoAvgMovementAmountCents,
            compound_adj_wo_anom_movement_count = :cawoMovementCount
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
  caCashFlowCents: number | null;
  caTotalIncomeCents: number | null;
  caTotalExpenseCents: number | null;
  caAvgExpenseCents: number | null;
  caAvgIncomeCents: number | null;
  caAvgMovementAmountCents: number | null;
  caMovementCount: number | null;
  cawoCashFlowCents: number | null;
  cawoTotalIncomeCents: number | null;
  cawoTotalExpenseCents: number | null;
  cawoAvgExpenseCents: number | null;
  cawoAvgIncomeCents: number | null;
  cawoAvgMovementAmountCents: number | null;
  cawoMovementCount: number | null;
};

/** Folds a prefixed group of raw columns back into a BasicSummary, or null when the group is unset
 *  (all seven columns are written together, so a null count means "not stored"). */
function toBasic(
  count: number | null,
  cashFlow: number | null,
  income: number | null,
  expense: number | null,
  avgExpense: number | null,
  avgIncome: number | null,
  avgAmount: number | null,
): BasicSummary | null {
  return count === null
    ? null
    : {
        cashFlowCents: cashFlow!,
        totalIncomeCents: income!,
        totalExpenseCents: expense!,
        avgExpenseCents: avgExpense!,
        avgIncomeCents: avgIncome!,
        avgMovementAmountCents: avgAmount!,
        movementCount: count,
      };
}

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
    // Each mirror's seven columns are written together, so a null count means "no mirror stored".
    summaryWithoutAnomalies: toBasic(
      r.woMovementCount,
      r.woCashFlowCents,
      r.woTotalIncomeCents,
      r.woTotalExpenseCents,
      r.woAvgExpenseCents,
      r.woAvgIncomeCents,
      r.woAvgMovementAmountCents,
    ),
    summaryCompoundAdjusted: toBasic(
      r.caMovementCount,
      r.caCashFlowCents,
      r.caTotalIncomeCents,
      r.caTotalExpenseCents,
      r.caAvgExpenseCents,
      r.caAvgIncomeCents,
      r.caAvgMovementAmountCents,
    ),
    summaryCompoundAdjustedWithoutAnomalies: toBasic(
      r.cawoMovementCount,
      r.cawoCashFlowCents,
      r.cawoTotalIncomeCents,
      r.cawoTotalExpenseCents,
      r.cawoAvgExpenseCents,
      r.cawoAvgIncomeCents,
      r.cawoAvgMovementAmountCents,
    ),
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
    caCashFlowCents: s.summaryCompoundAdjusted?.cashFlowCents ?? null,
    caTotalIncomeCents: s.summaryCompoundAdjusted?.totalIncomeCents ?? null,
    caTotalExpenseCents: s.summaryCompoundAdjusted?.totalExpenseCents ?? null,
    caAvgExpenseCents: s.summaryCompoundAdjusted?.avgExpenseCents ?? null,
    caAvgIncomeCents: s.summaryCompoundAdjusted?.avgIncomeCents ?? null,
    caAvgMovementAmountCents: s.summaryCompoundAdjusted?.avgMovementAmountCents ?? null,
    caMovementCount: s.summaryCompoundAdjusted?.movementCount ?? null,
    cawoCashFlowCents: s.summaryCompoundAdjustedWithoutAnomalies?.cashFlowCents ?? null,
    cawoTotalIncomeCents: s.summaryCompoundAdjustedWithoutAnomalies?.totalIncomeCents ?? null,
    cawoTotalExpenseCents: s.summaryCompoundAdjustedWithoutAnomalies?.totalExpenseCents ?? null,
    cawoAvgExpenseCents: s.summaryCompoundAdjustedWithoutAnomalies?.avgExpenseCents ?? null,
    cawoAvgIncomeCents: s.summaryCompoundAdjustedWithoutAnomalies?.avgIncomeCents ?? null,
    cawoAvgMovementAmountCents:
      s.summaryCompoundAdjustedWithoutAnomalies?.avgMovementAmountCents ?? null,
    cawoMovementCount: s.summaryCompoundAdjustedWithoutAnomalies?.movementCount ?? null,
  };
}

export const periodSummaryRepository = new PeriodSummaryRepository();
