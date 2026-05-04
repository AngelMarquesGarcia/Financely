import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../services/database.service';

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
}));

describe('DatabaseService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  let service: DatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DatabaseService();
    mockDb = jest.mocked(Database).mock.results[0].value;
  });

  describe('migrate', () => {
    it('applies v1 migration on a fresh database', () => {
      mockDb.get.mockReturnValue(undefined);
      service.migrate();
      expect(mockDb.run).toHaveBeenCalledTimes(4); // 3 CREATE TABLE + 1 INSERT schema_version
    });

    it('skips v1 migration when schema is already up to date', () => {
      mockDb.get.mockReturnValue({ value: '1' });
      service.migrate();
      expect(mockDb.run).toHaveBeenCalledTimes(3); // 3 CREATE TABLE only
    });
  });

  describe('insertOperation', () => {
    it('returns lastInsertRowid', () => {
      mockDb.run.mockReturnValue({ lastInsertRowid: 42, changes: 1 });
      const result = service.insertOperation({ number1: 2, number2: 3, operator: '+', result: 5 });
      expect(result).toBe(42);
    });
  });

  describe('insertSentence', () => {
    it('returns lastInsertRowid', () => {
      mockDb.run.mockReturnValue({ lastInsertRowid: 7, changes: 1 });
      const result = service.insertSentence({ sentence: 'hello world', words: 2, chars: 11 });
      expect(result).toBe(7);
    });
  });

  describe('getOperationByOperator', () => {
    it('returns matching operations', () => {
      const ops = [{ number1: 2, number2: 3, operator: '+', result: 5 }];
      mockDb.all.mockReturnValue(ops);
      expect(service.getOperationByOperator('+')).toEqual(ops);
    });
  });

  describe('getSentenceByWords', () => {
    it('returns matching sentences', () => {
      const sents = [{ sentence: 'hello world', words: 2, chars: 11 }];
      mockDb.all.mockReturnValue(sents);
      expect(service.getSentenceByWords(2)).toEqual(sents);
    });
  });

  describe('getAllOperations', () => {
    it('returns all operations', () => {
      const ops = [{ number1: 1, number2: 2, operator: '*', result: 2 }];
      mockDb.all.mockReturnValue(ops);
      expect(service.getAllOperations()).toEqual(ops);
    });
  });

  describe('getAllSentences', () => {
    it('returns all sentences', () => {
      const sents = [{ sentence: 'foo', words: 1, chars: 3 }];
      mockDb.all.mockReturnValue(sents);
      expect(service.getAllSentences()).toEqual(sents);
    });
  });

  describe('patchOperation', () => {
    const op = { number1: 2, number2: 3, operator: '+', result: 5 };

    it('returns true when a row was updated', () => {
      mockDb.run.mockReturnValue({ changes: 1 });
      expect(service.patchOperation(op)).toBe(true);
    });

    it('returns false when no row matched', () => {
      mockDb.run.mockReturnValue({ changes: 0 });
      expect(service.patchOperation(op)).toBe(false);
    });
  });

  describe('patchSentence', () => {
    const sent = { sentence: 'hello world', words: 2, chars: 11 };

    it('returns true when a row was updated', () => {
      mockDb.run.mockReturnValue({ changes: 1 });
      expect(service.patchSentence(sent)).toBe(true);
    });

    it('returns false when no row matched', () => {
      mockDb.run.mockReturnValue({ changes: 0 });
      expect(service.patchSentence(sent)).toBe(false);
    });
  });

  describe('deleteOperation', () => {
    const op = { number1: 2, number2: 3, operator: '+', result: 5 };

    it('returns true when a row was deleted', () => {
      mockDb.run.mockReturnValue({ changes: 1 });
      expect(service.deleteOperation(op)).toBe(true);
    });

    it('returns false when no row matched', () => {
      mockDb.run.mockReturnValue({ changes: 0 });
      expect(service.deleteOperation(op)).toBe(false);
    });
  });

  describe('deleteSentence', () => {
    const sent = { sentence: 'hello world', words: 2, chars: 11 };

    it('returns true when a row was deleted', () => {
      mockDb.run.mockReturnValue({ changes: 1 });
      expect(service.deleteSentence(sent)).toBe(true);
    });

    it('returns false when no row matched', () => {
      mockDb.run.mockReturnValue({ changes: 0 });
      expect(service.deleteSentence(sent)).toBe(false);
    });
  });
});
