import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

const globalForDb = globalThis as unknown as {
  __reelDb?: Database.Database
  __reelDbPath?: string
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY,
  week_id TEXT NOT NULL UNIQUE,
  movie TEXT NOT NULL,
  suggester_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  suggested_at TEXT NOT NULL,
  closed_at TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS weeks_status ON weeks(status);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY,
  week_row_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  experience REAL NOT NULL CHECK (experience >= 1 AND experience <= 10),
  quality REAL NOT NULL CHECK (quality >= 1 AND quality <= 10),
  updated_at TEXT NOT NULL,
  UNIQUE (week_row_id, user_id)
);
`

export function dbPath(): string {
  return process.env.CLUB_DB_PATH ?? path.join(process.cwd(), "data", "club.db")
}

export function getDb(): Database.Database {
  const file = dbPath()
  if (globalForDb.__reelDb && globalForDb.__reelDbPath !== file) {
    globalForDb.__reelDb.close()
    globalForDb.__reelDb = undefined
  }
  if (!globalForDb.__reelDb) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const db = new Database(file)
    db.pragma("journal_mode = WAL")
    db.pragma("foreign_keys = ON")
    db.pragma("busy_timeout = 3000")
    db.exec(SCHEMA)
    globalForDb.__reelDb = db
    globalForDb.__reelDbPath = file
  }
  return globalForDb.__reelDb
}

export function closeDb(): void {
  globalForDb.__reelDb?.close()
  globalForDb.__reelDb = undefined
  globalForDb.__reelDbPath = undefined
}
