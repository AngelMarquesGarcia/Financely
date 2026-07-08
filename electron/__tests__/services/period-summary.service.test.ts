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
import { compoundMovementService } from '../../services/compound-movement.service';
import { envelopeService } from '../../services/envelope.service';
import { accountService } from '../../services/account.service';
import { transferService } from '../../services/transfer.service';
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

  it('create builds an account-level summary aggregating every envelope in the month', () => {
    const accountLevel = new Period(defaultAccountId(), null, 2026, 3);
    periodSummaryService.create(accountLevel);
    const summary = periodSummaryService.getByPeriod(accountLevel);
    // April default account: 5 monthly expenses (94700) + April salary (220000), each counted once.
    expect(summary.envelopeId).toBeNull();
    expect(summary.movementCount).toBe(6);
    expect(summary.totalIncomeCents).toBe(220000);
    expect(summary.totalExpenseCents).toBe(94700);
    expect(summary.cashFlowCents).toBe(125300);
    expect(summary.netTransfersCents).toBe(0);
    // Anchored on the account starting balance (0); April is the earliest month with activity.
    expect(summary.endingBalanceCents).toBe(125300);
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
    movementService.create('May in', null, 35000, true, new Date(2026, 4, 10), cat, new Map([[def, 35000]]), null, false, null, false, acc);
    // June has no activity.
    movementService.create('Jul in', null, 5000, true, new Date(2026, 6, 10), cat, new Map([[def, 5000]]), null, false, null, false, acc);
    // The July balance must still include May → 40000, not just 5000.
    expect(periodSummaryService.getLatestPeriodSummary(def)!.endingBalanceCents).toBe(40000);
  });

  it('refreshes the default envelope balance when a split envelope is deleted', () => {
    const { acc, def } = freshDefault('DelAcc');
    const a = Number(envelopeService.create('DA', acc));
    const b = Number(envelopeService.create('DB', acc));
    const cat = firstCategoryId();
    movementService.create('Pay', null, 2000, true, new Date(2026, 6, 10), cat, new Map([[a, 1200], [b, 800]]), null, false, null, false, acc);
    envelopeService.delete(b); // b's 800 share merges into the account default
    expect(periodSummaryService.getLatestPeriodSummary(def)!.endingBalanceCents).toBe(800);
  });

  // ── anomalous movements ────────────────────────────────────────────────────
  it('summaryWithoutAnomalies is null when the period has no anomalous movements', () => {
    const { acc, def } = freshDefault('NoAnomAcc');
    const cat = firstCategoryId();
    movementService.create('Normal', null, 5000, false, new Date(2026, 3, 5), cat, new Map([[def, 5000]]), null, false, null, false, acc);
    expect(periodSummaryService.getByPeriod(new Period(acc, def, 2026, 3)).summaryWithoutAnomalies).toBeNull();
  });

  it('excludes an anomalous movement from the mirror but keeps it in the totals and balance', () => {
    const { acc, def } = freshDefault('AnomAcc');
    const cat = firstCategoryId();
    // Two normal expenses (3000, 1000) and one anomalous (20000).
    movementService.create('Food A', null, 3000, false, new Date(2026, 3, 5), cat, new Map([[def, 3000]]), null, false, null, false, acc);
    movementService.create('Food B', null, 1000, false, new Date(2026, 3, 6), cat, new Map([[def, 1000]]), null, false, null, false, acc);
    movementService.create('Car', null, 20000, false, new Date(2026, 3, 7), cat, new Map([[def, 20000]]), null, true, null, false, acc);

    const summary = periodSummaryService.getByPeriod(new Period(acc, def, 2026, 3));
    // Top-level (all-inclusive) counts everything — including balance.
    expect(summary.totalExpenseCents).toBe(24000);
    expect(summary.movementCount).toBe(3);
    expect(summary.avgExpenseCents).toBe(8000); // 24000 / 3
    expect(summary.endingBalanceCents).toBe(-24000);

    // The mirror excludes the anomalous car.
    const wo = summary.summaryWithoutAnomalies!;
    expect(wo).not.toBeNull();
    expect(wo.totalExpenseCents).toBe(4000);
    expect(wo.movementCount).toBe(2);
    expect(wo.avgExpenseCents).toBe(2000); // 4000 / 2
    expect(wo.cashFlowCents).toBe(-4000);
  });

  it('marking a movement anomalous recomputes the mirror without moving the ending balance', () => {
    const { acc, def } = freshDefault('MarkAnomAcc');
    const cat = firstCategoryId();
    const id = Number(
      movementService.create('Big', null, 20000, false, new Date(2026, 3, 7), cat, new Map([[def, 20000]]), null, false, null, false, acc),
    );
    expect(periodSummaryService.getByPeriod(new Period(acc, def, 2026, 3)).summaryWithoutAnomalies).toBeNull();

    movementService.update(Movement.from({ ...movementService.getById(id)!, isAnomalous: true }));

    const after = periodSummaryService.getByPeriod(new Period(acc, def, 2026, 3));
    expect(after.summaryWithoutAnomalies).not.toBeNull();
    expect(after.summaryWithoutAnomalies!.totalExpenseCents).toBe(0);
    expect(after.summaryWithoutAnomalies!.movementCount).toBe(0);
    expect(after.endingBalanceCents).toBe(-20000); // the flag never moves real money
  });

  it('an anomalous-only edit does not re-dirty later months, but an amount edit does', () => {
    const { acc, def } = freshDefault('RechainAcc');
    const cat = firstCategoryId();
    const mayId = Number(
      movementService.create('May', null, 5000, false, new Date(2026, 4, 5), cat, new Map([[def, 5000]]), null, false, null, false, acc),
    );
    movementService.create('Jun', null, 3000, false, new Date(2026, 5, 5), cat, new Map([[def, 3000]]), null, false, null, false, acc);
    periodSummaryService.getByPeriod(new Period(acc, def, 2026, 5)); // ensure June is CLEAN

    // Balance-neutral edit (flag only) → June stays CLEAN.
    movementService.update(Movement.from({ ...movementService.getById(mayId)!, isAnomalous: true }));
    expect(periodSummaryRepository.getByPeriod(new Period(acc, def, 2026, 5))!.dirtyState).toBe('CLEAN');

    // Amount edit → June is re-dirtied.
    movementService.update(
      Movement.from({ ...movementService.getById(mayId)!, quantityCents: 9000, envelopeIdMap: new Map([[def, 9000]]) }),
    );
    expect(periodSummaryRepository.getByPeriod(new Period(acc, def, 2026, 5))!.dirtyState).toBe('DIRTY');
  });

  it('getAll skips a summary orphaned by deleting the last movement in its period', () => {
    const { acc, def } = freshDefault('OrphanAcc');
    const cat = firstCategoryId();
    const id = Number(
      movementService.create('Solo', null, 5000, false, new Date(2026, 3, 5), cat, new Map([[def, 5000]]), null, false, null, false, acc),
    );
    movementService.delete(id); // leaves a MODIFIED summary with no backing movements
    expect(() => periodSummaryService.getAll()).not.toThrow();
    expect(
      periodSummaryService
        .getAll()
        .some((s) => s.accountId === acc && s.envelopeId === def && s.year === 2026 && s.month === 3),
    ).toBe(false);
  });

  // ── account-level summary maintenance ──────────────────────────────────────
  it('maintains an account-level summary when movements are created', () => {
    const { acc, def } = freshDefault('AcctMaint');
    const cat = firstCategoryId();
    movementService.create('Pay', null, 5000, true, new Date(2026, 3, 10), cat, new Map([[def, 5000]]), null, false, null, false, acc);
    movementService.create('Buy', null, 2000, false, new Date(2026, 3, 12), cat, new Map([[def, 2000]]), null, false, null, false, acc);
    const summary = periodSummaryService.getByPeriod(new Period(acc, null, 2026, 3));
    expect(summary.envelopeId).toBeNull();
    expect(summary.movementCount).toBe(2);
    expect(summary.totalIncomeCents).toBe(5000);
    expect(summary.totalExpenseCents).toBe(2000);
    expect(summary.cashFlowCents).toBe(3000);
    expect(summary.endingBalanceCents).toBe(3000);
  });

  it('counts a split movement once, at its full amount, in the account summary', () => {
    const { acc, def } = freshDefault('AcctSplit');
    const other = Number(envelopeService.create('AcctSplitB', acc));
    const cat = firstCategoryId();
    movementService.create('Split', null, 3000, true, new Date(2026, 3, 10), cat, new Map([[def, 1000], [other, 2000]]), null, false, null, false, acc);
    const accSummary = periodSummaryService.getByPeriod(new Period(acc, null, 2026, 3));
    expect(accSummary.movementCount).toBe(1);
    expect(accSummary.totalIncomeCents).toBe(3000);
    // Each envelope still sees only its partial share.
    expect(periodSummaryService.getByPeriod(new Period(acc, def, 2026, 3)).totalIncomeCents).toBe(1000);
    expect(periodSummaryService.getByPeriod(new Period(acc, other, 2026, 3)).totalIncomeCents).toBe(2000);
  });

  it('keeps account-level netTransfers at zero and balance real when envelopes transfer', () => {
    const { acc, def } = freshDefault('AcctXfer');
    const other = Number(envelopeService.create('AcctXferB', acc));
    const cat = firstCategoryId();
    movementService.create('Seed', null, 10000, true, new Date(2026, 3, 1), cat, new Map([[def, 10000]]), null, false, null, false, acc);
    transferService.create(def, other, 4000, new Date(2026, 3, 5));
    const accSummary = periodSummaryService.getByPeriod(new Period(acc, null, 2026, 3));
    expect(accSummary.netTransfersCents).toBe(0);
    expect(accSummary.endingBalanceCents).toBe(10000); // transfer moves nothing at account level
  });

  it('chains the account-level ending balance across months', () => {
    const { acc, def } = freshDefault('AcctChain');
    const cat = firstCategoryId();
    movementService.create('Apr', null, 5000, true, new Date(2026, 3, 10), cat, new Map([[def, 5000]]), null, false, null, false, acc);
    movementService.create('May', null, 3000, true, new Date(2026, 4, 10), cat, new Map([[def, 3000]]), null, false, null, false, acc);
    expect(periodSummaryService.getByPeriod(new Period(acc, null, 2026, 4)).endingBalanceCents).toBe(8000);
  });

  it('deletes the account-level summary when its last movement is removed', () => {
    const { acc, def } = freshDefault('AcctOrphan');
    const cat = firstCategoryId();
    const id = Number(
      movementService.create('Solo', null, 5000, false, new Date(2026, 3, 5), cat, new Map([[def, 5000]]), null, false, null, false, acc),
    );
    movementService.delete(id);
    expect(
      periodSummaryService
        .getAll()
        .some((s) => s.accountId === acc && s.envelopeId === null && s.year === 2026 && s.month === 3),
    ).toBe(false);
  });
});

