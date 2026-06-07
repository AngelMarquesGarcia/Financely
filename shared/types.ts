export type Movement = {
  id: number;
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

export type Category = {
  id: number;
  name: string;
  color?: string;
  emoji?: string;
  envelopeId: number | null;
  isDefault: boolean;
  movementCount?: number;
};

export type Account = {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
};

/** Aggregate stats across all accounts. All amounts in integer cents. */
export type AccountStats = {
  totalIncomeCents: number;
  totalExpenseCents: number;
  balanceCents: number;
  envelopeCount: number;
};

export type Envelope = {
  id: number;
  name: string;
  accountId: number | null;
  isDefault: boolean;
};

export type Tag = {
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
