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
import { movementService } from '../../services/movement.service';
import { Movement } from '@shared/domain';
import { AppErrorCode } from '@shared/error-codes';

describe('MovementService — validation and CRUD', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  // ── Validation guards ──────────────────────────────────────────────────────

  it('create throws MOVEMENT_NAME_REQUIRED for empty name', () => {
    expect(() =>
      movementService.create('', null, 1000, true, new Date(), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_NAME_REQUIRED);
  });

  it('create throws MOVEMENT_AMOUNT_INVALID for negative cents', () => {
    expect(() =>
      movementService.create('Test', null, -100, true, new Date(), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
  });

  it('create throws MOVEMENT_AMOUNT_INVALID for non-integer cents', () => {
    expect(() =>
      movementService.create('Test', null, 10.5, true, new Date(), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
  });

  it('create throws MOVEMENT_DATE_INVALID for invalid date', () => {
    expect(() =>
      movementService.create('Test', null, 1000, true, new Date('invalid'), 1, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_DATE_INVALID);
  });

  it('create throws MOVEMENT_CATEGORY_REQUIRED for id 0', () => {
    expect(() =>
      movementService.create('Test', null, 1000, true, new Date(), 0, 1, null),
    ).toThrow(AppErrorCode.MOVEMENT_CATEGORY_REQUIRED);
  });

  it('create throws MOVEMENT_ENVELOPE_REQUIRED for id 0', () => {
    expect(() =>
      movementService.create('Test', null, 1000, true, new Date(), 1, 0, null),
    ).toThrow(AppErrorCode.MOVEMENT_ENVELOPE_REQUIRED);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('create returns a positive id on success', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);

    const id = movementService.create('Rent', 'Monthly rent', 50000, false, new Date('2024-01-01'), catId, envId, null);
    expect(Number(id)).toBeGreaterThan(0);
  });

  // ── update ─────────────────────────────────────────────────────────────────

  it('update throws MOVEMENT_NAME_REQUIRED for blank name', () => {
    const db = DatabaseService.getInstance().db;
    const row = db.prepare('SELECT * FROM movements LIMIT 1').get() as { id: number } | undefined;
    if (!row) return;
    expect(() =>
      movementService.update(Movement.from({ id: row.id, accountId: 1, name: '  ', concept: null, quantityCents: 100, isPositive: true, date: new Date(), categoryId: 1, envelopeId: 1, additionalNotes: null, templateId: null, isTentative: false })),
    ).toThrow(AppErrorCode.MOVEMENT_NAME_REQUIRED);
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  it('delete returns true for existing movement', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const id = Number(movementService.create('Temp', null, 100, true, new Date('2024-01-01'), catId, envId, null));
    expect(movementService.delete(id)).toBe(true);
  });

  it('delete throws MOVEMENT_NOT_FOUND for a non-existent id', () => {
    expect(() => movementService.delete(999999)).toThrow(AppErrorCode.MOVEMENT_NOT_FOUND);
  });

  // ── getAll ─────────────────────────────────────────────────────────────────

  it('getAll returns an array', () => {
    const result = movementService.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAll filters by isPositive', () => {
    const expenses = movementService.getAll({ isPositive: false });
    expect(expenses.every((m) => !m.isPositive)).toBe(true);
  });

  // ── deleteMany ─────────────────────────────────────────────────────────────

  it('deleteMany removes all listed ids and returns the count', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number }).id);
    const ids = [
      Number(movementService.create('Bulk A', null, 100, true, new Date('2024-02-01'), catId, envId, null)),
      Number(movementService.create('Bulk B', null, 200, true, new Date('2024-02-02'), catId, envId, null)),
      Number(movementService.create('Bulk C', null, 300, true, new Date('2024-02-03'), catId, envId, null)),
    ];
    const deleted = movementService.deleteMany(ids);
    expect(deleted).toBe(3);
    const remaining = db
      .prepare(`SELECT COUNT(*) AS n FROM movements WHERE id IN (${ids.join(',')})`)
      .get() as { n: number };
    expect(remaining.n).toBe(0);
  });

  it('deleteMany returns 0 for empty input', () => {
    expect(movementService.deleteMany([])).toBe(0);
  });

  it('deleteMany rejects non-integer/non-positive ids', () => {
    expect(() => movementService.deleteMany([1, 0])).toThrow(AppErrorCode.MOVEMENT_ID_INVALID);
    expect(() => movementService.deleteMany([1, -3])).toThrow(AppErrorCode.MOVEMENT_ID_INVALID);
  });

  // ── suggestNames ───────────────────────────────────────────────────────────

  it('suggestNames returns prefix-matching distinct names', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number }).id);
    movementService.create('Ahorramas', null, 100, false, new Date('2024-03-01'), catId, envId, null);
    movementService.create('Ahorro vivienda', null, 100, false, new Date('2024-03-02'), catId, envId, null);
    const results = movementService.suggestNames('Ahor');
    expect(results).toEqual(expect.arrayContaining(['Ahorramas', 'Ahorro vivienda']));
  });

  it('suggestNames returns [] for empty prefix', () => {
    expect(movementService.suggestNames('')).toEqual([]);
    expect(movementService.suggestNames('   ')).toEqual([]);
  });
});

