-- Additive and re-runnable. Existing personal/financial records are preserved.
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, manager_name TEXT NOT NULL,
  manager_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS club_login_phones (
  phone TEXT PRIMARY KEY, club_id TEXT NOT NULL REFERENCES clubs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS account_access (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('athlete','coach','secretary','manager','support')),
  club_id TEXT REFERENCES clubs(id),
  state TEXT NOT NULL CHECK(state IN ('approved','pending','rejected')),
  reviewed_by TEXT REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  role TEXT NOT NULL CHECK(role IN ('coach','secretary')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','cancelled')),
  reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_role_request ON access_requests(user_id) WHERE state='pending';
CREATE INDEX IF NOT EXISTS club_pending_access ON access_requests(club_id,state,created_at);
CREATE TABLE IF NOT EXISTS login_intents (
  challenge_id TEXT PRIMARY KEY REFERENCES login_challenges(id),
  requested_role TEXT NOT NULL, club_id TEXT REFERENCES clubs(id)
);
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '',
  avatar_data TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
