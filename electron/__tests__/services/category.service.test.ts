import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-category');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { resetTestDb } from '../helpers/reset-db';
import { categoryService } from '../../services/category.service';
import { movementService } from '../../services/movement.service';
import { AppErrorCode } from '@shared/error-codes';

describe('CategoryService — delete & setDefault behavior', () => {
  beforeAll(() => {
    resetTestDb();
  });

  beforeEach(() => {
    resetTestDb();
  });

  it('delete refuses when no default is set', () => {
    const db = DatabaseService.getInstance().db;
    db.prepare('UPDATE categories SET is_default = 0').run();

    const target = categoryService.getAll().find((c) => c.name === 'Food')!;
    expect(() => categoryService.delete(target.id)).toThrow(AppErrorCode.CATEGORY_NO_DEFAULT);
  });

  it('delete refuses when the target is the current default', () => {
    const defaultCat = categoryService.getAll().find((c) => c.isDefault);
    expect(defaultCat).toBeDefined();
    expect(() => categoryService.delete(defaultCat!.id)).toThrow(
      AppErrorCode.CATEGORY_DELETE_DEFAULT,
    );
  });

  it('delete reassigns movements to the default and removes the target', () => {
    const cats = categoryService.getAll();
    const target = cats.find((c) => c.name === 'Food')!;
    const defaultCat = cats.find((c) => c.isDefault)!;

    const db = DatabaseService.getInstance().db;
    const movRow = db
      .prepare('SELECT id FROM movements WHERE category_id = ? LIMIT 1')
      .get(target.id) as { id: number } | undefined;
    expect(movRow).toBeDefined();
    const movId = movRow!.id;

    expect(categoryService.delete(target.id)).toBe(true);

    const after = movementService.getById(movId)!;
    expect(after.categoryId).toBe(defaultCat.id);
    expect(categoryService.getAll().find((c) => c.id === target.id)).toBeUndefined();
  });

  it('setDefault clears the previous default and enforces uniqueness', () => {
    const before = categoryService.getAll();
    const oldDefault = before.find((c) => c.isDefault)!;
    const newDefault = before.find((c) => c.name === 'Food')!;
    expect(oldDefault.id).not.toBe(newDefault.id);

    categoryService.setDefault(newDefault.id);

    const after = categoryService.getAll();
    const defaults = after.filter((c) => c.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(newDefault.id);
    expect(after.find((c) => c.id === oldDefault.id)!.isDefault).toBe(false);
  });
});
