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
import { envelopeRepository } from '../../repository/envelope-repository.service';
import { movementService } from '../../services/movement.service';
import { envelopeService } from '../../services/envelope.service';
import { accountService } from '../../services/account.service';
import { Period, PeriodSummary, Envelope, Movement } from '@shared/domain';
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

/** A single-envelope allocation `{ envelopeId → amount }` — the normal (non-split) case. */
const one = (envelopeId: number, amount: number) => new Map([[envelopeId, amount]]);

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
    // 'Monthly Expenses' is seeded without a budget, so no snapshot is stored.
    expect(stored.budgetCents).toBeUndefined();
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

  // ── budget + savings-cap snapshot ──────────────────────────────────────────
  it('stamps budgetCents and maxSavingsCents from the envelope on create', () => {
    const accId = defaultAccountId();
    const envId = Number(envelopeService.create('Groceries', accId, 0, 30000, 60000));
    movementService.create('Shop', null, 5000, false, new Date(2026, 3, 5), firstCategoryId(), one(envId, 5000), null);

    const stored = periodSummaryRepository.getByPeriod(new Period(accId, envId, 2026, 3))!;
    expect(stored.budgetCents).toBe(30000);
    expect(stored.maxSavingsCents).toBe(60000);
  });

  it('preserves the snapshots on recalc even when the envelope changes', () => {
    const accId = defaultAccountId();
    const envId = Number(envelopeService.create('Groceries', accId, 0, 30000, 60000));
    movementService.create('Shop', null, 5000, false, new Date(2026, 3, 5), firstCategoryId(), one(envId, 5000), null);
    const period = new Period(accId, envId, 2026, 3);

    // Change the envelope directly (bypassing the service re-stamp), then force a recalc.
    envelopeRepository.updateEnvelope(
      Envelope.from({
        id: envId,
        name: 'Groceries',
        accountId: accId,
        isDefault: false,
        startingBalance: 0,
        budgetCents: 99000,
        maxSavingsCents: 120000,
        overflowsTo: null,
      }),
    );
    periodSummaryService.recalculateForPeriod(period);

    const stored = periodSummaryRepository.getByPeriod(period)!;
    expect(stored.budgetCents).toBe(30000);
    expect(stored.maxSavingsCents).toBe(60000);
  });

  it('re-stamps current/future summaries on envelope edit but freezes past months', () => {
    const accId = defaultAccountId();
    const envId = Number(envelopeService.create('Groceries', accId, 0, 30000, 60000));

    const now = new Date();
    const pastDate = new Date(now.getFullYear(), now.getMonth() - 1, 5);
    const curDate = new Date(now.getFullYear(), now.getMonth(), 5);
    movementService.create('Past shop', null, 5000, false, pastDate, firstCategoryId(), one(envId, 5000), null);
    movementService.create('Current shop', null, 5000, false, curDate, firstCategoryId(), one(envId, 5000), null);

    const pastP = new Period(accId, envId, pastDate.getFullYear(), pastDate.getMonth());
    const curP = new Period(accId, envId, curDate.getFullYear(), curDate.getMonth());
    expect(periodSummaryRepository.getByPeriod(pastP)!.budgetCents).toBe(30000);
    expect(periodSummaryRepository.getByPeriod(curP)!.maxSavingsCents).toBe(60000);

    envelopeService.update(
      Envelope.from({
        id: envId,
        name: 'Groceries',
        accountId: accId,
        isDefault: false,
        startingBalance: 0,
        budgetCents: 45000,
        maxSavingsCents: 90000,
        overflowsTo: null,
      }),
    );

    const past = periodSummaryRepository.getByPeriod(pastP)!;
    const cur = periodSummaryRepository.getByPeriod(curP)!;
    expect(past.budgetCents).toBe(30000); // past frozen
    expect(past.maxSavingsCents).toBe(60000);
    expect(cur.budgetCents).toBe(45000); // current re-stamped
    expect(cur.maxSavingsCents).toBe(90000);
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
    movementService.create('Deposit', null, 30000, true, new Date(2026, 5, 10), firstCategoryId(), one(envId, 30000), null);

    const stored = periodSummaryRepository.getByPeriod(new Period(accId, envId, 2026, 5))!;
    expect(stored.cashFlowCents).toBe(30000);
    expect(stored.endingBalanceCents).toBe(80000); // 50000 startingBalance + 30000
  });

  // ── movement-driven auto-create + markDirty ───────────────────────────────
  it('movementService.create auto-creates a CLEAN summary for a new period', () => {
    const envId = envByName('Monthly Expenses').id;
    movementService.create('June expense', null, 5000, false, new Date(2026, 5, 5), firstCategoryId(), one(envId, 5000), null);

    const period = new Period(defaultAccountId(), envId, 2026, 5);
    expect(periodSummaryService.checkExists(period)).toBe(true);
    expect(periodSummaryRepository.getByPeriod(period)!.dirtyState).toBe('CLEAN');
  });

  it('a second movement in the same period marks the summary MODIFIED', () => {
    const envId = envByName('Monthly Expenses').id;
    const catId = firstCategoryId();
    movementService.create('June 1', null, 5000, false, new Date(2026, 5, 5), catId, one(envId, 5000), null);
    movementService.create('June 2', null, 3000, false, new Date(2026, 5, 6), catId, one(envId, 3000), null);

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
      movementService.create('Solo', null, 5000, false, new Date(2026, 6, 5), firstCategoryId(), one(envId, 5000), null),
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

  // ── getLatestPeriodSummary ─────────────────────────────────────────────────
  it('getLatestPeriodSummary returns the chronologically last summary', () => {
    const savings = envByName('Savings');
    periodSummaryService.create(periodFor('Savings', 2026, 3)); // April: ending 220000
    periodSummaryService.create(periodFor('Savings', 2026, 4)); // May: 220000 + 220000

    const latest = periodSummaryService.getLatestPeriodSummary(savings.id)!;
    expect(latest.year).toBe(2026);
    expect(latest.month).toBe(4); // May, not April
    expect(latest.endingBalanceCents).toBe(440000);
    expect(latest.dirtyState).toBe('CLEAN');
  });

  it('getLatestPeriodSummary returns undefined when the envelope has no summary', () => {
    const savings = envByName('Savings');
    expect(periodSummaryService.getLatestPeriodSummary(savings.id)).toBeUndefined();
  });

  // ── split movements (CU3) ──────────────────────────────────────────────────
  it('a split movement contributes its partial amount to each envelope summary', () => {
    const accId = defaultAccountId();
    const envA = Number(envelopeService.create('SplitA', accId));
    const envB = Number(envelopeService.create('SplitB', accId));
    movementService.create(
      'Paycheck', null, 2000, true, new Date(2026, 7, 10), firstCategoryId(),
      new Map([[envA, 1500], [envB, 500]]), null,
    );

    const a = periodSummaryRepository.getByPeriod(new Period(accId, envA, 2026, 7))!;
    const b = periodSummaryRepository.getByPeriod(new Period(accId, envB, 2026, 7))!;
    expect(a.totalIncomeCents).toBe(1500);
    expect(a.cashFlowCents).toBe(1500);
    expect(a.movementCount).toBe(1);
    expect(b.totalIncomeCents).toBe(500);
    expect(b.cashFlowCents).toBe(500);
    expect(b.movementCount).toBe(1);
  });

  // The exact read the Envelopes page performs (getLatestPeriodSummary → endingBalanceCents).
  it('getLatestPeriodSummary reflects a split share on create and on edit', () => {
    const accId = defaultAccountId();
    const envA = Number(envelopeService.create('LatestSplitA', accId));
    const envB = Number(envelopeService.create('LatestSplitB', accId));
    const id = Number(
      movementService.create(
        'Paycheck', null, 2000, true, new Date(2026, 7, 10), firstCategoryId(),
        new Map([[envA, 1500], [envB, 500]]), null,
      ),
    );
    expect(periodSummaryService.getLatestPeriodSummary(envA)!.endingBalanceCents).toBe(1500);
    expect(periodSummaryService.getLatestPeriodSummary(envB)!.endingBalanceCents).toBe(500);

    // Re-split 1200/800 and confirm the page read picks up the new balances.
    const stored = movementService.getById(id)!;
    movementService.update(Movement.from({ ...stored, envelopeIdMap: new Map([[envA, 1200], [envB, 800]]) }));
    expect(periodSummaryService.getLatestPeriodSummary(envA)!.endingBalanceCents).toBe(1200);
    expect(periodSummaryService.getLatestPeriodSummary(envB)!.endingBalanceCents).toBe(800);
  });

  // Uses a fresh account so its default envelope starts clean (balance 0, no seeded activity).
  function freshDefault(accountName: string): { acc: number; def: number } {
    const acc = Number(accountService.create(accountName));
    const def = envelopeService.getAll().find((e) => e.accountId === acc && e.isDefault)!.id;
    return { acc, def };
  }

  it('carries the ending balance across a month with no activity (gap)', () => {
    const { acc, def } = freshDefault('GapAcc');
    const cat = firstCategoryId();
    movementService.create('May in', null, 35000, true, new Date(2026, 4, 10), cat, new Map([[def, 35000]]), null, null, false, acc);
    // June has no activity.
    movementService.create('Jul in', null, 5000, true, new Date(2026, 6, 10), cat, new Map([[def, 5000]]), null, null, false, acc);
    // The July balance must still include May → 40000, not just 5000.
    expect(periodSummaryService.getLatestPeriodSummary(def)!.endingBalanceCents).toBe(40000);
  });

  it('refreshes the default envelope balance when a split envelope is deleted', () => {
    const { acc, def } = freshDefault('DelAcc');
    const a = Number(envelopeService.create('DA', acc));
    const b = Number(envelopeService.create('DB', acc));
    const cat = firstCategoryId();
    movementService.create('Pay', null, 2000, true, new Date(2026, 6, 10), cat, new Map([[a, 1200], [b, 800]]), null, null, false, acc);
    envelopeService.delete(b); // b's 800 share merges into the account default
    expect(periodSummaryService.getLatestPeriodSummary(def)!.endingBalanceCents).toBe(800);
  });
});
