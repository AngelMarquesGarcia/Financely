import { app } from 'electron';
import path from 'path';

import Database from 'better-sqlite3';
import {
  AccountSchema,
  CategorySchema,
  CompoundMovementSchema,
  EnvelopeSchema,
  MovementEnvelopeSchema,
  MovementSchema,
  MovementTagSchema,
  PeriodicMovementEnvelopeSchema,
  PeriodicMovementSchema,
  PeriodicMovementTagSchema,
  PeriodSummarySchema,
  TagSchema,
  TransferSchema,
} from './schema';
import { tables } from '../constants';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class DatabaseService {
  private static instance: DatabaseService;

  private readonly SCHEMA_VERSION = 1;

  /** Single long-lived connection. Every repository captures this handle at module load, so it must
   *  never be reopened — `restore()` copies data in-place (ATTACH) rather than swapping the file. */
  readonly db: InstanceType<typeof Database>;

  /** Data tables in FK dependency order (parents → children); reversed for deletes. Excludes `meta`. */
  private readonly dataTablesParentFirst = [
    tables.accounts,
    tables.tags,
    tables.envelopes,
    tables.categories,
    tables.periodicMovements,
    tables.periodicMovementEnvelopes,
    tables.compoundMovements,
    tables.movements,
    tables.movementEnvelopes,
    tables.transfers,
    tables.movementTags,
    tables.periodicMovementTags,
    tables.periodSummaries,
  ];

  private constructor() {
    this.db = new Database(path.join(app.getPath('userData'), 'electron_database.db'));
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Runs on every app start. Idempotent and non-destructive: creates any missing tables/indexes and
   * seeds the minimal defaults the app needs to function, preserving existing data. Populating the app
   * with demo data (and wiping it) is now explicit and front-triggered via `createExampleData()` /
   * `dropAllTables()`.
   */
  migrate(): void {
    this.ensureSchema();
  }

  /** Creates tables/indexes if absent and seeds the minimal bootstrap defaults. Data-preserving. */
  private ensureSchema(): void {
    //#region Create Tables (idempotent — FK dependency order: parent → child → junction)
    this.db
      .prepare(`CREATE TABLE IF NOT EXISTS ${tables.metadata} (key TEXT PRIMARY KEY, value TEXT)`)
      .run();

    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.accounts} (${AccountSchema})`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.tags} (${TagSchema})`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.envelopes} (${EnvelopeSchema})`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.categories} (${CategorySchema})`).run();
    this.db
      .prepare(`CREATE TABLE IF NOT EXISTS ${tables.periodicMovements} (${PeriodicMovementSchema})`)
      .run();
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${tables.periodicMovementEnvelopes} (${PeriodicMovementEnvelopeSchema})`,
      )
      .run();
    // compound_movements before movements (movements.parent_id references it).
    this.db
      .prepare(`CREATE TABLE IF NOT EXISTS ${tables.compoundMovements} (${CompoundMovementSchema})`)
      .run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.movements} (${MovementSchema})`).run();
    this.db
      .prepare(`CREATE TABLE IF NOT EXISTS ${tables.movementEnvelopes} (${MovementEnvelopeSchema})`)
      .run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.transfers} (${TransferSchema})`).run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.movementTags} (${MovementTagSchema})`).run();
    this.db
      .prepare(`CREATE TABLE IF NOT EXISTS ${tables.periodicMovementTags} (${PeriodicMovementTagSchema})`)
      .run();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS ${tables.periodSummaries} (${PeriodSummarySchema})`).run();

    // Per-envelope allocation lookups (listing an envelope's movements joins on envelope_id).
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_movement_envelopes_envelope ON ${tables.movementEnvelopes}(envelope_id)`,
      )
      .run();
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_periodic_movement_envelopes_envelope ON ${tables.periodicMovementEnvelopes}(envelope_id)`,
      )
      .run();
    // Compound membership lookups (listing a compound's children filters on parent_id).
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_movements_parent ON ${tables.movements}(parent_id)`)
      .run();

    // Logical key of a period summary. COALESCE(envelope_id, -1) because SQLite treats NULLs as
    // distinct in a plain UNIQUE, which would let duplicate account-level rows (null envelope) slip in.
    this.db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_period_summary_key
           ON ${tables.periodSummaries}(account_id, COALESCE(envelope_id, -1), year, month)`,
      )
      .run();
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

    //#region Seed minimal defaults (needed for the app to function on an empty DB)
    this.db
      .prepare(`INSERT OR IGNORE INTO ${tables.accounts} (name, is_default) VALUES ('Default', 1)`)
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
    // The neutral catch-all/default category: the reassign-on-delete target and the import fallback
    // bucket. Undeletable via the existing default-category guard.
    this.db
      .prepare(`INSERT OR IGNORE INTO ${tables.categories} (name, is_default) VALUES ('Uncategorized', 1)`)
      .run();
    //#endregion

    //#region Handle Schema version
    const row = this.db
      .prepare(`SELECT value FROM ${tables.metadata} WHERE key = 'schema_version'`)
      .get() as { value: string } | undefined;
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

  /**
   * TESTING / MAINTENANCE ONLY. Drops every data table (the `meta` table is preserved so persisted
   * settings survive). Exposed over the `Database` IPC surface for the dev-only "delete all data"
   * action — never call this from normal app flows.
   */
  dropAllTables(): void {
    // Drop in reverse FK dependency order: junction → child → parent.
    for (const table of [...this.dataTablesParentFirst].reverse()) {
      this.db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    }
  }

  /**
   * TESTING / MAINTENANCE ONLY. Ensures the schema exists, then seeds the sample/demo dataset (example
   * accounts, envelopes, categories, tags, movements and periodic templates). Exposed over the
   * `Database` IPC surface for the dev-only "seed example data" action.
   */
  createExampleData(): void {
    this.ensureSchema();
    this.seedExampleData();
  }

  /** Full-database backup to `destPath` via SQLite's online backup API (safe while the app runs). */
  backup(destPath: string): Promise<void> {
    return this.db.backup(destPath).then(() => undefined);
  }

  /**
   * Restores a full backup, replacing ALL current data (all-or-nothing; not a merge). The file is
   * validated first, then its contents are copied into the live connection in a single transaction via
   * ATTACH — the connection object is never swapped, so the handles the repositories cache stay valid.
   */
  restore(srcPath: string): void {
    this.validateBackupFile(srcPath);
    this.ensureSchema();

    const escaped = srcPath.replace(/'/g, "''");
    this.db.exec(`ATTACH DATABASE '${escaped}' AS backup`);
    try {
      this.db.transaction(() => {
        // Delete children-first, then copy parents-first. Column order matches (single schema v1).
        for (const table of [...this.dataTablesParentFirst].reverse()) {
          this.db.prepare(`DELETE FROM main.${table}`).run();
        }
        for (const table of this.dataTablesParentFirst) {
          this.db.prepare(`INSERT INTO main.${table} SELECT * FROM backup.${table}`).run();
        }
      })();
    } finally {
      this.db.exec(`DETACH DATABASE backup`);
    }
  }

  /** Opens the candidate file read-only and checks it looks like one of our databases. */
  private validateBackupFile(srcPath: string): void {
    let probe: InstanceType<typeof Database> | undefined;
    try {
      probe = new Database(srcPath, { readonly: true, fileMustExist: true });
      const hasTable = (name: string) =>
        probe!
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(name) != undefined;
      if (!hasTable(tables.metadata) || !hasTable(tables.movements)) {
        throw new AppError(AppErrorCode.RESTORE_INVALID_FILE);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(AppErrorCode.RESTORE_INVALID_FILE);
    } finally {
      probe?.close();
    }
  }

  /** The sample dataset, used by `createExampleData()`. Inserts via raw SQL (bypasses service hooks),
   *  so period summaries must be built afterwards by the caller (`backfillPeriodSummaries`). */
  private seedExampleData(): void {
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
      `INSERT INTO ${tables.movements} (account_id, name, concept, quantity_cents, isPositive, date, category_id, additional_notes)
       VALUES (:accountId, :name, :concept, :quantityCents, :isPositive, :date, :categoryId, :notes)`,
    );
    const insertMovEnv = this.db.prepare(
      `INSERT INTO ${tables.movementEnvelopes} (movement_id, envelope_id, amount_cents) VALUES (?, ?, ?)`,
    );
    const insertMovTag = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.movementTags} (movement_id, tag_id) VALUES (?, ?)`,
    );

    const addMov = (
      m: Parameters<typeof insertMov.run>[0],
      envelopes: Map<number, number>,
      tags: number[] = [],
    ) => {
      const id = Number(insertMov.run(m).lastInsertRowid);
      for (const [envId, amount] of envelopes) insertMovEnv.run(id, envId, amount);
      for (const t of tags) insertMovTag.run(id, t);
    };

    addMov({ accountId: defaultAccountId, name: 'April salary', concept: 'NOMINA ABRIL', quantityCents: 220000, isPositive: 1, date: '2026-04-28', categoryId: catId('Salary'), notes: null }, new Map([[savings, 220000]]), [recurring]);
    addMov({ accountId: defaultAccountId, name: 'April rent', concept: 'ALQUILER ABR', quantityCents: 80000, isPositive: 0, date: '2026-04-01', categoryId: catId('Housing'), notes: null }, new Map([[monthly, 80000]]), [recurring, urgent]);
    addMov({ accountId: defaultAccountId, name: 'Grocery run', concept: 'MERCADONA', quantityCents: 6700, isPositive: 0, date: '2026-04-04', categoryId: catId('Food'), notes: null }, new Map([[monthly, 6700]]), [recurring]);
    addMov({ accountId: defaultAccountId, name: 'Bus monthly pass', concept: null, quantityCents: 4000, isPositive: 0, date: '2026-04-02', categoryId: catId('Transport'), notes: null }, new Map([[monthly, 4000]]), [recurring]);
    addMov({ accountId: defaultAccountId, name: 'Cinema tickets', concept: 'CINESA', quantityCents: 2200, isPositive: 0, date: '2026-04-12', categoryId: catId('Entertainment'), notes: null }, new Map([[monthly, 2200]]), [oneTime]);
    addMov({ accountId: defaultAccountId, name: 'Pharmacy', concept: null, quantityCents: 1800, isPositive: 0, date: '2026-04-15', categoryId: catId('Health'), notes: 'Ibuprofen and vitamins' }, new Map([[monthly, 1800]]), [oneTime]);
    addMov({ accountId: defaultAccountId, name: 'May salary', concept: 'NOMINA MAYO', quantityCents: 220000, isPositive: 1, date: '2026-05-28', categoryId: catId('Salary'), notes: null }, new Map([[savings, 220000]]), [recurring]);
    addMov({ accountId: defaultAccountId, name: 'May rent', concept: 'ALQUILER MAY', quantityCents: 80000, isPositive: 0, date: '2026-05-01', categoryId: catId('Housing'), notes: null }, new Map([[monthly, 80000]]), [recurring, urgent]);
    addMov({ accountId: defaultAccountId, name: 'Grocery run', concept: 'MERCADONA', quantityCents: 5400, isPositive: 0, date: '2026-05-06', categoryId: catId('Food'), notes: null }, new Map([[monthly, 5400]]), [recurring]);
    addMov({ accountId: defaultAccountId, name: 'Freelance payment', concept: null, quantityCents: 35000, isPositive: 1, date: '2026-05-10', categoryId: catId('Salary'), notes: 'Logo design project' }, new Map([[unassigned, 35000]]), [oneTime]);

    // Seed periodic-movement templates. Cursor is left null and the start period is recent, so the
    // first frontend-triggered runDue generates a couple of tentative instances for the current month.
    const insertPeriodic = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.periodicMovements}
         (account_id, name, concept, quantity_cents, isPositive, day_of_month, category_id,
          additional_notes, active, start_year, start_month, last_created_year, last_created_month)
       VALUES (:accountId, :name, :concept, :quantityCents, :isPositive, :dayOfMonth, :categoryId,
          :notes, 1, :startYear, :startMonth, NULL, NULL)`,
    );
    const insertPeriodicEnv = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.periodicMovementEnvelopes} (periodic_movement_id, envelope_id, amount_cents) VALUES (?, ?, ?)`,
    );
    const insertPeriodicTag = this.db.prepare(
      `INSERT OR IGNORE INTO ${tables.periodicMovementTags} (periodic_movement_id, tag_id) VALUES (?, ?)`,
    );
    // The flagship split template: salary divided across savings + monthly on each generated instance.
    const salaryTemplateId = Number(
      insertPeriodic.run({
        accountId: defaultAccountId, name: 'Monthly salary', concept: 'NOMINA', quantityCents: 220000,
        isPositive: 1, dayOfMonth: 28, categoryId: catId('Salary'), notes: null,
        startYear: 2026, startMonth: 5,
      }).lastInsertRowid,
    );
    insertPeriodicEnv.run(salaryTemplateId, savings, 170000);
    insertPeriodicEnv.run(salaryTemplateId, monthly, 50000);
    insertPeriodicTag.run(salaryTemplateId, recurring);
    const karateTemplateId = Number(
      insertPeriodic.run({
        accountId: defaultAccountId, name: 'Karate fee', concept: null, quantityCents: 4500,
        isPositive: 0, dayOfMonth: 5, categoryId: catId('Health'), notes: 'Dojo monthly fee',
        startYear: 2026, startMonth: 5,
      }).lastInsertRowid,
    );
    insertPeriodicEnv.run(karateTemplateId, monthly, 4500);
    insertPeriodicTag.run(karateTemplateId, recurring);
  }
}
