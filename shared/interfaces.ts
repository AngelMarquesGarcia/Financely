import { MovementT, CategoryT, MovementFilter, AppSettings, AccountT, AccountStats, EnvelopeT, TagT, TransferT, PeriodSummaryT } from './types';

export interface Movements {
  create(
    name: string,
    concept: string | null,
    quantityCents: number,
    isPositive: boolean,
    date: Date,
    categoryId: number,
    envelopeId: number,
    additionalNotes: string | null,
  ): Promise<number | bigint>;
  getAll(filter?: MovementFilter): Promise<MovementT[]>;
  getById(id: number): Promise<MovementT | undefined>;
  update(movement: MovementT): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  /** Bulk delete. Returns the number of rows removed. Atomic (single transaction). */
  deleteMany(ids: number[]): Promise<number>;
  /** Returns distinct movement names matching the prefix, alphabetical, capped at `limit`. */
  suggestNames(prefix: string, limit?: number): Promise<string[]>;
}

export interface Categories {
  create(
    name: string,
    color?: string,
    emoji?: string,
    envelopeId?: number | null,
  ): Promise<number | bigint>;
  getAll(): Promise<CategoryT[]>;
  getById(id: number): Promise<CategoryT | undefined>;
  update(category: CategoryT): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  setDefault(id: number): Promise<void>;
}

export interface Accounts {
  create(name: string, description?: string, startingBalance?: number): Promise<number | bigint>;
  getAll(): Promise<AccountT[]>;
  getById(id: number): Promise<AccountT | undefined>;
  update(account: AccountT): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  setDefault(id: number): Promise<void>;
  /** Aggregate stats across all accounts. Computed via SQL aggregates (no N+1). */
  getStats(): Promise<AccountStats>;
}

export interface Envelopes {
  create(
    name: string,
    accountId: number,
    startingBalance?: number,
    budgetCents?: number | null,
    maxSavingsCents?: number | null,
    overflowsTo?: number | null,
  ): Promise<number | bigint>;
  getAll(): Promise<EnvelopeT[]>;
  getById(id: number): Promise<EnvelopeT | undefined>;
  update(envelope: EnvelopeT): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  setDefault(id: number): Promise<void>;
}

export interface Transfers {
  create(
    fromEnvelopeId: number,
    toEnvelopeId: number,
    quantityCents: number,
    date: Date,
    notes?: string | null,
  ): Promise<number | bigint>;
  getAll(): Promise<TransferT[]>;
  getForEnvelope(envelopeId: number): Promise<TransferT[]>;
  delete(id: number): Promise<boolean>;
}

export interface Tags {
  create(type: string, name: string, color: string): Promise<number | bigint>;
  getAll(): Promise<TagT[]>;
  getById(id: number): Promise<TagT | undefined>;
  update(tag: TagT): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  addToMovement(tagId: number, movementId: number): Promise<void>;
  removeFromMovement(tagId: number, movementId: number): Promise<void>;
  getForMovement(movementId: number): Promise<TagT[]>;
  /** Bulk read. Returns a map of movement id → tags; ids with no tags are absent from the map. */
  getForMovements(movementIds: number[]): Promise<Record<number, TagT[]>>;
}

export interface Settings {
  getAll(): Promise<AppSettings>;
  save(partial: Partial<AppSettings>): Promise<void>;
}

export interface PeriodSummaries {
  create(summary: PeriodSummaryT): Promise<number | bigint>;
  upsert(summary: PeriodSummaryT): Promise<number | bigint>;
  getAll(): Promise<PeriodSummaryT[]>;
  /** The envelope's most recent summary (cleaned), or undefined when it has none yet. */
  getLatest(envelopeId: number): Promise<PeriodSummaryT | undefined>;
  getByPeriod(accountId: number, envelopeId: number | null, year: number, month: number): Promise<PeriodSummaryT | undefined>;
  update(summary: PeriodSummaryT): Promise<boolean>;
  delete(accountId: number, envelopeId: number | null, year: number, month: number): Promise<boolean>;
}
