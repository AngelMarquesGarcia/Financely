import { app } from 'electron';
import path from 'path';

import Database from 'better-sqlite3';
import {
  AccountSchema,
  CategorySchema,
  EnvelopeSchema,
  MovementSchema,
  MovementTagSchema,
  PeriodSummarySchema,
  TagSchema,
  TransferSchema,
} from './schema';
import { tables } from '../constants';

export class DatabaseService {
  private static instance: DatabaseService;

  private readonly SCHEMA_VERSION = 1;

  readonly db: InstanceType<typeof Database>;

  private constructor() {
    this.db = new Database(path.join(app.getPath('userData'), 'electron_database.db'));
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initDatabase(): void {
    const insertCat = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.categories} (name, color, emoji) VALUES (:name, :color, :emoji)`,
    );
    for (const cat of [
      { name: 'Salary', color: '#22c55e', emoji: '💼' },
      { name: 'Food', color: '#ef4444', emoji: '🍕' },
      { name: 'Transport', color: '#3b82f6', emoji: '🚗' },
      { name: 'Housing', color: '#22c55e', emoji: '🏠' },
      { name: 'Entertainment', color: '#8b5cf6', emoji: '🎬' },
      { name: 'Health', color: '#f97316', emoji: '💊' },
    ]) insertCat.run(cat);

    // Seed a default category (Salary) so reassign-on-delete has a target out of the box.
    this.db
      .prepare(`UPDATE ${tables.categories} SET is_default = 1 WHERE name = 'Salary'`)
      .run();

    const insertTag = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.tags} (type, name, color) VALUES (:type, :name, :color)`,
    );
    for (const tag of [
      { type: 'frequency', name: 'Recurring', color: '#22c55e' },
      { type: 'frequency', name: 'One-time', color: '#3b82f6' },
      { type: 'priority', name: 'Urgent', color: '#ef4444' },
      { type: 'priority', name: 'Low', color: '#94a3b8' },
    ]) insertTag.run(tag);

    const defaultAccountId = (
      this.db
        .prepare(`SELECT id FROM ${tables.accounts} WHERE is_default = 1 LIMIT 1`)
        .get() as { id: number }
    ).id;

