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
import { deleteEnvelope, setDefaultEnvelope, getAllEnvelopes } from '../../services/envelope.service';
import { createAccount } from '../../services/account.service';
import { getMovementById } from '../../services/movement.service';
import { AppErrorCode } from '@shared/error-codes';

describe('EnvelopeService — delete, setDefault, and account-create side effect', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  it('deleteEnvelope refuses when the target is the default envelope', () => {
    const defaultEnv = getAllEnvelopes().find((e) => e.isDefault);
    expect(defaultEnv).toBeDefined();
    expect(() => deleteEnvelope(defaultEnv!.id)).toThrow(AppErrorCode.ENVELOPE_DELETE_DEFAULT);
  });

  it('deleteEnvelope reassigns movements to the account default and removes the envelope', () => {
    const envs = getAllEnvelopes();
    const monthly = envs.find((e) => e.name === 'Monthly Expenses')!;
    const unassigned = envs.find((e) => e.name === 'Unassigned' && e.isDefault)!;
    expect(monthly.accountId).toBe(unassigned.accountId);

    const db = DatabaseService.getInstance().db;
    const movRow = db
      .prepare('SELECT id FROM movements WHERE envelope_id = ? LIMIT 1')
      .get(monthly.id) as { id: number } | undefined;
    expect(movRow).toBeDefined();
    const movId = movRow!.id;

    expect(deleteEnvelope(monthly.id)).toBe(true);

    const after = getMovementById(movId)!;
    expect(after.envelopeId).toBe(unassigned.id);
    expect(getAllEnvelopes().find((e) => e.id === monthly.id)).toBeUndefined();
  });

  it('setDefaultEnvelope clears the previous default in the same account', () => {
    const envs = getAllEnvelopes();
    const oldDefault = envs.find((e) => e.isDefault)!;
    const sibling = envs.find((e) => !e.isDefault && e.accountId === oldDefault.accountId)!;

    setDefaultEnvelope(sibling.id);

    const after = getAllEnvelopes();
    const defaultsInAccount = after.filter(
      (e) => e.isDefault && e.accountId === oldDefault.accountId,
    );
    expect(defaultsInAccount).toHaveLength(1);
    expect(defaultsInAccount[0].id).toBe(sibling.id);
    expect(after.find((e) => e.id === oldDefault.id)!.isDefault).toBe(false);
  });

  it('createAccount auto-creates a default envelope named after the account', () => {
    const accountName = 'Test Bank';
    const newAccountId = Number(createAccount(accountName));

    const env = getAllEnvelopes().find((e) => e.accountId === newAccountId);
    expect(env).toBeDefined();
    expect(env!.name).toBe(accountName);
    expect(env!.isDefault).toBe(true);
  });
});
