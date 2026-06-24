import { DirtyState, PeriodT, PeriodSummaryT } from '@shared/types';
import { DatabaseService } from './database.service';
import { tables } from '../constants';

export class PeriodSummaryRepository {
  private readonly db = DatabaseService.getInstance().db;

  private readonly selectCols = `
    id,
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
    budget_cents              AS availableBudgetCents,
    notes,
    dirty_state               AS dirtyState
  `;

  insert(s: Omit<PeriodSummaryT, 'id'>): number | bigint {
    return this.db
      .prepare(
        `INSERT INTO ${tables.periodSummaries} (
          account_id, account_name, envelope_id, envelope_name, year, month,
          cash_flow_cents, total_income_cents, total_expense_cents,
          avg_expense_cents, avg_income_cents, avg_movement_amount_cents,
          movement_count, ending_balance_cents, budget_cents, notes, dirty_state
        ) VALUES (
          :accountId, :accountName, :envelopeId, :envelopeName, :year, :month,
          :cashFlowCents, :totalIncomeCents, :totalExpenseCents,
          :avgExpenseCents, :avgIncomeCents, :avgMovementAmountCents,
          :movementCount, :endingBalanceCents, :availableBudgetCents, :notes, :dirtyState
        )`,
      )
      .run(toRow(s)).lastInsertRowid;
  }

  getAll(): PeriodSummaryT[] {
    return (
      this.db.prepare(`SELECT ${this.selectCols} FROM ${tables.periodSummaries}`).all() as RawRow[]
    ).map(toSummary);
  }

  getById(id: number): PeriodSummaryT | undefined {
    const row = this.db
      .prepare(`SELECT ${this.selectCols} FROM ${tables.periodSummaries} WHERE id = ?`)
      .get(id) as RawRow | undefined;
    return row ? toSummary(row) : undefined;
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
            budget_cents = :availableBudgetCents,
            notes = :notes,
            dirty_state = :dirtyState
           WHERE id = :id`,
        )
        .run({ ...toRow(s), id: s.id }).changes > 0
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
  id: number;
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
  availableBudgetCents: number | null;
  notes: string | null;
  dirtyState: string;
};

function toSummary(r: RawRow): PeriodSummaryT {
  return {
    id: r.id,
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
    availableBudgetCents: r.availableBudgetCents ?? undefined,
    notes: r.notes ?? undefined,
    dirtyState: r.dirtyState as DirtyState,
  };
}

function toRow(s: Omit<PeriodSummaryT, 'id'>): Record<string, unknown> {
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
    availableBudgetCents: s.availableBudgetCents ?? null,
    notes: s.notes ?? null,
    dirtyState: s.dirtyState,
  };
}

export const periodSummaryRepository = new PeriodSummaryRepository();
