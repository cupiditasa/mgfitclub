-- Additive identity mapping only: never alters biometric templates, payments or attendance.
CREATE TABLE IF NOT EXISTS device_registry (
 serial TEXT PRIMARY KEY,
 club_id TEXT NOT NULL REFERENCES clubs(id)
);
CREATE TABLE IF NOT EXISTS device_verification_bridges (
 id TEXT PRIMARY KEY,
 device_serial TEXT NOT NULL REFERENCES device_registry(serial),
 token_hash TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL REFERENCES users(id),
 expires_at TEXT NOT NULL,
 revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS device_registrations (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 club_id TEXT NOT NULL REFERENCES clubs(id),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('unregistered','pending','verified')),
 device_serial TEXT REFERENCES device_registry(serial),
 member_id TEXT,
 requested_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 verified_at TEXT,
 verified_by_bridge TEXT REFERENCES device_verification_bridges(id),
 event_hash TEXT,
 claim_hash TEXT,
 claim_bridge_id TEXT REFERENCES device_verification_bridges(id),
 claim_started_at TEXT,
 claim_expires_at TEXT,
 last_error TEXT,
 UNIQUE(user_id,club_id),
 CHECK(state!='verified' OR (device_serial IS NOT NULL AND member_id IS NOT NULL AND verified_at IS NOT NULL AND verified_by_bridge IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS device_member_unique ON device_registrations(device_serial,member_id) WHERE state='verified';
CREATE INDEX IF NOT EXISTS device_pending_club ON device_registrations(club_id,state,requested_at);
CREATE TRIGGER IF NOT EXISTS device_mapping_guard BEFORE UPDATE ON device_registrations
WHEN NEW.state='verified' AND NOT EXISTS (
 SELECT 1 FROM users u JOIN device_registry d ON d.serial=NEW.device_serial
 JOIN device_verification_bridges b ON b.id=NEW.verified_by_bridge AND b.device_serial=d.serial
 WHERE u.id=NEW.user_id AND u.status='active' AND u.phone IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM clubs c WHERE c.manager_user_id=u.id)
 AND d.club_id=NEW.club_id AND b.revoked_at IS NULL AND b.expires_at>NEW.verified_at
)
BEGIN SELECT RAISE(ABORT,'invalid_device_mapping'); END;
