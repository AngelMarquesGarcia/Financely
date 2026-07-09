import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-transfer');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { resetTestDb } from '../helpers/reset-db';
import { transferService } from '../../services/transfer.service';
import { transferRepository } from '../../repository/transfer-repository.service';
import { movementService } from '../../services/movement.service';
import { envelopeService } from '../../services/envelope.service';
import { accountService } from '../../services/account.service';
import { periodSummaryService } from '../../services/period-summary.service';
import { Period, Movement } from '@shared/domain';
import { AppErrorCode } from '@shared/error-codes';

// Seed (see database.service.ts#initDatabase): default account with envelopes 'Unassigned'
// (default), 'Monthly Expenses', 'Savings'. Savings receives 220000 salary in April (month 3)
// and May (month 4); Monthly Expenses has 5 April expenses totalling 94700.
function envByName(name: string) {
  return envelopeService.getAll().find((e) => e.name === name)!;
}
function defaultAccountId(): number {
  return envByName('Unassigned').accountId!;
}
function firstCategoryId(): number {
  const db = DatabaseService.getInstance().db;
  return Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
}

/** A single-envelope allocation `{ envelopeId → amount }` — the normal (non-split) case. */
const one = (envelopeId: number, amount: number) => new Map([[envelopeId, amount]]);

