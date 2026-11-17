import assert from "node:assert/strict"
import fs from "node:fs"
import Database from "better-sqlite3"
import { after, test } from "node:test"
import { findUserByUsername } from "../src/lib/auth"
import { getMovie, getRatings, loadLeague, submitRating } from "../src/lib/club"
import { closeDb, getDb } from "../src/lib/db"
import { prepareTestDb } from "./helpers.ts"

const dir = prepareTestDb()
const file = process.env.CLUB_DB_PATH
if (!file) throw new Error("CLUB_DB_PATH missing")

after(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

function legacyClub(): void {
  const db = new Database(file)
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
      created_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE weeks (
      id INTEGER PRIMARY KEY,
      week_id TEXT NOT NULL UNIQUE,
      movie TEXT NOT NULL,
      suggester_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
      suggested_at TEXT NOT NULL,
      closed_at TEXT,
      note TEXT
    );
    CREATE TABLE ratings (
      id INTEGER PRIMARY KEY,
      week_row_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      experience REAL NOT NULL CHECK (experience >= 1 AND experience <= 10),
      quality REAL NOT NULL CHECK (quality >= 1 AND quality <= 10),
      updated_at TEXT NOT NULL,
      UNIQUE (week_row_id, user_id)
    );
  `)
  const insertUser = db.prepare(
    `INSERT INTO users (id, username, name, password_hash, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  insertUser.run(1, "ada", "Ada", "hash-ada", 1, "2026-01-01T00:00:00.000Z")
  insertUser.run(2, "bea", "Bea", "hash-bea", 0, "2026-01-01T00:00:00.000Z")
  insertUser.run(3, "cyo", "Cy", "hash-cy", 0, "2026-01-01T00:00:00.000Z")
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  ).run("session-ada", 1, "2027-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")

  const insertWeek = db.prepare(
    `INSERT INTO weeks (id, week_id, movie, suggester_id, status, suggested_at, closed_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  // week_id strings sort in the opposite order from the lock times.
  insertWeek.run(
    1,
    "2026-12-01",
    "Closed First",
    1,
    "closed",
    "2026-11-01T18:00:00.000Z",
    "2026-01-20T23:00:00.000Z",
    "keep me",
  )
  insertWeek.run(
    2,
    "2026-01-01",
    "Closed Second",
    2,
    "closed",
    "2026-11-02T18:00:00.000Z",
    "2026-02-20T23:00:00.000Z",
    null,
  )
  insertWeek.run(3, "2026-06-01", "Still Open", 3, "open", "2026-06-01T18:00:00.000Z", null, "partial")
  insertWeek.run(4, "2026-07-01", "Waiting", 1, "open", "2026-07-01T18:00:00.000Z", null, null)

  const insertRating = db.prepare(
    `INSERT INTO ratings (id, week_row_id, user_id, experience, quality, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  insertRating.run(1, 1, 2, 8, 7, "2026-01-10T00:00:00.000Z")
  insertRating.run(2, 1, 3, 6, 6, "2026-01-11T00:00:00.000Z")
  insertRating.run(3, 2, 1, 9, 9, "2026-02-10T00:00:00.000Z")
  insertRating.run(4, 2, 3, 5, 4, "2026-02-11T00:00:00.000Z")
  insertRating.run(5, 3, 1, 7, 8, "2026-06-02T00:00:00.000Z")
  db.close()
}

test("a weekly database migrates in place and replays by timestamp", () => {
  legacyClub()
  const db = getDb()
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'weeks'").get(), undefined)
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c, 3)
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM movies").get() as { c: number }).c, 4)
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM ratings").get() as { c: number }).c, 5)
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c, 1)

  const ada = findUserByUsername("ada")
  assert.equal(ada?.name, "Ada")
  assert.equal(ada?.is_admin, 1)
  assert.equal(ada?.password_hash, "hash-ada")
  assert.equal(findUserByUsername("bea")?.password_hash, "hash-bea")

  const first = getMovie(1)
  const second = getMovie(2)
  const open = getMovie(3)
  const waiting = getMovie(4)
  assert.equal(first?.movie, "Closed First")
  assert.equal(first?.note, "keep me")
  assert.equal(first?.suggesterName, "Ada")
  assert.equal(first?.rankedAt, "2026-01-20T23:00:00.000Z")
  assert.equal(first?.ratingCount, 2)
  assert.equal(second?.rankedAt, "2026-02-20T23:00:00.000Z")
  assert.equal(open?.rankedAt, "2026-06-02T00:00:00.000Z")
  assert.equal(open?.ratingCount, 1)
  assert.equal(waiting?.rankedAt, null)
  assert.equal(waiting?.ratingCount, 0)

  const kept = getRatings(1).find((rating) => rating.name === "Bea")
  assert.equal(kept?.experience, 8)
  assert.equal(kept?.quality, 7)
  assert.equal(kept?.createdAt, "2026-01-10T00:00:00.000Z")
  assert.equal(kept?.updatedAt, "2026-01-10T00:00:00.000Z")

  const league = loadLeague().league
  assert.ok(league)
  assert.deepEqual(
    league.history.map((event) => event.movie),
    ["Closed First", "Closed Second", "Still Open"],
  )
  assert.ok(Math.abs(league.total_elo - 4500) < 1e-6)

  closeDb()
  const again = getDb()
  assert.equal((again.prepare("SELECT COUNT(*) AS c FROM movies").get() as { c: number }).c, 4)
  assert.equal((again.prepare("SELECT COUNT(*) AS c FROM ratings").get() as { c: number }).c, 5)
  assert.equal((again.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c, 3)
  assert.equal(getMovie(1)?.rankedAt, "2026-01-20T23:00:00.000Z")
  assert.equal(again.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'weeks'").get(), undefined)

  submitRating(2, 4, 6, 6, { at: "2026-08-01T00:00:00.000Z" })
  const after = loadLeague().league
  assert.deepEqual(
    after?.history.map((event) => event.movie),
    ["Closed First", "Closed Second", "Still Open", "Waiting"],
  )
  assert.equal(getMovie(1)?.rankedAt, "2026-01-20T23:00:00.000Z")
  assert.equal(getRatings(1).length, 2)
})
