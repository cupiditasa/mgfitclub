-- Additive migration: never drops or rewrites existing users or financial tables.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('athlete','coach','manager','admin','secretary','support'))
);
CREATE TABLE IF NOT EXISTS login_challenges (
  id TEXT PRIMARY KEY, target TEXT NOT NULL, code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, delivery_status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL, consumed_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_target ON login_challenges(target,created_at DESC);
CREATE TABLE IF NOT EXISTS api_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS api_operations (
  key TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), fingerprint TEXT NOT NULL, resource_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entry_requests (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','exited')),
  reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, exited_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_entry ON entry_requests(user_id) WHERE status IN ('pending','approved');
CREATE TABLE IF NOT EXISTS coach_programs (
  id TEXT PRIMARY KEY, coach_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('training','food')), body TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS coach_program_owner ON coach_programs(coach_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS club_messages (
  id TEXT PRIMARY KEY, sender_id TEXT NOT NULL REFERENCES users(id), recipient_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS messages_recipient ON club_messages(recipient_id,created_at DESC);
