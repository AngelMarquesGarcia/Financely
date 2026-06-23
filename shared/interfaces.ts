import { Movement, Category, MovementFilter, AppSettings, Account, AccountStats, Envelope, Tag, PeriodSummary } from './types';

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
  getAll(filter?: MovementFilter): Promise<Movement[]>;
  getById(id: number): Promise<Movement | undefined>;
  update(movement: Movement): Promise<boolean>;
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
  getAll(): Promise<Category[]>;
  getById(id: number): Promise<Category | undefined>;
  update(category: Category): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  setDefault(id: number): Promise<void>;
}

export interface Accounts {
  create(name: string, description?: string, startingBalance?: number): Promise<number | bigint>;
  getAll(): Promise<Account[]>;
  getById(id: number): Promise<Account | undefined>;
  update(account: Account): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  setDefault(id: number): Promise<void>;
  /** Aggregate stats across all accounts. Computed via SQL aggregates (no N+1). */
  getStats(): Promise<AccountStats>;
}

export interface Envelopes {
  create(name: string, accountId: number, startingBalance?: number): Promise<number | bigint>;
  getAll(): Promise<Envelope[]>;
  getById(id: number): Promise<Envelope | undefined>;
  update(envelope: Envelope): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  setDefault(id: number): Promise<void>;
}

export interface Tags {
  create(type: string, name: string, color: string): Promise<number | bigint>;
  getAll(): Promise<Tag[]>;
  getById(id: number): Promise<Tag | undefined>;
  update(tag: Tag): Promise<boolean>;
  delete(id: number): Promise<boolean>;
  addToMovement(tagId: number, movementId: number): Promise<void>;
  removeFromMovement(tagId: number, movementId: number): Promise<void>;
  getForMovement(movementId: number): Promise<Tag[]>;
  /** Bulk read. Returns a map of movement id → tags; ids with no tags are absent from the map. */
  getForMovements(movementIds: number[]): Promise<Record<number, Tag[]>>;
}

export interface Settings {
  getAll(): Promise<AppSettings>;
  save(partial: Partial<AppSettings>): Promise<void>;
}

export interface PeriodSummaries {
  create(summary: Omit<PeriodSummary, 'id'>): Promise<number | bigint>;
  upsert(summary: Omit<PeriodSummary, 'id'>): Promise<number | bigint>;
  getAll(): Promise<PeriodSummary[]>;
  getByPeriod(accountId: number, envelopeId: number | null, year: number, month: number): Promise<PeriodSummary | undefined>;
  update(summary: PeriodSummary): Promise<boolean>;
  delete(accountId: number, envelopeId: number | null, year: number, month: number): Promise<boolean>;
}
