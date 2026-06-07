import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

// Mock electron's app.getPath BEFORE importing the service (which imports DatabaseService at module load).
const tmpDir = path.join(os.tmpdir(), 'financely-test-category');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import {
  deleteCategory,
  setDefaultCategory,
  getAllCategories,
} from '../../services/category.service';
import { getMovementById } from '../../services/movement.service';
import { AppErrorCode } from '@shared/error-codes';

describe('CategoryService — delete & setDefault behavior', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  it('deleteCategory refuses when no default is set', () => {
    const db = DatabaseService.getInstance().db;
    db.prepare('UPDATE categories SET is_default = 0').run();

    const target = getAllCategories().find((c) => c.name === 'Food')!;
    expect(() => deleteCategory(target.id)).toThrow(AppErrorCode.CATEGORY_NO_DEFAULT);
  });

  it('deleteCategory refuses when the target is the current default', () => {
    const defaultCat = getAllCategories().find((c) => c.isDefault);
    expect(defaultCat).toBeDefined();
    expect(() => deleteCategory(defaultCat!.id)).toThrow(AppErrorCode.CATEGORY_DELETE_DEFAULT);
  });

  it('deleteCategory reassigns movements to the default and removes the target', () => {
    const cats = getAllCategories();
    const target = cats.find((c) => c.name === 'Food')!;
    const defaultCat = cats.find((c) => c.isDefault)!;

    const db = DatabaseService.getInstance().db;
    const movRow = db
      .prepare('SELECT id FROM movements WHERE category_id = ? LIMIT 1')
      .get(target.id) as { id: number } | undefined;
    expect(movRow).toBeDefined();
    const movId = movRow!.id;

    expect(deleteCategory(target.id)).toBe(true);

    const after = getMovementById(movId)!;
    expect(after.categoryId).toBe(defaultCat.id);
    expect(getAllCategories().find((c) => c.id === target.id)).toBeUndefined();
  });

  it('setDefaultCategory clears the previous default and enforces uniqueness', () => {
    const before = getAllCategories();
    const oldDefault = before.find((c) => c.isDefault)!;
    const newDefault = before.find((c) => c.name === 'Food')!;
    expect(oldDefault.id).not.toBe(newDefault.id);

    setDefaultCategory(newDefault.id);

    const after = getAllCategories();
    const defaults = after.filter((c) => c.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(newDefault.id);
    expect(after.find((c) => c.id === oldDefault.id)!.isDefault).toBe(false);
  });
});
