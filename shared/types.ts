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
  /** The `CompoundMovementT` this movement belongs to (shared with its siblings), or null. A movement
   *  belongs to at most one compound. System-owned: changed only via the compound service. */
  parentId: number | null;
};

/**
 * A lightweight grouping of real, separately-existing movements that share a `parentId`. Two shapes:
 * a plain **grouping** (a trip — the children stay canonical) and an **`isCancelable`** set (a dinner
 * repaid by several Bizums — the compound's net is canonical). Never moves money; the `ownerMonth`
 * only re-attributes the set's *statistics* into one month (see PeriodSummary compound diffs). All
 * children share `accountId`; a cancelable compound additionally forces one envelope.
 */
export type CompoundMovementT = {
  id: number;
  /** Account every child shares (enforced on membership). */
  accountId: number;
  name: string;
  /** true → children cancel out; the net is treated as a single movement in the owner month. */
  isCancelable: boolean;
  /** Owner-month anchor (`ownerYear`/`ownerMonth` null-together). Non-null ⇒ the set's stats are
   *  re-attributed there; null ⇒ no re-attribution (children ride their own months / anomaly flag). */
  ownerYear: number | null;
  ownerMonth: number | null; // 0-11
  /** true ⇒ every child is forced anomalous (a child may not opt out while this is true). */
  isAnomalous: boolean;
  notes: string | null;
};

/** Caller-supplied fields for a new compound; `id`/`accountId` are derived from its children. */
export type NewCompoundFields = {
  name: string;
  isCancelable: boolean;
  isAnomalous: boolean;
  notes: string | null;
  /** Owner month. `undefined` ⇒ default to the earliest child month; `null` ⇒ intentional no-owner. */
  ownerYear?: number | null;
  ownerMonth?: number | null;
};

/** A movement to create on the spot as a compound child (single-envelope, non-tentative, no split). */
export type NewCompoundChild = {
  name: string;
  concept: string | null;
  quantityCents: number;
  isPositive: boolean;
  date: Date;
  categoryId: number;
  envelopeIdMap: Map<number, number>;
  additionalNotes: string | null;
  isAnomalous?: boolean;
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
  accountId?: number;
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
  /** System-owned, backend-set-only. Labels which anomaly variant a computed summary reflects (true =
   *  all-inclusive, false = anomalies excluded) so the two variants are distinct cache keys. Callers of
   *  the movement/summary APIs must not set it — no query filters on it; it is stamped on results. */
  includeAnomalies?: boolean;
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

/** One period's slice of an on-the-fly filter summary: the all-inclusive figures, their
 *  anomaly-stripped mirror (`null` when the slice holds no anomalous movement, as the two coincide),
 *  and a display flag for tentative movements. Each `BasicSummary.filters` echoes the exact slice
 *  (month-snapped date + the `includeAnomalies` label) so it stands alone as a cache key. */
export type FilterSummaryEntry = {
  summary: BasicSummary;
  summaryWithoutAnomalies: BasicSummary | null;
  tentative: boolean;
};

/** Result of summarizing movements matching an arbitrary `MovementFilter` over a month-granular
 *  interval — computed on the fly, never stored. `aggregate` is the whole interval; `children` is one
 *  entry per month, chronological. Unlike `PeriodSummaryT` it carries no balance/transfer/budget
 *  fields (a filter slice is not a money pool). */
export type FilterSummaryT = {
  filters: MovementFilter; // the request as received (whole-interval cache key)
  aggregate: FilterSummaryEntry;
  children: FilterSummaryEntry[];
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
  /** The aggregates with compound-movement re-attribution applied (a compound's stats collapse into
   *  its owner month per D4/D6): children in non-owner months drop out, the owner month gains the
   *  compound's figure (a cancelable set's net, a grouping's individuals). `null` when no compound
   *  affects this period. Stats-only — the ending-balance chain uses the all-inclusive fields (D1). */
  summaryCompoundAdjusted: BasicSummary | null;
  /** `summaryCompoundAdjusted` with anomalous movements additionally excluded — the compound-adjusted
   *  "without anomalies" view. `null` together with `summaryCompoundAdjusted`. */
  summaryCompoundAdjustedWithoutAnomalies: BasicSummary | null;
};

export type PeriodT = {
  accountId: number;
  envelopeId: number | null; // null = account-level summary
  year: number;
  month: number;
};
