-- New tables only. No auth, attendance, payment, or old program rows are changed.
CREATE TABLE IF NOT EXISTS education_categories (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, axis TEXT NOT NULL CHECK(axis IN ('muscle','style')),
 sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(axis,name)
);
CREATE TABLE IF NOT EXISTS education_exercises (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE,
 english_name TEXT NOT NULL DEFAULT '', muscle_id TEXT NOT NULL REFERENCES education_categories(id),
 style_id TEXT NOT NULL REFERENCES education_categories(id), created_by TEXT REFERENCES users(id),
 source TEXT NOT NULL DEFAULT 'coach', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS education_videos (
 id TEXT PRIMARY KEY, exercise_id TEXT NOT NULL REFERENCES education_exercises(id), coach_id TEXT NOT NULL REFERENCES users(id),
 title TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), UNIQUE(exercise_id,coach_id,url)
);
CREATE TABLE IF NOT EXISTS workout_templates (
 id TEXT PRIMARY KEY, coach_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 body_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, create_key TEXT NOT NULL,
 create_hash TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(coach_id,create_key)
);
CREATE TABLE IF NOT EXISTS workout_deliveries (
 id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES workout_templates(id), revision INTEGER NOT NULL,
 coach_id TEXT NOT NULL REFERENCES users(id), athlete_id TEXT NOT NULL REFERENCES users(id),
 club_id TEXT NOT NULL REFERENCES clubs(id), title TEXT NOT NULL, snapshot_json TEXT NOT NULL,
 coach_name TEXT NOT NULL, athlete_name TEXT NOT NULL, sent_at TEXT NOT NULL,
 request_key TEXT NOT NULL, UNIQUE(coach_id,request_key)
);
CREATE INDEX IF NOT EXISTS workout_owner ON workout_templates(coach_id,archived,updated_at);
CREATE INDEX IF NOT EXISTS workout_inbox ON workout_deliveries(athlete_id,sent_at);
CREATE INDEX IF NOT EXISTS workout_club_log ON workout_deliveries(club_id,sent_at);
CREATE TRIGGER IF NOT EXISTS workout_delivery_immutable BEFORE UPDATE ON workout_deliveries
BEGIN SELECT RAISE(ABORT,'delivered_workout_is_immutable'); END;
CREATE TRIGGER IF NOT EXISTS workout_delivery_no_delete BEFORE DELETE ON workout_deliveries
BEGIN SELECT RAISE(ABORT,'delivery_audit_must_be_preserved'); END;
