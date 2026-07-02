import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-periodic');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { periodicMovementService } from '../../services/periodic-movement.service';
import { periodicMovementRepository } from '../../repository/periodic-movement-repository.service';
import { movementRepository } from '../../repository/movement-repository.service';
import { tagRepository } from '../../repository/tag-repository.service';
import { PeriodicMovement } from '@shared/domain';
import { AppErrorCode } from '@shared/error-codes';

function ids() {
  const db = DatabaseService.getInstance().db;
  const accountId = Number((db.prepare('SELECT id FROM accounts LIMIT 1').get() as { id: number }).id);
  const categoryId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
  const envelopeId = Number((db.prepare('SELECT id FROM envelopes LIMIT 1').get() as { id: number }).id);
  const tagId = Number((db.prepare('SELECT id FROM tags LIMIT 1').get() as { id: number }).id);
  return { accountId, categoryId, envelopeId, tagId };
}

function baseFields(over: Partial<ReturnType<typeof ids>> & { day?: number; name?: string } = {}) {
  const { accountId, categoryId, envelopeId } = ids();
  return {
    accountId: over.accountId ?? accountId,
    name: over.name ?? 'Gym membership',
    concept: null,
    quantityCents: 5000,
    isPositive: false,
    dayOfMonth: over.day ?? 10,
    categoryId: over.categoryId ?? categoryId,
    envelopeId: over.envelopeId ?? envelopeId,
    additionalNotes: null,
  };
}

/** A period n months before the current one. */
function monthsAgo(n: number): { year: number; month: number } {
  const d = new Date();
  const idx = d.getFullYear() * 12 + d.getMonth() - n;
  return { year: Math.floor(idx / 12), month: idx % 12 };
}

