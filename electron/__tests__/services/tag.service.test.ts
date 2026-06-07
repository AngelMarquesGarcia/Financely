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
import { createTag, updateTag, deleteTag, getAllTags, addTagToMovement, removeTagFromMovement, getTagsForMovement, getTagsForMovements } from '../../services/tag.service';
import { AppErrorCode } from '@shared/error-codes';

describe('TagService', () => {
  beforeAll(() => {
    DatabaseService.getInstance().migrate();
  });

  beforeEach(() => {
    DatabaseService.getInstance().migrate();
  });

  it('createTag throws TAG_TYPE_REQUIRED for empty type', () => {
    expect(() => createTag('', 'label', '#fff')).toThrow(AppErrorCode.TAG_TYPE_REQUIRED);
  });

  it('createTag throws TAG_NAME_REQUIRED for empty name', () => {
    expect(() => createTag('expense', '', '#fff')).toThrow(AppErrorCode.TAG_NAME_REQUIRED);
  });

  it('createTag returns a positive id on success', () => {
    const id = createTag('expense', 'Food', '#ff0000');
    expect(Number(id)).toBeGreaterThan(0);
  });

  it('updateTag throws TAG_TYPE_REQUIRED for blank type', () => {
    const id = Number(createTag('income', 'Salary', '#00ff00'));
    expect(() => updateTag({ id, type: '  ', name: 'Salary', color: '#00ff00' })).toThrow(AppErrorCode.TAG_TYPE_REQUIRED);
  });

  it('updateTag throws TAG_NAME_REQUIRED for blank name', () => {
    const id = Number(createTag('income', 'Salary2', '#00ff00'));
    expect(() => updateTag({ id, type: 'income', name: '', color: '#00ff00' })).toThrow(AppErrorCode.TAG_NAME_REQUIRED);
  });

  it('deleteTag returns true for existing tag', () => {
    const id = Number(createTag('expense', 'Rent', '#0000ff'));
    expect(deleteTag(id)).toBe(true);
    expect(getAllTags().find((t) => t.id === id)).toBeUndefined();
  });

  it('addTagToMovement is idempotent (INSERT OR IGNORE)', () => {
    const db = DatabaseService.getInstance().db;
    const movId = (db.prepare('SELECT id FROM movements LIMIT 1').get() as { id: number } | undefined)?.id;
    if (!movId) return;

    const tagId = Number(createTag('label', 'Idempotent', '#111111'));
    addTagToMovement(tagId, movId);
    addTagToMovement(tagId, movId);

    const tags = getTagsForMovement(movId);
    expect(tags.filter((t) => t.id === tagId)).toHaveLength(1);
  });

  it('removeTagFromMovement removes the junction row', () => {
    const db = DatabaseService.getInstance().db;
    const movId = (db.prepare('SELECT id FROM movements LIMIT 1').get() as { id: number } | undefined)?.id;
    if (!movId) return;

    const tagId = Number(createTag('label', 'ToRemove', '#222222'));
    addTagToMovement(tagId, movId);
    removeTagFromMovement(tagId, movId);

    const tags = getTagsForMovement(movId);
    expect(tags.find((t) => t.id === tagId)).toBeUndefined();
  });

  it('getTagsForMovement returns only tags for the given movement', () => {
    const db = DatabaseService.getInstance().db;
    const movId = (db.prepare('SELECT id FROM movements LIMIT 1').get() as { id: number } | undefined)?.id;
    if (!movId) return;

    const tagId = Number(createTag('label', 'Tagged', '#333333'));
    addTagToMovement(tagId, movId);

    const tags = getTagsForMovement(movId);
    expect(tags.some((t) => t.id === tagId)).toBe(true);
  });

  it('getTagsForMovements groups tags by movement id', () => {
    const db = DatabaseService.getInstance().db;
    const movs = db.prepare('SELECT id FROM movements ORDER BY id DESC LIMIT 2').all() as {
      id: number;
    }[];
    if (movs.length < 2) return;

    const tagA = Number(createTag('label', 'BulkA', '#444444'));
    const tagB = Number(createTag('label', 'BulkB', '#555555'));
    addTagToMovement(tagA, movs[0].id);
    addTagToMovement(tagB, movs[0].id);
    addTagToMovement(tagA, movs[1].id);

    const map = getTagsForMovements([movs[0].id, movs[1].id]);
    const ids0 = (map[movs[0].id] ?? []).map((t) => t.id);
    const ids1 = (map[movs[1].id] ?? []).map((t) => t.id);
    expect(ids0).toContain(tagA);
    expect(ids0).toContain(tagB);
    expect(ids1).toContain(tagA);
    expect(ids1).not.toContain(tagB);
  });

  it('getTagsForMovements returns {} for empty input', () => {
    expect(getTagsForMovements([])).toEqual({});
  });
});
