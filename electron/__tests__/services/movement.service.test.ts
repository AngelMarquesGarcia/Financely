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

/** A single-envelope allocation `{ envelopeId → amount }` — the normal (non-split) case. */
const one = (envelopeId: number, amount: number) => new Map([[envelopeId, amount]]);

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
      movementService.create('', null, 1000, true, new Date(), 1, one(1, 1000), null),
    ).toThrow(AppErrorCode.MOVEMENT_NAME_REQUIRED);
  });

  it('create throws MOVEMENT_AMOUNT_INVALID for negative cents', () => {
    expect(() =>
      movementService.create('Test', null, -100, true, new Date(), 1, one(1, 100), null),
    ).toThrow(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
  });

  it('create throws MOVEMENT_AMOUNT_INVALID for non-integer cents', () => {
    expect(() =>
      movementService.create('Test', null, 10.5, true, new Date(), 1, one(1, 10), null),
    ).toThrow(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
  });

  it('create throws MOVEMENT_DATE_INVALID for invalid date', () => {
    expect(() =>
      movementService.create('Test', null, 1000, true, new Date('invalid'), 1, one(1, 1000), null),
    ).toThrow(AppErrorCode.MOVEMENT_DATE_INVALID);
  });

  it('create throws MOVEMENT_CATEGORY_REQUIRED for id 0', () => {
    expect(() =>
      movementService.create('Test', null, 1000, true, new Date(), 0, one(1, 1000), null),
    ).toThrow(AppErrorCode.MOVEMENT_CATEGORY_REQUIRED);
  });

  it('create throws MOVEMENT_ENVELOPE_REQUIRED for an empty allocation map', () => {
    expect(() =>
      movementService.create('Test', null, 1000, true, new Date(), 1, new Map(), null),
    ).toThrow(AppErrorCode.MOVEMENT_ENVELOPE_REQUIRED);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('create returns a positive id on success', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);

    const id = movementService.create('Rent', 'Monthly rent', 50000, false, new Date('2024-01-01'), catId, one(envId, 50000), null);
    expect(Number(id)).toBeGreaterThan(0);
  });

  it('persists the anomalous flag on create and on update (user-owned, unlike tentative)', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number }).id);

    const id = Number(
      movementService.create('Laptop', null, 150000, false, new Date('2024-07-01'), catId, one(envId, 150000), null, true),
    );
    expect(movementService.getById(id)?.isAnomalous).toBe(true);

    // Editing the flag off must persist — updateMovement writes is_anomalous.
    movementService.update(Movement.from({ ...movementService.getById(id)!, isAnomalous: false }));
    expect(movementService.getById(id)?.isAnomalous).toBe(false);
  });

  // ── update ─────────────────────────────────────────────────────────────────

  it('update throws MOVEMENT_NAME_REQUIRED for blank name', () => {
    const db = DatabaseService.getInstance().db;
    const row = db.prepare('SELECT * FROM movements LIMIT 1').get() as { id: number } | undefined;
    if (!row) return;
    expect(() =>
      movementService.update(Movement.from({ id: row.id, accountId: 1, name: '  ', concept: null, quantityCents: 100, isPositive: true, date: new Date(), categoryId: 1, envelopeIdMap: one(1, 100), additionalNotes: null, templateId: null, isTentative: false, isAnomalous: false, parentId: null })),
    ).toThrow(AppErrorCode.MOVEMENT_NAME_REQUIRED);
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  it('delete returns true for existing movement', () => {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const envId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number } | undefined)?.id ?? 1);
    const id = Number(movementService.create('Temp', null, 100, true, new Date('2024-01-01'), catId, one(envId, 100), null));
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
      Number(movementService.create('Bulk A', null, 100, true, new Date('2024-02-01'), catId, one(envId, 100), null)),
      Number(movementService.create('Bulk B', null, 200, true, new Date('2024-02-02'), catId, one(envId, 200), null)),
      Number(movementService.create('Bulk C', null, 300, true, new Date('2024-02-03'), catId, one(envId, 300), null)),
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
    movementService.create('Ahorramas', null, 100, false, new Date('2024-03-01'), catId, one(envId, 100), null);
    movementService.create('Ahorro vivienda', null, 100, false, new Date('2024-03-02'), catId, one(envId, 100), null);
    const results = movementService.suggestNames('Ahor');
    expect(results).toEqual(expect.arrayContaining(['Ahorramas', 'Ahorro vivienda']));
  });

  it('suggestNames returns [] for empty prefix', () => {
    expect(movementService.suggestNames('')).toEqual([]);
    expect(movementService.suggestNames('   ')).toEqual([]);
  });
});

