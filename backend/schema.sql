CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_key TEXT,
  role TEXT NOT NULL DEFAULT 'athlete' CHECK (role IN ('athlete','coach','manager','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','pending')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE auth_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  target TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('phone','email')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE membership_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  price INTEGER NOT NULL CHECK (price >= 0),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE training_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'normal',
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0),
  turnaround_days INTEGER NOT NULL DEFAULT 3,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('membership','training')),
  item_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','completed','cancelled','failed')),
  payment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE membership_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  birth_date TEXT,
  national_id TEXT,
  emergency_phone TEXT,
  notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
);

CREATE TABLE training_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  coach_id TEXT,
  height_cm REAL,
  weight_kg REAL,
  goal TEXT,
  experience_level TEXT,
  injuries TEXT,
  availability TEXT,
  notes TEXT,
  photo_key TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','assigned','in_progress','completed','rejected')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES training_plans(id),
  FOREIGN KEY (coach_id) REFERENCES users(id)
);

CREATE TABLE training_deliverables (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  file_key TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES training_requests(id),
  FOREIGN KEY (coach_id) REFERENCES users(id)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  authority TEXT,
  ref_id TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated',
  raw_result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE test_accounts (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('athlete','coach','manager','admin')),
  user_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

