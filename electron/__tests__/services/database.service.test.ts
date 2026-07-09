import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-database');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { AppErrorCode } from '@shared/error-codes';

const svc = () => DatabaseService.getInstance();
const count = (table: string) =>
  (svc().db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('DatabaseService — lifecycle', () => {
  beforeEach(() => {
    // Start each test from a clean, empty (non-demo) schema.
    svc().dropAllTables();
    svc().migrate();
  });

  it('migrate() is idempotent and seeds Uncategorized as the default category', () => {
    svc().migrate();
    svc().migrate();
    const defaults = svc()
      .db.prepare(`SELECT name FROM categories WHERE is_default = 1`)
      .all() as { name: string }[];
    expect(defaults).toEqual([{ name: 'Uncategorized' }]);
    expect(count('movements')).toBe(0); // migrate does NOT seed demo data
  });

  it('createExampleData() seeds the demo dataset on an empty DB', () => {
    expect(count('movements')).toBe(0);
    svc().createExampleData();
    expect(count('movements')).toBeGreaterThan(0);
    expect(count('categories')).toBeGreaterThan(1);
  });

  it('dropAllTables() wipes data', () => {
    svc().createExampleData();
    expect(count('movements')).toBeGreaterThan(0);
    svc().dropAllTables();
    svc().migrate();
    expect(count('movements')).toBe(0);
  });
});

describe('DatabaseService — backup & restore', () => {
  beforeEach(() => {
    svc().dropAllTables();
    svc().migrate();
  });

  it('backs up to a file and restores it, replacing current data', async () => {
    svc().createExampleData();
    const seeded = count('movements');
    expect(seeded).toBeGreaterThan(0);

    const backupPath = path.join(tmpDir, 'backup.db');
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    await svc().backup(backupPath);
    expect(fs.existsSync(backupPath)).toBe(true);

    // Wipe to empty, then restore.
    svc().dropAllTables();
    svc().migrate();
    expect(count('movements')).toBe(0);

    svc().restore(backupPath);
    expect(count('movements')).toBe(seeded);
  });

  it('rejects a file that is not one of our databases', () => {
    const badPath = path.join(tmpDir, 'not-a-db.txt');
    fs.writeFileSync(badPath, 'definitely not sqlite');
    expect(() => svc().restore(badPath)).toThrow(AppErrorCode.RESTORE_INVALID_FILE);
  });
});
