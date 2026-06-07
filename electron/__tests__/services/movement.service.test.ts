import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-movement');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import {
  createMovement,
  updateMovement,
  deleteMovement,
  deleteManyMovements,
  suggestMovementNames,
  getAllMovements,
} from '../../services/movement.service';
import { AppErrorCode } from '@shared/error-codes';

describe('MovementService — validation and CRUD', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  // ── Validation guards ──────────────────────────────────────────────────────

  it('createMovement throws MOVEMENT_NAME_REQUIRED for empty name', () => {
    expect(() =>
      createMovement('', null, 1000, true, new Date(), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_NAME_REQUIRED);
  });

  it('createMovement throws MOVEMENT_AMOUNT_INVALID for negative cents', () => {
    expect(() =>
      createMovement('Test', null, -100, true, new Date(), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
  });

  it('createMovement throws MOVEMENT_AMOUNT_INVALID for non-integer cents', () => {
    expect(() =>
      createMovement('Test', null, 10.5, true, new Date(), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
  });

  it('createMovement throws MOVEMENT_DATE_INVALID for invalid date', () => {
    expect(() =>
      createMovement('Test', null, 1000, true, new Date('invalid'), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_DATE_INVALID);
  });

  it('createMovement throws MOVEMENT_CATEGORY_REQUIRED for id 0', () => {
    expect(() =>
      createMovement('Test', null, 1000, true, new Date(), 0, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_CATEGORY_REQUIRED);
  });

  it('createMovement throws MOVEMENT_ENVELOPE_REQUIRED for id 0', () => {
    expect(() =>
      createMovement('Test', null, 1000, true, new Date(), 1, 0, null),
    ).toThrow(AppErrorCode.MOVEMENT_ENVELOPE_REQUIRED);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('createMovement returns a positive id on success', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);

    const id = createMovement('Rent', 'Monthly rent', 50000, false, new Date('2024-01-01'), catId, envId, null);
    expect(Number(id)).toBeGreaterThan(0);
  });

  // ── updateMovement ─────────────────────────────────────────────────────────

  it('updateMovement throws MOVEMENT_NAME_REQUIRED for blank name', () => {
    const db = DatabaseService.getInstance().db;
    const row = db.prepare('SELECT * FROM movements LIMIT 1').get() as { id: number } | undefined;
    if (!row) return;
    expect(() =>
      updateMovement({ id: row.id, name: '  ', concept: null, quantityCents: 100, isPositive: true, date: new Date(), categoryId: 1, envelopeId: 1, additionalNotes: null }),
    ).toThrow(AppErrorCode.MOVEMENT_NAME_REQUIRED);
  });

  // ── deleteMovement ─────────────────────────────────────────────────────────

  it('deleteMovement returns true for existing movement', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const id = Number(createMovement('Temp', null, 100, true, new Date('2024-01-01'), catId, envId, null));
    expect(deleteMovement(id)).toBe(true);
  });

  it('deleteMovement returns false for non-existent id', () => {
    expect(deleteMovement(999999)).toBe(false);
  });

  // ── getAllMovements ─────────────────────────────────────────────────────────

  it('getAllMovements returns an array', () => {
    const result = getAllMovements();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAllMovements filters by isPositive', () => {
    const expenses = getAllMovements({ isPositive: false });
    expect(expenses.every((m) => !m.isPositive)).toBe(true);
  });

  // ── deleteManyMovements ────────────────────────────────────────────────────

  it('deleteManyMovements removes all listed ids and returns the count', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number }).id);
    const ids = [
      Number(createMovement('Bulk A', null, 100, true, new Date('2024-02-01'), catId, envId, null)),
      Number(createMovement('Bulk B', null, 200, true, new Date('2024-02-02'), catId, envId, null)),
      Number(createMovement('Bulk C', null, 300, true, new Date('2024-02-03'), catId, envId, null)),
    ];
    const deleted = deleteManyMovements(ids);
    expect(deleted).toBe(3);
    const remaining = db
      .prepare(`SELECT COUNT(*) AS n FROM movements WHERE id IN (${ids.join(',')})`)
      .get() as { n: number };
    expect(remaining.n).toBe(0);
  });

  it('deleteManyMovements returns 0 for empty input', () => {
    expect(deleteManyMovements([])).toBe(0);
  });

  it('deleteManyMovements rejects non-integer/non-positive ids', () => {
    expect(() => deleteManyMovements([1, 0])).toThrow(AppErrorCode.MOVEMENT_ID_INVALID);
    expect(() => deleteManyMovements([1, -3])).toThrow(AppErrorCode.MOVEMENT_ID_INVALID);
  });

  // ── suggestMovementNames ───────────────────────────────────────────────────

  it('suggestMovementNames returns prefix-matching distinct names', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number }).id);
    createMovement('Ahorramas', null, 100, false, new Date('2024-03-01'), catId, envId, null);
    createMovement('Ahorro vivienda', null, 100, false, new Date('2024-03-02'), catId, envId, null);
    const results = suggestMovementNames('Ahor');
    expect(results).toEqual(expect.arrayContaining(['Ahorramas', 'Ahorro vivienda']));
  });

  it('suggestMovementNames returns [] for empty prefix', () => {
    expect(suggestMovementNames('')).toEqual([]);
    expect(suggestMovementNames('   ')).toEqual([]);
  });
});