    const insertEnv = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.envelopes} (name, account_id) VALUES (?, ?)`,
    );
    insertEnv.run('Monthly Expenses', defaultAccountId);
    insertEnv.run('Savings', defaultAccountId);

    const catId = (name: string) =>
      (
        this.db
          .prepare(`SELECT id FROM ${tables.categories} WHERE name = ?`)
          .get(name) as { id: number }
      ).id;
    const envId = (name: string) =>
      (
        this.db
          .prepare(`SELECT id FROM ${tables.envelopes} WHERE name = ?`)
          .get(name) as { id: number }
      ).id;
    const tagId = (name: string) =>
      (
        this.db.prepare(`SELECT id FROM ${tables.tags} WHERE name = ?`).get(name) as {
          id: number;
        }
      ).id;

    const monthly = envId('Monthly Expenses');
    const savings = envId('Savings');
    const unassigned = envId('Unassigned');
    const recurring = tagId('Recurring');
    const oneTime = tagId('One-time');
    const urgent = tagId('Urgent');

    const insertMov = this.db.prepare(
      `INSERT INTO ${tables.movements} (account_id, name, concept, quantity_cents, isPositive, date, category_id, envelope_id, additional_notes)
       VALUES (:accountId, :name, :concept, :quantityCents, :isPositive, :date, :categoryId, :envelopeId, :notes)`,
    );
    const insertMovTag = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.movementTags} (movement_id, tag_id) VALUES (?, ?)`,
    );

    const addMov = (
      m: Parameters<typeof insertMov.run>[0],
      tags: number[] = [],
    ) => {
      const id = Number(insertMov.run(m).lastInsertRowid);
      for (const t of tags) insertMovTag.run(id, t);
    };

    addMov({ accountId: defaultAccountId, name: 'April salary', concept: 'NOMINA ABRIL', quantityCents: 220000, isPositive: 1, date: '2026-04-28', categoryId: catId('Salary'), envelopeId: savings, notes: null }, [recurring]);
    addMov({ accountId: defaultAccountId, name: 'April rent', concept: 'ALQUILER ABR', quantityCents: 80000, isPositive: 0, date: '2026-04-01', categoryId: catId('Housing'), envelopeId: monthly, notes: null }, [recurring, urgent]);
    addMov({ accountId: defaultAccountId, name: 'Grocery run', concept: 'MERCADONA', quantityCents: 6700, isPositive: 0, date: '2026-04-04', categoryId: catId('Food'), envelopeId: monthly, notes: null }, [recurring]);
    addMov({ accountId: defaultAccountId, name: 'Bus monthly pass', concept: null, quantityCents: 4000, isPositive: 0, date: '2026-04-02', categoryId: catId('Transport'), envelopeId: monthly, notes: null }, [recurring]);
    addMov({ accountId: defaultAccountId, name: 'Cinema tickets', concept: 'CINESA', quantityCents: 2200, isPositive: 0, date: '2026-04-12', categoryId: catId('Entertainment'), envelopeId: monthly, notes: null }, [oneTime]);
    addMov({ accountId: defaultAccountId, name: 'Pharmacy', concept: null, quantityCents: 1800, isPositive: 0, date: '2026-04-15', categoryId: catId('Health'), envelopeId: monthly, notes: 'Ibuprofen and vitamins' }, [oneTime]);
    addMov({ accountId: defaultAccountId, name: 'May salary', concept: 'NOMINA MAYO', quantityCents: 220000, isPositive: 1, date: '2026-05-28', categoryId: catId('Salary'), envelopeId: savings, notes: null }, [recurring]);
    addMov({ accountId: defaultAccountId, name: 'May rent', concept: 'ALQUILER MAY', quantityCents: 80000, isPositive: 0, date: '2026-05-01', categoryId: catId('Housing'), envelopeId: monthly, notes: null }, [recurring, urgent]);
    addMov({ accountId: defaultAccountId, name: 'Grocery run', concept: 'MERCADONA', quantityCents: 5400, isPositive: 0, date: '2026-05-06', categoryId: catId('Food'), envelopeId: monthly, notes: null }, [recurring]);
    addMov({ accountId: defaultAccountId, name: 'Freelance payment', concept: null, quantityCents: 35000, isPositive: 1, date: '2026-05-10', categoryId: catId('Salary'), envelopeId: unassigned, notes: 'Logo design project' }, [oneTime]);
  }

  migrate(): void {
    //#region Drop data tables (temporary — remove once schema stabilises)
    // Drop in reverse FK dependency order: junction → child → parent
    // Meta table is intentionally preserved so persisted settings survive restarts
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.periodSummaries}`).run();
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.movementTags}`).run();
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.transfers}`).run();
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.movements}`).run();
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.categories}`).run();
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.envelopes}`).run();
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.accounts}`).run();
    this.db.prepare(`DROP TABLE IF EXISTS ${tables.tags}`).run();
    //#endregion

    //#region Create Tables
    // Create in FK dependency order: parent → child → junction
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${tables.metadata} (key TEXT PRIMARY KEY, value TEXT)`,
      )
      .run();

    this.db.prepare(`CREATE TABLE ${tables.accounts} (${AccountSchema})`).run();
    this.db.prepare(`CREATE TABLE ${tables.tags} (${TagSchema})`).run();
    this.db.prepare(`CREATE TABLE ${tables.envelopes} (${EnvelopeSchema})`).run();
    this.db.prepare(`CREATE TABLE ${tables.categories} (${CategorySchema})`).run();
    this.db.prepare(`CREATE TABLE ${tables.movements} (${MovementSchema})`).run();
    this.db.prepare(`CREATE TABLE ${tables.transfers} (${TransferSchema})`).run();
    this.db.prepare(`CREATE TABLE ${tables.movementTags} (${MovementTagSchema})`).run();
    this.db.prepare(`CREATE TABLE ${tables.periodSummaries} (${PeriodSummarySchema})`).run();
    //#endregion

    //#region Partial unique indexes (enforce single default per scope)
    this.db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_account_default ON ${tables.accounts}(is_default) WHERE is_default = 1`,
      )
      .run();
    this.db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_envelope_default ON ${tables.envelopes}(account_id) WHERE is_default = 1`,
      )
      .run();
    this.db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_category_default ON ${tables.categories}(is_default) WHERE is_default = 1`,
      )
      .run();
    //#endregion

    //#region Seed defaults
    this.db
      .prepare(
        `INSERT OR IGNORE INTO ${tables.accounts} (name, is_default) VALUES ('Default', 1)`,
      )
      .run();
    const defaultAccount = this.db
      .prepare(`SELECT id FROM ${tables.accounts} WHERE is_default = 1 LIMIT 1`)
      .get() as { id: number } | undefined;
    if (defaultAccount) {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO ${tables.envelopes} (name, account_id, is_default) VALUES ('Unassigned', ?, 1)`,
        )
        .run(defaultAccount.id);
    }
    //#endregion

    this.initDatabase();

    //#region Handle Schema version
    const row = this.db.prepare(`SELECT value FROM ${tables.metadata} WHERE key = 'schema_version'`).get() as
      | { value: string }
      | undefined;
    const currentSchemaVersion = row ? parseInt(row.value) : 0;

    if (currentSchemaVersion < this.SCHEMA_VERSION) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO ${tables.metadata} (key, value) VALUES ('schema_version', '${this.SCHEMA_VERSION}')`,
        )
        .run();
    }
    //#endregion
  }
}
