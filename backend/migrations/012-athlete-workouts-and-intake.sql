-- Add athlete-owned education-studio plans and required workout-order intake.
-- Additive only; existing templates, immutable deliveries and requests are preserved.
ALTER TABLE coach_service_requests ADD COLUMN height_cm INTEGER;
ALTER TABLE coach_service_requests ADD COLUMN weight_kg REAL;
ALTER TABLE coach_service_requests ADD COLUMN goal TEXT;
ALTER TABLE coach_service_requests ADD COLUMN photo_data TEXT;

CREATE TABLE IF NOT EXISTS athlete_saved_workouts (
 id TEXT PRIMARY KEY,
 athlete_id TEXT NOT NULL REFERENCES users(id),
 request_key TEXT NOT NULL,
 title TEXT NOT NULL,
 focus TEXT NOT NULL,
 goal TEXT NOT NULL,
 body_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(athlete_id,request_key)
);
CREATE INDEX IF NOT EXISTS athlete_saved_workout_owner
 ON athlete_saved_workouts(athlete_id,created_at DESC);
