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
  starting_balance INTEGER NOT NULL DEFAULT 0
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
  envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  additional_notes TEXT
`;

export const PeriodSummarySchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  envelope_id INTEGER REFERENCES envelopes(id) ON DELETE SET NULL,
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
  ending_balance_cents INTEGER NOT NULL CHECK(ending_balance_cents >= 0),
  budget_cents INTEGER,
  notes TEXT,
  dirty_state TEXT NOT NULL DEFAULT 'CLEAN' CHECK(dirty_state IN ('CLEAN', 'MODIFIED', 'DIRTY'))
`;

export const MovementTagSchema = `
  movement_id INTEGER NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (movement_id, tag_id)
`;
