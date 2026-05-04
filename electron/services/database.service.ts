import { Operation, Operator, Sentence } from '../../shared/types';
import { app } from 'electron';
import path from 'path';

import Database from 'better-sqlite3';

export class DatabaseService {
  private readonly SCHEMA_VERSION = 1;

  private db: InstanceType<typeof Database>;
  private dbPath = path.join(app.getPath('userData'), 'electron_database.db');

  constructor() {
    this.db = new Database(this.dbPath);
  }

  private tables = {
    ops: 'operations',
    sent: 'sentences',
  };

  migrate(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS ${this.tables.ops} (
      number1 INTEGER NOT NULL,
      number2 INTEGER NOT NULL,
      operator TEXT NOT NULL,
      result INTEGER NOT NULL,

      PRIMARY KEY (number1, number2, operator)
      )
    `,
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS ${this.tables.sent} (
      sentence TEXT PRIMARY KEY,
      words INTEGER NOT NULL CHECK (words>=0),
      chars INTEGER NOT NULL CHECK (chars>=0)
      )
    `,
      )
      .run();

    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS
      meta (key TEXT PRIMARY KEY, value TEXT)
      `,
      )
      .run();

    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
      | { value: string }
      | undefined;
    const current = row ? parseInt(row.value) : 0;

    if (current < 1) {
      this.db
        .prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')`)
        .run();
    }
    // if (current < this.SCHEMA_VERSION) { /* future migrations */ }
  }

  insertOperation(op: Operation): number | bigint {
    const stmt = this.db.prepare(
      `INSERT INTO ${this.tables.ops} VALUES ($number1, $number2, $operator, $result)`,
    );
    const stmtInfo = stmt.run(op);
    return stmtInfo.lastInsertRowid;
  }

  insertSentence(sent: Sentence): number | bigint {
    const stmt = this.db.prepare(
      `INSERT INTO ${this.tables.sent} VALUES ($sentence, $words, $chars)`,
    );
    const stmtInfo = stmt.run(sent);
    return stmtInfo.lastInsertRowid;
  }

  getOperationByOperator(operator: Operator): Operation[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tables.ops} WHERE operator = ?`);
    return stmt.all(operator) as Operation[];
  }

  getSentenceByWords(words: number) {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tables.sent} WHERE words = ?`);
    return stmt.all(words);
  }

  getAllOperations() {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tables.ops}`);
    return stmt.all();
  }

  getAllSentences() {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tables.sent}`);
    return stmt.all();
  }

  patchOperation(op: Operation): boolean {
    const stmt = this.db.prepare(`
      UPDATE ${this.tables.ops}
      SET
        number1 = :number1,
        number2 = :number2,
        operator = :operator,
        result = :result
      WHERE number1 = :number1 AND number2 = :number2 AND operator = :operator
    `);
    const stmtInfo = stmt.run(op);
    return stmtInfo.changes > 0;
  }

  patchSentence(sent: Sentence): boolean {
    const stmt = this.db.prepare(`
      UPDATE ${this.tables.sent}
      SET
        sentence = :sentence,
        words = :words,
        chars = :chars
      WHERE sentence = :sentence
    `);
    const stmtInfo = stmt.run(sent);
    return stmtInfo.changes > 0;
  }

  deleteOperation(op: Operation): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tables.ops}
      WHERE number1 = :number1 AND number2 = :number2 AND operator = :operator
    `);
    const stmtInfo = stmt.run(op);
    return stmtInfo.changes == 1;
  }

  deleteSentence(sent: Sentence): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tables.sent}
      WHERE sentence = :sentence
    `);
    const stmtInfo = stmt.run(sent.sentence);
    return stmtInfo.changes == 1;
  }
}
