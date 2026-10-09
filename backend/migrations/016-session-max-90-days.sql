-- Extend currently valid, unrevoked sessions to no more than 90 days from issuance.
-- Expired and revoked sessions remain untouched.
UPDATE sessions
SET expires_at = datetime(created_at, '+90 days')
WHERE revoked_at IS NULL
  AND datetime(expires_at) > datetime('now')
  AND datetime(expires_at) < datetime(created_at, '+90 days');