describe('TransferService', () => {
  beforeAll(() => {
    resetTestDb();
  });

  beforeEach(() => {
    resetTestDb();
  });

  // ── create + validation ────────────────────────────────────────────────────
  it('create persists a transfer between two envelopes of the same account', () => {
    const acc = defaultAccountId();
    const from = envByName('Savings').id;
    const to = envByName('Monthly Expenses').id;
    const id = Number(transferService.create(from, to, 5000, new Date(2026, 3, 10)));
    expect(id).toBeGreaterThan(0);

    const stored = transferRepository.getById(id)!;
    expect(stored.fromEnvelopeId).toBe(from);
    expect(stored.toEnvelopeId).toBe(to);
    expect(stored.accountId).toBe(acc);
    expect(stored.quantityCents).toBe(5000);
    expect(stored.isAuto).toBe(false);
  });

  it('create rejects a transfer to the same envelope', () => {
    const e = envByName('Savings').id;
    expect(() => transferService.create(e, e, 5000, new Date(2026, 3, 10))).toThrow(
      AppErrorCode.TRANSFER_SAME_ENVELOPE,
    );
  });

  it('create rejects a non-positive amount', () => {
    const from = envByName('Savings').id;
    const to = envByName('Monthly Expenses').id;
    expect(() => transferService.create(from, to, 0, new Date(2026, 3, 10))).toThrow(
      AppErrorCode.TRANSFER_AMOUNT_INVALID,
    );
  });

  it('create rejects a cross-account transfer', () => {
    const from = envByName('Savings').id;
    accountService.create('Other Bank');
    const otherEnv = envByName('Other Bank');
    expect(() => transferService.create(from, otherEnv.id, 5000, new Date(2026, 3, 10))).toThrow(
      AppErrorCode.TRANSFER_CROSS_ACCOUNT,
    );
  });

  // ── getForEnvelope / delete ─────────────────────────────────────────────────
  it('getForEnvelope returns transfers where the envelope is source or destination', () => {
    const a = envByName('Savings').id;
    const b = envByName('Monthly Expenses').id;
    transferService.create(a, b, 5000, new Date(2026, 3, 10));
    transferService.create(b, a, 1000, new Date(2026, 3, 11));
    expect(transferService.getForEnvelope(a)).toHaveLength(2);
    expect(transferService.getForEnvelope(b)).toHaveLength(2);
  });

  it('delete removes a transfer and throws for a missing one', () => {
    const a = envByName('Savings').id;
    const b = envByName('Monthly Expenses').id;
    const id = Number(transferService.create(a, b, 5000, new Date(2026, 3, 10)));
    expect(transferService.delete(id)).toBe(true);
    expect(transferRepository.getById(id)).toBeUndefined();
    expect(() => transferService.delete(999999)).toThrow(AppErrorCode.TRANSFER_NOT_FOUND);
  });

  // ── balance-chain integration ───────────────────────────────────────────────
  it('a transfer adjusts both envelopes ending balances within the period', () => {
    const acc = defaultAccountId();
    const savings = envByName('Savings').id;
    const monthly = envByName('Monthly Expenses').id;
    const aprS = new Period(acc, savings, 2026, 3);
    const aprM = new Period(acc, monthly, 2026, 3);
    periodSummaryService.create(aprS); // ending 220000
    periodSummaryService.create(aprM); // ending -94700

    transferService.create(savings, monthly, 50000, new Date(2026, 3, 15));

    const s = periodSummaryService.getByPeriod(aprS);
    const m = periodSummaryService.getByPeriod(aprM);
    expect(s.netTransfersCents).toBe(-50000);
    expect(s.endingBalanceCents).toBe(170000); // 220000 − 50000
    expect(m.netTransfersCents).toBe(50000);
    expect(m.endingBalanceCents).toBe(-44700); // -94700 + 50000
  });

  it('a transfer into a movement-less envelope creates its summary', () => {
    const acc = defaultAccountId();
    const savings = envByName('Savings').id;
    const target = Number(envelopeService.create('Empty Target', acc));
    const targetP = new Period(acc, target, 2026, 3);
    expect(periodSummaryService.checkExists(targetP)).toBe(false);

    transferService.create(savings, target, 30000, new Date(2026, 3, 20));

    const summary = periodSummaryService.getByPeriod(targetP);
    expect(summary.movementCount).toBe(0);
    expect(summary.netTransfersCents).toBe(30000);
    expect(summary.endingBalanceCents).toBe(30000); // startingBalance 0 + transfers
  });

  it('deleting the only transfer in a movement-less period removes its summary', () => {
    const acc = defaultAccountId();
    const savings = envByName('Savings').id;
    const target = Number(envelopeService.create('Empty Target', acc));
    const targetP = new Period(acc, target, 2026, 3);
    const id = Number(transferService.create(savings, target, 30000, new Date(2026, 3, 20)));
    expect(periodSummaryService.checkExists(targetP)).toBe(true);

    transferService.delete(id);
    expect(() => periodSummaryService.getByPeriod(targetP)).toThrow(
      AppErrorCode.PERIODSUMMARY_NOT_FOUND,
    );
  });

  it('a transfer cascades the ending-balance change to later periods', () => {
    const acc = defaultAccountId();
    const savings = envByName('Savings').id;
    const apr = new Period(acc, savings, 2026, 3);
    const may = new Period(acc, savings, 2026, 4);
    periodSummaryService.create(apr); // 220000
    periodSummaryService.create(may); // 440000
    expect(periodSummaryService.getByPeriod(may).endingBalanceCents).toBe(440000);

    transferService.create(savings, envByName('Monthly Expenses').id, 50000, new Date(2026, 3, 15));

    expect(periodSummaryService.getByPeriod(apr).endingBalanceCents).toBe(170000);
    expect(periodSummaryService.getByPeriod(may).endingBalanceCents).toBe(390000); // 170000 + 220000
  });

  // ── over-cap redirect ───────────────────────────────────────────────────────
  it('redirects over-cap income to the default envelope on create', () => {
    const acc = defaultAccountId();
    const unassigned = envByName('Unassigned').id;
    const capped = Number(envelopeService.create('Capped', acc, 0, 30000, 60000)); // threshold 90000
    const cat = firstCategoryId();

    movementService.create('Big income', null, 100000, true, new Date(2026, 3, 10), cat, one(capped, 100000), null);

    const transfers = transferService.getAll();
    expect(transfers).toHaveLength(1);
    expect(transfers[0].isAuto).toBe(true);
    expect(transfers[0].fromEnvelopeId).toBe(capped);
    expect(transfers[0].toEnvelopeId).toBe(unassigned);
    expect(transfers[0].quantityCents).toBe(10000); // 100000 − (60000 + 30000)

    const cappedP = new Period(acc, capped, 2026, 3);
    const unassignedP = new Period(acc, unassigned, 2026, 3);
    expect(periodSummaryService.getByPeriod(cappedP).endingBalanceCents).toBe(90000);
    expect(periodSummaryService.getByPeriod(unassignedP).endingBalanceCents).toBe(10000);
  });

  it('does not redirect when income stays within cap + budget', () => {
    const acc = defaultAccountId();
    const capped = Number(envelopeService.create('Capped', acc, 0, 30000, 60000)); // threshold 90000
    const cat = firstCategoryId();
    movementService.create('Modest', null, 50000, true, new Date(2026, 3, 10), cat, one(capped, 50000), null);
    expect(transferService.getAll()).toHaveLength(0);
  });

  it('does not redirect an uncapped envelope', () => {
    const acc = defaultAccountId();
    const env = Number(envelopeService.create('Uncapped', acc, 0, 30000, null));
    const cat = firstCategoryId();
    movementService.create('Huge', null, 999999, true, new Date(2026, 3, 10), cat, one(env, 999999), null);
    expect(transferService.getAll()).toHaveLength(0);
  });

  it('redirects to the envelope overflowsTo target when set', () => {
    const acc = defaultAccountId();
    const sink = Number(envelopeService.create('Sink', acc));
    const capped = Number(envelopeService.create('Capped', acc, 0, 30000, 60000, sink));
    const cat = firstCategoryId();
    movementService.create('Big income', null, 100000, true, new Date(2026, 3, 10), cat, one(capped, 100000), null);

    const transfers = transferService.getAll();
    expect(transfers).toHaveLength(1);
    expect(transfers[0].toEnvelopeId).toBe(sink);
    expect(transfers[0].quantityCents).toBe(10000);
  });

  it('redirects when an income movement is edited upward over the threshold', () => {
    const acc = defaultAccountId();
    const capped = Number(envelopeService.create('Capped', acc, 0, 30000, 60000)); // threshold 90000
    const cat = firstCategoryId();
    const movId = Number(
      movementService.create('Income', null, 50000, true, new Date(2026, 3, 10), cat, one(capped, 50000), null),
    );
    expect(transferService.getAll()).toHaveLength(0); // 50000 < 90000

    const mov = movementService.getById(movId)!;
    // Raising the amount must also update the single-envelope allocation so it still sums to the total.
    movementService.update(
      Movement.from({ ...mov, quantityCents: 120000, envelopeIdMap: one(capped, 120000) }),
    );

    const transfers = transferService.getAll();
    expect(transfers).toHaveLength(1);
    expect(transfers[0].quantityCents).toBe(30000); // 120000 − 90000
    expect(periodSummaryService.getByPeriod(new Period(acc, capped, 2026, 3)).endingBalanceCents).toBe(
      90000,
    );
  });
});
