import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-tag');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { tagService } from '../../services/tag.service';
import { AppErrorCode } from '@shared/error-codes';

describe('TagService', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  it('create throws TAG_TYPE_REQUIRED for empty type', () => {
    expect(() => tagService.create('', 'label', '#fff')).toThrow(AppErrorCode.TAG_TYPE_REQUIRED);
  });

  it('create throws TAG_NAME_REQUIRED for empty name', () => {
    expect(() => tagService.create('expense', '', '#fff')).toThrow(AppErrorCode.TAG_NAME_REQUIRED);
  });

  it('create returns a positive id on success', () => {
    const id = tagService.create('expense', 'Food', '#ff0000');
    expect(Number(id)).toBeGreaterThan(0);
  });

  it('update throws TAG_TYPE_REQUIRED for blank type', () => {
    const id = Number(tagService.create('income', 'Salary', '#00ff00'));
    expect(() => tagService.update({ id, type: '  ', name: 'Salary', color: '#00ff00' })).toThrow(AppErrorCode.TAG_TYPE_REQUIRED);
  });

  it('update throws TAG_NAME_REQUIRED for blank name', () => {
    const id = Number(tagService.create('income', 'Salary2', '#00ff00'));
    expect(() => tagService.update({ id, type: 'income', name: '', color: '#00ff00' })).toThrow(AppErrorCode.TAG_NAME_REQUIRED);
  });

  it('delete returns true for existing tag', () => {
    const id = Number(tagService.create('expense', 'Rent', '#0000ff'));
    expect(tagService.delete(id)).toBe(true);
    expect(tagService.getAll().find((t) => t.id === id)).toBeUndefined();
  });

  it('addToMovement is idempotent (INSERT OR IGNORE)', () => {
    const db = DatabaseService.getInstance().db;
    const movId = (db.prepare('SELECT id FROM movements LIMIT 1').get() as { id: number } | undefined)?.id;
    if (!movId) return;

    const tagId = Number(tagService.create('label', 'Idempotent', '#111111'));
    tagService.addToMovement(tagId, movId);
    tagService.addToMovement(tagId, movId);

    const tags = tagService.getForMovement(movId);
    expect(tags.filter((t) => t.id === tagId)).toHaveLength(1);
  });

  it('removeFromMovement removes the junction row', () => {
    const db = DatabaseService.getInstance().db;
    const movId = (db.prepare('SELECT id FROM movements LIMIT 1').get() as { id: number } | undefined)?.id;
    if (!movId) return;

    const tagId = Number(tagService.create('label', 'ToRemove', '#222222'));
    tagService.addToMovement(tagId, movId);
    tagService.removeFromMovement(tagId, movId);

    const tags = tagService.getForMovement(movId);
    expect(tags.find((t) => t.id === tagId)).toBeUndefined();
  });

  it('getForMovement returns only tags for the given movement', () => {
    const db = DatabaseService.getInstance().db;
    const movId = (db.prepare('SELECT id FROM movements LIMIT 1').get() as { id: number } | undefined)?.id;
    if (!movId) return;

    const tagId = Number(tagService.create('label', 'Tagged', '#333333'));
    tagService.addToMovement(tagId, movId);

    const tags = tagService.getForMovement(movId);
    expect(tags.some((t) => t.id === tagId)).toBe(true);
  });

  it('getForMovements groups tags by movement id', () => {
    const db = DatabaseService.getInstance().db;
    const movs = db.prepare('SELECT id FROM movements ORDER BY id DESC LIMIT 2').all() as {
      id: number;
    }[];
    if (movs.length < 2) return;

    const tagA = Number(tagService.create('label', 'BulkA', '#444444'));
    const tagB = Number(tagService.create('label', 'BulkB', '#555555'));
    tagService.addToMovement(tagA, movs[0].id);
    tagService.addToMovement(tagB, movs[0].id);
    tagService.addToMovement(tagA, movs[1].id);

    const map = tagService.getForMovements([movs[0].id, movs[1].id]);
    const ids0 = (map[movs[0].id] ?? []).map((t) => t.id);
    const ids1 = (map[movs[1].id] ?? []).map((t) => t.id);
    expect(ids0).toContain(tagA);
    expect(ids0).toContain(tagB);
    expect(ids1).toContain(tagA);
    expect(ids1).not.toContain(tagB);
  });

  it('getForMovements returns {} for empty input', () => {
    expect(tagService.getForMovements([])).toEqual({});
  });
});
