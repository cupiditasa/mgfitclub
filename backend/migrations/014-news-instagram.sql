ALTER TABLE news_settings ADD COLUMN instagram_rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (instagram_rights_confirmed IN (0,1));

CREATE TABLE IF NOT EXISTS news_instagram_connections (
  id TEXT PRIMARY KEY CHECK (id='global'),
  ig_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS news_instagram_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_instagram_oauth_expires ON news_instagram_oauth_states(expires_at);
