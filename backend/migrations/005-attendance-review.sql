-- Raw pilot observations are not attendance charges. Only explicit review consumes.
CREATE TABLE IF NOT EXISTS attendance_trial_observations (
 id TEXT PRIMARY KEY,
 trial_id TEXT NOT NULL REFERENCES attendance_trials(id),
 event_hash TEXT NOT NULL,
 event_json TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(trial_id,event_hash)
);
