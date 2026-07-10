import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-envelope');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { resetTestDb } from '../helpers/reset-db';
import { envelopeService } from '../../services/envelope.service';
import { accountService } from '../../services/account.service';
import { movementService } from '../../services/movement.service';
import { Envelope } from '@shared/domain';
import { AppErrorCode } from '@shared/error-codes';

describe('EnvelopeService — delete, setDefault, and account-create side effect', () => {
  beforeAll(() => {
    resetTestDb();
  });

  beforeEach(() => {
    resetTestDb();
  });

  it('delete refuses when the target is the default envelope', () => {
    const defaultEnv = envelopeService.getAll().find((e) => e.isDefault);
    expect(defaultEnv).toBeDefined();
    expect(() => envelopeService.delete(defaultEnv!.id)).toThrow(
      AppErrorCode.ENVELOPE_DELETE_DEFAULT,
    );
  });

  it('delete reassigns movements to the account default and removes the envelope', () => {
    const envs = envelopeService.getAll();
    const monthly = envs.find((e) => e.name === 'Monthly Expenses')!;
    const unassigned = envs.find((e) => e.name === 'Unassigned' && e.isDefault)!;
    expect(monthly.accountId).toBe(unassigned.accountId);

    const db = DatabaseService.getInstance().db;
    const movRow = db
      .prepare('SELECT movement_id AS id FROM movement_envelopes WHERE envelope_id = ? LIMIT 1')
      .get(monthly.id) as { id: number } | undefined;
    expect(movRow).toBeDefined();
    const movId = movRow!.id;

    expect(envelopeService.delete(monthly.id)).toBe(true);

    const after = movementService.getById(movId)!;
    expect(after.envelopeIdMap.has(unassigned.id)).toBe(true);
    expect(after.envelopeIdMap.has(monthly.id)).toBe(false);
    expect(envelopeService.getAll().find((e) => e.id === monthly.id)).toBeUndefined();
  });

  it('delete merges a split allocation when the movement already targets the account default', () => {
    const envs = envelopeService.getAll();
    const monthly = envs.find((e) => e.name === 'Monthly Expenses')!;
    const unassigned = envs.find((e) => e.name === 'Unassigned' && e.isDefault)!;
    const db = DatabaseService.getInstance().db;
    const catId = Number(
      (db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id,
    );

    // A movement split across the doomed envelope and the account default.
    const movId = Number(
      movementService.create(
        'Split',
        null,
        3000,
        false,
        new Date(2026, 3, 9),
        catId,
        new Map([
          [monthly.id, 2000],
          [unassigned.id, 1000],
        ]),
        null,
      ),
    );

    expect(envelopeService.delete(monthly.id)).toBe(true);

    const after = movementService.getById(movId)!;
    // The two allocations collapse into one on the default, preserving the total.
    expect(after.envelopeIdMap.size).toBe(1);
    expect(after.envelopeIdMap.get(unassigned.id)).toBe(3000);
  });

  it('setDefault clears the previous default in the same account', () => {
    const envs = envelopeService.getAll();
    const oldDefault = envs.find((e) => e.isDefault)!;
    const sibling = envs.find((e) => !e.isDefault && e.accountId === oldDefault.accountId)!;

    envelopeService.setDefault(sibling.id);

    const after = envelopeService.getAll();
    const defaultsInAccount = after.filter(
      (e) => e.isDefault && e.accountId === oldDefault.accountId,
    );
    expect(defaultsInAccount).toHaveLength(1);
    expect(defaultsInAccount[0].id).toBe(sibling.id);
    expect(after.find((e) => e.id === oldDefault.id)!.isDefault).toBe(false);
  });

  // ── budget ───────────────────────────────────────────────────────────────
  it('create persists the budget', () => {
    const accId = envelopeService.getAll().find((e) => e.isDefault)!.accountId!;
    const id = Number(envelopeService.create('Budgeted', accId, 0, 30000));
    expect(envelopeService.getById(id)!.budgetCents).toBe(30000);
  });

  it('create defaults the budget to null when omitted', () => {
    const accId = envelopeService.getAll().find((e) => e.isDefault)!.accountId!;
    const id = Number(envelopeService.create('No budget', accId));
    expect(envelopeService.getById(id)!.budgetCents).toBeNull();
  });

  it('create rejects a negative budget', () => {
    const accId = envelopeService.getAll().find((e) => e.isDefault)!.accountId!;
    expect(() => envelopeService.create('Bad', accId, 0, -1)).toThrow(
      AppErrorCode.ENVELOPE_BUDGET_NEGATIVE,
    );
  });

  it('update rejects a negative budget', () => {
    const env = envelopeService.getAll().find((e) => e.name === 'Monthly Expenses')!;
    expect(() => envelopeService.update(Envelope.from({ ...env, budgetCents: -5 }))).toThrow(
      AppErrorCode.ENVELOPE_BUDGET_NEGATIVE,
    );
  });

  it('create persists the savings cap and rejects a negative one', () => {
    const accId = envelopeService.getAll().find((e) => e.isDefault)!.accountId!;
    const id = Number(envelopeService.create('Capped', accId, 0, 30000, 60000));
    expect(envelopeService.getById(id)!.maxSavingsCents).toBe(60000);
    expect(() => envelopeService.create('Bad cap', accId, 0, 30000, -1)).toThrow(
      AppErrorCode.ENVELOPE_MAXSAVINGS_NEGATIVE,
    );
  });

  it('update rejects a negative savings cap', () => {
    const env = envelopeService.getAll().find((e) => e.name === 'Monthly Expenses')!;
    expect(() => envelopeService.update(Envelope.from({ ...env, maxSavingsCents: -5 }))).toThrow(
      AppErrorCode.ENVELOPE_MAXSAVINGS_NEGATIVE,
    );
  });

  it('accountService.create auto-creates a default envelope named after the account', () => {
    const accountName = 'Test Bank';
    const newAccountId = Number(accountService.create(accountName));

    const env = envelopeService.getAll().find((e) => e.accountId === newAccountId);
    expect(env).toBeDefined();
    expect(env!.name).toBe(accountName);
    expect(env!.isDefault).toBe(true);
  });
});
