import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-account');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { createAccount, deleteAccount, getAccountStats, getAllAccounts, setDefaultAccount } from '../../services/account.service';
import { createMovement } from '../../services/movement.service';
import { getAllEnvelopes } from '../../services/envelope.service';
import { AppErrorCode } from '@shared/error-codes';

describe('AccountService', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  it('createAccount throws ACCOUNT_NAME_REQUIRED for empty name', () => {
    expect(() => createAccount('')).toThrow(AppErrorCode.ACCOUNT_NAME_REQUIRED);
  });

  it('createAccount auto-creates a default envelope named after the account', () => {
    const name = 'Savings Account';
    const accountId = Number(createAccount(name));

    const envelopes = getAllEnvelopes();
    const created = envelopes.find((e) => e.accountId === accountId);
    expect(created).toBeDefined();
    expect(created!.name).toBe(name);
    expect(created!.isDefault).toBe(true);
  });

  it('deleteAccount throws ACCOUNT_DELETE_DEFAULT for the default account', () => {
    const accounts = getAllAccounts();
    const defaultAcc = accounts.find((a) => a.isDefault);
    expect(defaultAcc).toBeDefined();
    expect(() => deleteAccount(defaultAcc!.id)).toThrow(AppErrorCode.ACCOUNT_DELETE_DEFAULT);
  });

  it('deleteAccount succeeds for a non-default account', () => {
    const newId = Number(createAccount('Temp Account'));
    expect(deleteAccount(newId)).toBe(true);
    expect(getAllAccounts().find((a) => a.id === newId)).toBeUndefined();
  });

  it('setDefaultAccount changes the default', () => {
    const newId = Number(createAccount('New Main'));
    setDefaultAccount(newId);
    const after = getAllAccounts();
    const defaults = after.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(newId);
  });

  it('getAccountStats aggregates income/expense and envelope count', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number(
      (db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id,
    );
    const before = getAccountStats();
    const accountId = Number(createAccount('Stats Account'));
    const envelopeId = Number(
      (db.prepare('SELECT id FROM envelopes WHERE account_id = ?').get(accountId) as { id: number }).id,
    );
    createMovement('Income1', null, 10000, true, new Date('2024-04-01'), catId, envelopeId, null);
    createMovement('Expense1', null, 2500, false, new Date('2024-04-02'), catId, envelopeId, null);
    const after = getAccountStats();
    expect(after.totalIncomeCents - before.totalIncomeCents).toBe(10000);
    expect(after.totalExpenseCents - before.totalExpenseCents).toBe(2500);
    expect(after.balanceCents - before.balanceCents).toBe(7500);
    expect(after.envelopeCount).toBe(before.envelopeCount + 1);
  });
});
