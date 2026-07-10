import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-importexport');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { importExportService } from '../../services/import-export.service';
import { movementService } from '../../services/movement.service';
import { accountService } from '../../services/account.service';
import { categoryService } from '../../services/category.service';
import { envelopeService } from '../../services/envelope.service';
import { tagService } from '../../services/tag.service';
import { AppErrorCode } from '@shared/error-codes';
import { MovementDraftT } from '@shared/types';
import { resetTestDb } from '../helpers/reset-db';

const accId = () => accountService.getAll().find((a) => a.isDefault)!.id;
const catId = (name: string) => categoryService.getAll().find((c) => c.name === name)!.id;
const envId = (name: string) => envelopeService.getAll().find((e) => e.name === name)!.id;

describe('ImportExportService — export', () => {
  beforeAll(() => resetTestDb());
  beforeEach(() => resetTestDb());

  it('emits a header row with all columns and the seeded movements', () => {
    const csv = importExportService.exportMovements();
    const [header] = csv.split('\n');
    expect(header.trim()).toBe(
      'name,concept,quantity,date,account,category,envelope,tags,notes,anomalous,template,group',
    );
    expect(csv).toContain('April salary');
    expect(csv).toContain('NOMINA ABRIL');
  });

  it('formats amount as signed decimal, date as ISO, single envelope by name, tags as type/name', () => {
    const csv = importExportService.exportMovements();
    // April salary: +220000 → 2200.00, into Savings, tagged frequency/Recurring, on 2026-04-28.
    const row = csv.split('\n').find((l) => l.startsWith('April salary'))!;
    expect(row).toContain('2200.00');
    expect(row).toContain('2026-04-28');
    expect(row).toContain('Savings');
    expect(row).toContain('frequency/Recurring');
    // April rent is an expense → negative sign.
    const rent = csv.split('\n').find((l) => l.startsWith('April rent'))!;
    expect(rent).toContain('-800.00');
  });

  it('rejects an export whose selection contains a tentative movement', () => {
    movementService.create(
      'Pending',
      null,
      1000,
      false,
      new Date('2026-06-03'),
      catId('Food'),
      new Map([[envId('Monthly Expenses'), 1000]]),
      null,
      false,
      null,
      true,
    );
    expect(() => importExportService.exportMovements()).toThrow(
      AppErrorCode.EXPORT_CONTAINS_TENTATIVE,
    );
  });

  it('honors a month-range filter', () => {
    const csv = importExportService.exportMovements({
      date: { from: '2026-05-01', to: '2026-05-31' },
    });
    expect(csv).toContain('May salary');
    expect(csv).not.toContain('April salary');
  });
});

describe('ImportExportService — preview parsing', () => {
  beforeAll(() => resetTestDb());
  beforeEach(() => resetTestDb());

  it('parses a well-formed CSV into committable drafts', () => {
    const csv = [
      'name,concept,quantity,date,category,envelope,tags,notes,anomalous',
      'Morning coffee,Coffee,-3.50,2026-06-01,Food,Monthly Expenses,merchant/Starbucks,,false',
      ',Bonus,1000.00,2026-06,Salary,Savings,,,true',
    ].join('\n');

    const { drafts, issues } = importExportService.previewImport(csv, accId());
    expect(drafts).toHaveLength(2);

    const coffee = drafts[0];
    expect(coffee.name).toBe('Morning coffee');
    expect(coffee.quantityCents).toBe(350);
    expect(coffee.isPositive).toBe(false);
    expect(coffee.categoryId).toBe(catId('Food'));
    expect(coffee.envelopes).toEqual([
      { name: 'Monthly Expenses', id: envId('Monthly Expenses'), amountCents: 350 },
    ]);
    expect(coffee.tags).toEqual([{ type: 'merchant', name: 'Starbucks', id: null }]);

    const bonus = drafts[1];
    expect(bonus.name).toBe('Bonus'); // fell back to concept
    expect(bonus.isPositive).toBe(true);
    expect(bonus.isAnomalous).toBe(true);
    expect(bonus.date.getFullYear()).toBe(2026);
    expect(bonus.date.getMonth()).toBe(5); // June (YYYY-MM → day 01)
    expect(bonus.date.getDate()).toBe(1);

    expect(issues.some((i) => i.code === 'TAG_WILL_CREATE')).toBe(true);
  });

  it('falls unmatched category/envelope back to the default buckets and flags them', () => {
    const csv = [
      'concept,quantity,date,category,envelope',
      'Mystery,-10.00,2026-06-05,NopeCat,NopeEnv',
    ].join('\n');

    const { drafts, issues } = importExportService.previewImport(csv, accId());
    expect(drafts).toHaveLength(1);
    expect(drafts[0].categoryId).toBe(catId('Uncategorized'));
    expect(drafts[0].envelopes[0].id).toBe(envId('Unassigned'));
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['CATEGORY_NOT_FOUND', 'ENVELOPE_NOT_FOUND']),
    );
  });

  it('records blocking issues and drops the offending rows', () => {
    const csv = [
      'concept,quantity,date',
      ',,', // no name/concept → NAME_MISSING
      'Bad,notmoney,2026-06-01', // AMOUNT_INVALID
      'Baddate,5.00,notadate', // DATE_INVALID
    ].join('\n');

    const { drafts, issues } = importExportService.previewImport(csv, accId());
    expect(drafts).toHaveLength(0);
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['NAME_MISSING', 'AMOUNT_INVALID', 'DATE_INVALID']),
    );
  });

  it('throws when a required column is missing', () => {
    expect(() => importExportService.previewImport('foo,bar\n1,2', accId())).toThrow(
      AppErrorCode.IMPORT_MISSING_COLUMNS,
    );
  });

  it('parses the split mini-syntax and validates the sum', () => {
    const ok = [
      'concept,quantity,date,envelope',
      'Split,-10.00,2026-06-01,Monthly Expenses:7.00|Savings:3.00',
    ].join('\n');
    const okResult = importExportService.previewImport(ok, accId());
    expect(okResult.drafts[0].envelopes).toEqual([
      { name: 'Monthly Expenses', id: envId('Monthly Expenses'), amountCents: 700 },
      { name: 'Savings', id: envId('Savings'), amountCents: 300 },
    ]);

    const bad = [
      'concept,quantity,date,envelope',
      'Split,-10.00,2026-06-01,Monthly Expenses:7.00|Savings:2.00',
    ].join('\n');
    const badResult = importExportService.previewImport(bad, accId());
    expect(badResult.drafts).toHaveLength(0);
    expect(badResult.issues.some((i) => i.code === 'SPLIT_SUM_MISMATCH')).toBe(true);
  });

  it('auto-detects a semicolon delimiter and tolerates comma decimals (es-ES Excel)', () => {
    const csv = ['concept;quantity;date;category', 'Cafe;-3,50;2026-06-01;Food'].join('\n');
    const { drafts } = importExportService.previewImport(csv, accId());
    expect(drafts).toHaveLength(1);
    expect(drafts[0].quantityCents).toBe(350);
    expect(drafts[0].isPositive).toBe(false);
  });
});

