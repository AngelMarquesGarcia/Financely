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
  envelopeId: number;
  additionalNotes: string | null;
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
};

export type PeriodT = {
  accountId: number;
  envelopeId: number | null; // null = account-level summary
  year: number;
  month: number;
};
