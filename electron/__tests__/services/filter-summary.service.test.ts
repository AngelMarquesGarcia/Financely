import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-filtersummary');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { resetTestDb } from '../helpers/reset-db';
import { filterSummaryService } from '../../services/filter-summary.service';
import { movementService } from '../../services/movement.service';
import { envelopeService } from '../../services/envelope.service';
import { accountService } from '../../services/account.service';
import { tagService } from '../../services/tag.service';

function firstCategoryId(): number {
  const db = DatabaseService.getInstance().db;
  return Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
}

function freshDefault(name: string): { acc: number; def: number } {
  const acc = Number(accountService.create(name));
  const def = envelopeService.getAll().find((e) => e.accountId === acc && e.isDefault)!.id;
  return { acc, def };
}

const one = (envelopeId: number, amount: number) => new Map([[envelopeId, amount]]);

/** create(name, concept, qty, isPositive, date, categoryId, envMap, notes, isAnomalous, templateId, isTentative, accountId) */

describe('FilterSummaryService', () => {
  beforeAll(() => resetTestDb());
  beforeEach(() => resetTestDb());

  it('breaks a multi-month interval into per-month children plus an interval aggregate, snapping to whole months', () => {
    const { acc, def } = freshDefault('FSInterval');
    const cat = firstCategoryId();
    // Feb: two expenses of 1000 (avg 1000). Mar: nothing. Apr: one expense of 4000 (avg 4000).
    movementService.create(
      'F1',
      null,
      1000,
      false,
      new Date(2026, 1, 10),
      cat,
      one(def, 1000),
      null,
      false,
      null,
      false,
      acc,
    );
    movementService.create(
      'F2',
      null,
      1000,
      false,
      new Date(2026, 1, 20),
      cat,
      one(def, 1000),
      null,
      false,
      null,
      false,
      acc,
    );
    movementService.create(
      'A1',
      null,
      4000,
      false,
      new Date(2026, 3, 15),
      cat,
      one(def, 4000),
      null,
      false,
      null,
      false,
      acc,
    );

    const result = filterSummaryService.generateFilterSummary({
      accountId: acc,
      date: { from: '2026-02-15', to: '2026-04-10' }, // arbitrary days → snapped to Feb..Apr
    });

    // Top-level echoes the request verbatim; children cover every month in the interval.
    expect(result.filters.date).toEqual({ from: '2026-02-15', to: '2026-04-10' });
    expect(result.children).toHaveLength(3);

    const [feb, mar, apr] = result.children;
    expect(feb.summary.totalExpenseCents).toBe(2000);
    expect(feb.summary.movementCount).toBe(2);
    expect(feb.summary.avgExpenseCents).toBe(1000);
    expect(feb.summary.filters?.date).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(feb.summary.filters?.includeAnomalies).toBe(true);

    expect(mar.summary.movementCount).toBe(0);
    expect(mar.summary.totalExpenseCents).toBe(0);

    expect(apr.summary.totalExpenseCents).toBe(4000);
    expect(apr.summary.movementCount).toBe(1);

    // Aggregate is interval-correct: avg over ALL expenses (6000/3 = 2000), NOT the mean of monthly means.
    expect(result.aggregate.summary.totalExpenseCents).toBe(6000);
    expect(result.aggregate.summary.movementCount).toBe(3);
    expect(result.aggregate.summary.avgExpenseCents).toBe(2000);
    expect(result.aggregate.summary.filters?.date).toEqual({
      from: '2026-02-01',
      to: '2026-04-30',
    });
  });

  it('computes the without-anomalies mirror (null when a slice has none, populated otherwise)', () => {
    const { acc, def } = freshDefault('FSAnom');
    const cat = firstCategoryId();
    movementService.create(
      'FebOk',
      null,
      1000,
      false,
      new Date(2026, 1, 10),
      cat,
      one(def, 1000),
      null,
      false,
      null,
      false,
      acc,
    );
    movementService.create(
      'AprOk',
      null,
      1000,
      false,
      new Date(2026, 3, 10),
      cat,
      one(def, 1000),
      null,
      false,
      null,
      false,
      acc,
    );
    movementService.create(
      'AprAnom',
      null,
      5000,
      false,
      new Date(2026, 3, 12),
      cat,
      one(def, 5000),
      null,
      true,
      null,
      false,
      acc,
    );

    const result = filterSummaryService.generateFilterSummary({
      accountId: acc,
      date: { from: '2026-02-01', to: '2026-04-30' },
    });
    const [feb, , apr] = result.children;

    expect(feb.summaryWithoutAnomalies).toBeNull(); // Feb holds no anomalous movement
    expect(apr.summary.totalExpenseCents).toBe(6000);
    expect(apr.summary.filters?.includeAnomalies).toBe(true);
    expect(apr.summaryWithoutAnomalies).not.toBeNull();
    expect(apr.summaryWithoutAnomalies!.totalExpenseCents).toBe(1000);
    expect(apr.summaryWithoutAnomalies!.filters?.includeAnomalies).toBe(false);
    expect(result.aggregate.summaryWithoutAnomalies!.totalExpenseCents).toBe(2000);
  });

  it('uses envelope-partial amounts for a single-envelope filter and full amounts otherwise', () => {
    const { acc, def } = freshDefault('FSAmount');
    const other = Number(envelopeService.create('FSAmountB', acc));
    const cat = firstCategoryId();
    const tagId = Number(tagService.create('test', 'FSTag', '#fff'));
    const movId = Number(
      movementService.create(
        'Split',
        null,
        3000,
        true,
        new Date(2026, 3, 10),
        cat,
        new Map([
          [def, 1000],
          [other, 2000],
        ]),
        null,
        false,
        null,
        false,
        acc,
      ),
    );
    tagService.addToMovement(tagId, movId);
    const date = { from: '2026-04-01', to: '2026-04-30' };

    // Single-envelope filter → that envelope's slice.
    expect(
      filterSummaryService.generateFilterSummary({ accountId: acc, envelopeId: def, date })
        .aggregate.summary.totalIncomeCents,
    ).toBe(1000);
    expect(
      filterSummaryService.generateFilterSummary({ accountId: acc, envelopeId: other, date })
        .aggregate.summary.totalIncomeCents,
    ).toBe(2000);
    // Category / tag filters → the whole movement amount, counted once.
    expect(
      filterSummaryService.generateFilterSummary({ accountId: acc, categoryId: cat, date })
        .aggregate.summary.totalIncomeCents,
    ).toBe(3000);
    expect(
      filterSummaryService.generateFilterSummary({
        accountId: acc,
        tags: { ids: [tagId], matchAll: false },
        date,
      }).aggregate.summary.totalIncomeCents,
    ).toBe(3000);
  });

  it('defaults to the current month (a single child) when the filter carries no date', () => {
    const { acc, def } = freshDefault('FSDefault');
    const cat = firstCategoryId();
    movementService.create(
      'Now',
      null,
      1000,
      true,
      new Date(),
      cat,
      one(def, 1000),
      null,
      false,
      null,
      false,
      acc,
    );
    movementService.create(
      'Old',
      null,
      9999,
      true,
      new Date(2020, 0, 15),
      cat,
      one(def, 9999),
      null,
      false,
      null,
      false,
      acc,
    );

    const result = filterSummaryService.generateFilterSummary({ accountId: acc });
    expect(result.children).toHaveLength(1);
    expect(result.aggregate.summary.movementCount).toBe(1); // only the current-month movement
    expect(result.aggregate.summary.totalIncomeCents).toBe(1000);
  });
});
