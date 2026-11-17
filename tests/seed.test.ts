import assert from "node:assert/strict"
import fs from "node:fs"
import { after, test } from "node:test"
import { authenticate } from "../src/lib/auth"
import { getRatings, listMovies, loadLeague } from "../src/lib/club"
import { closeDb } from "../src/lib/db"
import { seedDemo } from "../src/lib/seed"
import { prepareTestDb } from "./helpers.ts"

const dir = prepareTestDb()

after(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

test("the demo club replays into a conserved leaderboard", () => {
  seedDemo()
  assert.equal(authenticate("mira", "reel-night").isAdmin, true)
  assert.equal(authenticate("sam", "reel-night").name, "Sam")
  const movies = listMovies()
  const portrait = movies.find((movie) => movie.movie === "Portrait of a Lady on Fire")
  const waiting = movies.find((movie) => movie.movie === "In the Mood for Love")
  assert.equal(portrait?.suggesterName, "Jules")
  assert.equal(getRatings(portrait?.id ?? 0).length, 2)
  assert.equal(waiting?.ratingCount, 0)
  assert.ok(movies.filter((movie) => movie.ratingCount === 0).length >= 1)
  const { league, error } = loadLeague()
  assert.equal(error, null)
  assert.ok(league)
  assert.equal(league.history.length, 7)
  assert.equal(league.preview, null)
  assert.equal(league.history.at(-1)?.movie, "Portrait of a Lady on Fire")
  assert.ok(Math.abs(league.total_elo - 7500) < 1e-6)
  const elos = league.standings.map((row) => row.elo)
  assert.ok(Math.max(...elos) - Math.min(...elos) > 10)
})
