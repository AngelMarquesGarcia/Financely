export const AccountSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  starting_balance INTEGER NOT NULL DEFAULT 0
`;

export const TagSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  UNIQUE(type, name)
`;

export const EnvelopeSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  is_default INTEGER NOT NULL DEFAULT 0,
  starting_balance INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER,
  max_savings_cents INTEGER,
  overflows_to INTEGER REFERENCES envelopes(id) ON DELETE SET NULL
`;

export const CategorySchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  emoji TEXT,
  envelope_id INTEGER REFERENCES envelopes(id) ON DELETE SET NULL,
  is_default INTEGER NOT NULL DEFAULT 0
`;

export const MovementSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL,
  concept TEXT,
  quantity_cents INTEGER NOT NULL,
  isPositive INTEGER NOT NULL,
  date TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  additional_notes TEXT,
  template_id INTEGER REFERENCES periodic_movements(id) ON DELETE SET NULL,
  is_tentative INTEGER NOT NULL DEFAULT 0,
  is_anomalous INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER REFERENCES compound_movements(id) ON DELETE SET NULL
`;

/** A lightweight compound grouping its member movements (which reference it via `parent_id`). All
 *  members share `account_id`; a cancelable compound additionally shares one envelope (enforced in
 *  the service). `owner_year`/`owner_month` are null-together (null owner ⇒ no stats re-attribution). */
export const CompoundMovementSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_cancelable INTEGER NOT NULL DEFAULT 0,
  owner_year INTEGER,
  owner_month INTEGER CHECK(owner_month IS NULL OR (owner_month >= 0 AND owner_month <= 11)),
  is_anomalous INTEGER NOT NULL DEFAULT 0,
  notes TEXT
`;

/** Per-envelope allocation for a movement. Every movement has ≥1 row; a split has several. The
 *  amounts sum to the movement's quantity_cents (enforced in the service, not the schema). */
export const MovementEnvelopeSchema = `
  movement_id INTEGER NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  PRIMARY KEY (movement_id, envelope_id)
`;

export const PeriodicMovementSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  concept TEXT,
  quantity_cents INTEGER NOT NULL,
  isPositive INTEGER NOT NULL,
  day_of_month INTEGER NOT NULL CHECK(day_of_month >= 1 AND day_of_month <= 31),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  additional_notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  start_year INTEGER NOT NULL,
  start_month INTEGER NOT NULL CHECK(start_month >= 0 AND start_month <= 11),
  last_created_year INTEGER,
  last_created_month INTEGER CHECK(last_created_month IS NULL OR (last_created_month >= 0 AND last_created_month <= 11))
`;

export const PeriodicMovementTagSchema = `
  periodic_movement_id INTEGER NOT NULL REFERENCES periodic_movements(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (periodic_movement_id, tag_id)
`;

/** Per-envelope allocation for a periodic template — the default split copied onto each instance. */
export const PeriodicMovementEnvelopeSchema = `
  periodic_movement_id INTEGER NOT NULL REFERENCES periodic_movements(id) ON DELETE CASCADE,
  envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  PRIMARY KEY (periodic_movement_id, envelope_id)
`;

export const TransferSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  to_envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity_cents INTEGER NOT NULL CHECK(quantity_cents > 0),
  date TEXT NOT NULL,
  is_auto INTEGER NOT NULL DEFAULT 0,
  notes TEXT
`;

export const PeriodSummarySchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  envelope_id INTEGER REFERENCES envelopes(id) ON DELETE CASCADE,
  envelope_name TEXT,
  year INTEGER NOT NULL CHECK(year >= 1970),
  month INTEGER NOT NULL CHECK(month >= 0 AND month <= 11),
  cash_flow_cents INTEGER NOT NULL,
  total_income_cents INTEGER NOT NULL CHECK(total_income_cents >= 0),
  total_expense_cents INTEGER NOT NULL CHECK(total_expense_cents >= 0),
  avg_expense_cents INTEGER NOT NULL CHECK(avg_expense_cents >= 0),
  avg_income_cents INTEGER NOT NULL CHECK(avg_income_cents >= 0),
  avg_movement_amount_cents INTEGER NOT NULL CHECK(avg_movement_amount_cents >= 0),
  movement_count INTEGER NOT NULL DEFAULT 0 CHECK(movement_count >= 0),
  ending_balance_cents INTEGER NOT NULL,
  net_transfers_cents INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER,
  max_savings_cents INTEGER,
  notes TEXT,
  dirty_state TEXT NOT NULL DEFAULT 'CLEAN' CHECK(dirty_state IN ('CLEAN', 'MODIFIED', 'DIRTY')),
  tentative INTEGER NOT NULL DEFAULT 0,
  without_anom_cash_flow_cents INTEGER,
  without_anom_total_income_cents INTEGER,
  without_anom_total_expense_cents INTEGER,
  without_anom_avg_expense_cents INTEGER,
  without_anom_avg_income_cents INTEGER,
  without_anom_avg_movement_amount_cents INTEGER,
  without_anom_movement_count INTEGER,
  compound_adj_cash_flow_cents INTEGER,
  compound_adj_total_income_cents INTEGER,
  compound_adj_total_expense_cents INTEGER,
  compound_adj_avg_expense_cents INTEGER,
  compound_adj_avg_income_cents INTEGER,
  compound_adj_avg_movement_amount_cents INTEGER,
  compound_adj_movement_count INTEGER,
  compound_adj_wo_anom_cash_flow_cents INTEGER,
  compound_adj_wo_anom_total_income_cents INTEGER,
  compound_adj_wo_anom_total_expense_cents INTEGER,
  compound_adj_wo_anom_avg_expense_cents INTEGER,
  compound_adj_wo_anom_avg_income_cents INTEGER,
  compound_adj_wo_anom_avg_movement_amount_cents INTEGER,
  compound_adj_wo_anom_movement_count INTEGER
`;

export const MovementTagSchema = `
  movement_id INTEGER NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (movement_id, tag_id)
`;
