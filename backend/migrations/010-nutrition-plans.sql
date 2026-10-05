-- Food plans are separate from exercise programs and use immutable send snapshots.
CREATE TABLE IF NOT EXISTS nutrition_templates (
 id TEXT PRIMARY KEY, coach_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 body_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, create_key TEXT NOT NULL,
 create_hash TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(coach_id,create_key)
);
CREATE TABLE IF NOT EXISTS nutrition_deliveries (
 id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES nutrition_templates(id), revision INTEGER NOT NULL,
 coach_id TEXT NOT NULL REFERENCES users(id), athlete_id TEXT NOT NULL REFERENCES users(id),
 club_id TEXT NOT NULL REFERENCES clubs(id), title TEXT NOT NULL, snapshot_json TEXT NOT NULL,
 coach_name TEXT NOT NULL, athlete_name TEXT NOT NULL, sent_at TEXT NOT NULL,
 request_key TEXT NOT NULL, UNIQUE(coach_id,request_key)
);
CREATE INDEX IF NOT EXISTS nutrition_owner ON nutrition_templates(coach_id,archived,updated_at);
CREATE INDEX IF NOT EXISTS nutrition_inbox ON nutrition_deliveries(athlete_id,sent_at);
CREATE INDEX IF NOT EXISTS nutrition_club_log ON nutrition_deliveries(club_id,sent_at);
CREATE TRIGGER IF NOT EXISTS nutrition_delivery_immutable BEFORE UPDATE ON nutrition_deliveries
BEGIN SELECT RAISE(ABORT,'delivered_nutrition_is_immutable'); END;
CREATE TRIGGER IF NOT EXISTS nutrition_delivery_no_delete BEFORE DELETE ON nutrition_deliveries
BEGIN SELECT RAISE(ABORT,'nutrition_delivery_audit_must_be_preserved'); END;
