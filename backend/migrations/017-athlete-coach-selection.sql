-- Persist the athlete's chosen coach for dashboard messaging.
-- Additive only; existing messages and requests are preserved.
CREATE TABLE IF NOT EXISTS athlete_coach_selections (
  athlete_id TEXT PRIMARY KEY REFERENCES users(id),
  coach_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  selected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS athlete_coach_selection_club ON athlete_coach_selections(club_id,coach_id);

-- Preserve the coach an athlete already chose through a service request.
INSERT OR IGNORE INTO athlete_coach_selections(athlete_id,coach_id,club_id,selected_at)
SELECT r.athlete_id,r.coach_id,r.club_id,r.updated_at
FROM coach_service_requests r
WHERE NOT EXISTS (
  SELECT 1 FROM coach_service_requests newer
  WHERE newer.athlete_id=r.athlete_id
    AND (newer.updated_at>r.updated_at OR (newer.updated_at=r.updated_at AND newer.id>r.id))
);