describe('ImportExportService — commit', () => {
  beforeAll(() => resetTestDb());
  beforeEach(() => resetTestDb());

  it('persists drafts in one transaction and auto-creates unknown tags', () => {
    const csv = [
      'name,concept,quantity,date,category,envelope,tags',
      'Morning coffee,Coffee,-3.50,2026-06-01,Food,Monthly Expenses,merchant/Starbucks',
    ].join('\n');
    const { drafts } = importExportService.previewImport(csv, accId());

    const before = movementService.getAll().length;
    const created = importExportService.commitImport(drafts, accId());
    expect(created).toBe(1);
    expect(movementService.getAll().length).toBe(before + 1);

    const newTag = tagService.getAll().find((t) => t.type === 'merchant' && t.name === 'Starbucks');
    expect(newTag).toBeDefined();
  });

  it('rolls back the whole batch when any row is invalid', () => {
    const good: MovementDraftT = {
      name: 'Good',
      concept: 'Good',
      quantityCents: 500,
      isPositive: false,
      date: new Date('2026-06-01'),
      categoryName: 'Food',
      categoryId: catId('Food'),
      envelopes: [{ name: 'Monthly Expenses', id: envId('Monthly Expenses'), amountCents: 500 }],
      tags: [],
      additionalNotes: null,
      isAnomalous: false,
      templateName: null,
      groupName: null,
    };
    const bad: MovementDraftT = { ...good, name: 'Bad', quantityCents: 0 };

    const before = movementService.getAll().length;
    expect(() => importExportService.commitImport([good, bad], accId())).toThrow();
    expect(movementService.getAll().length).toBe(before); // nothing persisted
  });

  it('round-trips: export → preview reproduces equivalent movements', () => {
    const csv = importExportService.exportMovements();
    const { drafts } = importExportService.previewImport(csv, accId());

    const salary = drafts.find((d) => d.name === 'April salary')!;
    expect(salary.quantityCents).toBe(220000);
    expect(salary.isPositive).toBe(true);
    expect(salary.categoryId).toBe(catId('Salary'));
    expect(salary.envelopes[0].id).toBe(envId('Savings'));
    expect(salary.tags.some((t) => t.type === 'frequency' && t.name === 'Recurring')).toBe(true);
  });
});

describe('ImportExportService — tentative guard', () => {
  beforeAll(() => resetTestDb());
  beforeEach(() => resetTestDb());

  it('refuses preview and commit when the target account has tentative movements', () => {
    // A tentative movement in the target account.
    movementService.create(
      'Pending',
      null,
      1000,
      false,
      new Date('2026-06-03'),
      catId('Food'),
      new Map([[envId('Monthly Expenses'), 1000]]),
      null,
      false,
      null,
      true,
    );

    const csv = 'concept,quantity,date\nCoffee,-3.50,2026-06-01';
    expect(() => importExportService.previewImport(csv, accId())).toThrow(
      AppErrorCode.IMPORT_ACCOUNT_HAS_TENTATIVE,
    );
    // The guard runs before the transaction, so even an empty commit is refused.
    expect(() => importExportService.commitImport([], accId())).toThrow(
      AppErrorCode.IMPORT_ACCOUNT_HAS_TENTATIVE,
    );
  });
});
