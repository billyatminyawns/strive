-- STRIVE API v1 — D1 schema (binding DB, database strive-db). Safe to re-apply.
--   npx wrangler d1 execute strive-db --remote --file schema.sql
-- Every tenant-scoped row carries athlete_id. Timestamps are ms since epoch.
-- v1.1 (10/1/26, Coach Angela brain) added athletes.autopilot, questions.answered_by/note/sources/
-- confidence/reason/reviewed and draft_source 'coach'. CREATE IF NOT EXISTS won't add them to an older
-- database (and SQLite can't alter a CHECK): production D1 is created fresh from this file by go-live.sh.

CREATE TABLE IF NOT EXISTS athletes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  coach_name    TEXT NOT NULL,
  headline      TEXT NOT NULL DEFAULT '',
  sport         TEXT NOT NULL DEFAULT '',
  photo_url     TEXT,
  hero_url      TEXT,
  badges        TEXT NOT NULL DEFAULT '[]',                -- JSON array of strings
  bio_text      TEXT NOT NULL DEFAULT '',
  bio_status    TEXT NOT NULL DEFAULT 'draft' CHECK (bio_status IN ('draft', 'approved')),
  bio_audio_key TEXT,
  bio_duration  REAL,
  paused        INTEGER NOT NULL DEFAULT 0,
  guard_topics  INTEGER NOT NULL DEFAULT 1,
  guard_decline INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  autopilot     INTEGER NOT NULL DEFAULT 0                 -- her own switch: Coach Angela may answer on its own
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT PRIMARY KEY,                             -- stored uppercase
  athlete_id TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  athlete_id     TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('fan', 'athlete')),
  name           TEXT,
  interests      TEXT NOT NULL DEFAULT '[]',               -- JSON array of strings
  notifs_read_at INTEGER NOT NULL DEFAULT 0,               -- notifications at or before this are read
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_athlete ON users (athlete_id, role, created_at);

-- Bearer tokens are never stored — only their SHA-256.
CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens (user_id);

CREATE TABLE IF NOT EXISTS questions (
  id           TEXT PRIMARY KEY,
  athlete_id   TEXT NOT NULL,
  user_id      TEXT,                                       -- NULL for starter questions
  kind         TEXT NOT NULL CHECK (kind IN ('fan', 'starter')),
  text         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'answered', 'instant', 'guarded', 'declined')),
  answer       TEXT,
  audio_key    TEXT,
  duration     REAL,
  draft        TEXT NOT NULL DEFAULT '',
  draft_source TEXT NOT NULL DEFAULT 'none' CHECK (draft_source IN ('claude', 'coach', 'starter', 'none')),
  drafting     INTEGER NOT NULL DEFAULT 0,
  drafting_at  INTEGER,
  kb_keys      TEXT NOT NULL DEFAULT '[]',                 -- key phrases carried into the library on approval
  kb_id        TEXT,                                       -- library entry an instant reply came from
  saved        INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  answered_at  INTEGER,
  answered_by  TEXT CHECK (answered_by IN ('angela', 'library', 'coach')),   -- NULL while unanswered
  note         TEXT,                                       -- fan-facing note replacing the status default (crisis, brain decline, retract)
  sources      TEXT NOT NULL DEFAULT '[]',                 -- JSON [{id, title, outlet, date, url}] the brain cited
  confidence   REAL,                                       -- the brain's 0–1 confidence; NULL if it never ran
  reason       TEXT,                                       -- the brain's one-line reason (why it needs Angela)
  reviewed     INTEGER NOT NULL DEFAULT 0                  -- an autopilot answer Angela kept
);
CREATE INDEX IF NOT EXISTS questions_user ON questions (user_id, created_at);
CREATE INDEX IF NOT EXISTS questions_queue ON questions (athlete_id, status, created_at);

-- The instant-answer library: approved Q&As that can be replayed to any fan.
CREATE TABLE IF NOT EXISTS kb (
  id                 TEXT PRIMARY KEY,
  athlete_id         TEXT NOT NULL,
  question           TEXT NOT NULL,
  answer             TEXT NOT NULL,
  keys               TEXT NOT NULL DEFAULT '[]',          -- JSON array of key phrases (whole-token match)
  audio_key          TEXT,
  duration           REAL,
  source_question_id TEXT,
  created_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS kb_athlete ON kb (athlete_id, created_at);
CREATE INDEX IF NOT EXISTS kb_source ON kb (source_question_id);

CREATE TABLE IF NOT EXISTS drops (
  id           TEXT PRIMARY KEY,
  athlete_id   TEXT NOT NULL,
  title        TEXT NOT NULL,
  script       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('draft', 'queued', 'published', 'rejected')),
  source       TEXT NOT NULL DEFAULT '',
  audio_key    TEXT,
  duration     REAL,
  published_at INTEGER,
  queue_pos    INTEGER,                                    -- ever-increasing; the API reports the rank
  pinned       INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS drops_athlete ON drops (athlete_id, status, published_at);

CREATE TABLE IF NOT EXISTS listens (
  drop_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (drop_id, user_id)
);
CREATE INDEX IF NOT EXISTS listens_athlete ON listens (athlete_id, created_at);
CREATE INDEX IF NOT EXISTS listens_user ON listens (user_id);

CREATE TABLE IF NOT EXISTS stories (
  id         TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  prompt_id  TEXT,
  title      TEXT NOT NULL,
  transcript TEXT NOT NULL DEFAULT '',
  duration   REAL,
  audio_key  TEXT,                                         -- KV key of the uploaded m4a, if any
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS stories_athlete ON stories (athlete_id, created_at);

-- Curated capture prompts. Live "FANS ARE ASKING" prompts and "free" are built per request.
CREATE TABLE IF NOT EXISTS prompts (
  id         TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  title      TEXT NOT NULL,
  src        TEXT NOT NULL,
  hint       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (athlete_id, id)
);

CREATE TABLE IF NOT EXISTS passed_prompts (
  athlete_id TEXT NOT NULL,
  prompt_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (athlete_id, prompt_id)
);

-- user_id NULL = broadcast to every fan of athlete_id (one row per drop, not one per fan).
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  user_id    TEXT,
  text       TEXT NOT NULL,
  sub        TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT 'home',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_athlete ON notifications (athlete_id, created_at);

CREATE TABLE IF NOT EXISTS devices (
  token        TEXT PRIMARY KEY,                           -- APNs device token (hex)
  user_id      TEXT NOT NULL,
  athlete_id   TEXT NOT NULL,
  env          TEXT NOT NULL CHECK (env IN ('sandbox', 'production')),
  session_hash TEXT,                                       -- bearer token that registered it; signout drops it
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_user ON devices (user_id);
CREATE INDEX IF NOT EXISTS devices_athlete ON devices (athlete_id);
CREATE INDEX IF NOT EXISTS devices_session ON devices (session_hash);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