describe('MovementService — tentative instances, confirm and the previous-month guard', () => {
  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  function refs() {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number }).id);
    return { catId, envId };
  }

  it('confirm clears the tentative flag', () => {
    const { catId, envId } = refs();
    const id = Number(
      movementService.create('Salary', null, 1000, true, new Date('2024-06-10'), catId, envId, null, null, true),
    );
    expect(movementService.getById(id)?.isTentative).toBe(true);
    expect(movementService.confirm(id)).toBe(true);
    expect(movementService.getById(id)?.isTentative).toBe(false);
  });

  it('confirm throws MOVEMENT_NOT_TENTATIVE for an already-confirmed movement', () => {
    const { catId, envId } = refs();
    const id = Number(
      movementService.create('Manual', null, 1000, false, new Date('2024-06-10'), catId, envId, null),
    );
    expect(() => movementService.confirm(id)).toThrow(AppErrorCode.MOVEMENT_NOT_TENTATIVE);
  });

  it('a tentative creation is exempt from the previous-month guard', () => {
    const { catId, envId } = refs();
    movementService.create('Mar', null, 1000, false, new Date('2024-03-10'), catId, envId, null, 1, true);
    // April tentative is allowed even though March is still tentative
    const id = Number(
      movementService.create('Apr', null, 1000, false, new Date('2024-04-10'), catId, envId, null, null, true),
    );
    expect(id).toBeGreaterThan(0);
  });

  it('a confirmed creation is blocked when the previous month has a tentative', () => {
    const { catId, envId } = refs();
    movementService.create('Mar', null, 1000, false, new Date('2024-03-10'), catId, envId, null, 1, true);
    expect(() =>
      movementService.create('Apr', null, 1000, false, new Date('2024-04-10'), catId, envId, null),
    ).toThrow(AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE);
  });

  it('confirm is blocked out of order, then allowed once the earlier month is clean', () => {
    const { catId, envId } = refs();
    const mar = Number(
      movementService.create('Mar', null, 1000, false, new Date('2024-03-10'), catId, envId, null, null, true),
    );
    const apr = Number(
      movementService.create('Apr', null, 1000, false, new Date('2024-04-10'), catId, envId, null, null, true),
    );
    // April cannot be confirmed while March is still tentative
    expect(() => movementService.confirm(apr)).toThrow(AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE);
    // confirm March first (its previous month is clean), then April succeeds
    expect(movementService.confirm(mar)).toBe(true);
    expect(movementService.confirm(apr)).toBe(true);
  });
});