describe('PeriodSummaryService — compound re-attribution (Phase 2)', () => {
  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  const APR = new Date(2026, 3, 15);
  const MAY = new Date(2026, 4, 10);

  /** A fresh account with two empty envelopes (no seed noise), so aggregates are exactly assertable. */
  function fresh(name: string): { acc: number; env1: number; env2: number } {
    const acc = Number(accountService.create(name));
    const env1 = envelopeService.getAll().find((e) => e.accountId === acc && e.isDefault)!.id;
    const env2 = Number(envelopeService.create(`${name}-2`, acc));
    return { acc, env1, env2 };
  }

  function m(
    acc: number,
    env: number,
    name: string,
    amountCents: number,
    isPositive: boolean,
    date: Date,
    isAnomalous = false,
  ): number {
    return Number(
      movementService.create(
        name, null, amountCents, isPositive, date, firstCategoryId(),
        one(env, amountCents), null, isAnomalous, null, false, acc,
      ),
    );
  }

  const compound = (over: Record<string, unknown>) => ({
    name: 'Set', isCancelable: false, isAnomalous: false, notes: null, ...over,
  });

  it('single-month cancelable collapses to its net at envelope level; base and balance untouched', () => {
    const { acc, env1 } = fresh('C1');
    const dinner = m(acc, env1, 'Dinner', 12000, false, APR);
    const bizum = m(acc, env1, 'Bizum', 10000, true, APR);
    compoundMovementService.create(compound({ isCancelable: true }), [dinner, bizum]);

    const apr = periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 3));
    // base (all-inclusive): two movements netting -2000.
    expect(apr.cashFlowCents).toBe(-2000);
    expect(apr.movementCount).toBe(2);
    // compound-adjusted: the same net, but as ONE movement.
    expect(apr.summaryCompoundAdjusted).toEqual(
      expect.objectContaining({ cashFlowCents: -2000, movementCount: 1, totalExpenseCents: 2000, totalIncomeCents: 0 }),
    );
    // ending balance follows the base cash flow, never the collapsed view (D1).
    expect(apr.endingBalanceCents).toBe(-2000);
  });

  it('single-month grouping does not alter statistics (adjusted mirror is null at both levels)', () => {
    const { acc, env1 } = fresh('C2');
    const a = m(acc, env1, 'Fuel', 5000, false, APR);
    const b = m(acc, env1, 'Hotel', 3000, false, APR);
    compoundMovementService.create(compound({ name: 'Trip' }), [a, b]);
    expect(periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 3)).summaryCompoundAdjusted).toBeNull();
    expect(periodSummaryService.getByPeriod(new Period(acc, null, 2026, 3)).summaryCompoundAdjusted).toBeNull();
  });

  it('multi-month cancelable nets into the owner month and empties the other; balances stay real', () => {
    const { acc, env1 } = fresh('C3');
    const dinner = m(acc, env1, 'Dinner', 12000, false, APR);
    const bizum = m(acc, env1, 'Bizum', 10000, true, MAY);
    compoundMovementService.create(compound({ isCancelable: true }), [dinner, bizum]); // owner defaults to April

    const apr = periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 3));
    const may = periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 4));
    // April (owner): raw -12000; collapsed net -2000 as one movement.
    expect(apr.cashFlowCents).toBe(-12000);
    expect(apr.summaryCompoundAdjusted).toEqual(expect.objectContaining({ cashFlowCents: -2000, movementCount: 1 }));
    // May: the reimbursement re-attributes away → empty adjusted; raw +10000.
    expect(may.cashFlowCents).toBe(10000);
    expect(may.summaryCompoundAdjusted).toEqual(expect.objectContaining({ cashFlowCents: 0, movementCount: 0 }));
    // Balances follow the real months: April -12000, May -2000.
    expect(apr.endingBalanceCents).toBe(-12000);
    expect(may.endingBalanceCents).toBe(-2000);
  });

  it('multi-month multi-envelope grouping collapses at account level only', () => {
    const { acc, env1, env2 } = fresh('C4');
    m(acc, env1, 'FuelApr', 5000, false, APR); // April, env1
    m(acc, env2, 'HotelMay', 3000, false, MAY); // May, env2
    const [a, b] = movementService.getAll({ accountId: acc }).map((mv) => mv.id);
    compoundMovementService.create(compound({ name: 'Trip' }), [a, b]); // owner April

    const aprAcc = periodSummaryService.getByPeriod(new Period(acc, null, 2026, 3));
    const mayAcc = periodSummaryService.getByPeriod(new Period(acc, null, 2026, 4));
    // Account level: April gains both children as individuals; May is emptied.
    expect(aprAcc.summaryCompoundAdjusted).toEqual(expect.objectContaining({ cashFlowCents: -8000, movementCount: 2 }));
    expect(mayAcc.summaryCompoundAdjusted).toEqual(expect.objectContaining({ cashFlowCents: 0, movementCount: 0 }));
    // Envelope level: a grouping never re-attributes (D4) → mirrors null, base intact.
    expect(periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 3)).summaryCompoundAdjusted).toBeNull();
    expect(periodSummaryService.getByPeriod(new Period(acc, env2, 2026, 4)).summaryCompoundAdjusted).toBeNull();
  });

  it('an anomalous cancelable compound distinguishes the four statistical views', () => {
    const { acc, env1 } = fresh('C5');
    const dinner = m(acc, env1, 'Dinner', 12000, false, APR);
    const bizum = m(acc, env1, 'Bizum', 10000, true, MAY);
    compoundMovementService.create(compound({ isCancelable: true, isAnomalous: true }), [dinner, bizum]);

    const apr = periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 3));
    expect(apr.cashFlowCents).toBe(-12000); // base
    expect(apr.summaryWithoutAnomalies).toEqual(expect.objectContaining({ cashFlowCents: 0, movementCount: 0 }));
    expect(apr.summaryCompoundAdjusted).toEqual(expect.objectContaining({ cashFlowCents: -2000, movementCount: 1 }));
    expect(apr.summaryCompoundAdjustedWithoutAnomalies).toEqual(expect.objectContaining({ cashFlowCents: 0, movementCount: 0 }));
  });

  it('editing a non-owner child updates the owner-month net (cross-period propagation)', () => {
    const { acc, env1 } = fresh('C6');
    const dinner = m(acc, env1, 'Dinner', 12000, false, APR);
    const bizum = m(acc, env1, 'Bizum', 10000, true, MAY);
    compoundMovementService.create(compound({ isCancelable: true }), [dinner, bizum]); // owner April
    expect(periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 3)).summaryCompoundAdjusted?.cashFlowCents).toBe(-2000);

    // Lower the May reimbursement to +80 → net becomes -40 in April.
    const stored = movementService.getById(bizum)!;
    movementService.update(
      Movement.from({ ...stored, quantityCents: 8000, envelopeIdMap: new Map([[env1, 8000]]) }),
    );
    expect(periodSummaryService.getByPeriod(new Period(acc, env1, 2026, 3)).summaryCompoundAdjusted?.cashFlowCents).toBe(-4000);
    expect(dinner).toBeGreaterThan(0);
  });
});
