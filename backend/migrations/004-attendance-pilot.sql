-- Opt-in pilot only. No existing plans, orders, payments or attendance are modified.
CREATE TABLE IF NOT EXISTS attendance_trials (
 id TEXT PRIMARY KEY,
 request_key TEXT NOT NULL UNIQUE,
 user_id TEXT NOT NULL REFERENCES users(id),
 club_id TEXT NOT NULL REFERENCES clubs(id),
 device_serial TEXT NOT NULL,
 device_member_id TEXT NOT NULL,
 starts_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 total_sessions INTEGER NOT NULL DEFAULT 30 CHECK(total_sessions=30),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 token_hash TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 CHECK(expires_at>starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trial_member ON attendance_trials(club_id,device_serial,device_member_id) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trial_account ON attendance_trials(club_id,user_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS attendance_trial_consumptions (
 id TEXT PRIMARY KEY,
 trial_id TEXT NOT NULL REFERENCES attendance_trials(id),
 event_hash TEXT NOT NULL,
 business_day TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 confirmed_at TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source='operator_confirmed_device_pilot'),
 UNIQUE(trial_id,event_hash),
 UNIQUE(trial_id,business_day)
);
CREATE TRIGGER IF NOT EXISTS trial_consumption_guard BEFORE INSERT ON attendance_trial_consumptions
WHEN NOT EXISTS (
 SELECT 1 FROM attendance_trials t JOIN users u ON u.id=t.user_id
 WHERE t.id=NEW.trial_id AND t.status='active' AND u.status='active'
 AND NEW.occurred_at>=t.starts_at AND NEW.occurred_at<t.expires_at
 AND NEW.confirmed_at>=t.starts_at AND NEW.confirmed_at<t.expires_at
 AND (SELECT COUNT(*) FROM attendance_trial_consumptions c WHERE c.trial_id=t.id)<t.total_sessions
)
BEGIN SELECT RAISE(ABORT,'trial_inactive_or_exhausted'); END;
