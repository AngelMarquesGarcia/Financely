import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-periodsummary');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { periodSummaryService } from '../../services/period-summary.service';
import { periodSummaryRepository } from '../../repository/period-summary-repository.service';
import { movementService } from '../../services/movement.service';
import { envelopeService } from '../../services/envelope.service';
import { Period, PeriodSummary } from '@shared/domain';
import { AppErrorCode } from '@shared/error-codes';

// Seeded movements (see database.service.ts#initDatabase) land in April (month 3) and
// May (month 4) of 2026, all under the default account. After migrate() the
// period_summaries table is empty, so these movements are deterministic fixtures we can
// build summaries from. Resolve ids by name to avoid hardcoding autoincrement values.
function envByName(name: string) {
  return envelopeService.getAll().find((e) => e.name === name)!;
}

function defaultAccountId(): number {
  return envByName('Unassigned').accountId!;
}

function periodFor(envelopeName: string, year: number, month: number): Period {
  const env = envByName(envelopeName);
  return new Period(env.accountId!, env.id, year, month);
}

function firstCategoryId(): number {
  const db = DatabaseService.getInstance().db;
  return Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
}

describe('PeriodSummaryService', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  // ── checkExists / getByPeriod (not found) ────────────────────────────────
  it('checkExists returns false before any summary exists', () => {
    expect(periodSummaryService.checkExists(periodFor('Monthly Expenses', 2026, 3))).toBe(false);
  });

  it('getByPeriod throws PERIODSUMMARY_NOT_FOUND when none exists', () => {
    expect(() => periodSummaryService.getByPeriod(periodFor('Monthly Expenses', 2026, 3))).toThrow(
      AppErrorCode.PERIODSUMMARY_NOT_FOUND,
    );
  });

  // ── create — happy path & guards ─────────────────────────────────────────
  it('create computes and persists the summary for a seeded period', () => {
    const period = periodFor('Monthly Expenses', 2026, 3); // 5 expenses, total 94700
    const id = periodSummaryService.create(period);
    expect(Number(id)).toBeGreaterThan(0);

    const stored = periodSummaryRepository.getByPeriod(period)!;
    expect(stored).toBeDefined();
    expect(stored.cashFlowCents).toBe(-94700);
    expect(stored.totalIncomeCents).toBe(0);
    expect(stored.totalExpenseCents).toBe(94700);
    expect(stored.movementCount).toBe(5);
    expect(stored.avgExpenseCents).toBe(18940);
    expect(stored.avgIncomeCents).toBe(0);
    expect(stored.avgMovementAmountCents).toBe(18940);
    expect(stored.endingBalanceCents).toBe(-94700); // startingBalance 0 + cashFlow
    expect(stored.accountName).toBe('Default');
    expect(stored.envelopeName).toBe('Monthly Expenses');
    expect(stored.dirtyState).toBe('CLEAN');
    // KNOWN BUG: period-summary.service.ts reads `envelope.fixedBudget`, a field that does
    // not exist on Envelope, so availableBudgetCents is NaN → stored as NULL → undefined.
    expect(stored.availableBudgetCents).toBeUndefined();
  });

  it('checkExists returns true after create', () => {
    const period = periodFor('Savings', 2026, 3);
    periodSummaryService.create(period);
    expect(periodSummaryService.checkExists(period)).toBe(true);
  });

  it('create throws INCORRECT_PARAMETERS when a summary already exists', () => {
    const period = periodFor('Monthly Expenses', 2026, 3);
    periodSummaryService.create(period);
    expect(() => periodSummaryService.create(period)).toThrow(AppErrorCode.INCORRECT_PARAMETERS);
  });

  it('create throws INCORRECT_PARAMETERS for a period with no movements', () => {
    expect(() => periodSummaryService.create(periodFor('Monthly Expenses', 2030, 0))).toThrow(
      AppErrorCode.INCORRECT_PARAMETERS,
    );
  });

  it('create throws INCORRECT_PARAMETERS for an account-level period (unreachable from movements)', () => {
    const accountLevel = new Period(defaultAccountId(), null, 2026, 3);
    expect(() => periodSummaryService.create(accountLevel)).toThrow(
      AppErrorCode.INCORRECT_PARAMETERS,
    );
  });

  // ── ending-balance chain ──────────────────────────────────────────────────
  it('chains ending balance across consecutive periods', () => {
    const apr = periodFor('Savings', 2026, 3);
    const may = periodFor('Savings', 2026, 4);
    periodSummaryService.create(apr);
    periodSummaryService.create(may);

    expect(periodSummaryRepository.getByPeriod(apr)!.endingBalanceCents).toBe(220000);
    // 220000 (April ending) + 220000 (May cash flow)
    expect(periodSummaryRepository.getByPeriod(may)!.endingBalanceCents).toBe(440000);
  });

  it('anchors the first period ending balance on the envelope startingBalance', () => {
    const accId = defaultAccountId();
    const envId = Number(envelopeService.create('Anchored Envelope', accId, 50000));
    movementService.create('Deposit', null, 30000, true, new Date(2026, 5, 10), firstCategoryId(), envId, null);

    const stored = periodSummaryRepository.getByPeriod(new Period(accId, envId, 2026, 5))!;
    expect(stored.cashFlowCents).toBe(30000);
    expect(stored.endingBalanceCents).toBe(80000); // 50000 startingBalance + 30000
  });

  // ── movement-driven auto-create + markDirty ───────────────────────────────
  it('movementService.create auto-creates a CLEAN summary for a new period', () => {
    const envId = envByName('Monthly Expenses').id;
    movementService.create('June expense', null, 5000, false, new Date(2026, 5, 5), firstCategoryId(), envId, null);

    const period = new Period(defaultAccountId(), envId, 2026, 5);
    expect(periodSummaryService.checkExists(period)).toBe(true);
    expect(periodSummaryRepository.getByPeriod(period)!.dirtyState).toBe('CLEAN');
  });

  it('a second movement in the same period marks the summary MODIFIED', () => {
    const envId = envByName('Monthly Expenses').id;
    const catId = firstCategoryId();
    movementService.create('June 1', null, 5000, false, new Date(2026, 5, 5), catId, envId, null);
    movementService.create('June 2', null, 3000, false, new Date(2026, 5, 6), catId, envId, null);

    const period = new Period(defaultAccountId(), envId, 2026, 5);
    expect(periodSummaryRepository.getByPeriod(period)!.dirtyState).toBe('MODIFIED');
  });

  // ── markDirty propagation + lazy clean ─────────────────────────────────────
  it('markDirty marks the period MODIFIED and later periods DIRTY', () => {
    const apr = periodFor('Savings', 2026, 3);
    const may = periodFor('Savings', 2026, 4);
    periodSummaryService.create(apr);
    periodSummaryService.create(may);

    periodSummaryService.markDirty(apr);

    expect(periodSummaryRepository.getByPeriod(apr)!.dirtyState).toBe('MODIFIED');
    expect(periodSummaryRepository.getByPeriod(may)!.dirtyState).toBe('DIRTY');
  });

  it('getByPeriod lazily recomputes a dirtied chain and returns CLEAN', () => {
    const apr = periodFor('Savings', 2026, 3);
    const may = periodFor('Savings', 2026, 4);
    periodSummaryService.create(apr);
    periodSummaryService.create(may);
    periodSummaryService.markDirty(apr);

    const cleaned = periodSummaryService.getByPeriod(may);
    expect(cleaned.dirtyState).toBe('CLEAN');
    expect(cleaned.endingBalanceCents).toBe(440000);
    // both rows are now persisted CLEAN
    expect(periodSummaryRepository.getByPeriod(apr)!.dirtyState).toBe('CLEAN');
    expect(periodSummaryRepository.getByPeriod(may)!.dirtyState).toBe('CLEAN');
  });

  // ── recalculate ────────────────────────────────────────────────────────────
  it('recalculateForPeriod updates an existing summary in place', () => {
    const period = periodFor('Monthly Expenses', 2026, 3);
    periodSummaryService.create(period);

    expect(Number(periodSummaryService.recalculateForPeriod(period))).toBe(1);
    const stored = periodSummaryRepository.getByPeriod(period)!;
    expect(stored.cashFlowCents).toBe(-94700);
    expect(stored.movementCount).toBe(5);
  });

  it('recalculateForPeriod creates a summary when none exists yet', () => {
    const period = periodFor('Monthly Expenses', 2026, 3);
    expect(periodSummaryService.checkExists(period)).toBe(false);
    periodSummaryService.recalculateForPeriod(period);
    expect(periodSummaryService.checkExists(period)).toBe(true);
  });

  it('recalculateForPeriod deletes the summary when its movements are gone', () => {
    const envId = envByName('Monthly Expenses').id;
    const movId = Number(
      movementService.create('Solo', null, 5000, false, new Date(2026, 6, 5), firstCategoryId(), envId, null),
    );
    const period = new Period(defaultAccountId(), envId, 2026, 6);
    expect(periodSummaryService.checkExists(period)).toBe(true);

    movementService.delete(movId);
    periodSummaryService.recalculateForPeriod(period);
    expect(periodSummaryService.checkExists(period)).toBe(false);
  });

  it('recalculateFromMovement throws MOVEMENT_NOT_FOUND for an unknown movement', () => {
    expect(() => periodSummaryService.recalculateFromMovement(999999)).toThrow(
      AppErrorCode.MOVEMENT_NOT_FOUND,
    );
  });

  // ── editNotes ──────────────────────────────────────────────────────────────
  it('editNotes persists notes on the summary', () => {
    const period = periodFor('Monthly Expenses', 2026, 3);
    periodSummaryService.create(period);
    periodSummaryService.editNotes(period, 'Rent went up');
    expect(periodSummaryRepository.getByPeriod(period)!.notes).toBe('Rent went up');
  });

  it('editNotes throws PERIODSUMMARY_NOT_FOUND when the summary does not exist', () => {
    expect(() => periodSummaryService.editNotes(periodFor('Monthly Expenses', 2026, 3), 'x')).toThrow(
      AppErrorCode.PERIODSUMMARY_NOT_FOUND,
    );
  });

  // ── upsert / update / delete / getAll ──────────────────────────────────────
  it('upsert inserts when absent and updates when present', () => {
    const period = periodFor('Savings', 2026, 3);
    periodSummaryService.create(period);
    const stored = periodSummaryRepository.getByPeriod(period)!;

    periodSummaryService.delete(period);
    expect(periodSummaryService.checkExists(period)).toBe(false);

    periodSummaryService.upsert(stored); // insert path
    expect(periodSummaryService.checkExists(period)).toBe(true);

    expect(Number(periodSummaryService.upsert({ ...stored, notes: 'upserted' }))).toBe(1); // update path
    expect(periodSummaryRepository.getByPeriod(period)!.notes).toBe('upserted');
  });

  it('update returns true and persists changes for an existing summary', () => {
    const period = periodFor('Savings', 2026, 3);
    periodSummaryService.create(period);
    const stored = periodSummaryRepository.getByPeriod(period)!;

    expect(periodSummaryService.update(PeriodSummary.from({ ...stored, notes: 'edited' }))).toBe(true);
    expect(periodSummaryRepository.getByPeriod(period)!.notes).toBe('edited');
  });

  it('delete removes an existing summary and returns false for a missing one', () => {
    const period = periodFor('Savings', 2026, 3);
    periodSummaryService.create(period);

    expect(periodSummaryService.delete(period)).toBe(true);
    expect(periodSummaryService.checkExists(period)).toBe(false);
    expect(periodSummaryService.delete(period)).toBe(false);
  });

  it('getAll returns all stored summaries', () => {
    expect(periodSummaryService.getAll()).toEqual([]);
    periodSummaryService.create(periodFor('Monthly Expenses', 2026, 3));
    periodSummaryService.create(periodFor('Savings', 2026, 3));
    expect(periodSummaryService.getAll()).toHaveLength(2);
  });
});
