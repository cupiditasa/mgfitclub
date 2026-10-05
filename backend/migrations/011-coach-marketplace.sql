-- Coach order switches, public profiles and club-scoped service requests.
-- Additive only: existing templates, users and delivery snapshots are preserved.
CREATE TABLE IF NOT EXISTS coach_offerings (
 coach_id TEXT PRIMARY KEY REFERENCES users(id),
 workout_enabled INTEGER NOT NULL DEFAULT 0 CHECK(workout_enabled IN (0,1)),
 nutrition_enabled INTEGER NOT NULL DEFAULT 0 CHECK(nutrition_enabled IN (0,1)),
 in_person_enabled INTEGER NOT NULL DEFAULT 0 CHECK(in_person_enabled IN (0,1)),
 workout_packages_json TEXT NOT NULL DEFAULT '[]',
 in_person_packages_json TEXT NOT NULL DEFAULT '[]',
 specialty TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
 hero_image TEXT,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coach_service_requests (
 id TEXT PRIMARY KEY,
 request_key TEXT NOT NULL,
 club_id TEXT NOT NULL REFERENCES clubs(id),
 coach_id TEXT NOT NULL REFERENCES users(id),
 athlete_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('workout','nutrition','in_person')),
 package_id TEXT, package_name TEXT, package_price INTEGER,
 notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed')),
 reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT,
 completed_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(athlete_id,request_key)
);
CREATE INDEX IF NOT EXISTS coach_request_inbox ON coach_service_requests(coach_id,kind,status,created_at DESC);
CREATE INDEX IF NOT EXISTS club_request_log ON coach_service_requests(club_id,created_at DESC);
CREATE INDEX IF NOT EXISTS athlete_request_history ON coach_service_requests(athlete_id,created_at DESC);