describe('PeriodicMovementService', () => {
  beforeAll(() => DatabaseService.getInstance().migrate());
  beforeEach(() => DatabaseService.getInstance().migrate());

  // ── CRUD + validation ──────────────────────────────────────────────────────

  it('creates a template and reads it back', () => {
    const id = Number(periodicMovementService.create(baseFields(), []));
    expect(id).toBeGreaterThan(0);
    const t = periodicMovementService.getById(id);
    expect(t?.name).toBe('Gym membership');
    expect(t?.active).toBe(true);
    expect(t?.lastCreatedYear).toBeNull();
  });

  it('rejects a duplicate name', () => {
    periodicMovementService.create(baseFields({ name: 'Rent' }), []);
    expect(() => periodicMovementService.create(baseFields({ name: 'Rent' }), [])).toThrow(
      AppErrorCode.PERIODIC_NAME_DUPLICATE,
    );
  });

  it('rejects an out-of-range day', () => {
    expect(() => periodicMovementService.create(baseFields({ day: 0 }), [])).toThrow(
      AppErrorCode.PERIODIC_DAY_INVALID,
    );
    expect(() => periodicMovementService.create(baseFields({ day: 32 }), [])).toThrow(
      AppErrorCode.PERIODIC_DAY_INVALID,
    );
  });

  it('rejects a non-positive amount', () => {
    expect(() =>
      periodicMovementService.create({ ...baseFields(), quantityCents: 0 }, []),
    ).toThrow(AppErrorCode.PERIODIC_AMOUNT_INVALID);
  });

  it('rejects a non-existent account', () => {
    expect(() => periodicMovementService.create(baseFields({ accountId: 999999 }), [])).toThrow(
      AppErrorCode.PERIODIC_ACCOUNT_REQUIRED,
    );
  });

  it('rejects a non-existent category', () => {
    expect(() => periodicMovementService.create(baseFields({ categoryId: 999999 }), [])).toThrow(
      AppErrorCode.PERIODIC_CATEGORY_REQUIRED,
    );
  });

  it('rejects a non-existent envelope', () => {
    expect(() => periodicMovementService.create(baseFields({ envelopeId: 999999 }), [])).toThrow(
      AppErrorCode.PERIODIC_ENVELOPE_REQUIRED,
    );
  });

  it('stores and returns tags', () => {
    const { tagId } = ids();
    const id = Number(periodicMovementService.create(baseFields(), [tagId]));
    const tags = periodicMovementService.getTagsForPeriodicMovement(id);
    expect(tags.map((t) => t.id)).toContain(tagId);
  });

  // ── Day clamping (pure domain) ─────────────────────────────────────────────

  it('clamps the expected day to the length of a short month', () => {
    const t = PeriodicMovement.from({
      ...baseFields({ day: 31 }),
      id: 1,
      active: true,
      startYear: 2024,
      startMonth: 1,
      lastCreatedYear: null,
      lastCreatedMonth: null,
    });
    // February 2024 is a leap year → 29 days.
    expect(t.expectedDate(2024, 1).getDate()).toBe(29);
    // A 31-day month is unaffected.
    expect(t.expectedDate(2024, 0).getDate()).toBe(31);
  });

  // ── Catch-up generation ────────────────────────────────────────────────────

  it('generates tentative instances for past + current months', () => {
    const start = monthsAgo(2);
    const { tagId } = ids();
    const id = Number(
      periodicMovementRepository.insert({
        ...baseFields({ day: 1 }),
        active: true,
        startYear: start.year,
        startMonth: start.month,
        lastCreatedYear: null,
        lastCreatedMonth: null,
      }),
    );
    periodicMovementRepository.setTags(id, [tagId]);

    periodicMovementService.generateDueForAll();

    const instances = movementRepository.getByTemplate(id);
    // months -2, -1, 0 (day 1 ⇒ current month is always due)
    expect(instances.length).toBe(3);
    expect(instances.every((m) => m.isTentative)).toBe(true);
    expect(instances.every((m) => m.templateId === id)).toBe(true);
    // tags inherited
    expect(tagRepository.getTagsForMovement(instances[0].id).map((t) => t.id)).toContain(tagId);

    // cursor advanced to the current month
    const cur = monthsAgo(0);
    const t = periodicMovementService.getById(id)!;
    expect(t.lastCreatedYear).toBe(cur.year);
    expect(t.lastCreatedMonth).toBe(cur.month);
  });

  it('is idempotent — a second run creates nothing new', () => {
    const start = monthsAgo(1);
    const id = Number(
      periodicMovementRepository.insert({
        ...baseFields({ day: 1 }),
        active: true,
        startYear: start.year,
        startMonth: start.month,
        lastCreatedYear: null,
        lastCreatedMonth: null,
      }),
    );
    periodicMovementService.generateDueForAll();
    const first = movementRepository.getByTemplate(id).length;
    periodicMovementService.generateDueForAll();
    expect(movementRepository.getByTemplate(id).length).toBe(first);
  });

  // ── Manual instantiation ───────────────────────────────────────────────────

  it('createAdditionalInstance makes a confirmed instance without advancing the cursor', () => {
    const id = Number(periodicMovementService.create(baseFields(), []));
    const before = periodicMovementService.getById(id)!;
    periodicMovementService.createAdditionalInstance(id, new Date('2020-03-15'), 7777);
    const instances = movementRepository.getByTemplate(id);
    expect(instances.length).toBe(1);
    expect(instances[0].isTentative).toBe(false);
    expect(instances[0].quantityCents).toBe(7777);
    const after = periodicMovementService.getById(id)!;
    expect(after.lastCreatedYear).toBe(before.lastCreatedYear); // unchanged
  });

  it('rejects a future date for additional instances', () => {
    const id = Number(periodicMovementService.create(baseFields(), []));
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() => periodicMovementService.createAdditionalInstance(id, future)).toThrow(
      AppErrorCode.PERIODIC_DATE_FUTURE,
    );
  });

  it('rejects a future date for early instantiation', () => {
    const id = Number(periodicMovementService.create(baseFields(), []));
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() => periodicMovementService.instantiateCurrentMonthEarly(id, future)).toThrow(
      AppErrorCode.PERIODIC_DATE_FUTURE,
    );
  });

  it('instantiateCurrentMonthEarly creates a confirmed instance and advances the cursor', () => {
    const prev = monthsAgo(1);
    const id = Number(
      periodicMovementRepository.insert({
        ...baseFields({ day: 28 }),
        active: true,
        startYear: prev.year,
        startMonth: prev.month,
        lastCreatedYear: prev.year, // cursor at last month ⇒ current not yet generated
        lastCreatedMonth: prev.month,
      }),
    );
    periodicMovementService.instantiateCurrentMonthEarly(id);
    const instances = movementRepository.getByTemplate(id);
    expect(instances.length).toBe(1);
    expect(instances[0].isTentative).toBe(false); // born confirmed
    const cur = monthsAgo(0);
    const t = periodicMovementService.getById(id)!;
    expect(t.lastCreatedYear).toBe(cur.year);
    expect(t.lastCreatedMonth).toBe(cur.month);
  });

  it('throws when the current month was already instantiated', () => {
    const cur = monthsAgo(0);
    const id = Number(
      periodicMovementRepository.insert({
        ...baseFields({ day: 1 }),
        active: true,
        startYear: cur.year,
        startMonth: cur.month,
        lastCreatedYear: cur.year, // cursor already covers the current month
        lastCreatedMonth: cur.month,
      }),
    );
    expect(() => periodicMovementService.instantiateCurrentMonthEarly(id)).toThrow(
      AppErrorCode.PERIODIC_ALREADY_INSTANTIATED,
    );
  });

  // ── Deletion + activation ──────────────────────────────────────────────────

  it('refuses to delete a template that has generated instances', () => {
    const id = Number(periodicMovementService.create(baseFields(), []));
    periodicMovementService.createAdditionalInstance(id, new Date('2020-01-10'));
    expect(() => periodicMovementService.delete(id)).toThrow(
      AppErrorCode.PERIODIC_DELETE_HAS_INSTANCES,
    );
  });

  it('deletes a template with no instances', () => {
    const id = Number(periodicMovementService.create(baseFields(), []));
    expect(periodicMovementService.delete(id)).toBe(true);
    expect(periodicMovementService.getById(id)).toBeUndefined();
  });

  it('reactivation snaps the cursor to the current month (no back-fill)', () => {
    const start = monthsAgo(3);
    const id = Number(
      periodicMovementRepository.insert({
        ...baseFields({ day: 1 }),
        active: false,
        startYear: start.year,
        startMonth: start.month,
        lastCreatedYear: start.year,
        lastCreatedMonth: start.month,
      }),
    );
    periodicMovementService.setActive(id, true);
    const cur = monthsAgo(0);
    const t = periodicMovementService.getById(id)!;
    expect(t.active).toBe(true);
    expect(t.lastCreatedYear).toBe(cur.year);
    expect(t.lastCreatedMonth).toBe(cur.month);
    // and a generation run then produces nothing for the dormant gap
    periodicMovementService.generateDueForAll();
    expect(movementRepository.getByTemplate(id).length).toBe(0);
  });
});
