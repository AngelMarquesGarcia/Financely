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
    dirty_state               AS dirtyState
  `;

  insert(s: PeriodSummaryT): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.periodSummaries} (
          account_id, account_name, envelope_id, envelope_name, year, month,
          cash_flow_cents, total_income_cents, total_expense_cents,
          avg_expense_cents, avg_income_cents, avg_movement_amount_cents,
          movement_count, ending_balance_cents, net_transfers_cents,
          budget_cents, max_savings_cents, notes, dirty_state
        ) VALUES (
          :accountId, :accountName, :envelopeId, :envelopeName, :year, :month,
          :cashFlowCents, :totalIncomeCents, :totalExpenseCents,
          :avgExpenseCents, :avgIncomeCents, :avgMovementAmountCents,
          :movementCount, :endingBalanceCents, :netTransfersCents,
          :budgetCents, :maxSavingsCents, :notes, :dirtyState
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
            dirty_state = :dirtyState
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
  };
}

export const periodSummaryRepository = new PeriodSummaryRepository();
