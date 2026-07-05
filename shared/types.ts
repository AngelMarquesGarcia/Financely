export type MovementT = {
  id: number;
  accountId: number;
  name: string;
  concept: string | null;
  /** Amount in integer cents (e.g. 2250 = €22.50). */
  quantityCents: number;
  isPositive: boolean;
  date: Date;
  categoryId: number;
  /** Per-envelope allocation `{ envelopeId → amountCents }`. Sums to `quantityCents`. A normal
   *  movement has a single entry; a split has several (`size > 1`). */
  envelopeIdMap: Map<number, number>;
  additionalNotes: string | null;
  /** Template this instance was generated from, or null for a manual movement. System-owned. */
  templateId: number | null;
  /** Auto-generated and awaiting user review. System-owned (set at creation / cleared by confirm). */
  isTentative: boolean;
  /** User-owned. Marks a one-off (a car, a trip) so it is excluded from the "without anomalies"
   *  statistics view. Always counted in balances/cash flow — the flag never moves real money, it only
   *  partitions the displayed statistics. */
  isAnomalous: boolean;
};

/** A recurring-movement blueprint. Not a real movement — it has a day-of-month, no date, and no
 *  balance impact of its own. Generates real `MovementT` instances as time passes. */
export type PeriodicMovementT = {
  id: number;
  /** Target account for generated instances (may differ per template). */
  accountId: number;
  name: string;
  concept: string | null;
  /** Default amount in integer cents for generated instances. */
  quantityCents: number;
  isPositive: boolean;
  /** Expected day of month (1-31); clamped to the month's length at instantiation. */
  dayOfMonth: number;
  categoryId: number;
  /** Default per-envelope allocation `{ envelopeId → amountCents }`, summing to `quantityCents`.
   *  Copied verbatim onto generated instances. A single entry for a non-split template. */
  envelopeIdMap: Map<number, number>;
  additionalNotes: string | null;
  /** false → generation is paused but history is preserved. */
  active: boolean;
  startYear: number;
  startMonth: number; // 0-11
  /** Generation cursor: the last period an instance was created for. null = nothing generated yet. */
  lastCreatedYear: number | null;
  lastCreatedMonth: number | null; // 0-11
};

export type CategoryT = {
  id: number;
  name: string;
  color?: string;
  emoji?: string;
  envelopeId: number | null;
  isDefault: boolean;
  movementCount?: number;
};

export type AccountT = {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  startingBalance: number;
};

/** Aggregate stats across all accounts. All amounts in integer cents. */
export type AccountStats = {
  totalIncomeCents: number;
  totalExpenseCents: number;
  /** Income/expense with anomalous movements excluded (for the "without anomalies" toggle). */
  totalIncomeWithoutAnomaliesCents: number;
  totalExpenseWithoutAnomaliesCents: number;
  /** Always all-inclusive — balance reflects real money, so anomalies are never excluded here. */
  balanceCents: number;
  envelopeCount: number;
};

export type EnvelopeT = {
  id: number;
  name: string;
  accountId: number | null;
  isDefault: boolean;
  startingBalance: number;
  budgetCents: number | null;
  maxSavingsCents: number | null;
  /** Envelope that over-cap savings are redirected to. null → resolve to the account default. */
  overflowsTo: number | null;
};

/** An internal transfer between two envelopes of the same account. Moves no real-world cash, so
 *  it never affects income/expense/cashflow aggregates — only each envelope's running balance. */
export type TransferT = {
  id: number;
  fromEnvelopeId: number;
  toEnvelopeId: number;
  accountId: number; // both envelopes share this account
  /** Amount in integer cents; always > 0. */
  quantityCents: number;
  date: Date;
  /** true = created automatically by the over-cap savings redirect. */
  isAuto: boolean;
  notes: string | null;
};

export type TagT = {
  id: number;
  type: string;
  name: string;
  color: string;
};

export type AppSettings = {
  useDefaultDate: boolean;
  defaultDate: string;
  colorOrder: string[];
  categoryIcons: string[];
};

export type TextMatchCondition = 'contains' | 'startsWith' | 'endsWith' | 'exact';
export type TextMatchField = 'name' | 'concept' | 'notes' | 'all';

export type MovementFilter = {
  date?: {
    from?: string;
    to?: string;
  };
  amount?: {
    from?: number;
    to?: number;
  };
  text?: {
    query: string;
    condition: TextMatchCondition;
    field: TextMatchField;
  };
  tags?: {
    ids: number[];
    matchAll: boolean;
  };
  categoryId?: number;
  envelopeId?: number;
  isPositive?: boolean;
};

export type BasicSummary = {
  cashFlowCents: number; // income - expenses; positive = surplus
  totalIncomeCents: number;
  totalExpenseCents: number;
  avgExpenseCents: number;
  avgIncomeCents: number;
  avgMovementAmountCents: number; // average ignoring sign
  movementCount: number;
  filters?: MovementFilter; // cache/deduplication key
};

export type DirtyState = 'CLEAN' | 'MODIFIED' | 'DIRTY';

export type PeriodSummaryT = {
  accountId: number;
  envelopeId: number | null; // null = account-level summary
  accountName: string;
  envelopeName: string | null;
  year: number;
  month: number; // 0-11
  // BasicSummary fields inlined
  cashFlowCents: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  avgExpenseCents: number;
  avgIncomeCents: number;
  avgMovementAmountCents: number;
  movementCount: number;
  // Period-specific
  endingBalanceCents: number;
  /** Net of internal transfers in this period (incoming − outgoing); folded into endingBalance. */
  netTransfersCents: number;
  budgetCents?: number;
  maxSavingsCents?: number;
  notes?: string;
  dirtyState: DirtyState;
  /** True when the period holds at least one tentative (unreviewed) movement. Display-only. */
  tentative: boolean;
  /** The same aggregates recomputed with anomalous movements excluded, or `null` when the period holds
   *  none (the without-view then equals the top-level fields). Top-level fields stay all-inclusive so the
   *  ending-balance chain is unaffected; this mirror only feeds the "without anomalies" display. */
  summaryWithoutAnomalies: BasicSummary | null;
};

export type PeriodT = {
  accountId: number;
  envelopeId: number | null; // null = account-level summary
  year: number;
  month: number;
};
