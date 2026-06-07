export const AccountSchema = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0
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
  is_default INTEGER NOT NULL DEFAULT 0
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
  name TEXT NOT NULL,
  concept TEXT,
  quantity_cents INTEGER NOT NULL,
  isPositive INTEGER NOT NULL,
  date TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  additional_notes TEXT
`;

export const MovementTagSchema = `
  movement_id INTEGER NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (movement_id, tag_id)
`;
