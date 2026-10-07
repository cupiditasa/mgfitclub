CREATE TABLE IF NOT EXISTS news_settings (
  id TEXT PRIMARY KEY CHECK (id = 'global'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  interval_hours INTEGER NOT NULL DEFAULT 4 CHECK (interval_hours IN (2,3,4,6,12)),
  instagram_auto_publish INTEGER NOT NULL DEFAULT 0 CHECK (instagram_auto_publish IN (0,1)),
  last_sync_at INTEGER,
  last_sync_status TEXT NOT NULL DEFAULT 'never',
  last_sync_error TEXT,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO news_settings (id, enabled, interval_hours, instagram_auto_publish, updated_at)
VALUES ('global', 1, 4, 0, unixepoch());

CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL UNIQUE,
  source_key TEXT NOT NULL,
  source_name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT NOT NULL,
  summary TEXT NOT NULL,
  original_summary TEXT NOT NULL,
  image_url TEXT,
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  instagram_status TEXT NOT NULL DEFAULT 'disabled',
  instagram_media_id TEXT,
  instagram_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items(published_at DESC);