describe('MovementService — split across envelopes (CU3)', () => {
  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  /** Category + two distinct envelope ids from the seed. */
  function refs() {
    const db = DatabaseService.getInstance().db;
    const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
    const envs = db.prepare('SELECT id FROM envelopes ORDER BY id LIMIT 2').all() as { id: number }[];
    return { catId, envId: envs[0].id, envId2: envs[1].id };
  }

  const splitId = () => {
    const { catId, envId, envId2 } = refs();
    return {
      envId,
      envId2,
      id: Number(
        movementService.create(
          'Salary', null, 2000, true, new Date('2024-05-01'), catId,
          new Map([[envId, 1500], [envId2, 500]]), null,
        ),
      ),
    };
  };

  it('persists a split and hydrates envelopeIdMap on read', () => {
    const { id, envId, envId2 } = splitId();
    const stored = movementService.getById(id)!;
    expect(stored.envelopeIdMap.size).toBe(2);
    expect(stored.envelopeIdMap.get(envId)).toBe(1500);
    expect(stored.envelopeIdMap.get(envId2)).toBe(500);
  });

  it('rejects a split whose shares do not sum to the total', () => {
    const { catId, envId, envId2 } = refs();
    expect(() =>
      movementService.create('Bad', null, 2000, true, new Date('2024-05-01'), catId, new Map([[envId, 1500], [envId2, 400]]), null),
    ).toThrow(AppErrorCode.MOVEMENT_SPLIT_SUM_MISMATCH);
  });

  it('rejects a split with a non-positive share', () => {
    const { catId, envId, envId2 } = refs();
    expect(() =>
      movementService.create('Bad', null, 2000, true, new Date('2024-05-01'), catId, new Map([[envId, 2000], [envId2, 0]]), null),
    ).toThrow(AppErrorCode.MOVEMENT_SPLIT_AMOUNT_INVALID);
  });

  it('returns the split under each envelope with its partial amount', () => {
    const { id, envId, envId2 } = splitId();
    const inEnv1 = movementService.getAll({ envelopeId: envId });
    const inEnv2 = movementService.getAll({ envelopeId: envId2 });
    expect(inEnv1.find((m) => m.id === id)?.envelopeIdMap.get(envId)).toBe(1500);
    expect(inEnv2.find((m) => m.id === id)?.envelopeIdMap.get(envId2)).toBe(500);
  });

  it('update replaces the split allocation (re-split to a single envelope)', () => {
    const { id, envId } = splitId();
    const stored = movementService.getById(id)!;
    movementService.update(Movement.from({ ...stored, envelopeIdMap: new Map([[envId, 2000]]) }));
    const after = movementService.getById(id)!;
    expect(after.envelopeIdMap.size).toBe(1);
    expect(after.envelopeIdMap.get(envId)).toBe(2000);
  });

  it('delete removes the movement and its allocation rows', () => {
    const db = DatabaseService.getInstance().db;
    const { id } = splitId();
    expect(movementService.delete(id)).toBe(true);
    const rows = db
      .prepare('SELECT COUNT(*) AS n FROM movement_envelopes WHERE movement_id = ?')
      .get(id) as { n: number };
    expect(rows.n).toBe(0);
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
      movementService.create('Salary', null, 1000, true, new Date('2024-06-10'), catId, one(envId, 1000), null, false, null, true),
    );
    expect(movementService.getById(id)?.isTentative).toBe(true);
    expect(movementService.confirm(id)).toBe(true);
    expect(movementService.getById(id)?.isTentative).toBe(false);
  });

  it('confirm throws MOVEMENT_NOT_TENTATIVE for an already-confirmed movement', () => {
    const { catId, envId } = refs();
    const id = Number(
      movementService.create('Manual', null, 1000, false, new Date('2024-06-10'), catId, one(envId, 1000), null),
    );
    expect(() => movementService.confirm(id)).toThrow(AppErrorCode.MOVEMENT_NOT_TENTATIVE);
  });

  it('a tentative creation is exempt from the previous-month guard', () => {
    const { catId, envId } = refs();
    movementService.create('Mar', null, 1000, false, new Date('2024-03-10'), catId, one(envId, 1000), null, false, 1, true);
    // April tentative is allowed even though March is still tentative
    const id = Number(
      movementService.create('Apr', null, 1000, false, new Date('2024-04-10'), catId, one(envId, 1000), null, false, null, true),
    );
    expect(id).toBeGreaterThan(0);
  });

  it('a confirmed creation is blocked when the previous month has a tentative', () => {
    const { catId, envId } = refs();
    movementService.create('Mar', null, 1000, false, new Date('2024-03-10'), catId, one(envId, 1000), null, false, 1, true);
    expect(() =>
      movementService.create('Apr', null, 1000, false, new Date('2024-04-10'), catId, one(envId, 1000), null),
    ).toThrow(AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE);
  });

  it('confirm is blocked out of order, then allowed once the earlier month is clean', () => {
    const { catId, envId } = refs();
    const mar = Number(
      movementService.create('Mar', null, 1000, false, new Date('2024-03-10'), catId, one(envId, 1000), null, false, null, true),
    );
    const apr = Number(
      movementService.create('Apr', null, 1000, false, new Date('2024-04-10'), catId, one(envId, 1000), null, false, null, true),
    );
    // April cannot be confirmed while March is still tentative
    expect(() => movementService.confirm(apr)).toThrow(AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE);
    // confirm March first (its previous month is clean), then April succeeds
    expect(movementService.confirm(mar)).toBe(true);
    expect(movementService.confirm(apr)).toBe(true);
  });
});
