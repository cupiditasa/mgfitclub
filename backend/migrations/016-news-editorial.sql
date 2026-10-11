CREATE TABLE IF NOT EXISTS news_editorial_articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  article_body TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '[]',
  source_refs TEXT NOT NULL DEFAULT '[]',
  image_url TEXT,
  image_alt TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT 'تحریریه MG FitClub',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_news_editorial_published
  ON news_editorial_articles(status, published_at DESC);
