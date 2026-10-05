-- Isolated, opt-in bridge v2. No legacy accounting, payment or biometric writes.
CREATE TABLE IF NOT EXISTS mg_bridges (
 id TEXT PRIMARY KEY, club_id TEXT NOT NULL REFERENCES clubs(id), serial TEXT NOT NULL UNIQUE,
 address TEXT NOT NULL, pairing_code TEXT NOT NULL UNIQUE, pairing_expires TEXT NOT NULL,
 token_hash TEXT UNIQUE, created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL, revoked_at TEXT, last_seen TEXT, device_status TEXT,
 capture_since TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mg_bridge_members (
 bridge_id TEXT NOT NULL REFERENCES mg_bridges(id), member_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id), confirmed_by TEXT NOT NULL REFERENCES users(id),
 confirmed_at TEXT NOT NULL, PRIMARY KEY(bridge_id,member_id), UNIQUE(bridge_id,user_id)
);
CREATE TABLE IF NOT EXISTS mg_bridge_events (
 id TEXT PRIMARY KEY, bridge_id TEXT NOT NULL REFERENCES mg_bridges(id), member_id TEXT NOT NULL,
 occurred_at TEXT NOT NULL, business_day TEXT NOT NULL, raw_json TEXT NOT NULL,
 created_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT,
 UNIQUE(bridge_id,member_id,occurred_at,raw_json)
);
CREATE INDEX IF NOT EXISTS mg_bridge_events_recent ON mg_bridge_events(bridge_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS mg_bridge_trials (
 id TEXT PRIMARY KEY, bridge_id TEXT NOT NULL REFERENCES mg_bridges(id), user_id TEXT NOT NULL REFERENCES users(id),
 starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, sessions INTEGER NOT NULL CHECK(sessions=30),
 created_by TEXT NOT NULL REFERENCES users(id), UNIQUE(bridge_id,user_id)
);
CREATE TABLE IF NOT EXISTS mg_bridge_visits (
 id TEXT PRIMARY KEY, trial_id TEXT NOT NULL REFERENCES mg_bridge_trials(id),
 event_id TEXT NOT NULL UNIQUE REFERENCES mg_bridge_events(id), business_day TEXT NOT NULL,
 created_at TEXT NOT NULL, UNIQUE(trial_id,business_day)
);
CREATE TRIGGER IF NOT EXISTS mg_bridge_visit_guard BEFORE INSERT ON mg_bridge_visits
WHEN NOT EXISTS (
 SELECT 1 FROM mg_bridge_trials t JOIN mg_bridge_events e ON e.id=NEW.event_id
 JOIN mg_bridge_members m ON m.bridge_id=e.bridge_id AND m.member_id=e.member_id AND m.user_id=t.user_id
 JOIN users u ON u.id=m.user_id
 WHERE t.id=NEW.trial_id AND t.bridge_id=e.bridge_id AND e.state='approved'
 AND e.business_day=NEW.business_day AND u.status='active'
 AND e.occurred_at>=t.starts_at AND e.occurred_at<t.expires_at
 AND (SELECT count(*) FROM mg_bridge_visits v WHERE v.trial_id=t.id)<t.sessions
)
BEGIN SELECT RAISE(ABORT,'visit_not_allowed'); END;
